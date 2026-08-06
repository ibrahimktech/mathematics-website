/**
 * Cloudflare Turnstile — configuration and client-side token handling rules.
 *
 * PURE on purpose (no `server-only`): the auth forms and the server actions both
 * import it, so the two can never disagree about whether a captcha is expected.
 * Same arrangement as `password.ts` and `redirect.ts`.
 *
 * WHERE THE TOKEN IS ACTUALLY VERIFIED — read this before "hardening" it:
 * the secret key lives in the Supabase dashboard (Authentication → Attack
 * Protection), and Supabase Auth calls Cloudflare's `siteverify` itself before
 * it will honour /signup, /token, /recover, /otp, /magiclink or /resend. That
 * placement is the whole point: it also covers a bot that skips this app and
 * posts straight to the Auth API, which is the traffic our in-process rate
 * limiter is structurally blind to.
 *
 * It follows that this app must NOT call `siteverify` itself. Cloudflare:
 * "Each token can only be validated once. A replayed token will be rejected
 * with the `timeout-or-duplicate` error code." A verification here would spend
 * the token and make Supabase's own check fail — every real sign-up would break.
 * One token, one verifier. The functions below therefore only ever check that a
 * token is PRESENT and plausible; they never make a judgement about validity.
 *
 * Consequence worth knowing: there is no Turnstile SECRET in this repo, in
 * `.env.local` or in the deployment. Only the site key, which is public by
 * design (it ships in the HTML of every site that uses Turnstile).
 */

/** Public site key. Safe in the browser — it is meant to be read from the page. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/**
 * True once a site key is configured. Mirrors `isSupabaseConfigured`: with no
 * key the widget renders nothing and the forms behave exactly as they did
 * before, so `npm run build` and a fresh checkout still work.
 */
export const isTurnstileConfigured = Boolean(TURNSTILE_SITE_KEY);

/** Turnstile tokens are opaque; these bounds are generous on purpose (see below). */
const MIN_TOKEN_LENGTH = 20;
const MAX_TOKEN_LENGTH = 4096;

/**
 * Cheap sanity check — "did the client send something token-shaped?" — NOT a
 * validity check. Deliberately loose: the token format is opaque and Cloudflare
 * may change it, so a strict pattern here would one day lock every real user
 * out while doing nothing to an attacker (who can trivially send a well-shaped
 * string). Its only jobs are to fail fast with a useful message and to keep a
 * tampered client from burning a Supabase Auth rate-limit slot.
 */
export function looksLikeTurnstileToken(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const token = raw.trim();
  if (token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) return false;
  // Printable and unbroken: no spaces, newlines or control characters. Rules out
  // obviously garbled input and stops a stray newline reaching an upstream request.
  for (const character of token) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) return false;
  }
  return true;
}

/* ----------------------------------------------------------- user messages -- */

/** The widget has not produced a token yet (or it expired before submit). */
export const TURNSTILE_INCOMPLETE_MESSAGE =
  "Təhlükəsizlik yoxlaması tamamlanmadı. Bir neçə saniyə gözləyib yenidən cəhd edin.";

/** The script could not load at all — blocked, offline, or a CSP misconfiguration. */
export const TURNSTILE_UNAVAILABLE_MESSAGE =
  "Təhlükəsizlik yoxlaması yüklənmədi. Bağlantınızı yoxlayıb yenidən cəhd edin.";
