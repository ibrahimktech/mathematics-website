import type { ExamAttempt, ExamStatus, Purchase, PurchaseStatus } from "./types";

/**
 * How many times one student may attempt one exam.
 *
 * ⚠️ This copy is for DISPLAY ONLY. The enforcing copy is
 * `public.max_exam_attempts()` in `supabase/exam-attempt-limit.sql`, read by a
 * BEFORE INSERT trigger on `exam_attempts` that rejects the extra attempt no
 * matter who writes it. Keep the two numbers in step.
 */
export const MAX_EXAM_ATTEMPTS = 2;

/** Attempts sorted oldest → newest (the order they were taken in). */
function chronological(attempts: ExamAttempt[]): ExamAttempt[] {
  return [...attempts].sort(
    (a, b) =>
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );
}

/**
 * Pure helper (no I/O) that derives a student's state for one PUBLISHED exam
 * from their access grants + purchases + attempts. Used by the dashboard and
 * the exams list.
 *
 * Access is the DB truth: `owned` is true only for a free exam or one with an
 * explicit `exam_access` grant (created server-side on admin approval). A
 * pending/denied purchase does NOT grant access — it only drives the label.
 *
 * Attempts are capped at MAX_EXAM_ATTEMPTS. STARTING an attempt consumes it, so
 * an open (in_progress) attempt counts towards `attemptsUsed` exactly like a
 * finished one — mirroring what the database trigger counts.
 */
export function computeExamState(
  examId: string,
  price: number,
  accessIds: Set<string>,
  purchases: Purchase[],
  attempts: ExamAttempt[],
): {
  owned: boolean;
  status: ExamStatus;
  purchaseStatus: PurchaseStatus | null;
  /** Whether the student may submit a (new) purchase request now. */
  canRequest: boolean;
  completedCount: number;
  bestScore: number | null;
  latestAttempt: ExamAttempt | null;
  inProgressId: string | null;
  /** Attempts consumed so far (in-progress included). */
  attemptsUsed: number;
  attemptsRemaining: number;
  attemptLimit: number;
  /** True when a brand-new attempt may still be started right now. */
  canStartNewAttempt: boolean;
  /** This exam's attempts, oldest first — the history list. */
  examAttempts: ExamAttempt[];
} {
  const owned = price === 0 || accessIds.has(examId);

  const mine = chronological(attempts.filter((a) => a.exam_id === examId));
  const completed = mine.filter((a) => a.status === "completed");
  const inProgress = mine.find((a) => a.status === "in_progress") ?? null;

  const attemptsUsed = mine.length;
  const attemptsRemaining = Math.max(0, MAX_EXAM_ATTEMPTS - attemptsUsed);

  // Latest purchase for this exam (purchases are passed newest-first).
  const latestPurchase =
    purchases.find((p) => p.exam_id === examId) ?? null;
  const purchaseStatus = latestPurchase?.status ?? null;

  let status: ExamStatus;
  if (owned) {
    // An open attempt always wins: it can be resumed even on the last attempt.
    if (inProgress) status = "in_progress";
    else if (attemptsRemaining === 0 && attemptsUsed > 0) status = "exhausted";
    else if (completed.length > 0) status = "completed";
    else status = "owned";
  } else if (purchaseStatus === "pending") {
    status = "pending";
  } else if (purchaseStatus === "denied") {
    status = "denied";
  } else {
    status = "available";
  }

  const canRequest = !owned && purchaseStatus !== "pending";

  const bestScore = completed.length
    ? completed.reduce((m, a) => Math.max(m, a.score ?? 0), 0)
    : null;

  const latestAttempt = mine.length ? mine[mine.length - 1] : null;

  return {
    owned,
    status,
    purchaseStatus,
    canRequest,
    completedCount: completed.length,
    bestScore,
    latestAttempt,
    inProgressId: inProgress?.id ?? null,
    attemptsUsed,
    attemptsRemaining,
    attemptLimit: MAX_EXAM_ATTEMPTS,
    canStartNewAttempt: owned && !inProgress && attemptsRemaining > 0,
    examAttempts: mine,
  };
}

const STATUS_LABELS: Record<ExamStatus, string> = {
  available: "Mövcud",
  pending: "Ödəniş yoxlanılır",
  denied: "Ödəniş rədd edildi",
  owned: "Alınıb",
  in_progress: "Davam edir",
  completed: "Tamamlanıb",
  exhausted: "Cəhdlər bitib",
};

export function examStatusLabel(s: ExamStatus): string {
  return STATUS_LABELS[s];
}

export function examStatusChipClass(s: ExamStatus): string {
  switch (s) {
    case "available":
      return "bg-secondary text-muted-foreground";
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "denied":
      return "bg-destructive/10 text-destructive";
    case "owned":
      return "bg-sky-50 text-sky-700";
    case "in_progress":
      return "bg-amber-50 text-amber-700";
    case "completed":
      return "bg-emerald-50 text-emerald-700";
    case "exhausted":
      return "bg-slate-100 text-slate-600";
  }
}

/** "Bu imtahan üçün maksimum cəhd sayına çatmısınız." — one wording, everywhere. */
export const ATTEMPTS_EXHAUSTED_MESSAGE =
  "Bu imtahan üçün maksimum cəhd sayına çatmısınız.";
