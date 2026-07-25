/** Domain types mirroring the Supabase schema in `supabase/schema.sql`. */

export type PostStatus = "draft" | "published";

export interface Category {
  id: string;
  name: string;
  slug: string;
  emoji: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  cover_image_url: string | null;
  excerpt: string | null;
  content: string;
  category_id: string | null;
  tags: string[];
  status: PostStatus;
  published_at: string | null;
  reading_time_minutes: number;
  created_at: string;
  updated_at: string;
}

/** A post joined with its category (as returned by the public/admin queries). */
export interface PostWithCategory extends Post {
  category: Category | null;
}

/** A category augmented with how many published posts it holds. */
export interface CategoryWithCount extends Category {
  post_count: number;
}
