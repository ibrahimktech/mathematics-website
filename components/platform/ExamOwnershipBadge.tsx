"use client";

import { useExamOwnership } from "@/lib/account/use-exam-ownership";
import { examStatusChipClass, examStatusLabel } from "@/lib/student/status";
import { cn } from "@/lib/utils";

/**
 * "Alınıb" / "Ödəniş yoxlanılır" chip on the PUBLIC exam card. Renders nothing
 * in the static HTML and for signed-out visitors / non-owners / free exams —
 * the card looks exactly as before — and appears only once the client session
 * resolves to an owner or a pending purchase (see `useExamOwnership`).
 */
export function ExamOwnershipBadge({
  examId,
  paid,
}: {
  examId: string;
  paid: boolean;
}) {
  const ownership = useExamOwnership();
  if (!paid || ownership.status !== "ready") return null;

  const state = ownership.ownedIds.has(examId)
    ? ("owned" as const)
    : ownership.pendingIds.has(examId)
      ? ("pending" as const)
      : null;
  if (!state) return null;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        examStatusChipClass(state),
      )}
    >
      {examStatusLabel(state)}
    </span>
  );
}
