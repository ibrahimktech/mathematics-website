import { Eye, Users, CalendarDays } from "lucide-react";
import {
  getBlogSummary,
  getBlogDaily,
  getArticleAnalytics,
  getTopCategoriesByViews,
} from "@/lib/analytics/queries";
import { StatCard } from "@/components/admin/charts/StatCard";
import { ChartCard } from "@/components/admin/charts/ChartCard";
import { LineChart } from "@/components/admin/charts/LineChart";
import { BarList } from "@/components/admin/charts/BarList";
import { ArticleAnalyticsTable } from "@/components/admin/ArticleAnalyticsTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bloq analitikası — Admin" };

export default async function BlogAnalyticsPage() {
  const [summary, daily, articles, topCats] = await Promise.all([
    getBlogSummary(),
    getBlogDaily(30),
    getArticleAnalytics(),
    getTopCategoriesByViews(),
  ]);

  const topArticles = [...articles]
    .filter((a) => a.totalViews > 0)
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 6)
    .map((a) => ({ label: a.title, value: a.totalViews, display: String(a.totalViews) }));

  const catBars = topCats
    .slice(0, 6)
    .map((c) => ({ label: c.categoryName, value: c.views, display: String(c.views) }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="exam-title text-2xl font-bold">Bloq analitikası</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Baxışlar Azərbaycan vaxtı ilə hesablanır. Unikal ziyarətçilər IP
          əsasında (məxfilik üçün heşlənmiş) sayılır; eyni ziyarətçi günə bir dəfə
          hesablanır.
        </p>
      </div>

      {/* View KPIs — kept lean: total views, today, this month, unique visitors. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ümumi baxış" value={String(summary.totalViews)} icon={Eye} accent />
        <StatCard label="Bu gün" value={String(summary.viewsToday)} icon={CalendarDays} />
        <StatCard label="Bu ay" value={String(summary.viewsMonth)} icon={CalendarDays} />
        <StatCard label="Unikal ziyarətçi" value={String(summary.uniqueVisitors)} icon={Users} />
      </div>

      {/* Views over time */}
      <ChartCard title="Baxışlar (son 30 gün)" subtitle="Gündəlik trafik">
        <LineChart labels={daily.labels} values={daily.values} />
      </ChartCard>

      {/* Top articles + categories */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Ən populyar məqalələr">
          {topArticles.length ? (
            <BarList items={topArticles} />
          ) : (
            <p className="text-muted-foreground text-sm">Hələ baxış yoxdur.</p>
          )}
        </ChartCard>
        <ChartCard title="Ən çox baxılan kateqoriyalar">
          {catBars.length ? (
            <BarList items={catBars} />
          ) : (
            <p className="text-muted-foreground text-sm">Hələ baxış yoxdur.</p>
          )}
        </ChartCard>
      </div>

      {/* Per-article table (sortable) */}
      <ArticleAnalyticsTable articles={articles} />
    </div>
  );
}
