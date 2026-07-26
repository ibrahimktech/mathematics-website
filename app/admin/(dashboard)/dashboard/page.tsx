import Link from "next/link";
import {
  FilePlus2,
  GraduationCap,
  Receipt,
  Wallet,
  ShoppingCart,
  Users,
  UserCircle,
  FileText,
  Eye,
  CalendarDays,
} from "lucide-react";
import { getPostCounts } from "@/lib/admin/queries";
import { getPurchaseCounts, getPurchasesAdmin } from "@/lib/admin/purchases";
import {
  getRevenueStats,
  getRevenueSeries,
  getBlogSummary,
  getBlogDaily,
  getUserCount,
  getExamSales,
  getArticleAnalytics,
} from "@/lib/analytics/queries";
import { StatCard } from "@/components/admin/charts/StatCard";
import { ChartCard } from "@/components/admin/charts/ChartCard";
import { LineChart } from "@/components/admin/charts/LineChart";
import { BarList } from "@/components/admin/charts/BarList";
import { RecentPurchasesTable } from "@/components/admin/RecentPurchasesTable";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "İdarə paneli" };

export default async function DashboardPage() {
  const [posts, purchaseCounts, rev, revSeries, blog, blogDaily, users, recent, sales, articles] =
    await Promise.all([
      getPostCounts(),
      getPurchaseCounts(),
      getRevenueStats(),
      getRevenueSeries(30),
      getBlogSummary(),
      getBlogDaily(30),
      getUserCount(),
      getPurchasesAdmin(),
      getExamSales(),
      getArticleAnalytics(),
    ]);

  const topSelling = [...sales]
    .filter((s) => s.purchaseCount > 0)
    .sort((a, b) => b.purchaseCount - a.purchaseCount)
    .slice(0, 5)
    .map((s) => ({ label: s.title, value: s.purchaseCount, display: `${s.purchaseCount}` }));

  const topArticles = [...articles]
    .filter((a) => a.totalViews > 0)
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 5)
    .map((a) => ({ label: a.title, value: a.totalViews, display: `${a.totalViews}` }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="exam-title text-2xl font-bold">İdarə paneli</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/exams/new" className={buttonVariants({ size: "sm" })}>
            <GraduationCap /> İmtahan
          </Link>
          <Link
            href="/admin/articles/new"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FilePlus2 /> Məqalə
          </Link>
          <Link
            href="/admin/purchases"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Receipt /> Ödənişlər
            {purchaseCounts.pending > 0 && (
              <span className="bg-amber-100 text-amber-800 ml-1 rounded-full px-1.5 text-xs font-bold tabular-nums">
                {purchaseCounts.pending}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ümumi gəlir" value={formatMoney(rev.total)} icon={Wallet} accent />
        <StatCard label="Bugünkü satış" value={formatMoney(rev.today)} icon={CalendarDays} />
        <StatCard label="Ümumi satış" value={String(rev.totalPurchases)} icon={ShoppingCart} />
        <StatCard label="Müştərilər" value={String(rev.uniqueCustomers)} icon={Users} />
        <StatCard label="İstifadəçilər" value={String(users)} icon={UserCircle} />
        <StatCard label="Bloq məqalələri" value={String(posts.total)} icon={FileText} />
        <StatCard label="Unikal ziyarətçi" value={String(blog.uniqueVisitors)} icon={Users} />
        <StatCard label="Bugünkü baxış" value={String(blog.viewsToday)} icon={Eye} />
      </div>

      {/* Trends */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Gəlir (son 30 gün)">
          <LineChart
            labels={revSeries.labels}
            values={revSeries.values}
            formatValue={(n) => formatMoney(n)}
            height={200}
          />
        </ChartCard>
        <ChartCard title="Bloq trafiki (son 30 gün)">
          <LineChart labels={blogDaily.labels} values={blogDaily.values} height={200} />
        </ChartCard>
      </div>

      {/* Recent purchases */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-foreground text-lg font-semibold">Son satışlar</h2>
          <Link href="/admin/analytics/satis" className="text-primary text-sm font-semibold">
            Ətraflı
          </Link>
        </div>
        <RecentPurchasesTable purchases={recent.slice(0, 6)} />
      </div>

      {/* Top lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Ən çox satılan imtahanlar"
          action={
            <Link href="/admin/analytics/satis" className="text-primary text-xs font-semibold">
              Hamısı
            </Link>
          }
        >
          {topSelling.length ? (
            <BarList items={topSelling} />
          ) : (
            <p className="text-muted-foreground text-sm">Hələ satış yoxdur.</p>
          )}
        </ChartCard>
        <ChartCard
          title="Ən çox baxılan məqalələr"
          action={
            <Link href="/admin/analytics/bloq" className="text-primary text-xs font-semibold">
              Hamısı
            </Link>
          }
        >
          {topArticles.length ? (
            <BarList items={topArticles} />
          ) : (
            <p className="text-muted-foreground text-sm">Hələ baxış yoxdur.</p>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
