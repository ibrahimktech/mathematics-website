"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Account settings — real, persisted updates via the browser Supabase client
 * (for the logged-in user only). Name updates the auth metadata (drives the UI)
 * and the profiles row (RLS: own row). Password uses Supabase's updateUser.
 */
export function AccountSettings({
  userId,
  initialName,
  email,
}: {
  userId: string;
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [password, setPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Ad ən azı 2 hərf olmalıdır.");
      return;
    }
    setSavingName(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
    });
    // Keep the profiles row in sync (RLS allows updating one's own row only).
    await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", userId);
    setSavingName(false);
    if (error) {
      toast.error("Yadda saxlanmadı.");
      return;
    }
    toast.success("Ad yeniləndi.");
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Şifrə ən azı 6 simvol olmalıdır.");
      return;
    }
    setSavingPw(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSavingPw(false);
    if (error) {
      toast.error("Şifrə yenilənmədi.");
      return;
    }
    setPassword("");
    toast.success("Şifrə yeniləndi.");
  }

  return (
    <div className="space-y-6">
      {/* Account info */}
      <section className="border-border bg-card rounded-xl border p-6">
        <h2 className="font-display text-foreground text-lg font-bold">
          Hesab məlumatı
        </h2>
        <form onSubmit={saveName} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="s-name">Ad</Label>
            <Input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 max-w-sm"
            />
          </div>
          <div>
            <Label htmlFor="s-email">E-poçt</Label>
            <Input
              id="s-email"
              value={email}
              disabled
              className="mt-1.5 max-w-sm"
            />
            <p className="text-muted-foreground mt-1.5 text-xs">
              E-poçt dəyişikliyi hazırda dəstəklənmir.
            </p>
          </div>
          <Button type="submit" disabled={savingName}>
            {savingName && <Loader2 className="animate-spin" />} Yadda saxla
          </Button>
        </form>
      </section>

      {/* Security */}
      <section className="border-border bg-card rounded-xl border p-6">
        <h2 className="font-display text-foreground text-lg font-bold">
          Təhlükəsizlik
        </h2>
        <form onSubmit={savePassword} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="s-pw">Yeni şifrə</Label>
            <Input
              id="s-pw"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 max-w-sm"
            />
            <p className="text-muted-foreground mt-1.5 text-xs">Ən azı 6 simvol.</p>
          </div>
          <Button type="submit" variant="outline" disabled={savingPw || !password}>
            {savingPw && <Loader2 className="animate-spin" />} Şifrəni yenilə
          </Button>
        </form>
      </section>
    </div>
  );
}
