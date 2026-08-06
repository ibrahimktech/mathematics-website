import Link from "next/link";
import { ArrowUpDown, FilePlus2, ListChecks } from "lucide-react";
import { getAllExamsAdmin } from "@/lib/admin/exam-queries";
import { buttonVariants } from "@/components/ui/button";
import {
  difficultyLabel,
  examPublishChipClass,
  examPublishLabel,
  formatPrice,
} from "@/lib/exams/display";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "İmtahanlar — Admin" };

export default async function AdminExamsPage() {
  const exams = await getAllExamsAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="exam-title text-2xl font-bold">İmtahanlar</h1>
          {exams.length > 1 && (
            <p className="text-muted-foreground mt-1 text-sm">
              Tələbələr imtahanları aşağıdakı ardıcıllıqla görür.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {exams.length > 1 && (
            <Link
              href="/admin/exams/siralama"
              className={buttonVariants({ variant: "outline" })}
            >
              <ArrowUpDown /> Sıralama
            </Link>
          )}
          <Link href="/admin/exams/new" className={buttonVariants()}>
            <FilePlus2 /> Yeni imtahan
          </Link>
        </div>
      </div>

      {exams.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed p-16 text-center text-sm">
          Hələ imtahan yoxdur.{" "}
          <Link href="/admin/exams/new" className="text-primary font-semibold">
            İlk imtahanı yaradın
          </Link>
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
                <th className="w-10 px-4 py-3 font-semibold">#</th>
                <th className="px-4 py-3 font-semibold">Ad</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Çətinlik</th>
                <th className="px-4 py-3 font-semibold">Qiymət</th>
                <th className="px-4 py-3 font-semibold">Sual</th>
                <th className="px-4 py-3 font-semibold">Yenilənib</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {exams.map((e, i) => (
                <tr key={e.id} className="hover:bg-muted/40">
                  {/* Position in the list students see, not the stored
                      display_order — deleting an exam leaves gaps there. */}
                  <td className="text-muted-foreground px-4 py-3 text-xs font-bold tabular-nums">
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/exams/${e.id}/edit`}
                      className="text-foreground hover:text-primary font-medium"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        examPublishChipClass(e.status),
                      )}
                    >
                      {examPublishLabel(e.status)}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {difficultyLabel(e.difficulty)}
                  </td>
                  <td className="text-foreground px-4 py-3 font-medium">
                    {formatPrice(Number(e.price), e.currency)}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <ListChecks className="size-3.5" /> {e.question_count}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {formatDate(e.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
