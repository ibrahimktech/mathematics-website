/** Central place to read Supabase env + know whether setup is complete. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * True once the two public Supabase env vars are present. Used by the public
 * data layer to degrade gracefully (show "no articles yet" instead of crashing)
 * before the teacher has configured their project.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const ARTICLE_IMAGES_BUCKET = "article-images";
