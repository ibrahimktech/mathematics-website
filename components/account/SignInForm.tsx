"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useSessionUser } from "@/lib/account/use-user";
import { navigateAfterAuth } from "@/lib/account/navigate";
import { beginSignIn, reportSignIn } from "@/lib/actions/account";
import { safeRedirectPath } from "@/lib/security/redirect";
import {
  TURNSTILE_INCOMPLETE_MESSAGE,
  TURNSTILE_UNAVAILABLE_MESSAGE,
} from "@/lib/security/turnstile";
import {
  TurnstileField,
  useTurnstileToken,
} from "@/components/account/TurnstileField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Signs in with the BROWSER Supabase client so the navbar updates immediately
 * (onAuthStateChange) and the auth cookie is set for the server/middleware.
 *
 * Every attempt is bracketed by two server actions: `beginSignIn` applies the
 * rate limit / lockout before Supabase is contacted, and `reportSignIn` records
 * the outcome so repeated failures escalate into a temporary lockout. The UI
 * never distinguishes "no such account" from "wrong password" — both produce
 * the single generic message, so this form cannot be used to enumerate users.
 *
 * Turnstile guards this form too. That is not optional: Supabase's CAPTCHA
 * setting is project-wide, and once it is on the password grant on /auth/v1/token
 * requires a token exactly like /signup does. It also earns its keep — it is the
 * only control that reaches credential-stuffing traffic aimed straight at the
 * Auth API, which the in-process limiter never sees. The widget is invisible
 * unless Cloudflare decides a visitor must prove something, so a returning
 * student sees no change at all.
 */
export function SignInForm() {
  const params = useSearchParams();
  const user = useSessionUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const captcha = useTurnstileToken();

  // Only allow same-origin relative paths — see lib/security/redirect.ts for
  // the bypasses (`/\host`, `/%09//host`, …) a naive prefix check lets through.
  const redirect = safeRedirectPath(params.get("redirect"), "/panel");

  // Already signed in (a returning visitor opening /daxil-ol) → straight to the
  // target. Skipped while a submit is in flight: that handler owns the redirect
  // and would otherwise race this one.
  useEffect(() => {
    if (user && !loading) navigateAfterAuth(redirect);
  }, [user, loading, redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Sistem hələ konfiqurasiya edilməyib.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);

    const captchaToken = (await captcha.waitForToken()) || undefined;
    if (captcha.enabled && !captchaToken) {
      setLoading(false);
      toast.error(
        captcha.unavailable()
          ? TURNSTILE_UNAVAILABLE_MESSAGE
          : TURNSTILE_INCOMPLETE_MESSAGE,
      );
      return;
    }

    // Server-side throttle + lockout. Runs BEFORE Supabase is contacted, so a
    // locked-out attempt costs the attacker a request and gains them nothing.
    const gate = await beginSignIn(normalizedEmail, captchaToken);
    if (!gate.ok) {
      setLoading(false);
      toast.error(gate.error);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
      options: { captchaToken },
    });

    // Record the outcome so failures escalate and a success clears the counter.
    // Bookkeeping must never strand a signed-in user on the login page, so a
    // failure here is swallowed rather than allowed to skip the redirect below.
    await reportSignIn(normalizedEmail, !error).catch(() => {});

    if (error) {
      setLoading(false);
      // Supabase has consumed the token by now — re-arm before the next attempt.
      captcha.reset();
      // Deliberately identical for "unknown account", "wrong password" and
      // "unconfirmed email" — the real reason is only ever in the server log.
      toast.error("E-poçt və ya şifrə yanlışdır.");
      return;
    }

    // Signed in — hand off to the panel. `loading` deliberately stays true so
    // the form cannot be resubmitted during the navigation.
    navigateAfterAuth(redirect);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">E-poçt</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Şifrə</Label>
          <Link
            href={`/sifre-sifirlama?redirect=${encodeURIComponent(redirect)}`}
            className="text-muted-foreground hover:text-primary text-xs font-medium"
          >
            Şifrəni unutmusan?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <TurnstileField {...captcha.fieldProps} action="signin" />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Daxil ol
        </Button>
      </div>
    </form>
  );
}
