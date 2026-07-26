import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { ExamQuestion } from "./types";

export type { ExamQuestion } from "./types";

/**
 * ANSWER-FREE questions for a student, delivered through the SECURITY DEFINER
 * function `public.get_exam_questions(uuid)`. That function returns rows ONLY if
 * the caller has access (exam published AND (free OR an exam_access grant)), and
 * it never selects `correct_index`/`explanation` — so the answer key can't reach
 * the browser even via dev tools. Uses the cookie session client (no service
 * role) so `auth.uid()` inside the function is the real caller.
 *
 * Returns [] when Supabase isn't configured, the exam has no questions, OR the
 * caller lacks access — callers must NOT treat a non-empty result as proof of
 * access on its own (the taking pages also gate explicitly, defense in depth).
 */
export async function getStudentExamQuestions(
  examId: string,
): Promise<ExamQuestion[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_exam_questions", {
      p_exam_id: examId,
    });
    if (error) return [];
    return ((data ?? []) as { id: string; prompt: string; choices: unknown }[]).map(
      (r) => ({
        id: r.id,
        prompt: r.prompt,
        choices: Array.isArray(r.choices) ? (r.choices as string[]) : [],
      }),
    );
  } catch {
    return [];
  }
}
