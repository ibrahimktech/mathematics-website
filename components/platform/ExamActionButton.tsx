"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Clock } from "lucide-react";
import { startAttempt } from "@/lib/student/actions";
import type { ExamStatus } from "@/lib/student/types";
import { cn } from "@/lib/utils";

/**
 * The per-exam action on the dashboard. Reflects the student's REAL state
 * (derived server-side from access grants + purchases + attempts):
 *   available → go to the manual-payment page
 *   pending   → disabled ("payment under review")
 *   denied    → re-submit a request
 *   owned     → start the exam (server-verified access)
 *   in_progress → continue
 *   completed → view result + retry
 * Starting/continuing goes through the `startAttempt` server action, which
 * re-checks access; a disabled button is never the security boundary.
 */
export function ExamActionButton({
  examId,
  status,
  completedAttemptId,
}: {
  examId: string;
  status: ExamStatus;
  completedAttemptId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function begin() {
    startTransition(async () => {
      const res = await startAttempt(examId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push(`/panel/imtahan/${examId}`);
    });
  }

  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60";
  const primary = cn(base, "bg-primary text-primary-foreground hover:bg-primary-hover");
  const outline = cn(base, "border-border text-foreground hover:bg-muted border");

  let action: React.ReactNode;
  if (status === "available") {
    action = (
      <Link href={`/panel/odenis/${examId}`} className={primary}>
        İmtahanı al
      </Link>
    );
  } else if (status === "pending") {
    action = (
      <span className={cn(outline, "cursor-default opacity-70")}>
        <Clock className="size-4" /> Ödəniş yoxlanılır
      </span>
    );
  } else if (status === "denied") {
    action = (
      <Link href={`/panel/odenis/${examId}`} className={primary}>
        Yenidən sorğu göndər
      </Link>
    );
  } else if (status === "in_progress") {
    action = (
      <button
        type="button"
        onClick={() => router.push(`/panel/imtahan/${examId}`)}
        className={primary}
      >
        Davam et
      </button>
    );
  } else if (status === "completed") {
    action = (
      <button type="button" onClick={begin} disabled={pending} className={outline}>
        {pending && <Loader2 className="size-4 animate-spin" />} Yenidən
      </button>
    );
  } else {
    // owned, not started
    action = (
      <button type="button" onClick={begin} disabled={pending} className={primary}>
        {pending && <Loader2 className="size-4 animate-spin" />} Başla
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {completedAttemptId && (
        <Link href={`/panel/netice/${completedAttemptId}`} className={outline}>
          Nəticə
        </Link>
      )}
      {action}
    </div>
  );
}
