import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin read of the registered accounts, for the read-only users list.
 *
 * Source of truth is `public.profiles` (one row per `auth.users` row, created by
 * the `on_auth_user_created` trigger) — no duplicate user store. Uses the cookie
 * session client under RLS: the "Admins read all profiles" policy is what makes
 * this return more than the caller's own row, so a non-admin session gets [].
 *
 * Only the three display fields are selected — never auth material (passwords,
 * hashes and tokens live in `auth.users`, which the anon key cannot read at all).
 */

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Older accounts may only have `full_name`; split it as a fallback. */
function splitFullName(full: string | null): [string, string] {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  return [parts.slice(0, -1).join(" ") || parts[0], parts.length > 1 ? parts[parts.length - 1] : ""];
}

export async function getUsersAdmin(): Promise<AdminUser[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, email")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as {
      id: string;
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
      email: string | null;
    }[];

    return rows.map((r) => {
      const [fallbackFirst, fallbackLast] = splitFullName(r.full_name);
      return {
        id: r.id,
        firstName: r.first_name?.trim() || fallbackFirst,
        lastName: r.last_name?.trim() || fallbackLast,
        email: r.email ?? "",
      };
    });
  } catch {
    return [];
  }
}
