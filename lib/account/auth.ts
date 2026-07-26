import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Student (non-admin) account helpers.
 *
 * The blog's `lib/admin/auth.ts` gates the *admin allow-list*; this file gates
 * ordinary signed-in students. Any authenticated Supabase user counts as a
 * student here — there is no allow-list. These two layers are intentionally
 * separate so the student dashboard can never be confused with the admin panel.
 */

export type AccountUser = {
  id: string;
  email: string | null;
  name: string | null;
};

function toAccountUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): AccountUser {
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  return { id: user.id, email: user.email ?? null, name };
}

/** The current signed-in user, or null. Never throws / redirects. */
export async function getOptionalUser(): Promise<AccountUser | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? toAccountUser(user) : null;
  } catch {
    return null;
  }
}

/**
 * Guard for pages that require a signed-in student. Sends anonymous visitors to
 * the login page with a `redirect` back to where they were headed. This is the
 * authoritative per-request gate (mirrored by middleware for a faster redirect).
 */
export async function requireUser(redirectTo = "/panel"): Promise<AccountUser> {
  const user = await getOptionalUser();
  if (!user) {
    redirect(`/daxil-ol?redirect=${encodeURIComponent(redirectTo)}`);
  }
  return user;
}
