import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Cookie-less anonymous Supabase client for PUBLIC reads (homepage, article
 * pages, category pages, search, RSS, sitemap). Because it never touches
 * cookies, pages that use it stay eligible for static generation / ISR.
 * RLS restricts it to published posts.
 */
export function createPublicClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
