import Link from "next/link";
import { FilePlus2, GraduationCap, Receipt, ArrowRight } from "lucide-react";
import { getPostCounts } from "@/lib/admin/queries";
import { getExamCounts } from "@/lib/admin/exam-queries";
import { getPurchaseCounts, getPurchasesAdmin } from "@/lib/admin/purchases";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/exams/display";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "İdarə paneli" };

function Stat({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href?: string;
  accent?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "border-border bg-card rounded-lg border p-5 transition-colors",
        href && "hover:border-primary/40",
        accent && value > 0 && "border-amber-300 bg-amber-50",
      )}
    >
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="exam-title mt-1 text-3xl font-bold tabular-nums">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Gözləyir",
  approved: "Təsdiqlənib",
  denied: "Rədd edilib",
};

export default async function DashboardPage() {
  const [posts, exams, purchases, recent] = await Promise.all([
    getPostCounts(),
    getExamCounts(),
    getPurchaseCounts(),
    getPurchasesAdmin(),
  ]);
  const recentPurchases = recent.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="exam-title text-2xl font-bold">İdarə paneli</h1>
      </div>

      {/* Key numbers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Gözləyən ödənişlər"
          value={purchases.pending}
          href="/admin/purchases"
          accent
        />
        <Stat label="Dərc edilmiş imtahan" value={exams.published} href="/admin/exams" />
        <Stat label="Qaralama imtahan" value={exams.draft} href="/admin/exams" />
        <Stat label="Bloq məqalələri" value={posts.total} href="/admin/articles" />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/exams/new" className={buttonVariants()}>
          <GraduationCap /> İmtahan yarat
        </Link>
        <Link href="/admin/articles/new" className={buttonVariants({ variant: "outline" })}>
          <FilePlus2 /> Məqalə yaz
        </Link>
        <Link href="/admin/purchases" className={buttonVariants({ variant: "outline" })}>
          <Receipt /> Ödənişlərə bax
        </Link>
      </div>

      {/* Recent purchase requests */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">Son ödəniş sorğuları</h2>
          <Link
            href="/admin/purchases"
            className="text-primary inline-flex items-center gap-1 text-sm font-semibold"
          >
            Hamısı <ArrowRight className="size-4" />
          </Link>
        </div>
        {recentPurchases.length === 0 ? (
          <div className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
            Hələ ödəniş sorğusu yoxdur.
          </div>
        ) : (
          <ul className="border-border divide-y rounded-xl border">
            {recentPurchases.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">
                    {p.student?.full_name ||
                      p.student?.email ||
                      p.student?.student_number ||
                      "—"}{" "}
                    <span className="text-muted-foreground">·</span>{" "}
                    {p.exam?.title ?? p.exam_id}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatPrice(Number(p.amount), p.currency)} · {formatDate(p.created_at)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    p.status === "pending"
                      ? "bg-amber-50 text-amber-700"
                      : p.status === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-destructive/10 text-destructive",
                  )}
                >
                  {STATUS_LABEL[p.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
