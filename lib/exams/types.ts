/**
 * Domain types for the exam platform. CLIENT-SAFE (no `server-only`) so both
 * server pages and client components (`ExamRunner`, `ExamPurchasePanel`) can
 * import them. Data access lives in `lib/exams.ts` (server-only).
 *
 * These mirror `public.exams` / `public.exam_questions` in
 * `supabase/exam-platform-schema.sql`, but use camelCase so the many existing
 * components that read `exam.problemCount`, `exam.categorySlug`, … keep working.
 */

export type ExamDifficulty =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "olympiad";

export type ExamStatus = "draft" | "published" | "archived";

/** A published exam as shown in the catalogue / detail page. */
export interface Exam {
  /** UUID — used in slugs indirectly and as the FK on purchases/attempts. */
  id: string;
  title: string;
  /** URL slug: /imtahanlar/[slug]. */
  slug: string;
  /** Human topic label (resolved from the blog category name; falls back to the slug). */
  topic: string;
  /** Ties an exam to a blog category slug for cross-linking. */
  categorySlug: string;
  difficulty: ExamDifficulty;
  /** Price in `currency` (0 = free). Always from the DB — never hard-coded in UI. */
  price: number;
  currency: string;
  durationMinutes: number;
  /** Number of questions (denormalized `question_count`). */
  problemCount: number;
  summary: string;
  description: string;
  /** Subtopics listed on the detail page. */
  covers: string[];
  featured: boolean;
  status: ExamStatus;
  updatedAt: string;
  createdAt: string;
}

/** The raw `public.exams` row shape (snake_case) returned by Supabase. */
export interface ExamRow {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  category_slug: string | null;
  difficulty: ExamDifficulty;
  price: number;
  currency: string;
  duration_minutes: number;
  covers: string[] | null;
  featured: boolean;
  status: ExamStatus;
  question_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * A question as delivered to a STUDENT — prompt + answer choices only. The
 * correct answer and explanation are NEVER part of this type; they stay on the
 * server (DB `correct_index`/`explanation`, exposed only via graded results).
 */
export interface ExamQuestion {
  id: string;
  /** LaTeX prompt (rendered with KaTeX). */
  prompt: string;
  /** LaTeX answer choices. */
  choices: string[];
}

/** A question as seen by an ADMIN (includes the correct answer + explanation). */
export interface AdminExamQuestion extends ExamQuestion {
  examId: string;
  position: number;
  correctIndex: number | null;
  explanation: string | null;
}

/** True for free practice sets. */
export function isFreeExam(exam: Exam): boolean {
  return exam.price === 0;
}
