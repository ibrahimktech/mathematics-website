"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useSessionUser } from "@/lib/account/use-user";
import { navigateAfterAuth } from "@/lib/account/navigate";
import { beginSignUp } from "@/lib/actions/account";
import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/security/password";
import { safeAbsoluteRedirect, safeRedirectPath } from "@/lib/security/redirect";
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
 * Signs up with the BROWSER Supabase client. If email confirmation is required
 * (no session returned), the student is sent to the login page; otherwise they
 * go straight to the target. The navbar reacts immediately via onAuthStateChange.
 *
 * The checks below run twice: here for instant feedback, and again inside
 * `beginSignUp` on the server — which also rate-limits sign-ups and returns the
 * normalised values actually submitted, so editing the client bundle buys
 * nothing.
 *
 * ACCOUNT EXISTENCE IS DISCLOSED HERE, DELIBERATELY — see the `identities`
 * branch below. This is a product decision, taken knowingly: the alternative
 * (one identical message either way) left people who had simply forgotten they
 * had an account staring at an inbox that would never receive anything. Sign-in
 * and password reset are NOT changed and still reveal nothing.
 *
 * BOT PROTECTION: a Cloudflare Turnstile token rides along as
 * `options.captchaToken`. Supabase Auth verifies it against Cloudflare before it
 * will create the account — which is what makes it unskippable, since it also
 * applies to a script that ignores this form and posts to /auth/v1/signup with
 * the public anon key. Stripping the widget from the DOM therefore does not
 * bypass anything; it just produces the same failure as an invalid token.
 */
export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useSessionUser();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const captcha = useTurnstileToken();

  // Only allow same-origin relative paths (see lib/security/redirect.ts).
  const redirect = safeRedirectPath(params.get("redirect"), "/panel");

  // Skipped while a submit is in flight — that handler owns the redirect.
  useEffect(() => {
    if (user && !loading) navigateAfterAuth(redirect);
  }, [user, loading, redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Sistem hələ konfiqurasiya edilməyib.");
      return;
    }
    // Fast local feedback. The authoritative copy of these rules runs server-side.
    const localError =
      validateName(firstName, "Ad") ??
      validateName(lastName, "Soyad") ??
      validateEmail(email) ??
      validatePassword(password, {
        email,
        name: `${firstName} ${lastName}`,
      });
    if (localError) {
      toast.error(localError);
      return;
    }

    setLoading(true);

    // The invisible widget usually has a token long before this, but a very fast
    // submit can beat it — so wait rather than failing someone who did nothing wrong.
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

    // Server-side validation + sign-up rate limit. Returns the cleaned values.
    const gate = await beginSignUp({
      email,
      password,
      firstName,
      lastName,
      captchaToken,
    });
    if (!gate.ok) {
      setLoading(false);
      toast.error(gate.error);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: gate.email,
      password,
      options: {
        data: {
          full_name: gate.fullName,
          first_name: gate.firstName,
          last_name: gate.lastName,
        },
        // Sibling of `data`, never inside it: anything in `data` is stored as
        // raw_user_meta_data and read by the handle_new_user trigger.
        captchaToken,
        // Built from our own origin, never from `?redirect=`, so a crafted link
        // can't turn the confirmation mail into a token hand-off to another host.
        emailRedirectTo: safeAbsoluteRedirect(window.location.origin, redirect, "/panel"),
      },
    });
    if (error) {
      setLoading(false);
      // The token is spent either way, so re-arm the widget before the retry.
      captcha.reset();
      toast.error("Qeydiyyat alınmadı. Yenidən cəhd edin.");
      return;
    }

    /**
     * Supabase does not error when the address already has a CONFIRMED account —
     * it returns an obfuscated user and sends no mail. The marker is an empty
     * `identities` array, and it is precise: a brand-new address and an existing
     * UNCONFIRMED one both come back with one identity, and both genuinely do
     * receive a link. So this branch fires only when nothing was sent, which is
     * exactly the case where "check your inbox" would be a lie.
     *
     * Yes, this confirms to a caller that an address is registered. That is the
     * accepted trade (see the note above the component). What makes it tolerable
     * rather than a free enumeration API: reaching this line costs a solved
     * Turnstile challenge and one of 5 sign-ups per hour per IP, so probing a
     * list of addresses is slow and expensive instead of instant.
     */
    if (!data.session && data.user && data.user.identities?.length === 0) {
      setLoading(false);
      captcha.reset();
      toast.error("Bu e-poçt artıq qeydiyyatdadır. Daxil ol və ya şifrəni bərpa et.");
      router.replace(`/daxil-ol?redirect=${encodeURIComponent(redirect)}`);
      return;
    }

    if (data.session) {
      // Confirmation is off — the account is already signed in, so go straight
      // to the panel. `loading` stays true for the length of the navigation.
      navigateAfterAuth(redirect);
    } else {
      setLoading(false);
      // Reached for a new address AND for an existing unconfirmed one; both are
      // sent a link, so the wording is true in either case.
      toast.success(
        "Təsdiq linki e-poçtuna göndərildi. Zəhmət olmasa e-poçtunu yoxla.",
      );
      router.replace(`/daxil-ol?redirect=${encodeURIComponent(redirect)}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName">Ad</Label>
          <Input
            id="firstName"
            type="text"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="lastName">Soyad</Label>
          <Input
            id="lastName"
            type="text"
            autoComplete="family-name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>
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
        <Label htmlFor="password">Şifrə</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5"
        />
        <p className="text-muted-foreground mt-1.5 text-xs">
          Ən azı {MIN_PASSWORD_LENGTH} simvol; böyük hərf, kiçik hərf və rəqəm.
        </p>
      </div>
      {/* Invisible for normal visitors; only takes up space if Cloudflare
          decides this one has to solve a challenge. Grouped with the button so
          the silent case leaves the form's spacing exactly as it was. */}
      <div>
        <TurnstileField {...captcha.fieldProps} action="signup" />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Qeydiyyatdan keç
        </Button>
      </div>
    </form>
  );
}
