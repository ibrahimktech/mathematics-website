import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCategories } from "@/lib/categories";
import { getAllExamsAdmin } from "@/lib/admin/exam-queries";
import { bakuDayKey, bakuWindowStarts, lastNBakuDays, shortDayLabel } from "./time";

/**
 * Admin analytics reads. Everything goes through the cookie session client, so
 * RLS (`is_admin()`) is the gate — the admin pages also call requireAdminPage().
 * Sales figures are aggregated in JS over the (small) purchases table, deduped
 * per request with React `cache`. Blog figures come from the SECURITY DEFINER
 * RPCs (heavy DISTINCT work in Postgres, admin-checked inside). All degrade to
 * zeros if Supabase / the migrations aren't ready.
 */

export interface Series {
  labels: string[];
  values: number[];
}
export interface RevenueStats {
  total: number;
  today: number;
  week: number;
  month: number;
  year: number;
  avgOrderValue: number;
  totalPurchases: number;
  uniqueCustomers: number;
}
export interface ExamSale {
  examId: string;
  title: string;
  slug: string;
  categorySlug: string | null;
  categoryName: string;
  price: number;
  currency: string;
  status: string;
  active: boolean;
  purchaseCount: number;
  revenue: number;
  lastPurchaseAt: string | null;
  createdAt: string;
}
export interface CategoryRevenue {
  categorySlug: string;
  categoryName: string;
  revenue: number;
  count: number;
}
export interface CustomerStats {
  totalCustomers: number;
  returningCustomers: number;
  firstTimeBuyers: number;
  totalPurchases: number;
  purchasesPerCustomer: number;
}
export interface BlogSummary {
  totalViews: number;
  uniqueVisitors: number;
  returningVisitors: number;
  viewsToday: number;
  viewsWeek: number;
  viewsMonth: number;
  viewsYear: number;
}
export interface ArticleAnalytics {
  postId: string;
  title: string;
  slug: string;
  categoryName: string;
  status: string;
  publishedAt: string | null;
  readingTime: number;
  totalViews: number;
  uniqueVisitors: number;
  returningVisitors: number;
  lastViewedAt: string | null;
}

type ApprovedPurchase = {
  amount: number;
  user_id: string;
  exam_id: string;
  created_at: string;
};

/** Approved purchases (the sale ledger). Fetched once per request. */
const getApprovedPurchases = cache(async (): Promise<ApprovedPurchase[]> => {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("purchases")
      .select("amount, user_id, exam_id, created_at")
      .eq("status", "approved");
    if (error) return [];
    return (data ?? []).map((r) => ({
      amount: Number((r as { amount: number }).amount) || 0,
      user_id: (r as { user_id: string }).user_id,
      exam_id: (r as { exam_id: string }).exam_id,
      created_at: (r as { created_at: string }).created_at,
    }));
  } catch {
    return [];
  }
});

/** Count of registered users (profiles). Admin-gated via RLS. */
export async function getUserCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getRevenueStats(): Promise<RevenueStats> {
  const rows = await getApprovedPurchases();
  const starts = bakuWindowStarts();
  const sum = (from?: string) =>
    rows
      .filter((r) => (from ? r.created_at >= from : true))
      .reduce((s, r) => s + r.amount, 0);
  const total = sum();
  const totalPurchases = rows.length;
  const uniqueCustomers = new Set(rows.map((r) => r.user_id)).size;
  return {
    total,
    today: sum(starts.today),
    week: sum(starts.week),
    month: sum(starts.month),
    year: sum(starts.year),
    avgOrderValue: totalPurchases ? Math.round((total / totalPurchases) * 100) / 100 : 0,
    totalPurchases,
    uniqueCustomers,
  };
}

export async function getRevenueSeries(days = 30): Promise<Series> {
  const rows = await getApprovedPurchases();
  const keys = lastNBakuDays(days);
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const k = bakuDayKey(r.created_at);
    byDay.set(k, (byDay.get(k) ?? 0) + r.amount);
  }
  return {
    labels: keys.map(shortDayLabel),
    values: keys.map((k) => byDay.get(k) ?? 0),
  };
}

export const getExamSales = cache(async (): Promise<ExamSale[]> => {
  const [exams, purchases, categories] = await Promise.all([
    getAllExamsAdmin(),
    getApprovedPurchases(),
    getCategories(),
  ]);
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  const agg = new Map<string, { count: number; revenue: number; last: string | null }>();
  for (const p of purchases) {
    const a = agg.get(p.exam_id) ?? { count: 0, revenue: 0, last: null };
    a.count += 1;
    a.revenue += p.amount;
    if (!a.last || p.created_at > a.last) a.last = p.created_at;
    agg.set(p.exam_id, a);
  }
  return exams.map((e) => {
    const a = agg.get(e.id) ?? { count: 0, revenue: 0, last: null };
    return {
      examId: e.id,
      title: e.title,
      slug: e.slug,
      categorySlug: e.category_slug,
      categoryName: (e.category_slug && catName.get(e.category_slug)) || e.category_slug || "—",
      price: Number(e.price) || 0,
      currency: e.currency,
      status: e.status,
      active: e.status === "published",
      purchaseCount: a.count,
      revenue: a.revenue,
      lastPurchaseAt: a.last,
      createdAt: e.created_at,
    };
  });
});

export async function getRevenueByCategory(): Promise<CategoryRevenue[]> {
  const sales = await getExamSales();
  const byCat = new Map<string, CategoryRevenue>();
  for (const s of sales) {
    if (s.revenue <= 0) continue;
    const key = s.categorySlug ?? "—";
    const c = byCat.get(key) ?? {
      categorySlug: key,
      categoryName: s.categoryName,
      revenue: 0,
      count: 0,
    };
    c.revenue += s.revenue;
    c.count += s.purchaseCount;
    byCat.set(key, c);
  }
  return [...byCat.values()].sort((a, b) => b.revenue - a.revenue);
}

export async function getCustomerStats(): Promise<CustomerStats> {
  const rows = await getApprovedPurchases();
  const perCustomer = new Map<string, number>();
  for (const r of rows) perCustomer.set(r.user_id, (perCustomer.get(r.user_id) ?? 0) + 1);
  const totalCustomers = perCustomer.size;
  const counts = [...perCustomer.values()];
  const returningCustomers = counts.filter((c) => c > 1).length;
  const firstTimeBuyers = counts.filter((c) => c === 1).length;
  const totalPurchases = rows.length;
  return {
    totalCustomers,
    returningCustomers,
    firstTimeBuyers,
    totalPurchases,
    purchasesPerCustomer: totalCustomers
      ? Math.round((totalPurchases / totalCustomers) * 10) / 10
      : 0,
  };
}

/* --------------------------------- Blog ---------------------------------- */

const BLOG_ZERO: BlogSummary = {
  totalViews: 0,
  uniqueVisitors: 0,
  returningVisitors: 0,
  viewsToday: 0,
  viewsWeek: 0,
  viewsMonth: 0,
  viewsYear: 0,
};

export async function getBlogSummary(): Promise<BlogSummary> {
  if (!isSupabaseConfigured) return BLOG_ZERO;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("blog_view_summary");
    if (error || !data) return BLOG_ZERO;
    const d = data as Record<string, number>;
    return {
      totalViews: d.total_views ?? 0,
      uniqueVisitors: d.unique_visitors ?? 0,
      returningVisitors: d.returning_visitors ?? 0,
      viewsToday: d.views_today ?? 0,
      viewsWeek: d.views_week ?? 0,
      viewsMonth: d.views_month ?? 0,
      viewsYear: d.views_year ?? 0,
    };
  } catch {
    return BLOG_ZERO;
  }
}

export async function getBlogDaily(days = 30): Promise<Series> {
  const keys = lastNBakuDays(days);
  const views = new Map<string, number>();
  if (isSupabaseConfigured) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.rpc("blog_view_daily", { p_days: days });
      for (const r of (data ?? []) as { view_date: string; views: number }[]) {
        views.set(r.view_date, r.views);
      }
    } catch {
      /* degrade to zeros */
    }
  }
  return {
    labels: keys.map(shortDayLabel),
    values: keys.map((k) => views.get(k) ?? 0),
  };
}

export async function getArticleAnalytics(): Promise<ArticleAnalytics[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const [postsRes, statsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, slug, status, published_at, reading_time_minutes, category:categories(name)")
        .order("published_at", { ascending: false }),
      supabase.rpc("blog_article_stats"),
    ]);
    const statMap = new Map(
      ((statsRes.data ?? []) as {
        post_id: string;
        total_views: number;
        unique_visitors: number;
        returning_visitors: number;
        last_viewed_at: string | null;
      }[]).map((s) => [s.post_id, s]),
    );
    return ((postsRes.data ?? []) as unknown as {
      id: string;
      title: string;
      slug: string;
      status: string;
      published_at: string | null;
      reading_time_minutes: number;
      category: { name: string } | null;
    }[]).map((p) => {
      const s = statMap.get(p.id);
      return {
        postId: p.id,
        title: p.title,
        slug: p.slug,
        categoryName: p.category?.name ?? "—",
        status: p.status,
        publishedAt: p.published_at,
        readingTime: p.reading_time_minutes ?? 0,
        totalViews: s?.total_views ?? 0,
        uniqueVisitors: s?.unique_visitors ?? 0,
        returningVisitors: s?.returning_visitors ?? 0,
        lastViewedAt: s?.last_viewed_at ?? null,
      };
    });
  } catch {
    return [];
  }
}

export async function getTopCategoriesByViews(): Promise<
  { categoryName: string; views: number }[]
> {
  const articles = await getArticleAnalytics();
  const byCat = new Map<string, number>();
  for (const a of articles) {
    if (a.totalViews <= 0) continue;
    byCat.set(a.categoryName, (byCat.get(a.categoryName) ?? 0) + a.totalViews);
  }
  return [...byCat.entries()]
    .map(([categoryName, views]) => ({ categoryName, views }))
    .sort((a, b) => b.views - a.views);
}
