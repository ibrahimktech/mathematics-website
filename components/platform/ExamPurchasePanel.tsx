import Link from "next/link";
import { ListChecks, Clock, BarChart3, KeyRound } from "lucide-react";
import { formatPrice, formatDuration, difficultyLabel } from "@/lib/exams/display";
import type { Exam } from "@/lib/exams/types";
import { cn } from "@/lib/utils";

/**
 * Exam advertisement + access gateway on the PUBLIC exam page.
 *
 * SERVER component (no client JS): purchases never happen here. The CTA is a
 * plain link into the manual bank-transfer flow (paid) or the dashboard (free).
 * Both targets are under `/panel/*`, which middleware already gates — a
 * logged-out visitor is auto-redirected to login with the target preserved, so
 * we don't need the client session here. Keeping this server-only means the
 * public exam page ships no Supabase browser bundle.
 */
export function ExamPurchasePanel({ exam }: { exam: Exam }) {
  const free = exam.price === 0;
  const target = free ? "/panel/imtahanlar" : `/panel/odenis/${exam.id}`;

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
            free ? "text-emerald-600" : "text-foreground",
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

      <Link
        href={target}
        className="bg-primary text-primary-foreground hover:bg-primary-hover mt-6 flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5"
      >
        {free ? "Başla" : "İmtahanı al"}
      </Link>

      <p className="text-muted-foreground mt-3 text-center text-xs">
        Hesabın yoxdur?{" "}
        <Link
          href={`/qeydiyyat?redirect=${encodeURIComponent(target)}`}
          className="text-primary font-semibold"
        >
          Qeydiyyatdan keç
        </Link>
      </p>

      {!free && (
        <p className="text-muted-foreground mt-4 border-t border-dashed pt-4 text-center text-xs leading-relaxed">
          Ödəniş bank köçürməsi ilə həyata keçirilir və əl ilə təsdiqlənir.
          Təsdiqdən sonra imtahan panelində açılır.
        </p>
      )}
    </div>
  );
}
