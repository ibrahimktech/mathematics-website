/**
 * Open-redirect guard for the `?redirect=` parameter used by the login /
 * sign-up / password-reset pages.
 *
 * The naive check `value.startsWith("/") && !value.startsWith("//")` is NOT
 * enough. Browsers normalise backslashes to forward slashes in URLs, so
 * `/\evil.example` and `/\/evil.example` are treated as PROTOCOL-RELATIVE and
 * navigate off-site — which is exactly what a phishing link needs after a real
 * login. Percent-encoded and control characters (`/%09/evil.example`,
 * `/%0Ahttps://…`) are stripped by browsers before parsing and slip past naive
 * checks the same way.
 *
 * This helper accepts ONLY a simple same-origin absolute path and falls back to
 * a known-safe local route otherwise.
 */

/** C0/C1 control characters, which browsers strip before parsing a URL. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;
/** Anything that could start a scheme, e.g. `javascript:` or `https:`. */
const HAS_SCHEME = /^[a-z][a-z0-9+.\-]*:/i;

function looksHostRelative(value: string): boolean {
  // `//host`, `/\host`, `/ /host` — every form a browser reads as "off-site".
  return /^\/[\\/]/.test(value) || /^\/\s*[\\/]/.test(value);
}

/**
 * Returns `raw` when it is a safe local path, otherwise `fallback`.
 * Always run the RESULT through this function — never the raw parameter.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = "/panel",
): string {
  if (typeof raw !== "string") return fallback;

  const value = raw.trim();
  if (!value || value.length > 512) return fallback;
  if (CONTROL_CHARS.test(value)) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.includes("\\")) return fallback;
  if (looksHostRelative(value)) return fallback;

  // Re-check after decoding: `%2f%2fevil.example` and `%09` only reveal their
  // shape once decoded, and some proxies decode before the browser sees them.
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback; // malformed escape sequence — reject outright
  }
  if (CONTROL_CHARS.test(decoded)) return fallback;
  if (decoded.includes("\\")) return fallback;
  if (looksHostRelative(decoded)) return fallback;
  if (HAS_SCHEME.test(decoded)) return fallback;

  return value;
}

/**
 * An absolute URL for Supabase's `emailRedirectTo` / `redirectTo` options,
 * pinned to THIS origin. Supabase also requires the URL to be in its redirect
 * allow-list, but building it from `window.location.origin` (never from user
 * input) means a crafted `?redirect=` can't turn a real confirmation mail into
 * a token-stealing link to someone else's host.
 */
export function safeAbsoluteRedirect(
  origin: string,
  path: string | null | undefined,
  fallback = "/panel",
): string {
  return `${origin}${safeRedirectPath(path, fallback)}`;
}
