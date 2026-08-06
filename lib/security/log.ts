import "server-only";

/**
 * Security event log.
 *
 * Writes one structured JSON line per security-relevant event to the server
 * log (Vercel → Runtime Logs, `next dev` → terminal). Deliberately NOT a
 * database table: these events must still be recorded when the database is the
 * thing that's failing, and a log line cannot be tampered with from the app.
 *
 * WHAT IS NEVER LOGGED: passwords, access/refresh tokens, session cookies, the
 * service-role key, receipt contents. Emails are MASKED and IPs are HASHED, so
 * the log is useful for spotting an attack ("40 failures against one account
 * from one address") without becoming a PII dump or a credential-stuffing list
 * if the logs themselves leak.
 */

import { createHash } from "node:crypto";

export type SecurityEvent =
  | "auth.sign_in_failed"
  | "auth.sign_in_succeeded"
  | "auth.sign_in_throttled"
  | "auth.sign_in_locked"
  | "auth.sign_up_attempt"
  | "auth.sign_up_throttled"
  /** A form submitted with no captcha token while Turnstile is configured. */
  | "auth.captcha_missing"
  | "auth.password_reset_requested"
  | "auth.password_reset_throttled"
  | "auth.password_changed"
  | "auth.password_change_rejected"
  | "authz.denied"
  | "abuse.rate_limited";

type Details = {
  /** Raw email — masked before it is written. Never store the raw value. */
  email?: string | null;
  /** Raw IP — hashed before it is written. Never store the raw value. */
  ip?: string | null;
  /** Non-sensitive context: route, reason, attempt counts, lockout seconds. */
  [key: string]: unknown;
};

const IP_LOG_SALT =
  process.env.ANALYTICS_IP_SALT ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "antg-security-log-salt";

/** `student@example.com` → `s****t@example.com`. Enough to correlate, not to reuse. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local[0] ?? "";
  const tail = local.length > 1 ? local[local.length - 1] : "";
  return `${head}${"*".repeat(Math.max(1, local.length - 2))}${tail}@${domain}`;
}

/** Short salted hash — correlates events from one address without storing it. */
function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${IP_LOG_SALT}:${ip}`).digest("hex").slice(0, 16);
}

export function logSecurityEvent(event: SecurityEvent, details: Details = {}): void {
  const { email, ip, ...rest } = details;
  const line = {
    kind: "security",
    event,
    at: new Date().toISOString(),
    email: maskEmail(email),
    ip: hashIp(ip),
    ...rest,
  };
  // A single line so log aggregators can parse it. `console.warn` keeps these
  // visible at the default log level without being flagged as crashes.
  console.warn(JSON.stringify(line));
}
