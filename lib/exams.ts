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

/** Every exam column EXCEPT `display_order` (added by a later migration). */
const EXAM_COLUMNS_PRE_ORDER =
  "id,title,slug,summary,description,category_slug,difficulty,price,currency,duration_minutes,covers,featured,status,question_count,created_at,updated_at";

const EXAM_SELECT = `${EXAM_COLUMNS_PRE_ORDER},display_order`;

type QueryError = { code?: string; message?: string } | null;

/**
 * True when a query failed only because `supabase/exam-display-order.sql` has
 * not been applied yet. PostgREST rejects the WHOLE query (42703,
 * undefined_column) when `display_order` appears in `select=` or `order=`, so
 * without a fallback a deploy landing ahead of the SQL would show an EMPTY
 * catalogue rather than an unsorted one.
 */
function isMissingDisplayOrder(error: QueryError): boolean {
  if (!error) return false;
  return error.code === "42703" || Boolean(error.message?.includes("display_order"));
}

/**
 * Run an `exams` query that selects and sorts by `display_order`, retrying ONCE
 * without the column if the migration hasn't been applied yet. `build` gets the
 * column list to select plus whether `display_order` is available, so each
 * caller picks its own pre-migration ordering.
 *
 * Same idea as the `blog_archive_counts` fallback in `lib/archives.ts`. This
 * helper and its `hasDisplayOrder === false` branches can all be deleted once
 * the migration is applied everywhere.
 *
 * Returns `unknown`: `columns` is a runtime value, so supabase-js can't infer a
 * row type from it. Callers cast to `ExamRow`, exactly as they did when they
 * passed the select string directly.
 */
export async function runExamQuery(
  build: (
    columns: string,
    hasDisplayOrder: boolean,
  ) => PromiseLike<{ data: unknown; error: QueryError }>,
): Promise<unknown> {
  const primary = await build(EXAM_SELECT, true);
  if (!primary.error) return primary.data;
  if (!isMissingDisplayOrder(primary.error)) throw primary.error;

  const fallback = await build(EXAM_COLUMNS_PRE_ORDER, false);
  if (fallback.error) throw fallback.error;
  return fallback.data;
}

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
    displayOrder: row.display_order ?? 0,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

async function toExams(rows: ExamRow[] | null): Promise<Exam[]> {
  const names = await categoryNameMap();
  return (rows ?? []).map((r) => mapExam(r, names));
}

/**
 * All published exams, in THE CATALOGUE ORDER: `display_order asc`, with
 * `created_at desc` only as a tie-break.
 *
 * `display_order` is the teacher's MANUAL order, set at /admin/exams/siralama —
 * it is the single thing that decides what a student sees first. Exams used to
 * be listed newest-first, which showed students the order the teacher happened
 * to finish uploading in.
 *
 * `featured` is deliberately NOT part of the sort any more: it picks which exams
 * the homepage highlights (`getFeaturedExams` below), and letting it also jump an
 * exam to the top of the catalogue would override the position the teacher
 * dragged it into. Every other student-facing list derives from this function,
 * so this is the one place the order is decided.
 */
export const getExams = cache(async (): Promise<Exam[]> => {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createPublicClient();
    const rows = await runExamQuery((columns, hasDisplayOrder) => {
      const q = supabase.from("exams").select(columns).eq("status", "published");
      return hasDisplayOrder
        ? q
            .order("display_order", { ascending: true })
            .order("created_at", { ascending: false })
        : // Pre-migration: the order the catalogue used before display_order.
          q
            .order("featured", { ascending: false })
            .order("created_at", { ascending: false });
    });
    return toExams(rows as ExamRow[]);
  } catch {
    return [];
  }
});

/** Featured published exams for the homepage. */
export async function getFeaturedExams(limit = 3): Promise<Exam[]> {
  const exams = await getExams();
  return exams.filter((e) => e.featured).slice(0, limit);
}

/** A single published exam by slug (null if missing/unpublished). */
export async function getExamBySlug(slug: string): Promise<Exam | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createPublicClient();
    const data = await runExamQuery((columns) =>
      supabase
        .from("exams")
        .select(columns)
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle(),
    );
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
    const data = await runExamQuery((columns) =>
      supabase
        .from("exams")
        .select(columns)
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle(),
    );
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
    const rows = await runExamQuery((columns, hasDisplayOrder) => {
      const q = supabase
        .from("exams")
        .select(columns)
        .in("id", ids)
        .eq("status", "published");
      return hasDisplayOrder
        ? q
            .order("display_order", { ascending: true })
            .order("created_at", { ascending: false })
        : q.order("created_at", { ascending: false });
    });
    return toExams(rows as ExamRow[]);
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
