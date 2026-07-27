import "server-only";

/**
 * In-process rate limiting, login throttling and temporary lockouts.
 *
 * Two independent counters per key:
 *   • a sliding REQUEST window — caps how often an endpoint may be called at
 *     all (blunts credential stuffing and beacon/upload spam);
 *   • a FAILURE counter — after `maxFailures` bad attempts the key is locked
 *     out, and each further failure doubles the lockout (progressive delay)
 *     up to `maxLockoutMs`. A success clears it.
 *
 * Keys are always scoped so an attacker cannot lock a victim out of their own
 * account by failing logins from elsewhere: we limit per (IP + account) and per
 * IP, never per account alone. See `authKeys()`.
 *
 * SCOPE / LIMITS — be honest about what this is:
 *   • State lives in module memory. It is per server instance and is lost on
 *     cold start, so on serverless it slows an attacker down rather than
 *     stopping them dead. For a hard, shared limit put Supabase's own Auth
 *     rate limits + CAPTCHA in front (see README "Brute-force protection").
 *   • It cannot see requests that bypass this app and hit the Supabase Auth
 *     API directly — that path is covered by Supabase's built-in limits.
 */

export type RateRule = {
  /** Max requests allowed inside `windowMs`. */
  limit: number;
  windowMs: number;
  /** Failures tolerated before lockouts begin. Omit for request-only limiting. */
  maxFailures?: number;
  /** First lockout length; doubles per extra failure. */
  baseLockoutMs?: number;
  maxLockoutMs?: number;
};

export const RATE_RULES = {
  /** Password sign-in: 10 tries / 10 min, lockout after 5 failures. */
  signIn: {
    limit: 10,
    windowMs: 10 * 60_000,
    maxFailures: 5,
    baseLockoutMs: 30_000,
    maxLockoutMs: 15 * 60_000,
  },
  /** Account creation: 5 / hour per address — stops automated sign-up floods. */
  signUp: { limit: 5, windowMs: 60 * 60_000 },
  /** Reset mail: 3 / 15 min — also protects the mail quota from being burned. */
  passwordReset: { limit: 3, windowMs: 15 * 60_000 },
  /** Password change (authenticated): lock out after repeated wrong current-password. */
  passwordChange: {
    limit: 10,
    windowMs: 15 * 60_000,
    maxFailures: 5,
    baseLockoutMs: 60_000,
    maxLockoutMs: 15 * 60_000,
  },
  /** Purchase submissions (each may carry a 5 MB upload). */
  purchase: { limit: 5, windowMs: 10 * 60_000 },
  /** Analytics beacon — generous, just stops one client inflating counts. */
  viewBeacon: { limit: 120, windowMs: 60_000 },
} satisfies Record<string, RateRule>;

type Entry = {
  /** Timestamps of recent requests (sliding window). */
  hits: number[];
  failures: number;
  lockedUntil: number;
  /** Last time this entry was touched — drives eviction. */
  seen: number;
};

const store = new Map<string, Entry>();
const MAX_ENTRIES = 10_000;
const ENTRY_TTL_MS = 60 * 60_000;

function sweep(now: number): void {
  for (const [key, entry] of store) {
    if (now - entry.seen > ENTRY_TTL_MS && entry.lockedUntil < now) store.delete(key);
  }
  // Hard cap so a flood of unique keys can't grow the map without bound.
  if (store.size > MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].seen - b[1].seen);
    for (const [key] of oldest.slice(0, store.size - MAX_ENTRIES)) store.delete(key);
  }
}

function entryFor(key: string, now: number): Entry {
  let entry = store.get(key);
  if (!entry) {
    entry = { hits: [], failures: 0, lockedUntil: 0, seen: now };
    store.set(key, entry);
    if (store.size % 256 === 0) sweep(now);
  }
  entry.seen = now;
  return entry;
}

export type RateVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: "rate" | "lockout" };

/**
 * Consume one request slot for `key`. Call this BEFORE doing the work, on every
 * attempt. Returns how long to wait when the caller is over the limit or locked.
 */
export function consume(key: string, rule: RateRule, now = Date.now()): RateVerdict {
  const entry = entryFor(key, now);

  if (entry.lockedUntil > now) {
    return {
      allowed: false,
      reason: "lockout",
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  entry.hits = entry.hits.filter((t) => now - t < rule.windowMs);
  if (entry.hits.length >= rule.limit) {
    const oldest = entry.hits[0] ?? now;
    return {
      allowed: false,
      reason: "rate",
      retryAfterSeconds: Math.max(1, Math.ceil((rule.windowMs - (now - oldest)) / 1000)),
    };
  }

  entry.hits.push(now);
  return { allowed: true };
}

/**
 * Record a FAILED attempt (wrong password, wrong current password). Escalates
 * into a temporary lockout that doubles with each further failure.
 * Returns the lockout now in force, in seconds (0 = not locked yet).
 */
export function penalize(key: string, rule: RateRule, now = Date.now()): number {
  const entry = entryFor(key, now);
  entry.failures += 1;

  const maxFailures = rule.maxFailures ?? Number.POSITIVE_INFINITY;
  if (entry.failures < maxFailures) return 0;

  const base = rule.baseLockoutMs ?? 30_000;
  const max = rule.maxLockoutMs ?? 15 * 60_000;
  const overage = entry.failures - maxFailures; // 0 on the first lockout
  const lockoutMs = Math.min(max, base * 2 ** overage);
  entry.lockedUntil = Math.max(entry.lockedUntil, now + lockoutMs);
  return Math.ceil(lockoutMs / 1000);
}

/** Clear failures + lockout for a key after a genuine success. */
export function reset(key: string): void {
  const entry = store.get(key);
  if (!entry) return;
  entry.failures = 0;
  entry.lockedUntil = 0;
}

/**
 * Keys for an authentication attempt.
 *
 * `ipAccount` is the precise one (this address against this account) and is the
 * only key we ever LOCK, so a third party flooding failures for someone else's
 * email can never lock the real owner out of their account — the victim's own
 * IP has its own untouched counter. `ip` is a coarse ceiling that stops one
 * address from spraying many different accounts (credential stuffing).
 */
export function authKeys(scope: string, ip: string, account: string) {
  const id = account.trim().toLowerCase();
  return {
    ipAccount: `${scope}:ip-acct:${ip}:${id}`,
    ip: `${scope}:ip:${ip}`,
  };
}
