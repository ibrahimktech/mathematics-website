import type { ExamAttempt, ExamStatus, Purchase, PurchaseStatus } from "./types";

/**
 * Pure helper (no I/O) that derives a student's state for one PUBLISHED exam
 * from their access grants + purchases + attempts. Used by the dashboard and
 * the exams list.
 *
 * Access is the DB truth: `owned` is true only for a free exam or one with an
 * explicit `exam_access` grant (created server-side on admin approval). A
 * pending/denied purchase does NOT grant access — it only drives the label.
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
} {
  const owned = price === 0 || accessIds.has(examId);

  const mine = attempts.filter((a) => a.exam_id === examId);
  const completed = mine.filter((a) => a.status === "completed");
  const inProgress = mine.find((a) => a.status === "in_progress") ?? null;

  // Latest purchase for this exam (purchases are passed newest-first).
  const latestPurchase =
    purchases.find((p) => p.exam_id === examId) ?? null;
  const purchaseStatus = latestPurchase?.status ?? null;

  let status: ExamStatus;
  if (owned) {
    if (inProgress) status = "in_progress";
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

  const latestAttempt =
    [...mine].sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
    )[0] ?? null;

  return {
    owned,
    status,
    purchaseStatus,
    canRequest,
    completedCount: completed.length,
    bestScore,
    latestAttempt,
    inProgressId: inProgress?.id ?? null,
  };
}

const STATUS_LABELS: Record<ExamStatus, string> = {
  available: "Mövcud",
  pending: "Ödəniş yoxlanılır",
  denied: "Ödəniş rədd edildi",
  owned: "Alınıb",
  in_progress: "Davam edir",
  completed: "Tamamlanıb",
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
  }
}
