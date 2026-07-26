import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isServiceRoleConfigured = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

/**
 * Service-role Supabase client — **SERVER ONLY** (guarded by `server-only`, so
 * importing it into a client component is a build error). It bypasses RLS, so it
 * is used exclusively for authoritative writes AFTER the caller's identity has
 * been verified from the session (granting a purchase, creating/grading an
 * attempt). This is why students cannot forge scores or self-grant purchases via
 * the REST API: those tables have no user-facing write policies, and the only
 * code that writes them runs here, on the server, with a session-derived user_id.
 *
 * The service-role key must NEVER reach the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
