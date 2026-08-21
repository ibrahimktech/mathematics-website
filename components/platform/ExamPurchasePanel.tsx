import { ListChecks, Clock, BarChart3, KeyRound } from "lucide-react";
import { formatPrice, formatDuration, difficultyLabel } from "@/lib/exams/display";
import type { Exam } from "@/lib/exams/types";
import { cn } from "@/lib/utils";
import { ExamPurchaseCta } from "./ExamPurchaseCta";

/**
 * Exam advertisement + access gateway on the PUBLIC exam page.
 *
 * SERVER component: purchases never happen here, and the server markup —
 * a plain link into the manual bank-transfer flow (paid) or the dashboard
 * (free), both under middleware-gated `/panel/*` — is what the static HTML and
 * every signed-out visitor get. The CTA region (`ExamPurchaseCta`) upgrades
 * client-side when the visitor already owns the exam or has a pending payment,
 * pointing them at the panel instead. The navbar already ships the Supabase
 * browser bundle on every page, so that costs no new bundle class.
 */
export function ExamPurchasePanel({ exam }: { exam: Exam }) {
  const free = exam.price === 0;
  // Always carry the exam the visitor clicked. Paid exams have a per-exam
  // checkout page; free ones have none (`/panel/odenis/[id]` bounces price<=0),
  // so they go to the dashboard list with `?exam=` — the selection the panel
  // already understands — instead of an anonymous list the student has to
  // search through for the exam they just chose.
  const target = free
    ? `/panel/imtahanlar?exam=${exam.id}`
    : `/panel/odenis/${exam.id}`;

  const features = [
    { icon: ListChecks, label: `${exam.problemCount} sual` },
    { icon: Clock, label: formatDuration(exam.durationMinutes) },
    { icon: BarChart3, label: `Çətinlik: ${difficultyLabel(exam.difficulty)}` },
    { icon: KeyRound, label: "Təsdiqdən sonra ömürlük giriş" },
  ];

  return (
    <div className="border-border bg-card rounded-2xl border p-6 shadow-sm lg:sticky lg:top-24">
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            "exam-title text-3xl font-bold",
            free ? "text-primary" : "text-foreground",
          )}
        >
          {formatPrice(exam.price, exam.currency)}
        </span>
        {!free && (
          <span className="text-muted-foreground text-sm">birdəfəlik</span>
        )}
      </div>

      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li
            key={f.label}
            className="text-foreground/80 flex items-center gap-2.5 text-sm"
          >
            <f.icon className="text-primary size-4 shrink-0" />
            {f.label}
          </li>
        ))}
      </ul>

      <ExamPurchaseCta examId={exam.id} free={free} target={target} />

      {!free && (
        <p className="text-muted-foreground mt-4 border-t border-dashed pt-4 text-center text-xs leading-relaxed">
          Ödəniş bank köçürməsi ilə həyata keçirilir və əl ilə təsdiqlənir.
          Təsdiqdən sonra imtahan panelində açılır.
        </p>
      )}
    </div>
  );
}
