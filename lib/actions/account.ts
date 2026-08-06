"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getClientIp } from "@/lib/security/request";
import { authKeys, consume, penalize, reset, RATE_RULES } from "@/lib/security/rate-limit";
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
 * Server-side gate for the authentication forms.
 *
 * The sign-in / sign-up calls themselves stay in the browser (that is what lets
 * the navbar react instantly via `onAuthStateChange`, and it is the supported
 * `@supabase/ssr` flow). These actions wrap that call with the controls the
 * browser cannot be trusted to apply to itself:
 *
 *   • server-side re-validation of every field (client checks are UX only);
 *   • IP-keyed rate limiting, progressive delays and temporary lockouts;
 *   • security-event logging (never passwords or tokens).
 *
 * IMPORTANT — the honest limit of this design: an attacker who skips our UI and
 * posts straight to the Supabase Auth API is not seen by these actions. Supabase's
 * own Auth rate limits (and CAPTCHA, if enabled) are the control on that path;
 * see README → "Brute-force protection". These actions harden the application
 * path and give us the log trail, they are not the only line of defence.
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
  scope: "signin" | "signup" | "reset",
  token: unknown,
  email: string,
  ip: string,
): GateResult {
  if (!isTurnstileConfigured) return { ok: true };
  if (looksLikeTurnstileToken(token)) return { ok: true };
  logSecurityEvent("auth.captcha_missing", { email, ip, scope });
  return { ok: false, error: TURNSTILE_INCOMPLETE_MESSAGE };
}

/* ============================================================== sign-in ==== */

/**
 * Call BEFORE `supabase.auth.signInWithPassword`. Consumes a rate-limit slot
 * for this (IP, account) pair and for the IP as a whole, and refuses while a
 * lockout is in force.
 */
export async function beginSignIn(
  rawEmail: string,
  captchaToken?: string,
): Promise<GateResult> {
  const email = normalizeEmail(String(rawEmail ?? ""));
  const ip = await callerIp();

  // Malformed input never reaches Supabase — and returns the SAME generic
  // message as a wrong password, so this can't be used to probe addresses.
  if (validateEmail(email)) return { ok: false, error: GENERIC_CREDENTIALS };

  const captcha = captchaGate("signin", captchaToken, email, ip);
  if (!captcha.ok) return captcha;

  const keys = authKeys("signin", ip, email);
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
  return { ok: true };
}

/**
 * Call AFTER the sign-in attempt resolves. A failure escalates the lockout for
 * this (IP, account) pair; a success clears it. Only the precise pair is locked,
 * so nobody can lock a victim out of their own account from another address.
 */
export async function reportSignIn(
  rawEmail: string,
  success: boolean,
): Promise<void> {
  const email = normalizeEmail(String(rawEmail ?? ""));
  const ip = await callerIp();
  const keys = authKeys("signin", ip, email);

  if (success) {
    reset(keys.ipAccount);
    reset(keys.ip);
    logSecurityEvent("auth.sign_in_succeeded", { email, ip });
    return;
  }

  const lockoutSeconds = penalize(keys.ipAccount, RATE_RULES.signIn);
  logSecurityEvent("auth.sign_in_failed", { email, ip, lockoutSeconds });
  if (lockoutSeconds > 0) {
    logSecurityEvent("auth.sign_in_locked", { email, ip, lockoutSeconds });
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

/**
 * Rate-limit gate for changing the password of the CURRENTLY signed-in user.
 * The account is identified from the verified session, never from an argument.
 */
export async function beginPasswordChange(): Promise<GateResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Sistem konfiqurasiya edilməyib." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Əvvəlcə daxil olun." };

  const ip = await callerIp();
  const key = `pwchange:${user.id}`;
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
  return { ok: true };
}

/** Record the outcome of a password change (wrong current password → penalty). */
export async function reportPasswordChange(success: boolean): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const ip = await callerIp();
  const key = `pwchange:${user.id}`;
  if (success) {
    reset(key);
    logSecurityEvent("auth.password_changed", { email: user.email, ip });
    return;
  }
  const lockoutSeconds = penalize(key, RATE_RULES.passwordChange);
  logSecurityEvent("auth.password_change_rejected", {
    email: user.email,
    ip,
    reason: "bad_current_password",
    lockoutSeconds,
  });
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
