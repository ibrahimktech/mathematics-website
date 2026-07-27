import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type AdminUser = { id: string; email: string | null };

/**
 * Whether the current session belongs to an allow-listed admin.
 *
 * Two checks, both server-side and both against Supabase (never the client):
 *   1. `auth.getUser()` re-validates the JWT with the Auth server.
 *   2. the `is_admin()` RPC (SECURITY DEFINER) confirms a row in `public.admins`.
 *
 * Pass the request-scoped cookie client so `auth.uid()` inside the RPC resolves
 * to the caller. This is the same gate the RLS policies enforce in the database,
 * mirrored in the app so we can fail fast with a friendly redirect/error.
 */
export async function isAdmin(supabase: SupabaseClient): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

/**
 * Guard for admin **pages / layouts** (Server Components). Enforces the app's
 * redirect policy and returns the admin's identity:
 *   - not signed in           → /daxil-ol (the shared login; no admin-only page)
 *   - signed in, not an admin  → /
 *
 * This is the authoritative server-side gate (the Data Access Layer). The
 * middleware performs the same check first for a snappier redirect, but this
 * one runs at render time and cannot be bypassed by skipping the middleware.
 */
export async function requireAdminPage(): Promise<AdminUser> {
  // Fail closed before setup: no config means nobody can be an admin.
  if (!isSupabaseConfigured) redirect("/daxil-ol");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/daxil-ol?redirect=/admin/dashboard");
  const { data: adminFlag, error } = await supabase.rpc("is_admin");
  if (error || adminFlag !== true) redirect("/");
  return { id: user.id, email: user.email ?? null };
}
