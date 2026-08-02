import { Lock } from "lucide-react";
import { formatBakuDateTime } from "@/lib/format";
import { ATTEMPTS_EXHAUSTED_MESSAGE } from "@/lib/student/status";
import type { ExamAttempt } from "@/lib/student/types";
import { cn } from "@/lib/utils";

/**
 * Per-exam attempt ledger for the student dashboard: how many of the allowed
 * attempts are spent, how many are left, and what each earlier attempt scored.
 *
 * Server component — no client JS. Timestamps render in Asia/Baku like every
 * other timestamp on the platform, never UTC.
 */
export function AttemptHistory({
  attempts,
  attemptsUsed,
  attemptsRemaining,
  attemptLimit,
  className,
}: {
  /** This exam's attempts, oldest first. */
  attempts: ExamAttempt[];
  attemptsUsed: number;
  attemptsRemaining: number;
  attemptLimit: number;
  className?: string;
}) {
  const exhausted = attemptsRemaining === 0;

  return (
    <div className={cn("text-xs", className)}>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Cəhd:{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {attemptsUsed}/{attemptLimit}
          </span>
        </span>
        <span aria-hidden>·</span>
        <span>
          Qalan:{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              exhausted ? "text-destructive" : "text-foreground",
            )}
          >
            {attemptsRemaining}
          </span>
        </span>
      </div>

      {attempts.length > 0 && (
        <ul className="border-border mt-2 space-y-1 border-l pl-3">
          {attempts.map((a, i) => (
            <li
              key={a.id}
              className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5"
            >
              <span className="text-foreground font-medium">
                Cəhd {a.attempt_number ?? i + 1}
              </span>
              {a.status === "completed" ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatBakuDateTime(a.finished_at ?? a.started_at)}</span>
                  <span aria-hidden>·</span>
                  <span className="text-foreground font-semibold tabular-nums">
                    {a.score ?? 0}%
                  </span>
                  <span className="tabular-nums">
                    ({a.correct_count ?? 0}/{a.total_count ?? 0})
                  </span>
                </>
              ) : (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatBakuDateTime(a.started_at)}</span>
                  <span aria-hidden>·</span>
                  <span className="font-semibold text-amber-700">
                    Davam edir
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {exhausted && (
        <p className="text-destructive mt-2 flex items-start gap-1.5">
          <Lock className="mt-0.5 size-3 shrink-0" />
          {ATTEMPTS_EXHAUSTED_MESSAGE}
        </p>
      )}
    </div>
  );
}
