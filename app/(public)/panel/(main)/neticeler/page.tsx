import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/account/auth";
import { getExams } from "@/lib/exams";
import { getMyAttempts } from "@/lib/student/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Nəticələr", robots: { index: false, follow: false } };

function durationLabel(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} san`;
  return s ? `${m} dəq ${s} san` : `${m} dəq`;
}

export default async function ResultsPage() {
  await requireUser("/panel/neticeler");
  const [exams, attempts] = await Promise.all([getExams(), getMyAttempts()]);
  const examMap = new Map(exams.map((e) => [e.id, e]));
  const completed = attempts.filter((a) => a.status === "completed");

  return (
    <div>
      <header>
        <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
          Əvvəlki nəticələr
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Tamamladığın imtahanların nəticələri.
        </p>
      </header>

      {completed.length ? (
        <div className="border-border mt-6 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">İmtahan</th>
                <th className="px-4 py-3 font-semibold">Cəhd</th>
                <th className="px-4 py-3 font-semibold">Tarix</th>
                <th className="px-4 py-3 font-semibold">Bal</th>
                <th className="px-4 py-3 font-semibold">Vaxt</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {completed.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <span className="text-foreground font-medium">
                      {examMap.get(a.exam_id)?.title ?? a.exam_id}
                    </span>
                  </td>
                  {/* Two attempts per exam are allowed, so results for the same
                      exam are only distinguishable by their ordinal. */}
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {a.attempt_number ?? "—"}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {formatDate(a.finished_at ?? a.started_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-foreground font-semibold tabular-nums">
                      {a.score ?? 0}%
                    </span>
                    <span className="text-muted-foreground ml-1 text-xs">
                      ({a.correct_count ?? 0}/{a.total_count ?? 0})
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {durationLabel(a.duration_seconds)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/panel/netice/${a.id}`}
                      className="text-primary font-semibold"
                    >
                      Bax
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-border text-muted-foreground mt-6 rounded-xl border border-dashed p-10 text-center text-sm">
          Hələ tamamlanmış imtahanın yoxdur.{" "}
          <Link href="/panel/imtahanlar" className="text-primary font-semibold">
            İmtahana başla
          </Link>
        </div>
      )}
    </div>
  );
}
