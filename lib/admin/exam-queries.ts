import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { AdminExamQuestion, ExamRow } from "@/lib/exams/types";

/**
 * Admin reads of exams + questions. Uses the cookie session client, so RLS
 * (`is_admin()`) is the gate — a non-admin session returns nothing. Admins can
 * read ALL exams (drafts included) and the full question rows (with answers).
 */

const EXAM_SELECT =
  "id,title,slug,summary,description,category_slug,difficulty,price,currency,duration_minutes,covers,featured,status,question_count,created_at,updated_at";

/** All exams (any status), newest updated first. */
export async function getAllExamsAdmin(): Promise<ExamRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("exams")
      .select(EXAM_SELECT)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ExamRow[];
  } catch {
    return [];
  }
}

export async function getExamByIdAdmin(id: string): Promise<ExamRow | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("exams")
      .select(EXAM_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
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
