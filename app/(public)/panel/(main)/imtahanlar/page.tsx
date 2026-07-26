import type { Metadata } from "next";
import { ListChecks, Clock } from "lucide-react";
import { requireUser } from "@/lib/account/auth";
import {
  getExams,
  difficultyLabel,
  difficultyChipClass,
  formatDuration,
  formatPrice,
} from "@/lib/exams";
import {
  getMyAttempts,
  getMyAccessExamIds,
  getMyPurchases,
} from "@/lib/student/queries";
import { computeExamState, examStatusChipClass, examStatusLabel } from "@/lib/student/status";
import { ExamActionButton } from "@/components/platform/ExamActionButton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "İmtahanlarım", robots: { index: false, follow: false } };

export default async function DashboardExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ exam?: string }>;
}) {
  await requireUser("/panel/imtahanlar");
  const { exam: selected } = await searchParams;

  const [exams, accessIds, purchases, attempts] = await Promise.all([
    getExams(),
    getMyAccessExamIds(),
    getMyPurchases(),
    getMyAttempts(),
  ]);

  // Selected exam (from the Buy-Exam flow) floats to the top.
  const ordered = [...exams].sort((a, b) =>
    a.id === selected ? -1 : b.id === selected ? 1 : 0,
  );

  return (
    <div>
      <header>
        <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
          İmtahanlar
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          İmtahanı al, başla və nəticələrinə bax.
        </p>
      </header>

      <div className="mt-6 space-y-3">
        {ordered.map((exam) => {
          const state = computeExamState(
            exam.id,
            exam.price,
            accessIds,
            purchases,
            attempts,
          );
          const completedForExam = attempts
            .filter((a) => a.exam_id === exam.id && a.status === "completed")
            .sort(
              (a, b) =>
                new Date(b.finished_at ?? b.started_at).getTime() -
                new Date(a.finished_at ?? a.started_at).getTime(),
            );
          const completedAttemptId = completedForExam[0]?.id ?? null;
          const isSelected = exam.id === selected;

          return (
            <div
              key={exam.id}
              className={cn(
                "border-border bg-card flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between",
                isSelected && "ring-primary/40 ring-2",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-accent text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    {exam.topic}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      difficultyChipClass(exam.difficulty),
                    )}
                  >
                    {difficultyLabel(exam.difficulty)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      examStatusChipClass(state.status),
                    )}
                  >
                    {examStatusLabel(state.status)}
                  </span>
                </div>

                <h2 className="text-foreground mt-2.5 font-semibold">
                  {exam.title}
                </h2>

                <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="size-3.5" /> {exam.problemCount} sual
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" /> {formatDuration(exam.durationMinutes)}
                  </span>
                  <span className={exam.price === 0 ? "font-semibold text-emerald-600" : ""}>
                    {formatPrice(exam.price, exam.currency)}
                  </span>
                  {state.bestScore !== null && (
                    <span className="text-foreground font-semibold">
                      Ən yaxşı: {state.bestScore}%
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                <ExamActionButton
                  examId={exam.id}
                  status={state.status}
                  completedAttemptId={completedAttemptId}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
