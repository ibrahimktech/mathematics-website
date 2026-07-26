import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createPublicClient } from "@/lib/supabase/public";
import { getCategories } from "@/lib/categories";
import type { Exam, ExamRow } from "./exams/types";

export type {
  Exam,
  ExamRow,
  ExamDifficulty,
  ExamStatus,
  ExamQuestion,
  AdminExamQuestion,
} from "./exams/types";
export { isFreeExam } from "./exams/types";
export {
  difficultyLabel,
  difficultyChipClass,
  formatPrice,
  formatDuration,
  DIFFICULTY_OPTIONS,
} from "./exams/display";

/* =============================================================================
 * PUBLIC exam data access — reads the `exams` table through the cookie-less
 * public client, so RLS returns ONLY published exams and pages stay static/ISR.
 * Drafts/archived exams are invisible here; the admin panel uses its own
 * cookie-client queries (lib/admin/exam-queries.ts). Every function degrades
 * gracefully to [] / null when Supabase isn't configured.
 * ========================================================================== */

const EXAM_SELECT =
  "id,title,slug,summary,description,category_slug,difficulty,price,currency,duration_minutes,covers,featured,status,question_count,created_at,updated_at";

/** Blog category slug → display name, memoized per request (for the topic label). */
const categoryNameMap = cache(async (): Promise<Map<string, string>> => {
  const cats = await getCategories();
  return new Map(cats.map((c) => [c.slug, c.name]));
});

function mapExam(row: ExamRow, names: Map<string, string>): Exam {
  const slug = row.category_slug ?? "";
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    categorySlug: slug,
    topic: names.get(slug) ?? slug,
    difficulty: row.difficulty,
    price: Number(row.price) || 0,
    currency: row.currency || "AZN",
    durationMinutes: row.duration_minutes ?? 0,
    problemCount: row.question_count ?? 0,
    summary: row.summary ?? "",
    description: row.description ?? "",
    covers: row.covers ?? [],
    featured: Boolean(row.featured),
    status: row.status,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

async function toExams(rows: ExamRow[] | null): Promise<Exam[]> {
  const names = await categoryNameMap();
  return (rows ?? []).map((r) => mapExam(r, names));
}

/** All published exams, newest first. */
export const getExams = cache(async (): Promise<Exam[]> => {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("exams")
      .select(EXAM_SELECT)
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return toExams(data as ExamRow[]);
  } catch {
    return [];
  }
});

/** Featured published exams for the homepage. */
export async function getFeaturedExams(limit = 3): Promise<Exam[]> {
  const exams = await getExams();
  return exams.filter((e) => e.featured).slice(0, limit);
}

/** Free published practice sets (surfaced on /meseleler). */
export async function getFreeExams(): Promise<Exam[]> {
  const exams = await getExams();
  return exams.filter((e) => e.price === 0);
}

/** A single published exam by slug (null if missing/unpublished). */
export async function getExamBySlug(slug: string): Promise<Exam | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("exams")
      .select(EXAM_SELECT)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const names = await categoryNameMap();
    return mapExam(data as ExamRow, names);
  } catch {
    return null;
  }
}

/** A single published exam by id (null if missing/unpublished). */
export async function getExamById(id: string): Promise<Exam | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("exams")
      .select(EXAM_SELECT)
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const names = await categoryNameMap();
    return mapExam(data as ExamRow, names);
  } catch {
    return null;
  }
}

/** Published exams whose ids are in `ids` (for resolving titles in the panel). */
export async function getExamsByIds(ids: string[]): Promise<Exam[]> {
  if (!isSupabaseConfigured || ids.length === 0) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("exams")
      .select(EXAM_SELECT)
      .in("id", ids)
      .eq("status", "published");
    if (error) throw error;
    return toExams(data as ExamRow[]);
  } catch {
    return [];
  }
}

/** Published exams in a given blog category slug (for the /imtahanlar filter). */
export async function getExamsByCategorySlug(slug: string): Promise<Exam[]> {
  const exams = await getExams();
  return exams.filter((e) => e.categorySlug === slug);
}

/** Related published exams (same topic, excluding one). */
export async function getRelatedExams(
  categorySlug: string,
  excludeId?: string,
  limit = 2,
): Promise<Exam[]> {
  const exams = await getExams();
  return exams
    .filter((e) => e.categorySlug === categorySlug && e.id !== excludeId)
    .slice(0, limit);
}

/** Distinct topics present in the published catalogue, with slug + count. */
export async function getExamTopics(): Promise<
  { topic: string; categorySlug: string; count: number }[]
> {
  const exams = await getExams();
  const map = new Map<
    string,
    { topic: string; categorySlug: string; count: number }
  >();
  for (const e of exams) {
    if (!e.categorySlug) continue;
    const existing = map.get(e.categorySlug);
    if (existing) existing.count += 1;
    else
      map.set(e.categorySlug, {
        topic: e.topic,
        categorySlug: e.categorySlug,
        count: 1,
      });
  }
  return [...map.values()];
}
