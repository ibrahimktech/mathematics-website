"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getExamById } from "@/lib/exams";
import { gradeExam } from "@/lib/exams/grade";
import { getClientIp } from "@/lib/security/request";
import { consume, RATE_RULES } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/log";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Student write actions. The authenticated user's id ALWAYS comes from the
 * verified session (`auth.getUser()`), never from a client argument.
 *
 * Purchase submission + receipt upload use the COOKIE client under RLS (ordinary
 * student ops — a student may only ever create their own PENDING purchase and
 * upload into their own receipts folder). Only attempt creation + grading use
 * the service role, because a score must be unforgeable and access is verified
 * first — see notes on each function.
 */

const RECEIPT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Ids arriving from the client are shape-checked before they reach Postgres. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verified user id from the session cookie, or null. */
async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * The verified user, but ONLY if their e-mail has been confirmed.
 *
 * Money and exam access are the sensitive actions on this platform, and both
 * hang off an address nobody has proven they control. Without this check, a
 * throwaway address can file purchase requests (wasting the teacher's review
 * time and polluting the sales figures) and there is no reliable way to contact
 * the buyer. `email_confirmed_at` is set by Supabase Auth only after the
 * confirmation link is followed, so it cannot be forged from the client.
 *
 * Returns a discriminated result so callers can give the right message.
 */
async function verifiedUser(): Promise<
  | { ok: true; id: string; email: string | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Əvvəlcə daxil olun." };
  if (!user.email_confirmed_at) {
    return {
      ok: false,
      error: "Davam etmək üçün e-poçt ünvanınızı təsdiqləyin.",
    };
  }
  return { ok: true, id: user.id, email: user.email ?? null };
}

function notReady(): ActionResult {
  return { ok: false, error: "Sistem hələ tam konfiqurasiya edilməyib." };
}

/**
 * Sniff the real file type from magic bytes — NOT the filename/extension. A
 * `.png` that isn't actually a PNG is rejected. Returns the detected mime + a
 * safe extension, or null if it isn't an allowed receipt type.
 */
function sniffReceipt(
  bytes: Uint8Array,
): { mime: string; ext: string } | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  )
    return { mime: "image/png", ext: "png" };
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  )
    return { mime: "application/pdf", ext: "pdf" };
  return null;
}

/**
 * Submit a manual bank-transfer purchase request. Creates a PENDING purchase for
 * the current student and, if provided, uploads their receipt to the private
 * bucket. Access is NOT granted here — an admin must approve it.
 *
 * FormData fields: `examId`, `receiptUnavailable` ("true"|"false"), `receipt` (File).
 */
export async function submitPurchase(formData: FormData): Promise<ActionResult> {
  if (!isSupabaseConfigured) return notReady();

  // AUTHENTICATION + email verification (see verifiedUser).
  const session = await verifiedUser();
  if (!session.ok) return { ok: false, error: session.error };
  const userId = session.id;

  // Rate limit: each submission can carry a 5 MB upload and creates review work.
  const ip = getClientIp(await headers());
  const verdict = consume(`purchase:${userId}`, RATE_RULES.purchase);
  if (!verdict.allowed) {
    logSecurityEvent("abuse.rate_limited", {
      email: session.email,
      ip,
      action: "submitPurchase",
      retryAfterSeconds: verdict.retryAfterSeconds,
    });
    return {
      ok: false,
      error: `Çox sayda sorğu. ${Math.ceil(
        verdict.retryAfterSeconds / 60,
      )} dəqiqə sonra yenidən cəhd edin.`,
    };
  }

  const examId = String(formData.get("examId") ?? "").trim();
  if (!examId) return { ok: false, error: "İmtahan seçilməyib." };
  // Reject a malformed id before it reaches the database.
  if (!UUID_RE.test(examId)) return { ok: false, error: "İmtahan tapılmadı." };

  // Price + published check come from the DB (getExamById returns published only).
  const exam = await getExamById(examId);
  if (!exam) return { ok: false, error: "İmtahan tapılmadı və ya mövcud deyil." };
  if (exam.price <= 0) {
    return { ok: false, error: "Bu imtahan pulsuzdur — ödəniş tələb olunmur." };
  }

  const receiptUnavailable =
    String(formData.get("receiptUnavailable") ?? "") === "true";
  const file = formData.get("receipt");
  const hasFile = file instanceof File && file.size > 0;

  if (!receiptUnavailable && !hasFile) {
    return {
      ok: false,
      error: "Qəbz yükləyin və ya “qəbz yükləyə bilmirəm” seçin.",
    };
  }

  const supabase = await createClient();

  // --- Upload receipt (cookie client → storage RLS scopes to own folder). ---
  let receiptPath: string | null = null;
  if (hasFile && !receiptUnavailable) {
    const f = file as File;
    if (f.size > RECEIPT_MAX_BYTES) {
      return { ok: false, error: "Fayl 5 MB-dan böyük ola bilməz." };
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const sniffed = sniffReceipt(bytes);
    if (!sniffed) {
      return {
        ok: false,
        error: "Yalnız JPG, PNG və ya PDF qəbul olunur.",
      };
    }
    const path = `${userId}/${crypto.randomUUID()}.${sniffed.ext}`;
    const { error: upErr } = await supabase.storage
      .from("receipts")
      .upload(path, f, { contentType: sniffed.mime, upsert: false });
    if (upErr) {
      return { ok: false, error: "Qəbz yüklənmədi. Yenidən cəhd edin." };
    }
    receiptPath = path;
  }

  // --- Create the pending purchase (cookie client → RLS: own + pending only). ---
  const { data: inserted, error } = await supabase
    .from("purchases")
    .insert({
      user_id: userId,
      exam_id: exam.id,
      amount: exam.price,
      currency: exam.currency,
      status: "pending",
      receipt_path: receiptPath,
      receipt_unavailable: receiptUnavailable,
    })
    .select("id")
    .single();

  if (error) {
    /**
     * Clean up an orphaned receipt if the insert failed. This MUST use the
     * service role: the `receipts` bucket deliberately has no student DELETE
     * policy, so a student cannot remove a receipt they have already submitted
     * as evidence. With the cookie client this call failed silently and the
     * orphaned file stayed in the bucket forever. The path is one we just built
     * from the session user id, so the service role is not being handed
     * client-controlled input.
     */
    if (receiptPath && isServiceRoleConfigured) {
      await createAdminClient().storage.from("receipts").remove([receiptPath]);
    }
    // 23505 = unique violation → an active (pending/approved) request exists.
    if ((error as { code?: string }).code === "23505") {
      return {
        ok: false,
        error: "Bu imtahan üçün artıq aktiv sorğunuz var.",
      };
    }
    return { ok: false, error: "Sorğu göndərilmədi. Yenidən cəhd edin." };
  }

  revalidatePath("/panel");
  revalidatePath("/panel/imtahanlar");
  return { ok: true, id: inserted.id as string };
}

/**
 * Start (or resume) an attempt. Verifies (a) the exam is published, (b) the
 * caller HAS access — free OR an exam_access grant — via `has_exam_access` (the
 * same DB truth the question-delivery function uses), then creates an
 * in-progress attempt. The attempt row is written with the SERVICE ROLE so
 * `total_count`/score can't be forged, but the user_id is the session user.
 */
export async function startAttempt(examId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured || !isServiceRoleConfigured) return notReady();
  if (!UUID_RE.test(String(examId ?? ""))) {
    return { ok: false, error: "İmtahan tapılmadı." };
  }

  const session = await verifiedUser();
  if (!session.ok) return { ok: false, error: session.error };
  const userId = session.id;
  const supabase = await createClient();

  const exam = await getExamById(examId);
  if (!exam) return { ok: false, error: "İmtahan tapılmadı." };

  // AUTHORIZATION: published + (free OR granted). Enforced in the DB function.
  const { data: access, error: accessErr } = await supabase.rpc(
    "has_exam_access",
    { p_exam_id: exam.id },
  );
  if (accessErr || access !== true) {
    return { ok: false, error: "Bu imtahana girişiniz yoxdur." };
  }

  if (exam.problemCount <= 0) {
    return { ok: false, error: "Bu imtahanın sualları hazırlanır." };
  }

  const admin = createAdminClient();

  // Resume an open attempt if one exists.
  const { data: open } = await admin
    .from("exam_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("exam_id", exam.id)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) return { ok: true, id: open.id as string };

  const { data: created, error } = await admin
    .from("exam_attempts")
    .insert({
      user_id: userId,
      exam_id: exam.id,
      status: "in_progress",
      total_count: exam.problemCount,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: "Başlamaq alınmadı." };

  revalidatePath("/panel");
  return { ok: true, id: created.id as string };
}

/**
 * Submit answers for an attempt. Re-verifies the attempt belongs to the session
 * user (never trusts the attempt id alone), grades on the server against the DB
 * answer key (service role, never exposed), and writes the score with the
 * service role.
 */
export async function submitAttempt(
  attemptId: string,
  answers: Record<string, number>,
): Promise<ActionResult> {
  if (!isSupabaseConfigured || !isServiceRoleConfigured) return notReady();
  if (!UUID_RE.test(String(attemptId ?? ""))) {
    return { ok: false, error: "Cəhd tapılmadı." };
  }
  const userId = await sessionUserId();
  if (!userId) return { ok: false, error: "Əvvəlcə daxil olun." };

  const admin = createAdminClient();
  const { data: attempt, error: readErr } = await admin
    .from("exam_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (readErr || !attempt) return { ok: false, error: "Cəhd tapılmadı." };

  // AUTHORIZATION: the attempt must belong to the authenticated user.
  if (attempt.user_id !== userId) {
    return { ok: false, error: "İcazə yoxdur." };
  }
  if (attempt.status === "completed") {
    return { ok: true, id: attemptId };
  }

  /**
   * Sanitize client answers before they are stored as jsonb. Keys must look
   * like question ids and values must be small non-negative integers, so a
   * crafted payload cannot stuff arbitrary keys/objects into the `answers`
   * column (which is later read back and rendered on the review page), and the
   * row size stays bounded. Grading ignores unknown ids regardless — this is
   * about what gets persisted.
   */
  const clean: Record<string, number> = {};
  for (const [qid, choice] of Object.entries(answers ?? {})) {
    if (Object.keys(clean).length >= 500) break;
    if (!UUID_RE.test(qid)) continue;
    if (typeof choice === "number" && Number.isInteger(choice) && choice >= 0 && choice < 100) {
      clean[qid] = choice;
    }
  }

  const { correct, total, score } = await gradeExam(attempt.exam_id, clean);
  const startedMs = new Date(attempt.started_at).getTime();
  const durationSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));

  const { error: writeErr } = await admin
    .from("exam_attempts")
    .update({
      status: "completed",
      score,
      correct_count: correct,
      total_count: total,
      answers: clean,
      finished_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq("id", attemptId)
    .eq("user_id", userId); // defense in depth
  if (writeErr) return { ok: false, error: "Təqdim alınmadı." };

  revalidatePath("/panel");
  revalidatePath("/panel/neticeler");
  revalidatePath(`/panel/netice/${attemptId}`);
  return { ok: true, id: attemptId };
}
