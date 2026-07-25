import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { PostStatus, PostWithCategory } from "@/lib/types";

const POST_SELECT = "*, category:categories(*)";

/** All posts (drafts + published) for the dashboard. Requires the admin session. */
export async function getAllPostsAdmin(
  status?: PostStatus,
): Promise<PostWithCategory[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    let query = supabase
      .from("posts")
      .select(POST_SELECT)
      .order("updated_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PostWithCategory[];
  } catch {
    return [];
  }
}

export async function getPostByIdAdmin(
  id: string,
): Promise<PostWithCategory | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as PostWithCategory) ?? null;
  } catch {
    return null;
  }
}

/** Lightweight status counts for the dashboard overview. */
export async function getPostCounts(): Promise<{
  total: number;
  published: number;
  draft: number;
}> {
  if (!isSupabaseConfigured) return { total: 0, published: 0, draft: 0 };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("posts").select("status");
    if (error) throw error;
    const rows = (data ?? []) as { status: PostStatus }[];
    const published = rows.filter((r) => r.status === "published").length;
    const draft = rows.filter((r) => r.status === "draft").length;
    return { total: rows.length, published, draft };
  } catch {
    return { total: 0, published: 0, draft: 0 };
  }
}
