/** Central place to read Supabase env + know whether setup is complete. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * True once the two public Supabase env vars are present. Used by the public
 * data layer to degrade gracefully (show "no articles yet" instead of crashing)
 * before the teacher has configured their project.
 */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const ARTICLE_IMAGES_BUCKET = "article-images";

/**
 * Cookie attributes for the Supabase auth cookies, applied identically by the
 * browser client, the server client and the middleware so a cookie written by
 * one is never silently re-scoped by another.
 *
 *   • `sameSite: "lax"` — the cookie is not sent on cross-site POSTs, which is
 *     the primary CSRF defence for anything cookie-authenticated. "strict"
 *     would break returning from the Supabase confirmation/reset e-mail link
 *     (a cross-site top-level navigation), so "lax" is the correct choice here.
 *   • `secure` in production — the session token may never travel over plain
 *     HTTP. Left off in dev because http://localhost would reject it.
 *   • `path: "/"` — one session for the whole app, so sign-out clears it all.
 *
 * NOT SET: `httpOnly`. Sign-in happens in the browser (that is what lets the
 * navbar update instantly and what the direct-to-Supabase client calls need),
 * and a cookie written via `document.cookie` cannot be HttpOnly — browsers
 * forbid it. The mitigation is the strict CSP in `next.config.ts` plus the
 * output escaping in the LaTeX renderer, i.e. preventing the XSS that would be
 * needed to read the cookie. Moving auth server-side is the way to get HttpOnly;
 * see the security report for that trade-off.
 */
export const AUTH_COOKIE_OPTIONS = {
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
