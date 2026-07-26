import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * Refreshes the Supabase auth session and guards `/admin/*`.
 * - Unauthenticated visitors to any admin page (except the login page) are
 *   redirected to `/admin/login`.
 * - Authenticated but NON-admin visitors (not in `public.admins`) are sent to
 *   the public home page — being logged in is not enough to enter the panel.
 * - Admins already signed in are bounced away from the login page.
 * If Supabase isn't configured yet, nothing is blocked (pre-setup).
 *
 * This is an optimistic first line of defense for a fast redirect; the real
 * gate is `requireAdminPage()` in the admin layout plus the RLS policies. Never
 * rely on middleware alone (routes can be matched incompletely, and mutations
 * bypass page rendering entirely).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured) return supabaseResponse;

  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/admin/login";

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Student dashboard (/panel): ANY signed-in user may enter; there is no
  // admin allow-list here. Handled first and returned early so the admin logic
  // below is untouched. Anonymous visitors go to the student login page.
  if (pathname.startsWith("/panel")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/daxil-ol";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // --- Admin area (/admin): unchanged allow-list behavior. ---
  // Not signed in: allow only the login page; send everyone else to it.
  if (!user) {
    if (isLogin) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    if (pathname !== "/admin") url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Signed in — but only allow-listed admins may touch /admin. Verify against
  // public.admins via the SECURITY DEFINER RPC (same check the RLS uses).
  const { data: adminFlag } = await supabase.rpc("is_admin");
  const admin = adminFlag === true;

  if (!admin) {
    // Authenticated yet not an admin: never let them into the panel (this also
    // covers the login page, so they can't linger there). Send home.
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Admin hitting the login page → straight to the dashboard.
  if (isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
