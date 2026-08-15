import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/account/auth";
import { getExams } from "@/lib/exams";
import {
  getMyAttempts,
  getMyAccessExamIds,
  getMyPurchases,
} from "@/lib/student/queries";
import {
  computeExamState,
  examStatusChipClass,
  examStatusLabel,
} from "@/lib/student/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Panel", robots: { index: false, follow: false } };

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-card rounded-xl border p-5">
      <p className="font-display text-foreground text-3xl font-bold tabular-nums">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 text-sm">{label}</p>
    </div>
  );
}

export default async function DashboardOverview() {
  const user = await requireUser("/panel");
  const [exams, accessIds, purchases, attempts] = await Promise.all([
    getExams(),
    getMyAccessExamIds(),
    getMyPurchases(),
    getMyAttempts(),
  ]);
  // "Owned" = explicit grants + free exams the student actually started.
  // An untouched free exam is merely available, not theirs yet.
  const attemptedIds = new Set(attempts.map((a) => a.exam_id));
  const ownedExams = exams.filter(
    (e) => accessIds.has(e.id) || (e.price === 0 && attemptedIds.has(e.id)),
  );

  const examMap = new Map(exams.map((e) => [e.id, e]));
  const completed = attempts.filter((a) => a.status === "completed");
  const inProgress = attempts.find((a) => a.status === "in_progress") ?? null;
  const avgScore = completed.length
    ? Math.round(
        completed.reduce((s, a) => s + (a.score ?? 0), 0) / completed.length,
      )
    : null;

  const displayName = user.name ?? user.email?.split("@")[0] ?? "tələbə";

  return (
    <div>
      <header>
        <h1 className="font-display text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
          Salam, {displayName}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          İmtahanlarına və nəticələrinə buradan bax.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="İmtahanlarım" value={String(ownedExams.length)} />
        <StatTile label="Tamamlanmış cəhd" value={String(completed.length)} />
        <StatTile label="Orta bal" value={avgScore === null ? "—" : `${avgScore}%`} />
      </div>

      {inProgress && examMap.get(inProgress.exam_id) && (
        <Link
          href={`/panel/imtahan/${inProgress.exam_id}`}
          className="border-primary/20 mt-6 flex items-center justify-between gap-4 rounded-xl border bg-[#eef4ff] p-5 transition-colors hover:bg-[#e6efff]"
        >
          <div className="flex items-center gap-3">
            <PlayCircle className="text-primary size-6 shrink-0" />
            <div>
              <p className="text-foreground text-sm font-semibold">
                Yarımçıq imtahanın var
              </p>
              <p className="text-muted-foreground text-sm">
                {examMap.get(inProgress.exam_id)!.title}
              </p>
            </div>
          </div>
          <span className="text-primary inline-flex items-center gap-1 text-sm font-semibold">
            Davam et <ArrowRight className="size-4" />
          </span>
        </Link>
      )}

      {/* Owned exams (purchased + started free ones) */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-foreground text-lg font-bold">
            Sənin imtahanların
          </h2>
          <Link
            href="/panel/imtahanlar"
            className="text-primary hover:text-primary-hover text-sm font-semibold"
          >
            Hamısı
          </Link>
        </div>

        {ownedExams.length ? (
          <ul className="border-border mt-4 divide-y rounded-xl border">
            {ownedExams.map((exam) => {
              const state = computeExamState(
                exam.id,
                exam.price,
                accessIds,
                purchases,
                attempts,
              );
              return (
                <li
                  key={exam.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {exam.title}
                    </p>
                    <p className="mt-1">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          examStatusChipClass(state.status),
                        )}
                      >
                        {examStatusLabel(state.status)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {state.bestScore !== null && (
                      <span className="text-foreground text-sm font-semibold tabular-nums">
                        {state.bestScore}%
                      </span>
                    )}
                    {state.status === "in_progress" ? (
                      <Link
                        href={`/panel/imtahan/${exam.id}`}
                        className="text-primary text-sm font-semibold"
                      >
                        Davam et
                      </Link>
                    ) : (
                      <Link
                        href={`/panel/imtahanlar?exam=${exam.id}`}
                        className="text-primary text-sm font-semibold"
                      >
                        Bax
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-border text-muted-foreground mt-4 rounded-xl border border-dashed p-8 text-center text-sm">
            Hələ imtahanın yoxdur.{" "}
            <Link href="/panel/imtahanlar" className="text-primary font-semibold">
              İmtahanlara bax
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
