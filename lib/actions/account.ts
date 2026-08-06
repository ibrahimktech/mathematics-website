"use server";

import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { getClientIp } from "@/lib/security/request";
import {
  acquire,
  authKeys,
  consume,
  penalize,
  release,
  reset,
  RATE_RULES,
} from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/log";
import {
  cleanName,
  normalizeEmail,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/security/password";
import { safeRedirectPath } from "@/lib/security/redirect";
import {
  TURNSTILE_INCOMPLETE_MESSAGE,
  isTurnstileConfigured,
  looksLikeTurnstileToken,
} from "@/lib/security/turnstile";

/**
 * Server-side authentication.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: the browser never tells the server
 * whether a credential check passed. The server performs the check itself and
 * observes the result first-hand.
 *
 * This used to work the other way. `signInWithPassword` ran in the browser and
 * called `reportSignIn(email, success)` afterwards to say how it went — and
 * `success: true` cleared the failure counter and any lockout. The boolean came
 * from the client, so a brute-forcer just sent `true` after every wrong guess
 * and the progressive lockout never engaged. No amount of validation fixes
 * that: the party observing the result was not the party enforcing the
 * consequences, and any report channel from browser to server is forgeable by
 * definition. `reportSignIn` and `reportPasswordChange` are therefore GONE, not
 * hardened — an endpoint that exists only to be told something by an untrusted
 * caller cannot be made safe.
 *
 * What every credential action here now does, in order:
 *
 *   1. re-validate the input server-side (client checks are UX only);
 *   2. require a Turnstile token before any counter moves;
 *   3. take an in-flight lock so concurrent attempts cannot outrun the counter;
 *   4. consume a rate-limit slot, honouring any active lockout;
 *   5. CALL SUPABASE ITSELF and branch on the real answer;
 *   6. penalize or reset from that answer, never from an argument.
 *
 * Auth cookies are written by the cookie-backed server client in step 5 and
 * ride back on the Server Action response, so the browser is signed in when the
 * action returns. Server Actions are same-origin enforced by Next.js, which is
 * what stops a cross-site page from driving them.
 *
 * IMPORTANT — the honest limit: an attacker who skips this app and posts
 * straight to the Supabase Auth API is not seen by these actions at all. That
 * path is covered by Turnstile (enforced inside Supabase Auth) plus Supabase's
 * own rate limits — see README §8.2. This file hardens the application path and
 * produces the log trail; it is not the only line of defence.
 */

export type GateResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds?: number };

/** Generic — never reveals whether the account exists or which field was wrong. */
const GENERIC_CREDENTIALS = "E-poçt və ya şifrə yanlışdır.";

async function callerIp(): Promise<string> {
  return getClientIp(await headers());
}

function throttleMessage(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  return seconds < 60
    ? `Çox sayda cəhd. ${seconds} saniyə sonra yenidən yoxlayın.`
    : `Çox sayda cəhd. ${minutes} dəqiqə sonra yenidən yoxlayın.`;
}

/**
 * Refuse a submission that arrived without a Turnstile token.
 *
 * This is a PRESENCE check, not a verification — deliberately. The token is
 * verified by Supabase Auth against Cloudflare (Dashboard → Authentication →
 * Attack Protection), which is the only placement that also covers a bot
 * posting straight to the Auth API. Verifying here as well would spend the
 * single-use token and make Supabase's own check fail with
 * `timeout-or-duplicate`, breaking every real sign-up. See lib/security/turnstile.ts.
 *
 * So what does this buy? It fails fast with a message that says what actually
 * went wrong (instead of the deliberately vague Supabase error), it stops a
 * tampered client from spending a Supabase rate-limit slot, and it leaves a log
 * line when someone strips the widget. Skipped entirely when no site key is
 * configured, so a developer without Turnstile keys is unaffected.
 *
 * Call it BEFORE `consume()`: a visitor whose widget was slow or blocked must
 * not lose one of their few sign-up / reset attempts over it.
 */
function captchaGate(
  scope: "signin" | "signup" | "reset" | "pwchange",
  token: unknown,
  email: string,
  ip: string,
): GateResult {
  if (!isTurnstileConfigured) return { ok: true };
  if (looksLikeTurnstileToken(token)) return { ok: true };
  logSecurityEvent("auth.captcha_missing", { email, ip, scope });
  return { ok: false, error: TURNSTILE_INCOMPLETE_MESSAGE };
}

/**
 * Did Supabase refuse for a reason that is NOT "these credentials are wrong"?
 * Returns the message to show, or null when it really was a credential failure.
 *
 * Only a genuine credential rejection may move the failure counter. A Turnstile
 * token expires after five minutes, and Supabase rejects at the captcha
 * middleware BEFORE any password is checked — so counting that as a failed
 * login would let someone who simply left the form open lock themselves out,
 * while being told their password was wrong when nothing was wrong with it.
 *
 * This is not a hole an attacker can use: a request rejected for a bad captcha
 * never tests a password, so skipping the penalty gives them nothing to learn.
 * They have still spent a rate-limit slot, because `consume()` ran first.
 */
function nonCredentialFailure(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const { code, status, message } = error as {
    code?: unknown;
    status?: unknown;
    message?: unknown;
  };
  const codeText = String(code ?? "").toLowerCase();
  const messageText = String(message ?? "").toLowerCase();

  if (codeText.includes("captcha") || messageText.includes("captcha")) {
    return TURNSTILE_INCOMPLETE_MESSAGE;
  }
  // Supabase's own limiter kicked in. Slowing them further on our side as well
  // would punish the user twice for one condition.
  if (status === 429 || codeText.includes("rate_limit")) {
    return throttleMessage(60);
  }
  return null;
}

/* ============================================================== sign-in ==== */

export type SignInFields = {
  email: string;
  password: string;
  /** Turnstile token. Presence checked here; VERIFIED by Supabase Auth. */
  captchaToken?: string;
};

/**
 * Sign in. The whole operation, server-side.
 *
 * The password reaches Supabase from here rather than from the browser, which
 * is the entire point: the failure counter is driven by the answer Supabase
 * gave THIS code, so there is nothing for a modified client to lie about. The
 * old three-call dance (`beginSignIn` → browser auth → `reportSignIn`) is gone.
 *
 * On success the cookie-backed client writes the session cookies, and Next.js
 * returns them with this action's response — so the caller is signed in by the
 * time this resolves and only has to navigate.
 *
 * Every failure — bad address, unknown account, wrong password, unconfirmed
 * email — returns one identical message. The distinctions exist only in the
 * server log, so this cannot be used to work out which addresses have accounts.
 */
export async function signIn(fields: SignInFields): Promise<GateResult> {
  const email = normalizeEmail(String(fields?.email ?? ""));
  const password = String(fields?.password ?? "");
  const ip = await callerIp();

  if (!isSupabaseConfigured) return { ok: false, error: GENERIC_CREDENTIALS };

  // Malformed input never reaches Supabase — and returns the SAME generic
  // message as a wrong password, so this can't be used to probe addresses.
  if (validateEmail(email)) return { ok: false, error: GENERIC_CREDENTIALS };

  const captcha = captchaGate("signin", fields?.captchaToken, email, ip);
  if (!captcha.ok) return captcha;

  const keys = authKeys("signin", ip, email);

  // Serialise before counting. Without this, a burst of parallel requests all
  // clear `consume()` before the first failure is recorded and the lockout
  // never engages. Refused attempts deliberately do NOT consume a slot — a
  // double-clicking real user must not spend their own budget on it.
  if (!acquire(keys.ipAccount)) {
    logSecurityEvent("auth.sign_in_throttled", { email, ip, reason: "concurrent" });
    return { ok: false, error: throttleMessage(5), retryAfterSeconds: 5 };
  }

  try {
    for (const key of [keys.ipAccount, keys.ip]) {
      const verdict = consume(key, RATE_RULES.signIn);
      if (!verdict.allowed) {
        logSecurityEvent("auth.sign_in_throttled", {
          email,
          ip,
          reason: verdict.reason,
          retryAfterSeconds: verdict.retryAfterSeconds,
        });
        return {
          ok: false,
          error: throttleMessage(verdict.retryAfterSeconds),
          retryAfterSeconds: verdict.retryAfterSeconds,
        };
      }
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: fields?.captchaToken },
    });

    // Treat "no error but no session" as a failure too. Trusting the absence of
    // an error alone would make any future Supabase response shape that omits a
    // session look like a successful login.
    if (error || !data?.session) {
      // An expired captcha or an upstream throttle is not a wrong password, and
      // must not push a real user towards a lockout they did not earn.
      const upstream = nonCredentialFailure(error);
      if (upstream) {
        logSecurityEvent("auth.sign_in_throttled", {
          email,
          ip,
          reason: "upstream_rejected",
        });
        return { ok: false, error: upstream };
      }

      const lockoutSeconds = penalize(keys.ipAccount, RATE_RULES.signIn);
      logSecurityEvent("auth.sign_in_failed", { email, ip, lockoutSeconds });
      if (lockoutSeconds > 0) {
        logSecurityEvent("auth.sign_in_locked", { email, ip, lockoutSeconds });
      }
      return { ok: false, error: GENERIC_CREDENTIALS };
    }

    // Verified success — the only path that may clear the counters.
    reset(keys.ipAccount);
    reset(keys.ip);
    logSecurityEvent("auth.sign_in_succeeded", { email, ip });
    return { ok: true };
  } finally {
    // `finally`, so a thrown request can never leave the account pinned shut.
    release(keys.ipAccount);
  }
}

/* ============================================================== sign-up ==== */

export type SignUpFields = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Turnstile token. Checked for presence here; VERIFIED by Supabase Auth. */
  captchaToken?: string;
};

/**
 * Server-side validation + rate limiting for account creation. Returns the
 * CLEANED values so the client submits exactly what the server approved,
 * instead of re-deriving them and drifting.
 */
export async function beginSignUp(
  fields: SignUpFields,
): Promise<
  | { ok: true; email: string; firstName: string; lastName: string; fullName: string }
  | { ok: false; error: string; retryAfterSeconds?: number }
> {
  const email = normalizeEmail(String(fields?.email ?? ""));
  const password = String(fields?.password ?? "");
  const firstName = cleanName(String(fields?.firstName ?? ""));
  const lastName = cleanName(String(fields?.lastName ?? ""));
  const ip = await callerIp();

  const emailError = validateEmail(email);
  if (emailError) return { ok: false, error: emailError };

  const firstError = validateName(firstName, "Ad");
  if (firstError) return { ok: false, error: firstError };

  const lastError = validateName(lastName, "Soyad");
  if (lastError) return { ok: false, error: lastError };

  const passwordError = validatePassword(password, {
    email,
    name: `${firstName} ${lastName}`,
  });
  if (passwordError) return { ok: false, error: passwordError };

  const captcha = captchaGate("signup", fields?.captchaToken, email, ip);
  if (!captcha.ok) return captcha;

  const verdict = consume(`signup:ip:${ip}`, RATE_RULES.signUp);
  if (!verdict.allowed) {
    logSecurityEvent("auth.sign_up_throttled", {
      email,
      ip,
      retryAfterSeconds: verdict.retryAfterSeconds,
    });
    return {
      ok: false,
      error: throttleMessage(verdict.retryAfterSeconds),
      retryAfterSeconds: verdict.retryAfterSeconds,
    };
  }

  logSecurityEvent("auth.sign_up_attempt", { email, ip });
  return {
    ok: true,
    email,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
  };
}

/* ======================================================= password reset ==== */

/**
 * Request a password-reset mail. Runs ENTIRELY on the server — the browser
 * never calls Supabase for this — so the rate limit cannot be skipped by
 * scripting the form, and the response is identical whether or not the address
 * exists (no account enumeration, no mail-quota burning).
 *
 * The token itself is issued and enforced by Supabase Auth: it is single-use,
 * expires (Dashboard → Authentication → Email → OTP expiry), and consuming it
 * invalidates the link. We never see, store or log it.
 *
 * `captchaToken` comes from the browser widget because the /recover endpoint is
 * CAPTCHA-gated like /signup; only the token travels, the Supabase call itself
 * still happens here. A missing token IS reported (the visitor has to know to
 * retry) and still reveals nothing about whether the account exists.
 */
export async function requestPasswordReset(
  rawEmail: string,
  redirectPath?: string,
  captchaToken?: string,
): Promise<GateResult> {
  const email = normalizeEmail(String(rawEmail ?? ""));
  const ip = await callerIp();

  // One identical answer for every outcome below.
  const generic: GateResult = { ok: true };

  if (!isSupabaseConfigured) return generic;
  if (validateEmail(email)) return generic;

  const captcha = captchaGate("reset", captchaToken, email, ip);
  if (!captcha.ok) return captcha;

  const keys = authKeys("reset", ip, email);
  for (const key of [keys.ipAccount, keys.ip]) {
    const verdict = consume(key, RATE_RULES.passwordReset);
    if (!verdict.allowed) {
      logSecurityEvent("auth.password_reset_throttled", {
        email,
        ip,
        retryAfterSeconds: verdict.retryAfterSeconds,
      });
      // Throttling IS surfaced (the user must know to wait), but it still says
      // nothing about whether the account exists.
      return {
        ok: false,
        error: throttleMessage(verdict.retryAfterSeconds),
        retryAfterSeconds: verdict.retryAfterSeconds,
      };
    }
  }

  const origin = (await headers()).get("origin");
  const base =
    origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const target = `${base}/sifre-yenile?redirect=${encodeURIComponent(
    safeRedirectPath(redirectPath, "/panel"),
  )}`;

  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: target,
      captchaToken,
    });
  } catch {
    // Swallow: a Supabase error must not turn into a signal about the account.
  }

  logSecurityEvent("auth.password_reset_requested", { email, ip });
  return generic;
}

/* ====================================================== password change ==== */

export type PasswordChangeFields = {
  currentPassword: string;
  newPassword: string;
  /** Turnstile token — the re-authentication below is a password grant. */
  captchaToken?: string;
};

/**
 * Change the signed-in user's password. The whole operation, server-side.
 *
 * Same disease as sign-in, same cure: this used to be `beginPasswordChange()`
 * → browser re-auth → `reportPasswordChange(success)`, and that last boolean
 * came from the client. Anyone sitting at an unlocked signed-in browser could
 * guess the current password indefinitely, clearing the counter after each miss
 * — which defeated the one control protecting that field. Now the server does
 * the verification and moves the counter from what it saw.
 *
 * The account is taken from the verified session, never from an argument, so a
 * caller cannot aim this at somebody else.
 *
 * WHY RE-AUTHENTICATE AT ALL: without it, a valid session cookie alone is
 * enough to take an account over permanently — a shared computer, a borrowed
 * phone, or an XSS payload becomes a password reset. Requiring the current
 * password means momentary access is no longer sufficient.
 *
 * The check runs on a THROWAWAY client, not the request's cookie client: a
 * password grant issues a new session, and doing that on the cookie client
 * would overwrite the caller's own session cookies mid-request. The throwaway
 * session is signed out immediately so it cannot linger as a usable refresh
 * token.
 */
export async function changePassword(
  fields: PasswordChangeFields,
): Promise<GateResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Sistem konfiqurasiya edilməyib." };
  }

  const currentPassword = String(fields?.currentPassword ?? "");
  const newPassword = String(fields?.newPassword ?? "");
  const ip = await callerIp();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Əvvəlcə daxil olun." };

  if (!currentPassword) return { ok: false, error: "Cari şifrəni daxil edin." };
  if (currentPassword === newPassword) {
    return { ok: false, error: "Yeni şifrə cari şifrədən fərqli olmalıdır." };
  }

  // Strength rules enforced here, so editing the client bundle cannot skip them.
  const strengthError = validatePassword(newPassword, { email: user.email });
  if (strengthError) return { ok: false, error: strengthError };

  const captcha = captchaGate("pwchange", fields?.captchaToken, user.email, ip);
  if (!captcha.ok) return captcha;

  const key = `pwchange:${user.id}`;
  if (!acquire(key)) {
    return { ok: false, error: throttleMessage(5), retryAfterSeconds: 5 };
  }

  try {
    const verdict = consume(key, RATE_RULES.passwordChange);
    if (!verdict.allowed) {
      logSecurityEvent("auth.password_change_rejected", {
        email: user.email,
        ip,
        reason: verdict.reason,
      });
      return {
        ok: false,
        error: throttleMessage(verdict.retryAfterSeconds),
        retryAfterSeconds: verdict.retryAfterSeconds,
      };
    }

    // Prove the person at the keyboard knows the current password.
    const verifier = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: reauth, error: reauthError } =
      await verifier.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
        options: { captchaToken: fields?.captchaToken },
      });

    if (reauthError || !reauth?.session) {
      // Same rule as sign-in: an expired captcha never tested the password, so
      // it must not count as a wrong-current-password attempt.
      const upstream = nonCredentialFailure(reauthError);
      if (upstream) return { ok: false, error: upstream };

      const lockoutSeconds = penalize(key, RATE_RULES.passwordChange);
      logSecurityEvent("auth.password_change_rejected", {
        email: user.email,
        ip,
        reason: "bad_current_password",
        lockoutSeconds,
      });
      return { ok: false, error: "Cari şifrə yanlışdır." };
    }

    // Don't leave the verification session usable.
    await verifier.auth.signOut().catch(() => {});

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError) {
      logSecurityEvent("auth.password_change_rejected", {
        email: user.email,
        ip,
        reason: "update_failed",
      });
      return { ok: false, error: "Şifrə yenilənmədi." };
    }

    // If the old password had leaked, the sessions it created must not survive
    // the change. This session stays signed in; every other device is cut off.
    await supabase.auth.signOut({ scope: "others" }).catch(() => {});

    reset(key);
    logSecurityEvent("auth.password_changed", { email: user.email, ip });
    return { ok: true };
  } finally {
    release(key);
  }
}

/**
 * Server-side validation of a new password. Used by both the settings page and
 * the reset-completion page so neither can be bypassed by editing the client
 * bundle — Supabase's configured minimum then enforces a floor underneath.
 */
export async function validateNewPassword(password: string): Promise<GateResult> {
  const supabase = isSupabaseConfigured ? await createClient() : null;
  const email = supabase
    ? (await supabase.auth.getUser()).data.user?.email ?? undefined
    : undefined;
  const error = validatePassword(String(password ?? ""), { email });
  return error ? { ok: false, error } : { ok: true };
}
