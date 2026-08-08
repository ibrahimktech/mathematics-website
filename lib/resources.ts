import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Resource } from "./resources/types";

export type { Resource, ResourceUrlMode } from "./resources/types";
export { formatFileSize } from "./resources/types";

/* =============================================================================
 * Resource-library reads. ALWAYS through the request's cookie session client,
 * so Postgres RLS decides: `authenticated` may SELECT, anonymous gets nothing
 * (see `supabase/resources-schema.sql`). That is deliberate — unlike posts and
 * exams there is no public/anon path here, which is what makes the library
 * members-only in the database rather than merely behind a redirect.
 *
 * The same function serves students and admins: both are `authenticated`, both
 * see the whole library, and there is no draft/published split to hide.
 *
 * Degrades gracefully to [] when Supabase isn't configured or the migration
 * hasn't been applied yet, so the page renders an empty state instead of a 500.
 * ========================================================================== */

/**
 * Columns safe to hand to the browser. `file_path` is EXCLUDED on purpose: the
 * storage object name is internal, and the client never needs it — it asks for
 * a resource by id and the server resolves the path (see
 * `fetchResourceUrl`). Nothing the client sends can therefore address storage.
 */
const RESOURCE_COLUMNS =
  "id,title,description,author,category_slug,file_name,file_size,created_at,updated_at";

/** Sane ceiling — the library is a teacher's shelf, not a catalogue. */
const MAX_RESOURCES = 500;

/** The whole library, newest first. Search/filtering happens in the client. */
export async function getResources(): Promise<Resource[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("resources")
      .select(RESOURCE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(MAX_RESOURCES);
    if (error) throw error;
    return (data ?? []) as unknown as Resource[];
  } catch {
    return [];
  }
}

/** How many resources exist (admin dashboard / empty-state copy). */
export async function getResourceCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("resources")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  } catch {
    return 0;
  }
}
