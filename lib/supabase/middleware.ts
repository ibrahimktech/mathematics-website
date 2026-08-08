import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_COOKIE_OPTIONS,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "./config";

/**
 * Areas any SIGNED-IN user may enter — no allow-list, just an account. Kept as
 * a list because these must be handled BEFORE the admin logic below: falling
 * through to it would bounce an ordinary student to the home page for failing
 * an `is_admin()` check that was never meant to apply to them.
 *
 * Every entry must also appear in the `matcher` in `middleware.ts`, or the
 * middleware never runs for it.
 */
const MEMBER_AREAS = ["/panel", "/resurslar"];

function isMemberArea(pathname: string): boolean {
  return MEMBER_AREAS.some(
    (base) => pathname === base || pathname.startsWith(base + "/"),
  );
}

/**
 * Refreshes the Supabase auth session and guards the private areas.
 * - `/panel/*` and `/resurslar` need only an ACCOUNT. Anonymous visitors go to
 *   `/daxil-ol` with a `redirect` back, so they return to the page they wanted.
 * - `/admin/*` needs the `public.admins` allow-list on top. Unauthenticated
 *   visitors are redirected to the same shared login (there is no separate admin
 *   login page); authenticated but NON-admin visitors are sent to the public
 *   home page — being logged in is not enough to enter the panel.
 * If Supabase isn't configured yet, nothing is blocked (pre-setup).
 *
 * This is an optimistic first line of defense for a fast redirect; the real
 * gates are `requireUser()` / `requireAdminPage()` at render time plus the RLS
 * policies. Never rely on middleware alone (routes can be matched incompletely,
 * and mutations bypass page rendering entirely).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured) return supabaseResponse;

  const pathname = request.nextUrl.pathname;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      /**
       * `responseHeaders` carries the no-store directives the library asks us to
       * set whenever auth cookies are written. Applying them matters: a refreshed
       * session token in a cacheable response is one user's session handed to
       * whoever the CDN serves next.
       */
      setAll(cookiesToSet, responseHeaders) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(responseHeaders ?? {}).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Member areas (/panel, /resurslar): ANY signed-in user may enter; there
  // is no admin allow-list here. Handled first and returned early so the admin
  // logic below is untouched. Anonymous visitors go to the login page with a
  // `redirect` back, which is what makes the public "Resurslar" navbar link
  // work for a signed-out visitor instead of dead-ending.
  if (isMemberArea(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/daxil-ol";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // --- Admin area (/admin): allow-list. Admins sign in through the shared
  // `/daxil-ol` login (no separate admin login page). ---
  // Not signed in: send to the login page with a return path back into /admin.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/daxil-ol";
    url.searchParams.set(
      "redirect",
      pathname === "/admin" ? "/admin/dashboard" : pathname,
    );
    return NextResponse.redirect(url);
  }

  // Signed in — but only allow-listed admins may touch /admin. Verify against
  // public.admins via the SECURITY DEFINER RPC (same check the RLS uses).
  const { data: adminFlag } = await supabase.rpc("is_admin");
  if (adminFlag !== true) {
    // Authenticated yet not an admin: never let them into the panel. Send home.
    // Logged as a security event — a signed-in user probing /admin is worth
    // seeing. No email, no token, no IP: middleware runs on the Edge runtime,
    // where the hashing helpers in lib/security/log.ts are unavailable.
    console.warn(
      JSON.stringify({
        kind: "security",
        event: "authz.denied",
        at: new Date().toISOString(),
        area: "admin",
        path: pathname,
        userId: `${user.id.slice(0, 8)}…`,
      }),
    );
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
