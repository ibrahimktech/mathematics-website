"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { submitAttempt } from "@/lib/student/actions";
import { Tex } from "./Tex";
import { cn } from "@/lib/utils";
import type { ExamQuestion } from "@/lib/exams/types";

/**
 * The exam-taking interface. Clean sans-serif (inside `.app-ui`), one question
 * per view with a question palette, a countdown timer (auto-submits at zero),
 * and server-side grading on submit. Fully responsive: the palette wraps and the
 * navigation collapses to a sticky bottom bar on small screens.
 */
export function ExamRunner({
  examTitle,
  durationMinutes,
  questions,
  attemptId,
  startedAt,
  initialAnswers,
}: {
  examTitle: string;
  durationMinutes: number;
  questions: ExamQuestion[];
  attemptId: string;
  startedAt: string;
  initialAnswers: Record<string, number>;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>(
    initialAnswers ?? {},
  );
  const [current, setCurrent] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const deadline = useMemo(
    () => new Date(startedAt).getTime() + durationMinutes * 60_000,
    [startedAt, durationMinutes],
  );
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((deadline - Date.now()) / 1000)),
  );

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const res = await submitAttempt(attemptId, answers);
    if (!res.ok) {
      submittedRef.current = false;
      setSubmitting(false);
      toast.error(res.error);
      return;
    }
    router.push(`/panel/netice/${attemptId}`);
  }, [attemptId, answers, router]);

  // Countdown; auto-submit at zero.
  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        void doSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline, doSubmit]);

  const answeredCount = Object.keys(answers).length;
  const q = questions[current];
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const low = remaining <= 60;

  function select(choice: number) {
    setAnswers((a) => ({ ...a, [q.id]: choice }));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:px-6">
      {/* Sticky header: title + timer */}
      <div className="bg-background/95 border-border sticky top-16 z-20 -mx-4 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <p className="text-foreground truncate text-sm font-semibold">
          {examTitle}
        </p>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
            low ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground",
          )}
          aria-live="polite"
        >
          <Clock className="size-4" /> {mm}:{ss}
        </div>
      </div>

      {/* Progress + palette */}
      <div className="mt-5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Sual {current + 1} / {questions.length}
        </span>
        <span className="text-muted-foreground">
          Cavablanıb: {answeredCount}/{questions.length}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {questions.map((question, i) => {
          const answered = question.id in answers;
          const isCurrent = i === current;
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Sual ${i + 1}`}
              className={cn(
                "size-8 rounded-lg border text-sm font-semibold transition-colors",
                isCurrent
                  ? "border-primary text-primary ring-primary/30 ring-2"
                  : answered
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Question */}
      <div className="border-border bg-card mt-6 rounded-2xl border p-5 sm:p-7">
        <span className="text-primary text-xs font-semibold tracking-wide uppercase">
          Sual {current + 1}
        </span>
        <Tex className="text-foreground mt-2 text-base sm:text-lg">
          {q.prompt}
        </Tex>

        <div className="mt-5 space-y-2.5">
          {q.choices.map((choice, i) => {
            const selected = answers[q.id] === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => select(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                  selected
                    ? "border-primary bg-accent/50"
                    : "border-border hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <Tex className="text-foreground">{choice}</Tex>
              </button>
            );
          })}
        </div>
      </div>

      {/* Desktop nav */}
      <div className="mt-6 hidden items-center justify-between sm:flex">
        <button
          type="button"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="border-border text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40"
        >
          <ChevronLeft className="size-4" /> Əvvəlki
        </button>
        {current < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
          >
            Növbəti <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold transition-colors"
          >
            Təqdim et
          </button>
        )}
      </div>

      {/* Mobile sticky nav */}
      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 border-t px-4 py-3 backdrop-blur sm:hidden">
        <button
          type="button"
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="border-border text-foreground inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          <ChevronLeft className="size-4" /> Geri
        </button>
        {current < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            className="bg-primary text-primary-foreground inline-flex flex-1 items-center justify-center gap-1 rounded-full px-4 py-2 text-sm font-semibold"
          >
            Növbəti <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="bg-primary text-primary-foreground inline-flex flex-1 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold"
          >
            Təqdim et
          </button>
        )}
      </div>

      {/* Submit confirmation */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-xl">
            <h2 className="font-display text-foreground text-lg font-bold">
              İmtahanı təqdim et?
            </h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              {answeredCount < questions.length
                ? `${questions.length - answeredCount} sual cavablanmayıb. Təqdim etdikdən sonra dəyişmək olmaz.`
                : "Bütün suallar cavablanıb. Təqdim etdikdən sonra dəyişmək olmaz."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="border-border text-foreground hover:bg-muted rounded-full border px-4 py-2 text-sm font-semibold"
              >
                Ləğv et
              </button>
              <button
                type="button"
                onClick={doSubmit}
                disabled={submitting}
                className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />} Təqdim et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
