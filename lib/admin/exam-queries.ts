import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { runExamQuery } from "@/lib/exams";
import type { AdminExamQuestion, ExamRow } from "@/lib/exams/types";

/**
 * Admin reads of exams + questions. Uses the cookie session client, so RLS
 * (`is_admin()`) is the gate — a non-admin session returns nothing. Admins can
 * read ALL exams (drafts included) and the full question rows (with answers).
 */

/**
 * All exams (any status), in the SAME order students see them (`display_order`,
 * set at /admin/exams/siralama). Drafts and archived exams hold positions too,
 * so publishing a draft leaves it exactly where the teacher put it. Matching the
 * public order here is what makes the reorder page's effect visible and lets the
 * admin table double as a preview of the catalogue.
 */
export async function getAllExamsAdmin(): Promise<ExamRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const rows = await runExamQuery((columns, hasDisplayOrder) => {
      const q = supabase.from("exams").select(columns);
      return hasDisplayOrder
        ? q
            .order("display_order", { ascending: true })
            .order("created_at", { ascending: false })
        : // Pre-migration (see runExamQuery): the previous admin ordering.
          q.order("updated_at", { ascending: false });
    });
    return (rows ?? []) as ExamRow[];
  } catch {
    return [];
  }
}

export async function getExamByIdAdmin(id: string): Promise<ExamRow | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const data = await runExamQuery((columns) =>
      supabase.from("exams").select(columns).eq("id", id).maybeSingle(),
    );
    return (data as ExamRow) ?? null;
  } catch {
    return null;
  }
}

/** Full question rows (WITH correct answers) for the admin question editor. */
export async function getExamQuestionsAdmin(
  examId: string,
): Promise<AdminExamQuestion[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("exam_questions")
      .select("id, exam_id, position, prompt, choices, correct_index, explanation")
      .eq("exam_id", examId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as {
      id: string;
      exam_id: string;
      position: number;
      prompt: string;
      choices: unknown;
      correct_index: number | null;
      explanation: string | null;
    }[]).map((r) => ({
      id: r.id,
      examId: r.exam_id,
      position: r.position,
      prompt: r.prompt,
      choices: Array.isArray(r.choices) ? (r.choices as string[]) : [],
      correctIndex: r.correct_index,
      explanation: r.explanation,
    }));
  } catch {
    return [];
  }
}

/** Status counts for the dashboard. */
export async function getExamCounts(): Promise<{
  total: number;
  published: number;
  draft: number;
}> {
  if (!isSupabaseConfigured) return { total: 0, published: 0, draft: 0 };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("exams").select("status");
    if (error) throw error;
    const rows = (data ?? []) as { status: string }[];
    return {
      total: rows.length,
      published: rows.filter((r) => r.status === "published").length,
      draft: rows.filter((r) => r.status === "draft").length,
    };
  } catch {
    return { total: 0, published: 0, draft: 0 };
  }
}
