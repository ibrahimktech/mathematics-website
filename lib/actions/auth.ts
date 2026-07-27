"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Signs the current admin out of their panel session and returns to the public
 * home page.
 *
 * There is no separate admin login form. Admins sign IN through the shared
 * `/daxil-ol` login like any user; being in the `public.admins` allow-list is
 * what unlocks the panel (surfaced as the "Admin panel" nav link and enforced
 * by middleware + `requireAdminPage()` + RLS).
 */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
