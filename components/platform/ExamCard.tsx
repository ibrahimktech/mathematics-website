import Link from "next/link";
import { ListChecks, Clock } from "lucide-react";
import type { Exam } from "@/lib/exams/types";
import {
  difficultyLabel,
  difficultyChipClass,
  formatPrice,
  formatDuration,
} from "@/lib/exams/display";
import { cn } from "@/lib/utils";
import { ExamOwnershipBadge } from "./ExamOwnershipBadge";
import { ExamCardAction } from "./ExamCardAction";

/**
 * Exam card, reused on the homepage showcase, /imtahanlar and the related-exams
 * strip of the exam page. Imports only client-safe modules so it renders on the
 * server where possible and under the client-side `ExamCatalogue` filter alike;
 * the static markup is the signed-out view, and the small client leaves
 * (`ExamOwnershipBadge`, `ExamCardAction`) upgrade
 * it after hydration when the visitor owns the exam. The title link is
 * STRETCHED over the card (`after:absolute after:inset-0`) instead of wrapping
 * it, so the owned-state action can be a sibling link — never an <a> in an <a>.
 */
export function ExamCard({ exam, index }: { exam: Exam; index?: number }) {
  const free = exam.price === 0;
  return (
    <article data-index={index} className="animate-fade-rise h-full">
      <div className="article-card group border-border bg-card relative flex h-full flex-col border p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="bg-accent text-primary inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold">
            {exam.topic}
          </span>
          <div className="flex items-center gap-2">
            <ExamOwnershipBadge examId={exam.id} paid={!free} />
            <span
              className={cn(
                "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                difficultyChipClass(exam.difficulty),
              )}
            >
              {difficultyLabel(exam.difficulty)}
            </span>
          </div>
        </div>

        <h3 className="exam-title text-foreground group-hover:text-primary mt-4 text-lg leading-snug font-bold tracking-tight transition-colors">
          <Link
            href={`/imtahanlar/${exam.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {exam.title}
          </Link>
        </h3>
        <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
          {exam.summary}
        </p>

        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="size-3.5" /> {exam.problemCount} sual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> {formatDuration(exam.durationMinutes)}
          </span>
        </div>

        <div className="border-border mt-auto flex items-center justify-between border-t pt-5">
          <span
            className={cn(
              "text-sm font-bold",
              free ? "text-emerald-600" : "text-foreground",
            )}
          >
            {formatPrice(exam.price, exam.currency)}
          </span>
          <ExamCardAction examId={exam.id} free={free} />
        </div>
      </div>
    </article>
  );
}
