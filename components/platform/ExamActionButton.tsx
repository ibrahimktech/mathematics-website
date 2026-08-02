"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Clock, Lock } from "lucide-react";
import { startAttempt } from "@/lib/student/actions";
import type { ExamStatus } from "@/lib/student/types";
import { cn } from "@/lib/utils";

/**
 * The per-exam action on the dashboard. Reflects the student's REAL state
 * (derived server-side from access grants + purchases + attempts):
 *   available   → go to the manual-payment page
 *   pending     → disabled ("payment under review")
 *   denied      → re-submit a request
 *   owned       → start the exam (server-verified access)
 *   in_progress → continue (resuming costs nothing)
 *   completed   → view result + start the remaining attempt
 *   exhausted   → disabled; every allowed attempt has been used
 *
 * Starting always goes through the `startAttempt` server action, which re-checks
 * access AND the attempt limit against the database; the disabled button and the
 * confirmation dialog are UX, never the security boundary.
 */
export function ExamActionButton({
  examId,
  status,
  completedAttemptId,
  attemptsUsed,
  attemptsRemaining,
  attemptLimit,
}: {
  examId: string;
  status: ExamStatus;
  completedAttemptId: string | null;
  attemptsUsed: number;
  attemptsRemaining: number;
  attemptLimit: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function begin() {
    setConfirming(false);
    startTransition(async () => {
      const res = await startAttempt(examId);
      if (!res.ok) {
        toast.error(res.error);
        // The server refused — its view of the attempt count is the real one,
        // so pull fresh state instead of leaving a stale button on screen.
        router.refresh();
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
  } else if (status === "exhausted") {
    action = (
      <button
        type="button"
        disabled
        title="Bu imtahan üçün maksimum cəhd sayına çatmısınız."
        className={cn(outline, "cursor-not-allowed opacity-60")}
      >
        <Lock className="size-4" /> Cəhdlər bitib
      </button>
    );
  } else if (status === "completed") {
    action = (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className={outline}
      >
        {pending && <Loader2 className="size-4 animate-spin" />} Yenidən
      </button>
    );
  } else {
    // owned, not started
    action = (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className={primary}
      >
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

      {/* Starting spends an attempt, so say so before it happens. */}
      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="bg-card w-full max-w-md rounded-2xl p-6 text-left shadow-xl">
            <h2 className="font-display text-foreground text-lg font-bold">
              İmtahana başlanılsın?
            </h2>
            <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
              <li className="flex gap-2">
                <span aria-hidden className="text-primary">
                  •
                </span>
                Bu imtahan üçün maksimum {attemptLimit} cəhd hüququnuz var
                ({attemptsUsed}/{attemptLimit} istifadə olunub, {attemptsRemaining}{" "}
                qalıb).
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-primary">
                  •
                </span>
                Başlamaq dərhal bir cəhdi istifadə edir və cəhd geri qaytarılmır.
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-primary">
                  •
                </span>
                İmtahandan çıxsanız və ya səhifəni bağlasanız, cavablarınız
                avtomatik təqdim ediləcək.
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-primary">
                  •
                </span>
                Davam etməzdən əvvəl kifayət qədər vaxtınızın və sabit internet
                bağlantınızın olduğundan əmin olun.
              </li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="border-border text-foreground hover:bg-muted rounded-full border px-4 py-2 text-sm font-semibold"
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={begin}
                disabled={pending}
                className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {pending && <Loader2 className="size-4 animate-spin" />} İmtahana
                başla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
