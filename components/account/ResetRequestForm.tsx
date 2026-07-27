"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/account";
import { validateEmail } from "@/lib/security/password";
import { safeRedirectPath } from "@/lib/security/redirect";
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
 */
export function ResetRequestForm() {
  const params = useSearchParams();
  const redirect = safeRedirectPath(params.get("redirect"), "/panel");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      toast.error(emailError);
      return;
    }
    setLoading(true);
    const result = await requestPasswordReset(email, redirect);
    setLoading(false);

    if (!result.ok) {
      // Only ever a throttling message — never "no such account".
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
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Yeniləmə linki göndər
      </Button>
    </form>
  );
}
