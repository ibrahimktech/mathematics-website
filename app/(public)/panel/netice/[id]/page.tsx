import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { requireUser } from "@/lib/account/auth";
import { getExamById } from "@/lib/exams";
import { getStudentExamQuestions } from "@/lib/exams/questions";
import { getReviewKey } from "@/lib/exams/grade";
import { getMyAttemptById } from "@/lib/student/queries";
import { MAX_EXAM_ATTEMPTS } from "@/lib/student/status";
import { formatDate } from "@/lib/format";
import { Tex } from "@/components/platform/Tex";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

function durationLabel(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} san`;
  return s ? `${m} dəq ${s} san` : `${m} dəq`;
}

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("/panel");
  const { id } = await params;

  // RLS guarantees this returns the attempt ONLY if it belongs to the caller —
  // another student's attempt id yields null → 404.
  const attempt = await getMyAttemptById(id);
  if (!attempt) notFound();
  if (attempt.status !== "completed") {
    redirect(`/panel/imtahan/${attempt.exam_id}`);
  }

  const [exam, questions, reviewKey] = await Promise.all([
    getExamById(attempt.exam_id),
    getStudentExamQuestions(attempt.exam_id),
    getReviewKey(attempt.exam_id),
  ]);
  const score = attempt.score ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-10">
      <Link
        href="/panel/neticeler"
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> Nəticələr
      </Link>

      {/* Score summary */}
      <div className="border-border bg-card mt-6 rounded-2xl border p-6 sm:p-8">
        <p className="text-muted-foreground text-sm">
          {exam?.title ?? attempt.exam_id}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <p
              className={cn(
                "font-display text-5xl font-bold tabular-nums",
                score >= 70
                  ? "text-emerald-600"
                  : score >= 40
                    ? "text-amber-600"
                    : "text-foreground",
              )}
            >
              {score}%
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {attempt.correct_count ?? 0} / {attempt.total_count ?? 0} düzgün
            </p>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">
              Tarix:{" "}
              <span className="text-foreground font-medium">
                {formatDate(attempt.finished_at ?? attempt.started_at)}
              </span>
            </p>
            <p className="text-muted-foreground mt-1">
              Vaxt:{" "}
              <span className="text-foreground font-medium">
                {durationLabel(attempt.duration_seconds)}
              </span>
            </p>
            {/* `typeof` (not `!== null`): the column is absent, so undefined,
                until supabase/exam-attempt-limit.sql has been applied. */}
            {typeof attempt.attempt_number === "number" && (
              <p className="text-muted-foreground mt-1">
                Cəhd:{" "}
                <span className="text-foreground font-medium tabular-nums">
                  {attempt.attempt_number}/{MAX_EXAM_ATTEMPTS}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Per-question review */}
      <h2 className="font-display text-foreground mt-10 text-lg font-bold">
        Cavabların təhlili
      </h2>
      <div className="mt-4 space-y-4">
        {questions.map((q, qi) => {
          const review = reviewKey[q.id];
          const correctIndex = review?.correctIndex ?? undefined;
          const explanation = review?.explanation ?? null;
          const theirIndex = attempt.answers?.[q.id];
          const isCorrect = theirIndex === correctIndex;
          return (
            <div
              key={q.id}
              className="exam-watermark border-border bg-card rounded-2xl border p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-primary text-xs font-semibold tracking-wide uppercase">
                  Sual {qi + 1}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    isCorrect
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-destructive/10 text-destructive",
                  )}
                >
                  {isCorrect ? (
                    <>
                      <Check className="size-3" /> Düzgün
                    </>
                  ) : (
                    <>
                      <X className="size-3" /> Səhv
                    </>
                  )}
                </span>
              </div>

              <Tex className="text-foreground mt-2">{q.prompt}</Tex>

              <div className="mt-4 space-y-2">
                {q.choices.map((choice, i) => {
                  const isRight = i === correctIndex;
                  const isTheirs = i === theirIndex;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 text-sm",
                        isRight
                          ? "border-emerald-200 bg-emerald-50"
                          : isTheirs
                            ? "border-destructive/30 bg-destructive/5"
                            : "border-border",
                      )}
                    >
                      <span className="text-muted-foreground w-5 shrink-0 font-bold">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <Tex className="text-foreground flex-1">{choice}</Tex>
                      {isRight && (
                        <span className="shrink-0 text-xs font-semibold text-emerald-700">
                          Düzgün
                        </span>
                      )}
                      {isTheirs && !isRight && (
                        <span className="text-destructive shrink-0 text-xs font-semibold">
                          Sənin cavabın
                        </span>
                      )}
                    </div>
                  );
                })}
                {theirIndex === undefined && (
                  <p className="text-muted-foreground text-xs">
                    Bu sual cavablanmayıb.
                  </p>
                )}
              </div>

              {explanation && (
                <div className="border-border bg-secondary/40 mt-4 rounded-lg border p-4">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Həll
                  </p>
                  <Tex className="text-foreground mt-1.5 text-sm">
                    {explanation}
                  </Tex>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/panel/imtahanlar"
          className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          Başqa imtahan
        </Link>
        <Link
          href="/panel/neticeler"
          className="border-border text-foreground hover:bg-muted inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-semibold"
        >
          Bütün nəticələr
        </Link>
      </div>
    </div>
  );
}
