import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createPublicClient } from "@/lib/supabase/public";
import type { Category, CategoryWithCount } from "@/lib/types";

/** All categories, ordered for the sidebar. */
export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Category[];
  } catch {
    return [];
  }
}

/** Categories with a count of PUBLISHED posts each (for the sidebar). */
export async function getCategoriesWithCount(): Promise<CategoryWithCount[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createPublicClient();
    const [categoriesRes, postsRes] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("posts").select("category_id").eq("status", "published"),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;

    const counts = new Map<string, number>();
    for (const row of postsRes.data ?? []) {
      const id = (row as { category_id: string | null }).category_id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return (categoriesRes.data ?? []).map((c) => ({
      ...(c as Category),
      post_count: counts.get((c as Category).id) ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return (data as Category) ?? null;
  } catch {
    return null;
  }
}
