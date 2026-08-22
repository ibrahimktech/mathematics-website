"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Loader2, ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";
import { saveAttemptAnswers, submitAttempt } from "@/lib/student/actions";
import { Tex } from "./Tex";
import { cn } from "@/lib/utils";
import type { ExamQuestion } from "@/lib/exams/types";

/** Quiet period after an answer changes before it is autosaved. */
const AUTOSAVE_DEBOUNCE_MS = 1_200;
/** Safety-net autosave, so a save that failed silently gets retried. */
const AUTOSAVE_INTERVAL_MS = 30_000;
/** Unload beacon target — mirrors app/api/exam/auto-submit/route.ts. */
const AUTO_SUBMIT_URL = "/api/exam/auto-submit";

/** Shared dialog chrome, so every modal on this page looks identical. */
function Modal({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-xl">
        <h2 className="font-display text-foreground text-lg font-bold">{title}</h2>
        <div className="text-muted-foreground mt-1.5 text-sm">{children}</div>
        <div className="mt-5 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

/**
 * The countdown pill, isolated so its once-a-second `setState` re-renders only
 * the timer instead of the whole runner. The question below is LaTeX rendered
 * through `Tex`, and re-rendering that used to reassign `innerHTML` and wipe
 * the horizontal scroll position of a wide formula — `Tex` is memoised so it
 * cannot any more, but the clock still has no business re-rendering the
 * question, the palette and every answer choice sixty times a minute.
 *
 * `onExpire` is read through a ref so a new function identity can never restart
 * the interval; the deadline alone may.
 */
function Countdown({
  deadline,
  onExpire,
}: {
  deadline: number;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((deadline - Date.now()) / 1000)),
  );
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  // Auto-submit at zero.
  useEffect(() => {
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(t);
        expireRef.current();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const low = remaining <= 60;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums",
        low ? "bg-destructive/10 text-destructive" : "bg-secondary text-foreground",
      )}
      aria-live="polite"
    >
      <Clock className="size-4" /> {mm}:{ss}
    </div>
  );
}

/**
 * The exam-taking interface. Clean sans-serif (inside `.app-ui`), one question
 * per view with a question palette, a countdown timer (auto-submits at zero),
 * and server-side grading on submit. Fully responsive: the palette wraps and the
 * navigation collapses to a sticky bottom bar on small screens.
 *
 * Leaving the exam always ends it — the attempt is already spent, so it is
 * submitted with whatever has been answered rather than left dangling:
 *   • closing/refreshing the tab or leaving the site → the browser's own
 *     confirmation (`beforeunload`, whose text browsers no longer let us set),
 *     then a `pagehide` beacon that submits server-side;
 *   • a link inside the site or the browser Back button → an in-app dialog we
 *     control, which submits and forwards to the result page.
 * Answers are autosaved as they change, so even a hard crash keeps them.
 */
export function ExamRunner({
  examTitle,
  durationMinutes,
  questions,
  attemptId,
  startedAt,
  initialAnswers,
  attemptNumber,
  attemptLimit,
}: {
  examTitle: string;
  durationMinutes: number;
  questions: ExamQuestion[];
  attemptId: string;
  startedAt: string;
  initialAnswers: Record<string, number>;
  attemptNumber: number | null;
  attemptLimit: number;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>(
    initialAnswers ?? {},
  );
  const [current, setCurrent] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Non-null while the "you are about to leave" dialog is open. */
  const [leaving, setLeaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const submittedRef = useRef(false);
  /** Latest answers, readable from unload handlers that can't re-render. */
  const answersRef = useRef(answers);
  /** Serialized answers as last persisted — skips no-op saves. */
  const savedRef = useRef(JSON.stringify(initialAnswers ?? {}));
  const savingRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const deadline = useMemo(
    () => new Date(startedAt).getTime() + durationMinutes * 60_000,
    [startedAt, durationMinutes],
  );

  /** Persist the current answers without submitting. Silent by design. */
  const save = useCallback(
    async (snapshot: Record<string, number>) => {
      if (submittedRef.current || savingRef.current) return;
      const serialized = JSON.stringify(snapshot);
      if (serialized === savedRef.current) return;

      savingRef.current = true;
      setSaveState("saving");
      const res = await saveAttemptAnswers(attemptId, snapshot);
      savingRef.current = false;

      if (res.ok) {
        savedRef.current = serialized;
        setSaveState("saved");
      } else {
        // A failed autosave is not worth interrupting the exam over: the next
        // tick retries, and submit sends the full set anyway.
        setSaveState("idle");
      }
    },
    [attemptId],
  );

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const res = await submitAttempt(attemptId, answersRef.current);
    if (!res.ok) {
      submittedRef.current = false;
      setSubmitting(false);
      toast.error(res.error);
      return;
    }
    router.push(`/panel/netice/${attemptId}`);
  }, [attemptId, router]);

  // --- Autosave: debounced on change, plus a periodic safety net. -----------
  useEffect(() => {
    const t = setTimeout(() => void save(answers), AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [answers, save]);

  useEffect(() => {
    const t = setInterval(
      () => void save(answersRef.current),
      AUTOSAVE_INTERVAL_MS,
    );
    return () => clearInterval(t);
  }, [save]);

  // --- Leaving the page ------------------------------------------------------
  /**
   * The browser's own "leave site?" prompt. Modern browsers ignore any text we
   * supply here and show their standard wording, which is why the in-app dialog
   * below exists for navigation we CAN intercept.
   */
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (submittedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  /**
   * The page is actually going away (tab closed, refreshed, navigated off-site).
   * `sendBeacon` is the only request browsers reliably deliver at this point and
   * it cannot invoke a Server Action, so it posts to the route handler that
   * wraps the very same server-side submit.
   */
  useEffect(() => {
    function onPageHide(e: PageTransitionEvent) {
      if (submittedRef.current) return;
      /**
       * `persisted` means the page is going into the back/forward cache, not
       * being destroyed — a phone switching apps looks like this. It may well
       * come back, so DON'T end the exam: the attempt is already spent and stays
       * resumable, which is the recoverable failure. An attempt wrongly graded
       * because someone answered a phone call is not.
       *
       * Closing the tab, refreshing, or discarding the page gives persisted =
       * false, which is exactly the case the rule is written for.
       */
      if (e.persisted) return;
      submittedRef.current = true;

      const payload = JSON.stringify({
        attemptId,
        answers: answersRef.current,
      });
      const blob = new Blob([payload], { type: "application/json" });
      const queued = navigator.sendBeacon?.(AUTO_SUBMIT_URL, blob) ?? false;
      if (queued) return;

      // Beacon refused (queue full, or the API is missing). `keepalive` lets a
      // normal fetch outlive the document, which is the same guarantee.
      void fetch(AUTO_SUBMIT_URL, {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => {});
    }

    /**
     * Restored from the back/forward cache after that submit. The exam on screen
     * is finished, so replace it with the result rather than showing a live-
     * looking UI whose answers no longer go anywhere.
     */
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted && submittedRef.current) {
        window.location.replace(`/panel/netice/${attemptId}`);
      }
    }

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [attemptId]);

  /**
   * Internal navigation. The site header and footer are full of `<Link>`s, and
   * a client-side route change fires none of the unload events — so intercept
   * the click in the CAPTURE phase (before Next's router sees it) and ask first.
   */
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (submittedRef.current || e.defaultPrevented) return;
      // Let the browser handle modified clicks (new tab/window) untouched.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // Off-site links unload the page, which `beforeunload`/`pagehide` cover.
      if (url.origin !== window.location.origin) return;
      // A link back to this very page is not "leaving".
      if (url.pathname === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      setLeaving(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  /**
   * The Back button. A sentinel history entry is pushed on mount; when Back pops
   * it we immediately push it again (so the student stays put) and ask instead.
   */
  useEffect(() => {
    window.history.pushState({ examGuard: true }, "");
    function onPopState() {
      if (submittedRef.current) return;
      window.history.pushState({ examGuard: true }, "");
      setLeaving(true);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const answeredCount = Object.keys(answers).length;
  const q = questions[current];

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
        <Countdown deadline={deadline} onExpire={doSubmit} />
      </div>

      {/* Leaving-the-page notice: the rule, stated before it is needed. */}
      <p className="text-muted-foreground mt-4 flex items-start gap-2 text-xs">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        Bu səhifədən çıxsanız, imtahan cari cavablarınızla avtomatik təqdim
        ediləcək. Cavablar avtomatik yadda saxlanılır.
      </p>

      {/* Progress + palette */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Sual {current + 1} / {questions.length}
        </span>
        <span className="text-muted-foreground flex items-center gap-2">
          {attemptNumber !== null && (
            <span className="tabular-nums">
              Cəhd {attemptNumber}/{attemptLimit}
            </span>
          )}
          <span aria-hidden>·</span>
          <span>
            Cavablanıb: {answeredCount}/{questions.length}
          </span>
        </span>
      </div>
      <p className="text-muted-foreground/80 mt-1 h-4 text-xs" aria-live="polite">
        {saveState === "saving"
          ? "Saxlanılır…"
          : saveState === "saved"
            ? "Cavablar yadda saxlanıldı"
            : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
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

      {/* Question — `exam-watermark` paints the repeating site watermark behind
          the prompt and the choices (see `.exam-watermark` in globals.css). */}
      <div className="exam-watermark border-border bg-card mt-6 rounded-2xl border p-5 sm:p-7">
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
        <Modal
          title="İmtahanı təqdim et?"
          footer={
            <>
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
            </>
          }
        >
          {answeredCount < questions.length
            ? `${questions.length - answeredCount} sual cavablanmayıb. Təqdim etdikdən sonra dəyişmək olmaz.`
            : "Bütün suallar cavablanıb. Təqdim etdikdən sonra dəyişmək olmaz."}
        </Modal>
      )}

      {/* Leaving confirmation (internal links + Back button) */}
      {leaving && !confirming && (
        <Modal
          title="Səhifədən çıxılsın?"
          footer={
            <>
              <button
                type="button"
                onClick={() => setLeaving(false)}
                disabled={submitting}
                className="border-border text-foreground hover:bg-muted rounded-full border px-4 py-2 text-sm font-semibold"
              >
                İmtahanda qal
              </button>
              <button
                type="button"
                onClick={doSubmit}
                disabled={submitting}
                className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />} Çıx və
                təqdim et
              </button>
            </>
          }
        >
          Bu səhifədən çıxsanız, imtahanınız cari cavablarınızla avtomatik təqdim
          ediləcək və bu cəhdə qayıtmaq mümkün olmayacaq.
        </Modal>
      )}
    </div>
  );
}
