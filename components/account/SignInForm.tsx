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
 * Signs in with the BROWSER Supabase client so the navbar updates immediately
 * (onAuthStateChange) and the auth cookie is set for the server/middleware.
 */
export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useSessionUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Only allow same-origin relative redirects (guard against open redirects).
  const rawRedirect = params.get("redirect") || "/panel";
  const redirect =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/panel";

  // Already signed in → straight to the target.
  useEffect(() => {
    if (user) router.replace(redirect);
  }, [user, redirect, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error("Sistem hələ konfiqurasiya edilməyib.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      toast.error("E-poçt və ya şifrə yanlışdır.");
      return;
    }
    router.replace(redirect);
    router.refresh();
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
        <Label htmlFor="password">Şifrə</Label>
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
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="animate-spin" />}
        Daxil ol
      </Button>
    </form>
  );
}
