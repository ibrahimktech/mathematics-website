"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { navigateAfterAuth } from "@/lib/account/navigate";
import { validateNewPassword } from "@/lib/actions/account";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/security/password";
import { safeRedirectPath } from "@/lib/security/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Completes a password reset.
 *
 * Supabase turns the link from the e-mail into a short-lived RECOVERY session in
 * the browser (the `PASSWORD_RECOVERY` auth event). This form only ever runs
 * `updateUser({ password })` against that session — the recovery token itself is
 * consumed by the Supabase client, is single-use, and is never read, forwarded
 * or logged here.
 *
 * Two things matter for safety:
 *   • the token is scrubbed from the URL as soon as it is exchanged, so it can't
 *     leak through Referer, browser history or a screenshot;
 *   • after the change, every OTHER session is revoked — a reset is normally a
 *     response to "someone else may be in my account", and leaving their session
 *     alive would defeat the point.
 */
export function NewPasswordForm() {
  const params = useSearchParams();
  const redirect = safeRedirectPath(params.get("redirect"), "/panel");

  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(false);
      return;
    }
    const supabase = createClient();
    let active = true;

    // Strip the recovery fragment/query as soon as the client has consumed it —
    // it must not survive in the address bar or in history.
    function scrubUrl() {
      if (typeof window === "undefined") return;
      if (window.location.hash || window.location.search.includes("code=")) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname +
            (redirect !== "/panel" ? `?redirect=${encodeURIComponent(redirect)}` : ""),
        );
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        scrubUrl();
        if (active) setReady(true);
      }
    });

    // The link may already have been exchanged before this effect ran.
    supabase.auth.getUser().then(({ data }) => {
      scrubUrl();
      if (active) setReady(Boolean(data.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Şifrələr eyni deyil.");
      return;
    }
    const localError = validatePassword(password);
    if (localError) {
      toast.error(localError);
      return;
    }

    setSaving(true);

    const strength = await validateNewPassword(password);
    if (!strength.ok) {
      setSaving(false);
      toast.error(strength.error);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      // A used or expired link lands here. Generic wording — no detail about
      // which account the link belonged to.
      toast.error("Link etibarsız və ya vaxtı keçib. Yenidən cəhd edin.");
      return;
    }

    // Revoke sessions created before the reset.
    await supabase.auth.signOut({ scope: "others" });
    toast.success("Şifrə yeniləndi.");
    // `saving` stays true: the form is done with, the page is on its way out.
    navigateAfterAuth(redirect);
  }

  if (ready === null) {
    return <div className="text-muted-foreground text-sm">Yüklənir…</div>;
  }

  if (ready === false) {
    return (
      <div className="space-y-3">
        <p className="text-foreground text-sm">
          Bu link etibarsızdır və ya vaxtı keçib. Şifrə yeniləmə linkləri yalnız
          bir dəfə və məhdud müddət üçün işləyir.
        </p>
        <Link
          href="/sifre-sifirlama"
          className="text-primary text-sm font-semibold hover:underline"
        >
          Yeni link istə
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="new-pw">Yeni şifrə</Label>
        <Input
          id="new-pw"
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
      <div>
        <Label htmlFor="new-pw-confirm">Yeni şifrə (təkrar)</Label>
        <Input
          id="new-pw-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1.5"
        />
      </div>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        Şifrəni yenilə
      </Button>
    </form>
  );
}
