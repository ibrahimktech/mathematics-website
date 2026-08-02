import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeExam } from "./grade";
import type { ExamAttempt } from "@/lib/student/types";

/* =============================================================================
 * SERVER-ONLY attempt persistence: autosave + the one authoritative submit.
 *
 * Both entry points into "the student's answers reach the database" live here so
 * they cannot drift:
 *   • the `submitAttempt` / `saveAttemptAnswers` Server Actions (normal UI), and
 *   • the `/api/exam/auto-submit` beacon fired when the page is being unloaded
 *     (Server Actions cannot be called from `navigator.sendBeacon`).
 *
 * Every function here takes an ALREADY-VERIFIED `userId` from the caller's
 * session and re-checks that the attempt belongs to it — the attempt id alone is
 * never trusted. Writes use the service role because `exam_attempts` has no
 * user-facing write policy: that is what stops a student from PATCHing their own
 * score through PostgREST.
 * ========================================================================== */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How many answers one attempt may persist — bounds the stored row size. */
const MAX_ANSWERS = 500;

/**
 * Sanitize client answers before they are stored as jsonb. Keys must look like
 * question ids and values must be small non-negative integers, so a crafted
 * payload cannot stuff arbitrary keys/objects into the `answers` column (which
 * is later read back and rendered on the review page). Grading ignores unknown
 * ids regardless — this is about what gets persisted.
 */
export function sanitizeAnswers(input: unknown): Record<string, number> {
  const clean: Record<string, number> = {};
  if (!input || typeof input !== "object") return clean;
  for (const [qid, choice] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(clean).length >= MAX_ANSWERS) break;
    if (!UUID_RE.test(qid)) continue;
    if (
      typeof choice === "number" &&
      Number.isInteger(choice) &&
      choice >= 0 &&
      choice < 100
    ) {
      clean[qid] = choice;
    }
  }
  return clean;
}

type Loaded =
  | { ok: true; attempt: ExamAttempt }
  | { ok: false; error: string };

/** Read an attempt and verify it belongs to `userId`. */
async function loadOwnAttempt(
  userId: string,
  attemptId: string,
): Promise<Loaded> {
  if (!UUID_RE.test(String(attemptId ?? ""))) {
    return { ok: false, error: "Cəhd tapılmadı." };
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("exam_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Cəhd tapılmadı." };

  // AUTHORIZATION: the attempt must belong to the authenticated user. Returning
  // the same message as "not found" keeps this from being an id oracle.
  if ((data as ExamAttempt).user_id !== userId) {
    return { ok: false, error: "Cəhd tapılmadı." };
  }
  return { ok: true, attempt: data as ExamAttempt };
}

/**
 * Merge autosaved answers with the ones the client just sent. The client's copy
 * is the fresher one, but a truncated/partial payload (a beacon fired while the
 * tab was closing) must never wipe answers that were already saved — and the UI
 * only ever *changes* a choice, never clears one, so a merge can't resurrect
 * something the student deliberately removed.
 */
function mergeAnswers(
  stored: Record<string, number> | null | undefined,
  incoming: Record<string, number>,
): Record<string, number> {
  return { ...(stored ?? {}), ...incoming };
}

export type AttemptWriteResult =
  | { ok: true; attemptId: string; alreadyCompleted: boolean }
  | { ok: false; error: string };

/**
 * AUTOSAVE. Stores the latest answers on an OPEN attempt and nothing else — no
 * status change, no score. A completed attempt is immutable, so a late autosave
 * arriving after submission is ignored rather than treated as an error.
 */
export async function persistAttemptAnswers(
  userId: string,
  attemptId: string,
  answers: unknown,
): Promise<AttemptWriteResult> {
  const loaded = await loadOwnAttempt(userId, attemptId);
  if (!loaded.ok) return loaded;
  const attempt = loaded.attempt;

  if (attempt.status === "completed") {
    return { ok: true, attemptId, alreadyCompleted: true };
  }

  const merged = mergeAnswers(attempt.answers, sanitizeAnswers(answers));

  const { error } = await createAdminClient()
    .from("exam_attempts")
    .update({ answers: merged })
    .eq("id", attemptId)
    .eq("user_id", userId) // defense in depth
    .eq("status", "in_progress"); // never touch a graded attempt
  if (error) return { ok: false, error: "Cavablar saxlanılmadı." };

  return { ok: true, attemptId, alreadyCompleted: false };
}

/**
 * SUBMIT. Grades on the server against the DB answer key (never exposed) and
 * closes the attempt. Idempotent: submitting an already-completed attempt is a
 * no-op success, which is what makes the unload beacon safe to race against a
 * normal submit.
 *
 * The conditional `status = 'in_progress'` on the UPDATE means two concurrent
 * submissions can never both write a score — the loser updates zero rows.
 */
export async function finalizeAttempt(
  userId: string,
  attemptId: string,
  answers: unknown,
): Promise<AttemptWriteResult> {
  const loaded = await loadOwnAttempt(userId, attemptId);
  if (!loaded.ok) return loaded;
  const attempt = loaded.attempt;

  if (attempt.status === "completed") {
    return { ok: true, attemptId, alreadyCompleted: true };
  }

  const merged = mergeAnswers(attempt.answers, sanitizeAnswers(answers));

  const { correct, total, score } = await gradeExam(attempt.exam_id, merged);
  const startedMs = new Date(attempt.started_at).getTime();
  const durationSeconds = Math.max(
    0,
    Math.round((Date.now() - startedMs) / 1000),
  );

  const { error } = await createAdminClient()
    .from("exam_attempts")
    .update({
      status: "completed",
      score,
      correct_count: correct,
      total_count: total,
      answers: merged,
      finished_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq("id", attemptId)
    .eq("user_id", userId) // defense in depth
    .eq("status", "in_progress"); // race-safe: only the first submit wins
  if (error) return { ok: false, error: "Təqdim alınmadı." };

  return { ok: true, attemptId, alreadyCompleted: false };
}
