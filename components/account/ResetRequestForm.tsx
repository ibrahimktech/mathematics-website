"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/account";
import { validateEmail } from "@/lib/security/password";
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
 * Requests a password-reset e-mail.
 *
 * The Supabase call happens ENTIRELY on the server (`requestPasswordReset`), not
 * here — that is what makes the rate limit unavoidable, since scripting this form
 * still goes through the throttled action. The confirmation text below is shown
 * for every valid-looking address whether or not an account exists, so this page
 * cannot be used to discover who has an account.
 *
 * The token in the mail is issued and enforced by Supabase Auth: single-use,
 * expiring, and consumed the moment the new password is set. It is never handled,
 * stored or logged by this application.
 *
 * The Turnstile token is the one thing that has to be produced here rather than
 * on the server: /recover is CAPTCHA-gated like /signup, and only a browser can
 * solve the challenge. It is handed to the action, which passes it straight to
 * Supabase — protecting the mail quota from being drained by a script.
 */
export function ResetRequestForm() {
  const params = useSearchParams();
  const redirect = safeRedirectPath(params.get("redirect"), "/panel");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const captcha = useTurnstileToken();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      toast.error(emailError);
      return;
    }
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

    const result = await requestPasswordReset(email, redirect, captchaToken);
    setLoading(false);

    if (!result.ok) {
      // Only ever a throttling or captcha message — never "no such account".
      captcha.reset();
      toast.error(result.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="text-foreground text-sm">
          Əgər bu e-poçt ünvanı ilə hesab varsa, şifrə yeniləmə linki
          göndərildi. Zəhmət olmasa gələn qutunu (və spam qovluğunu) yoxlayın.
        </p>
        <p className="text-muted-foreground text-xs">
          Link məhdud müddət üçün etibarlıdır və yalnız bir dəfə istifadə edilə
          bilər.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="reset-email">E-poçt</Label>
        <Input
          id="reset-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <div>
        <TurnstileField {...captcha.fieldProps} action="password-reset" />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Yeniləmə linki göndər
        </Button>
      </div>
    </form>
  );
}
