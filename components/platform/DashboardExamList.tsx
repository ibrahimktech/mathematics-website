"use client";

import { useMemo, useState } from "react";
import { ListChecks, Clock, Search } from "lucide-react";
import type { Exam } from "@/lib/exams/types";
import {
  difficultyLabel,
  difficultyChipClass,
  formatDuration,
  formatPrice,
} from "@/lib/exams/display";
import {
  type computeExamState,
  examStatusChipClass,
  examStatusLabel,
} from "@/lib/student/status";
import { ExamActionButton } from "./ExamActionButton";
import { AttemptHistory } from "./AttemptHistory";
import { cn } from "@/lib/utils";

type ExamState = ReturnType<typeof computeExamState>;

/**
 * The student's exam rows on /panel/imtahanlar, with a search box on top.
 * The page hands over every exam WITH its per-student state precomputed
 * server-side (the purchase/attempt tables never reach the client), already
 * ordered so a just-purchased `?exam=` floats first — search only narrows,
 * it never reorders. Filtering is in-memory over a handful of rows, same
 * reasoning as `ResourceLibrary`: a round trip per keystroke buys nothing.
 */
export function DashboardExamList({
  rows,
  selectedId,
}: {
  rows: { exam: Exam; state: ExamState }[];
  selectedId: string | null;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    // "az" locale is load-bearing: İ→i and I→ı.
    const q = query.trim().toLocaleLowerCase("az");
    if (!q) return rows;
    return rows.filter(({ exam, state }) => {
      const haystack = [
        exam.title,
        exam.summary,
        exam.description,
        exam.topic,
        difficultyLabel(exam.difficulty),
        examStatusLabel(state.status),
      ];
      return haystack.some((v) => v?.toLocaleLowerCase("az").includes(q));
    });
  }, [rows, query]);

  return (
    <div>
      <div className="relative mt-6">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ad və ya mövzu üzrə axtar"
          aria-label="İmtahanlarda axtar"
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-10 w-full rounded-lg border pr-3 pl-9 text-sm outline-none focus-visible:ring-[3px]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="border-border text-muted-foreground bg-card mt-6 rounded-xl border border-dashed p-12 text-center text-sm">
          Axtarışa uyğun imtahan tapılmadı.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map(({ exam, state }) => {
            const completedForExam = state.examAttempts
              .filter((a) => a.status === "completed")
              .sort(
                (a, b) =>
                  new Date(b.finished_at ?? b.started_at).getTime() -
                  new Date(a.finished_at ?? a.started_at).getTime(),
              );
            const completedAttemptId = completedForExam[0]?.id ?? null;
            const isSelected = exam.id === selectedId;

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
                    <span className={exam.price === 0 ? "text-primary font-semibold" : ""}>
                      {formatPrice(exam.price, exam.currency)}
                    </span>
                    {state.bestScore !== null && (
                      <span className="text-foreground font-semibold">
                        Ən yaxşı: {state.bestScore}%
                      </span>
                    )}
                  </div>

                  {/* Attempt ledger — only meaningful once the exam is unlocked. */}
                  {state.owned && (
                    <AttemptHistory
                      className="mt-3"
                      attempts={state.examAttempts}
                      attemptsUsed={state.attemptsUsed}
                      attemptsRemaining={state.attemptsRemaining}
                      attemptLimit={state.attemptLimit}
                    />
                  )}
                </div>

                <div className="shrink-0">
                  <ExamActionButton
                    examId={exam.id}
                    status={state.status}
                    completedAttemptId={completedAttemptId}
                    attemptsUsed={state.attemptsUsed}
                    attemptsRemaining={state.attemptsRemaining}
                    attemptLimit={state.attemptLimit}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
