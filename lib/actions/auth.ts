"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAdmin } from "@/lib/admin/auth";
import type { ActionResult } from "./types";

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase konfiqurasiya edilməyib." };
  }
  const email = input.email?.trim();
  const password = input.password ?? "";
  if (!email || !password) {
    return { ok: false, error: "E-poçt və şifrə tələb olunur." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: "E-poçt və ya şifrə yanlışdır." };
  }

  // Credentials are valid — but only allow-listed admins may hold a panel
  // session. Reject anyone else and drop the session immediately so no
  // half-authenticated state lingers.
  if (!(await isAdmin(supabase))) {
    await supabase.auth.signOut();
    return { ok: false, error: "Bu hesabın admin icazəsi yoxdur." };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/admin/login");
}
