import {
  Wallet,
  CalendarDays,
  ShoppingCart,
  Users,
  Repeat,
  UserPlus,
} from "lucide-react";
import {
  getRevenueStats,
  getRevenueSeries,
  getExamSales,
  getRevenueByCategory,
  getCustomerStats,
} from "@/lib/analytics/queries";
import { getPurchasesAdmin } from "@/lib/admin/purchases";
import { StatCard } from "@/components/admin/charts/StatCard";
import { ChartCard } from "@/components/admin/charts/ChartCard";
import { LineChart } from "@/components/admin/charts/LineChart";
import { DonutChart } from "@/components/admin/charts/DonutChart";
import { BarList } from "@/components/admin/charts/BarList";
import { foldToOther } from "@/components/admin/charts/palette";
import { ExamSalesTable } from "@/components/admin/ExamSalesTable";
import { RecentPurchasesTable } from "@/components/admin/RecentPurchasesTable";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Satış analitikası — Admin" };

export default async function SalesAnalyticsPage() {
  const [rev, series, sales, byCat, cust, recent] = await Promise.all([
    getRevenueStats(),
    getRevenueSeries(30),
    getExamSales(),
    getRevenueByCategory(),
    getCustomerStats(),
    getPurchasesAdmin(),
  ]);

  const donut = foldToOther(
    byCat.map((c) => ({ label: c.categoryName, value: c.revenue })),
    6,
  );
  const topSelling = [...sales]
    .filter((s) => s.purchaseCount > 0)
    .sort((a, b) => b.purchaseCount - a.purchaseCount)
    .slice(0, 6)
    .map((s) => ({
      label: s.title,
      value: s.purchaseCount,
      display: `${s.purchaseCount} satış`,
    }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="exam-title text-2xl font-bold">Satış analitikası</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Bütün tarixlər Azərbaycan vaxtı ilə (Asia/Baku). Gəlir yalnız
          təsdiqlənmiş ödənişlərdən hesablanır.
        </p>
      </div>

      {/* Revenue KPIs — kept lean: headline revenue, today, this month, total sales. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ümumi gəlir" value={formatMoney(rev.total)} icon={Wallet} accent />
        <StatCard label="Bu gün" value={formatMoney(rev.today)} icon={CalendarDays} />
        <StatCard label="Bu ay" value={formatMoney(rev.month)} icon={CalendarDays} />
        <StatCard label="Ümumi satış" value={String(rev.totalPurchases)} icon={ShoppingCart} />
      </div>

      {/* Revenue over time */}
      <ChartCard title="Gəlir (son 30 gün)" subtitle="Gündəlik təsdiqlənmiş gəlir">
        <LineChart labels={series.labels} values={series.values} format="money" />
      </ChartCard>

      {/* Category share + top selling */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Kateqoriya üzrə gəlir">
          <DonutChart items={donut} format="money" />
        </ChartCard>
        <ChartCard title="Ən çox satılan imtahanlar">
          {topSelling.length ? (
            <BarList items={topSelling} />
          ) : (
            <p className="text-muted-foreground text-sm">Hələ satış yoxdur.</p>
          )}
        </ChartCard>
      </div>

      {/* Customer analytics */}
      <div>
        <h2 className="text-foreground mb-3 text-lg font-semibold">Müştəri analitikası</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Ümumi müştəri" value={String(cust.totalCustomers)} icon={Users} />
          <StatCard label="Təkrar müştəri" value={String(cust.returningCustomers)} icon={Repeat} />
          <StatCard label="İlk dəfə alan" value={String(cust.firstTimeBuyers)} icon={UserPlus} />
          <StatCard
            label="Müştəri başına satış"
            value={String(cust.purchasesPerCustomer)}
            icon={ShoppingCart}
          />
        </div>
      </div>

      {/* Exam sales table (sortable) */}
      <ExamSalesTable sales={sales} />

      {/* Recent purchases */}
      <div>
        <h2 className="text-foreground mb-3 text-lg font-semibold">Son satışlar</h2>
        <RecentPurchasesTable purchases={recent.slice(0, 15)} />
      </div>
    </div>
  );
}
