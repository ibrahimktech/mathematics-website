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
 * nothing. The success message is identical for a new and an existing address
 * so the form cannot be used to test which e-mails have accounts.
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

    // Server-side validation + sign-up rate limit. Returns the cleaned values.
    const gate = await beginSignUp({ email, password, firstName, lastName });
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
        // Built from our own origin, never from `?redirect=`, so a crafted link
        // can't turn the confirmation mail into a token hand-off to another host.
        emailRedirectTo: safeAbsoluteRedirect(window.location.origin, redirect, "/panel"),
      },
    });
    if (error) {
      setLoading(false);
      // No branch on "already registered": telling the visitor that an address
      // is taken is an account-enumeration oracle. One message for every failure.
      toast.error("Qeydiyyat alınmadı. Yenidən cəhd edin.");
      return;
    }
    if (data.session) {
      // Confirmation is off — the account is already signed in, so go straight
      // to the panel. `loading` stays true for the length of the navigation.
      navigateAfterAuth(redirect);
    } else {
      setLoading(false);
      // Also the response when the address already exists — identical wording,
      // so a bulk prober learns nothing either way.
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
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Qeydiyyatdan keç
      </Button>
    </form>
  );
}
