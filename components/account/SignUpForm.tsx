"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useSessionUser } from "@/lib/account/use-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Signs up with the BROWSER Supabase client. If email confirmation is required
 * (no session returned), the student is sent to the login page; otherwise they
 * go straight to the target. The navbar reacts immediately via onAuthStateChange.
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

  // Only allow same-origin relative redirects (guard against open redirects).
  const rawRedirect = params.get("redirect") || "/panel";
  const redirect =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/panel";

  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, redirect, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Sistem hələ konfiqurasiya edilməyib.");
      return;
    }
    if (firstName.trim().length < 2) {
      toast.error("Ad ən azı 2 hərf olmalıdır.");
      return;
    }
    if (lastName.trim().length < 2) {
      toast.error("Soyad ən azı 2 hərf olmalıdır.");
      return;
    }
    if (password.length < 6) {
      toast.error("Şifrə ən azı 6 simvol olmalıdır.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
        emailRedirectTo: `${window.location.origin}/panel`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("already")
          ? "Bu e-poçt artıq qeydiyyatdan keçib."
          : "Qeydiyyat alınmadı. Yenidən cəhd edin.",
      );
      return;
    }
    if (data.session) {
      toast.success("Xoş gəldin! Hesabın yaradıldı.");
      router.replace(redirect);
      router.refresh();
    } else {
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
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5"
        />
        <p className="text-muted-foreground mt-1.5 text-xs">Ən azı 6 simvol.</p>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Qeydiyyatdan keç
      </Button>
    </form>
  );
}
