import Link from "next/link";
import { ArrowRight, ListChecks, Clock } from "lucide-react";
import type { Exam } from "@/lib/exams";
import {
  difficultyLabel,
  difficultyChipClass,
  formatPrice,
  formatDuration,
} from "@/lib/exams";
import { cn } from "@/lib/utils";

/** Exam card, reused on the homepage, /imtahanlar, /meseleler and /panel. */
export function ExamCard({ exam, index }: { exam: Exam; index?: number }) {
  const free = exam.price === 0;
  return (
    <article data-index={index} className="animate-fade-rise h-full">
      <Link
        href={`/imtahanlar/${exam.slug}`}
        className="article-card group border-border bg-card flex h-full flex-col border p-6 focus-visible:outline-none"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="bg-accent text-primary inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold">
            {exam.topic}
          </span>
          <span
            className={cn(
              "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              difficultyChipClass(exam.difficulty),
            )}
          >
            {difficultyLabel(exam.difficulty)}
          </span>
        </div>

        <h3 className="exam-title text-foreground group-hover:text-primary mt-4 text-lg leading-snug font-bold tracking-tight transition-colors">
          {exam.title}
        </h3>
        <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
          {exam.summary}
        </p>

        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="size-3.5" /> {exam.problemCount} məsələ
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
          <span className="text-primary inline-flex items-center gap-1 text-sm font-semibold">
            Ətraflı
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </article>
  );
}
