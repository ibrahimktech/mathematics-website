/**
 * Live authorization / RLS audit for the exam platform.
 *
 * Creates two real students (A, B) via the Auth Admin API and, using their
 * actual JWTs against PostgREST + Storage, verifies the whole authorization
 * matrix: draft exams are hidden, question answers never leak, a student can
 * only ever create their OWN pending purchase (never self-approve, never grant
 * themselves access, never forge a score), receipts are private, settings are
 * read-only to students, and the admin allow-list can't be self-joined. Also
 * checks that the approval transition is race-safe, and that the 2-attempts-per-
 * exam limit holds against DIRECT API writes. Cleans everything up.
 *
 * Run (after applying supabase/exam-platform-schema.sql
 *      and  supabase/exam-attempt-limit.sql):
 *   node scripts/security-test.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- load env from .env.local -------------------------------------------------
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SR = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SR) {
  console.error("Missing Supabase env in .env.local");
  process.exit(1);
}

const admin = createClient(URL_, SR, { auth: { persistSession: false } });

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "✓ PASS" : "✗ FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function tableExists(t) {
  const { error } = await admin.from(t).select("*").limit(1);
  if (!error) return true;
  if (error.code === "42P01" || error.code === "PGRST205") return false;
  return true;
}

/**
 * A client acting as `email`, using the ANON key + that student's own JWT — so
 * every assertion below is judged by RLS exactly as it would be in the browser.
 *
 * The session is minted through a throwaway SERVICE-ROLE client rather than by
 * signing in with the anon key directly. Reason: with Cloudflare Turnstile
 * enabled (Authentication → Attack Protection), Supabase requires a captcha
 * token on the password grant, and a script cannot solve a challenge — but it
 * skips that check for callers presenting service-role credentials. Only the
 * sign-in transport changes; the tokens handed over are the student's.
 *
 * The bootstrap client MUST be a throwaway. Signing in on the shared `admin`
 * client would swap its Authorization header from the service-role key to the
 * student's JWT and quietly break every admin call after it.
 */
async function signedInClient(email, password) {
  const bootstrap = createClient(URL_, SR, { auth: { persistSession: false } });
  const { data, error } = await bootstrap.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  if (!data?.session) throw new Error(`no session returned for ${email}`);

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: sessionError } = await c.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) {
    throw new Error(`session hand-off failed for ${email}: ${sessionError.message}`);
  }
  return c;
}

const rand = Math.random().toString(36).slice(2, 8);
const A = { email: `sectest-a-${rand}@example.com`, password: "Passw0rd!123", id: "" };
const B = { email: `sectest-b-${rand}@example.com`, password: "Passw0rd!123", id: "" };

// 1x1 PNG (valid magic bytes) for the receipt-storage tests.
const PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f0e0000000049454e44ae426082",
  "hex",
);

const created = {
  examPub: null,
  examDraft: null,
  examFree: null,
  examLimit: null,
  examRace: null,
};

async function main() {
  console.log("\n=== Exam-platform authorization audit ===\n");

  if (!(await tableExists("exams"))) {
    console.error(
      "exams table MISSING — apply supabase/exam-platform-schema.sql first.\n",
    );
    process.exitCode = 1;
    return;
  }

  // Create A and B (email pre-confirmed).
  for (const u of [A, B]) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: {
        full_name: u === A ? "Student A" : "Student B",
        first_name: u === A ? "Student" : "Student",
        last_name: u === A ? "A" : "B",
      },
    });
    if (error) throw new Error(`create ${u.email}: ${error.message}`);
    u.id = data.user.id;
  }
  const aC = await signedInClient(A.email, A.password);
  const bC = await signedInClient(B.email, B.password);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  console.log(`Created A=${A.id.slice(0, 8)}… B=${B.id.slice(0, 8)}…\n`);

  // Seed exams (service role): a published paid exam + a draft + a free published.
  const mk = async (over) => {
    const { data, error } = await admin
      .from("exams")
      .insert({
        title: "SecTest Exam",
        slug: `sectest-${rand}-${Math.random().toString(36).slice(2, 7)}`,
        difficulty: "intermediate",
        price: 10,
        duration_minutes: 15,
        status: "published",
        ...over,
      })
      .select("id")
      .single();
    if (error) throw new Error(`seed exam: ${error.message}`);
    return data.id;
  };
  created.examPub = await mk({});
  created.examDraft = await mk({ status: "draft" });
  created.examFree = await mk({ price: 0 });
  // Two more free published exams, used only by the attempt-limit section so
  // its counts are not disturbed by the attempts other sections create.
  created.examLimit = await mk({ price: 0 });
  created.examRace = await mk({ price: 0 });

  // Questions for the published paid exam (with SECRET correct answers).
  await admin.from("exam_questions").insert([
    { exam_id: created.examPub, position: 0, prompt: "$1+1=?$", choices: ["$1$", "$2$", "$3$"], correct_index: 1 },
    { exam_id: created.examPub, position: 1, prompt: "$2\\cdot2=?$", choices: ["$3$", "$4$", "$5$"], correct_index: 1 },
  ]);

  // ------------------------------------------------------------------- exams --
  console.log("exams (catalogue visibility + write protection):");
  {
    const { data: pub } = await anon.from("exams").select("id").eq("id", created.examPub);
    check("anon can read a PUBLISHED exam", (pub ?? []).length === 1);
    const { data: draft } = await anon.from("exams").select("id").eq("id", created.examDraft);
    check("anon CANNOT read a DRAFT exam", (draft ?? []).length === 0);
    const { data: bDraft } = await bC.from("exams").select("id").eq("id", created.examDraft);
    check("student CANNOT read a DRAFT exam", (bDraft ?? []).length === 0);

    const ins = await bC.from("exams").insert({ title: "hack", slug: `hack-${rand}`, difficulty: "beginner" });
    check("student CANNOT create an exam", !!ins.error, ins.error?.code ?? "");
    await bC.from("exams").update({ price: 0 }).eq("id", created.examPub);
    const { data: priceRow } = await admin.from("exams").select("price").eq("id", created.examPub).single();
    check("student CANNOT change an exam price", Number(priceRow?.price) === 10, `price=${priceRow?.price}`);
  }

  // --------------------------------------------------------- exam_questions --
  console.log("\nexam_questions (answer key must never leak):");
  {
    const { data: direct } = await bC.from("exam_questions").select("*").eq("exam_id", created.examPub);
    check("student CANNOT read exam_questions directly", (direct ?? []).length === 0, `rows=${(direct ?? []).length}`);
    const { data: anonQ } = await anon.from("exam_questions").select("*").eq("exam_id", created.examPub);
    check("anon CANNOT read exam_questions directly", (anonQ ?? []).length === 0);

    // No access yet (paid, not granted) → RPC returns nothing.
    const { data: noAccess } = await bC.rpc("get_exam_questions", { p_exam_id: created.examPub });
    check("student WITHOUT access gets 0 questions from RPC", (noAccess ?? []).length === 0);

    // Free published exam → RPC returns questions, but NEVER correct_index.
    await admin.from("exam_questions").insert({
      exam_id: created.examFree, position: 0, prompt: "$3+0=?$", choices: ["$3$", "$4$"], correct_index: 0,
    });
    const { data: freeQ } = await bC.rpc("get_exam_questions", { p_exam_id: created.examFree });
    check("free-exam RPC returns questions", (freeQ ?? []).length === 1, `rows=${(freeQ ?? []).length}`);
    const leaks = (freeQ ?? []).some((q) => "correct_index" in q || "explanation" in q);
    check("RPC never returns correct_index/explanation", !leaks);
  }

  // ------------------------------------------------------- has_exam_access --
  console.log("\nhas_exam_access (published-first, free-or-granted):");
  {
    const { data: paid } = await bC.rpc("has_exam_access", { p_exam_id: created.examPub });
    check("no access to a paid exam without a grant", paid !== true);
    const { data: free } = await bC.rpc("has_exam_access", { p_exam_id: created.examFree });
    check("access to a FREE published exam", free === true);
    const { data: draft } = await bC.rpc("has_exam_access", { p_exam_id: created.examDraft });
    check("NO access to a draft exam (price=0 cannot bypass)", draft !== true);
  }

  // --------------------------------------------------------------- purchases --
  console.log("\npurchases (own-pending only; no self-approve/self-grant):");
  {
    const ownPending = await bC.from("purchases").insert({
      user_id: B.id, exam_id: created.examPub, amount: 10, status: "pending",
    });
    check("student CAN create own pending purchase", !ownPending.error, ownPending.error?.code ?? "");

    const asApproved = await bC.from("purchases").insert({
      user_id: B.id, exam_id: created.examFree, amount: 0, status: "approved",
    });
    check("student CANNOT self-insert an APPROVED purchase", !!asApproved.error, asApproved.error?.code ?? "");

    const forA = await bC.from("purchases").insert({
      user_id: A.id, exam_id: created.examPub, amount: 10, status: "pending",
    });
    check("student CANNOT create a purchase for another user", !!forA.error, forA.error?.code ?? "");

    const dup = await bC.from("purchases").insert({
      user_id: B.id, exam_id: created.examPub, amount: 10, status: "pending",
    });
    check("duplicate active purchase blocked (unique index)", !!dup.error, dup.error?.code ?? "");

    await bC.from("purchases").update({ status: "approved" }).eq("user_id", B.id).eq("exam_id", created.examPub);
    const { data: still } = await admin.from("purchases").select("status").eq("user_id", B.id).eq("exam_id", created.examPub).single();
    check("student CANNOT update own purchase to approved", still?.status === "pending", `status=${still?.status}`);

    // A's purchase is invisible to B.
    await admin.from("purchases").insert({ user_id: A.id, exam_id: created.examFree, amount: 0, status: "pending" });
    const { data: aP } = await bC.from("purchases").select("*").eq("user_id", A.id);
    check("student CANNOT read another student's purchases", (aP ?? []).length === 0);
  }

  // ------------------------------------------------------------- exam_access --
  console.log("\nexam_access (grants are server-only):");
  {
    const selfGrant = await bC.from("exam_access").insert({ user_id: B.id, exam_id: created.examPub });
    check("student CANNOT grant themselves access", !!selfGrant.error, selfGrant.error?.code ?? "");
    await admin.from("exam_access").insert({ user_id: A.id, exam_id: created.examPub });
    const { data: aAcc } = await bC.from("exam_access").select("*").eq("user_id", A.id);
    check("student CANNOT read another student's access", (aAcc ?? []).length === 0);
  }

  // ---------------------------------------------- approval (race-safe) -------
  console.log("\napproval transition (race-safe) + grant:");
  {
    // Simulate the server action: conditional update pending → approved.
    const first = await admin
      .from("purchases")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: A.id })
      .eq("user_id", B.id).eq("exam_id", created.examPub).eq("status", "pending")
      .select("id, user_id, exam_id");
    check("first approve transitions exactly 1 row", (first.data ?? []).length === 1);

    // Second concurrent approve → 0 rows (already approved).
    const second = await admin
      .from("purchases")
      .update({ status: "approved" })
      .eq("user_id", B.id).eq("exam_id", created.examPub).eq("status", "pending")
      .select("id");
    check("second approve transitions 0 rows (no double-approve)", (second.data ?? []).length === 0);

    // Grant (idempotent) then B has access + can fetch questions (no answers).
    if ((first.data ?? [])[0]) {
      const p = first.data[0];
      await admin.from("exam_access").upsert({ user_id: p.user_id, exam_id: p.exam_id, purchase_id: p.id }, { onConflict: "user_id,exam_id", ignoreDuplicates: true });
    }
    const { data: nowAccess } = await bC.rpc("has_exam_access", { p_exam_id: created.examPub });
    check("student has access AFTER approval", nowAccess === true);
    const { data: q } = await bC.rpc("get_exam_questions", { p_exam_id: created.examPub });
    check("student can now fetch questions (still no answers)", (q ?? []).length === 2 && !(q ?? []).some((x) => "correct_index" in x));
  }

  // ---------------------------------------------------------- exam_attempts --
  console.log("\nexam_attempts (scores are server-only):");
  if (await tableExists("exam_attempts")) {
    const { data: att } = await admin
      .from("exam_attempts")
      .insert({ user_id: A.id, exam_id: created.examPub, status: "completed", score: 100, correct_count: 2, total_count: 2 })
      .select("id").single();
    const selfIns = await bC.from("exam_attempts").insert({ user_id: B.id, exam_id: created.examPub, status: "completed", score: 100 });
    check("student CANNOT self-insert an attempt (no write policy)", !!selfIns.error, selfIns.error?.code ?? "");
    await bC.from("exam_attempts").update({ score: 0 }).eq("id", att?.id);
    const { data: aAtt } = await admin.from("exam_attempts").select("score").eq("id", att?.id).single();
    check("student CANNOT tamper with another student's score", Number(aAtt?.score) === 100, `score=${aAtt?.score}`);
    const { data: aList } = await bC.from("exam_attempts").select("*").eq("user_id", A.id);
    check("student CANNOT read another student's attempts", (aList ?? []).length === 0);
  }

  // ------------------------------------------------- attempt limit (max 2) --
  /**
   * The whole point of this section: every insert below uses the SERVICE ROLE,
   * which bypasses RLS entirely. If the cap still holds here, then it cannot be
   * beaten by a crafted REST call, a patched frontend, or a replayed action —
   * because the rule lives in a BEFORE INSERT trigger, not in the application.
   * Requires supabase/exam-attempt-limit.sql.
   */
  console.log("\nexam attempt limit (max 2 per student per exam):");
  {
    const { data: limitFn, error: limitFnErr } = await admin.rpc("max_exam_attempts");
    const LIMIT = Number(limitFn ?? 2);
    check(
      "max_exam_attempts() exists (migration applied)",
      !limitFnErr,
      limitFnErr ? "apply supabase/exam-attempt-limit.sql" : `limit=${LIMIT}`,
    );

    const startAttempt = (userId, examId, extra = {}) =>
      admin
        .from("exam_attempts")
        .insert({ user_id: userId, exam_id: examId, status: "in_progress", ...extra })
        .select("id, attempt_number")
        .single();

    // --- sequential: attempts 1..LIMIT succeed, LIMIT+1 is refused ----------
    const first = await startAttempt(B.id, created.examLimit);
    check("attempt 1 is created", !first.error, first.error?.message ?? "");
    check("attempt 1 is numbered 1", first.data?.attempt_number === 1, `n=${first.data?.attempt_number}`);

    // Finish it, so the next start is a genuine new attempt and not a resume.
    await admin
      .from("exam_attempts")
      .update({ status: "completed", score: 50, finished_at: new Date().toISOString() })
      .eq("id", first.data?.id);

    // A forged ordinal must be ignored — the trigger assigns it, not the caller.
    const second = await startAttempt(B.id, created.examLimit, { attempt_number: 1 });
    check("attempt 2 is created", !second.error, second.error?.message ?? "");
    check(
      "client-supplied attempt_number is OVERRIDDEN by the trigger",
      second.data?.attempt_number === 2,
      `n=${second.data?.attempt_number}`,
    );
    await admin
      .from("exam_attempts")
      .update({ status: "completed", score: 70, finished_at: new Date().toISOString() })
      .eq("id", second.data?.id);

    const third = await startAttempt(B.id, created.examLimit);
    check(
      `attempt ${LIMIT + 1} is REFUSED even with the service role`,
      !!third.error,
      third.error?.message ?? "INSERT SUCCEEDED — limit not enforced",
    );

    const { count: total } = await admin
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", B.id)
      .eq("exam_id", created.examLimit);
    check(`exactly ${LIMIT} attempt rows exist`, total === LIMIT, `rows=${total}`);

    // --- the limit is PER EXAM, not per student ----------------------------
    const other = await startAttempt(B.id, created.examFree);
    check("a DIFFERENT exam still allows a fresh attempt", !other.error, other.error?.message ?? "");

    // --- deleting attempts must not be a way to buy more -------------------
    const del = await bC.from("exam_attempts").delete().eq("user_id", B.id).eq("exam_id", created.examLimit);
    const { count: afterDel } = await admin
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", B.id)
      .eq("exam_id", created.examLimit);
    check(
      "student CANNOT delete attempts to reset the counter",
      afterDel === LIMIT,
      `rows=${afterDel}${del.error ? ` (${del.error.code})` : ""}`,
    );

    // --- reopening a graded attempt is also a reset ------------------------
    await bC
      .from("exam_attempts")
      .update({ status: "in_progress", score: null })
      .eq("user_id", B.id)
      .eq("exam_id", created.examLimit);
    const { data: statuses } = await admin
      .from("exam_attempts")
      .select("status")
      .eq("user_id", B.id)
      .eq("exam_id", created.examLimit);
    check(
      "student CANNOT reopen a completed attempt",
      (statuses ?? []).every((s) => s.status === "completed"),
      (statuses ?? []).map((s) => s.status).join(","),
    );

    // --- concurrency: hammering "Start" cannot mint extra attempts ---------
    /**
     * Fires LIMIT+2 inserts at once for a fresh (student, exam). Concurrent
     * transactions all read the same count, so they collide on the unique
     * (user_id, exam_id, attempt_number) index — which is exactly the desired
     * failure direction: some inserts are rejected, never duplicated.
     */
    const burst = await Promise.all(
      Array.from({ length: LIMIT + 2 }, () => startAttempt(A.id, created.examRace)),
    );
    const wins = burst.filter((r) => !r.error);
    const { data: raceRows } = await admin
      .from("exam_attempts")
      .select("attempt_number")
      .eq("user_id", A.id)
      .eq("exam_id", created.examRace);
    const numbers = (raceRows ?? []).map((r) => r.attempt_number);
    check(
      `${LIMIT + 2} simultaneous starts create at most ${LIMIT} attempts`,
      (raceRows ?? []).length <= LIMIT && (raceRows ?? []).length >= 1,
      `rows=${(raceRows ?? []).length}, inserts_ok=${wins.length}`,
    );
    check(
      "no duplicate attempt_number survives the race",
      new Set(numbers).size === numbers.length,
      `numbers=[${numbers.join(",")}]`,
    );
  }

  // ------------------------------------------------------ platform_settings --
  console.log("\nplatform_settings (read-only to students):");
  if (await tableExists("platform_settings")) {
    const { data: rd } = await bC.from("platform_settings").select("*").eq("id", 1);
    check("student CAN read payment settings", (rd ?? []).length === 1);
    await bC.from("platform_settings").update({ card_number: "HACKED" }).eq("id", 1);
    const { data: s } = await admin.from("platform_settings").select("card_number").eq("id", 1).single();
    check("student CANNOT modify payment settings", s?.card_number !== "HACKED");
    const { data: anonS } = await anon.from("platform_settings").select("*");
    check("anon CANNOT read payment settings", (anonS ?? []).length === 0);
  }

  // --------------------------------------------------------- admins allowlist --
  console.log("\nadmins allow-list (no self-promotion):");
  {
    const { data: isAdm } = await bC.rpc("is_admin");
    check("student is_admin() = false", isAdm !== true);
    const promote = await bC.from("admins").insert({ user_id: B.id });
    check("student CANNOT self-add to admins", !!promote.error, promote.error?.code ?? "");
    const { data: adms } = await bC.from("admins").select("*");
    check("student CANNOT read the admin list", (adms ?? []).length === 0);
  }

  // ----------------------------------------------------------- storage/receipts --
  console.log("\nstorage receipts (private per-owner):");
  {
    const path = `${A.id}/receipt-${rand}.png`;
    const up = await aC.storage.from("receipts").upload(path, PNG_BYTES, { contentType: "image/png" });
    check("owner CAN upload into own receipts folder", !up.error, up.error?.message ?? "");

    const bIntoA = await bC.storage.from("receipts").upload(`${A.id}/evil-${rand}.png`, PNG_BYTES, { contentType: "image/png" });
    check("student CANNOT upload into another user's folder", !!bIntoA.error, bIntoA.error?.message ?? "");

    const bDl = await bC.storage.from("receipts").download(path);
    check("student CANNOT download another user's receipt", !!bDl.error, bDl.error?.message ?? "");
    const bSign = await bC.storage.from("receipts").createSignedUrl(path, 60);
    check("student CANNOT sign another user's receipt", !!bSign.error, bSign.error?.message ?? "");

    const ownSign = await aC.storage.from("receipts").createSignedUrl(path, 60);
    check("owner CAN sign own receipt", !ownSign.error && !!ownSign.data?.signedUrl);
  }

  // ------------------------------------------------------------------ cleanup --
  console.log("\ncleanup:");
  await admin.storage.from("receipts").remove([`${A.id}/receipt-${rand}.png`]).catch(() => {});
  for (const id of Object.values(created)) {
    if (id) await admin.from("exams").delete().eq("id", id); // cascades questions/purchases/access/attempts
  }
  await admin.auth.admin.deleteUser(A.id);
  await admin.auth.admin.deleteUser(B.id);
  console.log("  cleaned up test users + exams.");

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch(async (e) => {
  console.error("\nERROR:", e.message);
  for (const id of Object.values(created)) {
    if (id) await admin.from("exams").delete().eq("id", id).catch(() => {});
  }
  for (const u of [A, B]) if (u.id) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  process.exitCode = 1;
});
