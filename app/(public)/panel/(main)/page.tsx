import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/account/auth";
import { getExams } from "@/lib/exams";
import { getMyAttempts, getMyAccessExamIds } from "@/lib/student/queries";
import { formatDate } from "@/lib/format";
import {
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
  const [exams, accessIds, attempts] = await Promise.all([
    getExams(),
    getMyAccessExamIds(),
    getMyAttempts(),
  ]);
  // "Owned" = free published exams + explicit grants.
  const ownedCount = new Set([
    ...accessIds,
    ...exams.filter((e) => e.price === 0).map((e) => e.id),
  ]).size;

  const examMap = new Map(exams.map((e) => [e.id, e]));
  const completed = attempts.filter((a) => a.status === "completed");
  const inProgress = attempts.find((a) => a.status === "in_progress") ?? null;
  const avgScore = completed.length
    ? Math.round(
        completed.reduce((s, a) => s + (a.score ?? 0), 0) / completed.length,
      )
    : null;

  const displayName = user.name ?? user.email?.split("@")[0] ?? "tələbə";
  const recent = attempts.slice(0, 4);

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
        <StatTile label="Mövcud imtahan" value={String(ownedCount)} />
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

      {/* Recent activity */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-foreground text-lg font-bold">
            Son fəaliyyət
          </h2>
          <Link
            href="/panel/neticeler"
            className="text-primary hover:text-primary-hover text-sm font-semibold"
          >
            Hamısı
          </Link>
        </div>

        {recent.length ? (
          <ul className="border-border mt-4 divide-y rounded-xl border">
            {recent.map((a) => {
              const exam = examMap.get(a.exam_id);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">
                      {exam?.title ?? a.exam_id}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(a.started_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {a.status === "completed" ? (
                      <>
                        <span className="text-foreground text-sm font-semibold tabular-nums">
                          {a.score ?? 0}%
                        </span>
                        <Link
                          href={`/panel/netice/${a.id}`}
                          className="text-primary text-sm font-semibold"
                        >
                          Nəticə
                        </Link>
                      </>
                    ) : (
                      <>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            examStatusChipClass("in_progress"),
                          )}
                        >
                          {examStatusLabel("in_progress")}
                        </span>
                        <Link
                          href={`/panel/imtahan/${a.exam_id}`}
                          className="text-primary text-sm font-semibold"
                        >
                          Davam et
                        </Link>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="border-border text-muted-foreground mt-4 rounded-xl border border-dashed p-8 text-center text-sm">
            Hələ fəaliyyət yoxdur.{" "}
            <Link href="/panel/imtahanlar" className="text-primary font-semibold">
              İmtahanlara bax
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
