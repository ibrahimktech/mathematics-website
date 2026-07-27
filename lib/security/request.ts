import "server-only";

/**
 * Trusted client-IP resolution.
 *
 * `x-forwarded-for` is a CLIENT-CONTROLLED header. Anyone can send
 * `X-Forwarded-For: 1.2.3.4` and, if we blindly read the left-most entry, they
 * pick their own identity — which would make IP-keyed rate limiting and
 * analytics de-duplication trivially bypassable (send a random XFF per request
 * and every attempt looks like a brand-new visitor).
 *
 * The only trustworthy values are the ones the hosting proxy *overwrites* on
 * every request. We therefore prefer platform headers, and fall back to XFF
 * counted from the RIGHT (the proxy appends, so the right-most entries are the
 * ones our infrastructure added and the left-most are attacker-supplied).
 *
 * `TRUSTED_PROXY_COUNT` = how many reverse proxies sit in front of the app
 * (Vercel = 1, which is the default). Raise it if you add another proxy/CDN.
 */

const TRUSTED_PROXY_COUNT = (() => {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
})();

/** Platform-set headers, in order of trust. These are overwritten per request. */
const PLATFORM_IP_HEADERS = [
  "x-vercel-forwarded-for", // Vercel — always rewritten at the edge
  "cf-connecting-ip", // Cloudflare
  "true-client-ip", // Akamai / Cloudflare Enterprise
  "x-real-ip", // nginx-style single-value header
] as const;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function normalize(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let ip = raw.trim();
  if (!ip) return null;
  // Strip an IPv6 bracket form and any :port suffix on IPv4.
  if (ip.startsWith("[")) ip = ip.slice(1, ip.indexOf("]") > 0 ? ip.indexOf("]") : undefined);
  else if (IPV4.test(ip.split(":")[0]) && ip.includes(":")) ip = ip.split(":")[0];
  // Reject anything that isn't plausibly an address so a junk header can't
  // become a rate-limit bucket key of its own.
  if (ip.length > 45 || !/^[0-9a-f.:]+$/i.test(ip)) return null;
  return ip;
}

/**
 * The caller's IP as reported by infrastructure we trust. Falls back to
 * `"unknown"` (a single shared bucket) rather than to a spoofable value —
 * failing closed is the right trade-off for a rate-limit key.
 */
export function getClientIp(headers: Headers): string {
  for (const name of PLATFORM_IP_HEADERS) {
    const value = normalize(headers.get(name)?.split(",")[0]);
    if (value) return value;
  }

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    // With N trusted proxies the client is at index (length - N); anything
    // further left was supplied by the client and must not be trusted.
    const index = parts.length - TRUSTED_PROXY_COUNT;
    const value = normalize(parts[index >= 0 ? index : 0]);
    if (value) return value;
  }

  return "unknown";
}

/**
 * Same-origin check for state-changing route handlers. Server Actions get this
 * for free from Next.js; plain route handlers do not, so any POST route that
 * writes must call this to blunt cross-site (CSRF) submissions.
 *
 * Returns true when the request either has no Origin (same-origin navigations
 * and non-browser callers such as curl send none) or an Origin matching the
 * host we were actually reached on.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
