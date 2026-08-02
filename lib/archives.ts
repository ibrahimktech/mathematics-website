import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createPublicClient } from "@/lib/supabase/public";
import type { PostWithCategory } from "@/lib/types";
import {
  archiveLabel,
  archiveRange,
  bakuMonthKey,
  compareArchivesDesc,
  parseArchivePeriod,
  type ArchiveEntry,
  type ArchivePeriod,
} from "@/lib/archives/period";

/**
 * Blog archives — published posts grouped by month. Derived data: there is no
 * archives table. Reads go through the cookie-less public client so the blog
 * pages stay static/ISR, exactly like `lib/posts.ts` and `lib/categories.ts`.
 */

const POST_SELECT = "*, category:categories(*)";

type ArchiveRow = { period: string | null; post_count: number | null };

function toEntries(rows: ArchiveRow[]): ArchiveEntry[] {
  return rows
    .filter((r): r is { period: string; post_count: number } =>
      Boolean(r.period && parseArchivePeriod(r.period) && (r.post_count ?? 0) > 0),
    )
    .map((r) => ({
      period: r.period,
      label: archiveLabel(r.period),
      post_count: r.post_count,
    }))
    .sort(compareArchivesDesc);
}

/**
 * Fallback used only when `blog_archive_counts` is missing — i.e. before
 * `supabase/blog-archives.sql` has been applied. Selects the single
 * `published_at` column (no bodies, no joins) and buckets it here, so the
 * sidebar still works pre-migration; the RPC replaces it the moment it exists.
 */
async function archivesFromPublishedDates(): Promise<ArchiveEntry[]> {
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("posts")
      .select("published_at")
      .eq("status", "published")
      .not("published_at", "is", null);
    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { published_at: string | null }[]) {
      const key = row.published_at ? bakuMonthKey(row.published_at) : "";
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return toEntries(
      [...counts].map(([period, post_count]) => ({ period, post_count })),
    );
  } catch {
    return [];
  }
}

/**
 * Every month that holds at least one published post, newest first, with its
 * post count. Aggregated in Postgres (one row per month).
 */
export async function getArchives(): Promise<ArchiveEntry[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase.rpc("blog_archive_counts");
    if (error) throw error;
    return toEntries((data ?? []) as ArchiveRow[]);
  } catch {
    return archivesFromPublishedDates();
  }
}

/**
 * Published posts of one archive month, newest first. `period` is the raw URL
 * segment; an unparseable one yields `period: null` so the page can 404.
 */
export async function getPostsByArchive(
  rawPeriod: string,
  limit?: number,
): Promise<{ period: ArchivePeriod | null; posts: PostWithCategory[] }> {
  const period = parseArchivePeriod(rawPeriod);
  if (!period || !isSupabaseConfigured) return { period, posts: [] };
  try {
    const { start, end } = archiveRange(period);
    const supabase = createPublicClient();
    let query = supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("status", "published")
      .gte("published_at", start)
      .lt("published_at", end)
      .order("published_at", { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return { period, posts: (data ?? []) as PostWithCategory[] };
  } catch {
    return { period, posts: [] };
  }
}
