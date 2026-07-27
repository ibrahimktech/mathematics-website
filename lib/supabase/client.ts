import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Supabase client for Client Components (login form, image uploads in the
 * editor). Carries the user's auth session; RLS restricts every read and write
 * to what that session is allowed to see.
 *
 * Only the ANON key is ever used here — it is a public identifier, not a
 * secret, and on its own grants nothing beyond what the RLS policies allow.
 * The service-role key is `server-only` (see `admin.ts`) and can never be
 * imported into this file without failing the build.
 *
 * Cookie attributes are pinned explicitly (SameSite=Lax, Secure in production);
 * see `AUTH_COOKIE_OPTIONS` for why HttpOnly is not — and cannot be — set here.
 */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
  });
}
