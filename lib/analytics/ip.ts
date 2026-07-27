import "server-only";
import { createHash } from "node:crypto";

/**
 * Privacy: we NEVER store a raw visitor IP. We store a salted SHA-256 hash,
 * which is enough to de-duplicate refreshes and count unique/returning visitors
 * without holding PII. The salt is a server-only secret (defaults to the
 * service-role key, which never reaches the browser), so hashes aren't
 * reversible by dictionary attack across deployments.
 */
const SALT =
  process.env.ANALYTICS_IP_SALT ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "antg-analytics-fallback-salt";

/**
 * Client IP, resolved from headers our infrastructure controls.
 *
 * This used to read the LEFT-most `x-forwarded-for` entry, which is the part of
 * the header a client supplies. Anyone could send a fresh random value per
 * request and appear as a new visitor every time, inflating "unique visitors"
 * and defeating the per-day de-duplication. `lib/security/request.ts` prefers
 * proxy-set headers and counts XFF from the trusted (right-hand) end instead.
 *
 * Re-exported here so existing analytics callers keep working unchanged.
 */
export { getClientIp } from "@/lib/security/request";

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${SALT}:${ip}`).digest("hex");
}

/** Baku calendar day (YYYY-MM-DD) for the dedup bucket — one view per day. */
export function bakuViewDay(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // en-CA → "YYYY-MM-DD"
  return p;
}
