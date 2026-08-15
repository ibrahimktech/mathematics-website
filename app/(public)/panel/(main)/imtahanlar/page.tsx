import type { Metadata } from "next";
import { requireUser } from "@/lib/account/auth";
import { getExams } from "@/lib/exams";
import {
  getMyAttempts,
  getMyAccessExamIds,
  getMyPurchases,
} from "@/lib/student/queries";
import { computeExamState } from "@/lib/student/status";
import { DashboardExamList } from "@/components/platform/DashboardExamList";

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

  // Per-student state is derived here so the raw purchase/attempt lists never
  // ship to the client — the list component only receives what it renders.
  const rows = ordered.map((exam) => ({
    exam,
    state: computeExamState(exam.id, exam.price, accessIds, purchases, attempts),
  }));

  return (
    <div>
      <header>
        <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
          İmtahanlarım
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          İmtahanı al, başla və nəticələrinə bax.
        </p>
      </header>

      <DashboardExamList rows={rows} selectedId={selected ?? null} />
    </div>
  );
}
