import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/* =============================================================================
 * SERVER-ONLY grading. The answer key (correct_index) lives in the admin-only
 * `exam_questions` table and is read here with the service-role client — the
 * ONE place that touches correct answers, on the server, never exposed to the
 * client. Reading it via service role (not an RPC) guarantees no callable
 * endpoint can leak the key. Used only by the grader + the post-completion
 * review, which are already gated on attempt ownership.
 * ========================================================================== */

export type GradeResult = { correct: number; total: number; score: number };

/** questionId → correct choice index (0-based). Empty if none authored. */
export async function getAnswerKey(
  examId: string,
): Promise<Record<string, number>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("exam_questions")
    .select("id, correct_index")
    .eq("exam_id", examId);
  if (error || !data) return {};
  const key: Record<string, number> = {};
  for (const row of data as { id: string; correct_index: number | null }[]) {
    if (typeof row.correct_index === "number") key[row.id] = row.correct_index;
  }
  return key;
}

/**
 * Grades submitted answers on the server against the DB answer key. `answers`
 * maps questionId → chosen choice index. Unknown/omitted answers count as wrong.
 * `total` is the number of questions that HAVE a correct answer authored.
 */
export async function gradeExam(
  examId: string,
  answers: Record<string, number>,
): Promise<GradeResult> {
  const key = await getAnswerKey(examId);
  const ids = Object.keys(key);
  const total = ids.length;
  let correct = 0;
  for (const id of ids) {
    if (typeof answers[id] === "number" && answers[id] === key[id]) correct += 1;
  }
  const score = total ? Math.round((correct / total) * 100) : 0;
  return { correct, total, score };
}

/**
 * For the post-completion review page: the correct choice index per question,
 * plus any explanation. Safe to expose here because the caller has already been
 * verified to own a COMPLETED attempt for this exam.
 */
export async function getReviewKey(
  examId: string,
): Promise<Record<string, { correctIndex: number | null; explanation: string | null }>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("exam_questions")
    .select("id, correct_index, explanation")
    .eq("exam_id", examId);
  if (error || !data) return {};
  const out: Record<
    string,
    { correctIndex: number | null; explanation: string | null }
  > = {};
  for (const row of data as {
    id: string;
    correct_index: number | null;
    explanation: string | null;
  }[]) {
    out[row.id] = {
      correctIndex: row.correct_index,
      explanation: row.explanation,
    };
  }
  return out;
}
