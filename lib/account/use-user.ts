"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type ClientUser = {
  email: string | null;
  name: string | null;
  /**
   * Whether this user is an admin. Read from the `is_admin()` RPC purely to
   * decide whether to SHOW the "Admin Panel" link — it is NOT a security
   * boundary. The real gate is middleware + `requireAdminPage()` + RLS on the
   * server, which a hidden/forged client flag can never bypass.
   */
  isAdmin: boolean;
};

/**
 * Client-side session for the shared navbar. Kept on the client on purpose:
 * public pages are cookie-less and statically rendered / ISR (see
 * `lib/supabase/public.ts`), so reading the session on the SERVER would opt the
 * whole site out of static generation. Instead the nav renders the logged-out
 * state in the static HTML and this hook upgrades it after hydration.
 *
 * Returns `undefined` while loading, `null` when signed out, or the user.
 */
export function useSessionUser(): ClientUser | null | undefined {
  const [user, setUser] = useState<ClientUser | null | undefined>(
    isSupabaseConfigured ? undefined : null,
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let active = true;

    function map(u: {
      email?: string | null;
      user_metadata?: Record<string, unknown> | null;
    } | null): ClientUser | null {
      if (!u) return null;
      const meta = u.user_metadata ?? {};
      const name =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        null;
      return { email: u.email ?? null, name, isAdmin: false };
    }

    async function resolve(
      client: SupabaseClient,
      u: Parameters<typeof map>[0],
    ): Promise<ClientUser | null> {
      const base = map(u);
      if (!base) return null;
      try {
        const { data } = await client.rpc("is_admin");
        return { ...base, isAdmin: data === true };
      } catch {
        return base;
      }
    }

    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        const resolved = await resolve(supabase, data.user);
        if (active) setUser(resolved);
      })
      .catch(() => {
        if (active) setUser(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void resolve(supabase, session?.user ?? null).then((resolved) => {
        if (active) setUser(resolved);
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return user;
}
