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

/** First hop in x-forwarded-for is the real client IP behind the platform proxy. */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

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
