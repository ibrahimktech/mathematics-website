import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Exam } from "@/lib/exams";
import { SectionHeading } from "./SectionHeading";
import { ExamCard } from "./ExamCard";

/** Featured exams on the homepage, in a subtle white band for section rhythm. */
export function ExamsShowcase({ exams }: { exams: Exam[] }) {
  if (exams.length === 0) return null;
  return (
    <section className="border-border bg-card border-y">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="İmtahanlar"
            title="Səni sınayacaq imtahanlar"
            description="Hər imtahan müəyyən mövzu və çətinlik səviyyəsi üçün diqqətlə seçilmiş məsələlərdən ibarətdir."
          />
          <Link
            href="/imtahanlar"
            className="text-primary hover:text-primary-hover inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors"
          >
            Bütün imtahanlara bax
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam, i) => (
            <ExamCard key={exam.id} exam={exam} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
