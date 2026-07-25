import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createPublicClient } from "@/lib/supabase/public";
import { getCategoryBySlug } from "@/lib/categories";
import type { Post, PostWithCategory } from "@/lib/types";

const POST_SELECT = "*, category:categories(*)";

function asPosts(data: unknown): PostWithCategory[] {
  return (data ?? []) as PostWithCategory[];
}

/** Latest published posts, newest first. */
export async function getPublishedPosts(limit?: number): Promise<PostWithCategory[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createPublicClient();
    let query = supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return asPosts(data);
  } catch {
    return [];
  }
}

/** A single published post by slug (null if missing/unpublished). */
export async function getPostBySlug(slug: string): Promise<PostWithCategory | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw error;
    return (data as PostWithCategory) ?? null;
  } catch {
    return null;
  }
}

/** Published posts in a category (by category slug). */
export async function getPostsByCategorySlug(
  slug: string,
  limit?: number,
): Promise<{ category: Awaited<ReturnType<typeof getCategoryBySlug>>; posts: PostWithCategory[] }> {
  const category = await getCategoryBySlug(slug);
  if (!category || !isSupabaseConfigured) return { category, posts: [] };
  try {
    const supabase = createPublicClient();
    let query = supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("status", "published")
      .eq("category_id", category.id)
      .order("published_at", { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw error;
    return { category, posts: asPosts(data) };
  } catch {
    return { category, posts: [] };
  }
}

/** Full-text search across title, excerpt, tags and body (published only). */
export async function searchPosts(rawQuery: string, limit = 30): Promise<PostWithCategory[]> {
  const q = rawQuery.trim();
  if (!q || !isSupabaseConfigured) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("status", "published")
      .textSearch("search_vector", q, { type: "websearch", config: "simple" })
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return asPosts(data);
  } catch {
    return [];
  }
}

/** Previous (older) and next (newer) published posts relative to `post`. */
export async function getAdjacentPosts(
  post: Pick<Post, "published_at">,
): Promise<{ previous: PostWithCategory | null; next: PostWithCategory | null }> {
  if (!isSupabaseConfigured || !post.published_at)
    return { previous: null, next: null };
  try {
    const supabase = createPublicClient();
    const [prevRes, nextRes] = await Promise.all([
      supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("status", "published")
        .lt("published_at", post.published_at)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("status", "published")
        .gt("published_at", post.published_at)
        .order("published_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      previous: (prevRes.data as PostWithCategory) ?? null,
      next: (nextRes.data as PostWithCategory) ?? null,
    };
  } catch {
    return { previous: null, next: null };
  }
}

/** Related published posts (same category, excluding the current one). */
export async function getRelatedPosts(
  post: Pick<Post, "id" | "category_id">,
  limit = 3,
): Promise<PostWithCategory[]> {
  if (!isSupabaseConfigured || !post.category_id) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("status", "published")
      .eq("category_id", post.category_id)
      .neq("id", post.id)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return asPosts(data);
  } catch {
    return [];
  }
}

/** Slugs + timestamps of all published posts (for the sitemap). */
export async function getAllPublishedSlugs(): Promise<
  { slug: string; updated_at: string; published_at: string | null }[]
> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("posts")
      .select("slug, updated_at, published_at")
      .eq("status", "published");
    if (error) throw error;
    return (data ?? []) as {
      slug: string;
      updated_at: string;
      published_at: string | null;
    }[];
  } catch {
    return [];
  }
}
