"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PHONE_PREFIX, pinCountryCode } from "@/lib/account/phone";
import { changePassword } from "@/lib/actions/account";
import {
  MIN_PASSWORD_LENGTH,
  cleanName,
  normalizePhone,
  validateName,
  validatePhone,
} from "@/lib/security/password";
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
 * Account settings — real, persisted updates via the browser Supabase client
 * (for the logged-in user only). Name and phone update the auth metadata
 * (drives the UI / mirrors what sign-up stored) and the profiles row (RLS: own
 * row). Neither is a credential, so like the name the phone needs no Turnstile
 * or server action — RLS is the boundary.
 *
 * Changing the password REQUIRES the current password. Without that, anyone who
 * gets momentary access to a signed-in session (a shared or stolen browser, an
 * XSS payload) can lock the real owner out by silently setting a new password.
 * Re-authentication turns session access alone into something that is no longer
 * enough. A successful change also revokes every OTHER session.
 *
 * That re-authentication is a password grant, so it needs a Turnstile token
 * like any other sign-in once Supabase's project-wide CAPTCHA is on — without
 * one, changing your password would fail. The widget is invisible in practice;
 * only the password form carries it, since renaming yourself is not a
 * credential operation.
 */
export function AccountSettings({
  userId,
  initialName,
  initialPhone,
  email,
}: {
  userId: string;
  initialName: string;
  initialPhone: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone || PHONE_PREFIX);
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const captcha = useTurnstileToken();

  function onPhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = pinCountryCode(e.target.value);
    // When `next` equals the state React last rendered — restoring "+994" after
    // a backspace, say — React skips the re-render and the raw edit ("+99")
    // stays on screen while the state says otherwise. Write it back here so the
    // field and the value being validated can never disagree.
    if (e.target.value !== next) e.target.value = next;
    setPhone(next);
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = cleanName(name);
    const cleanedPhone = normalizePhone(phone);
    const error0 =
      validateName(cleaned, "Ad") ?? validatePhone(cleanedPhone);
    if (error0) {
      toast.error(error0);
      return;
    }
    setSavingName(true);
    const supabase = createClient();
    // Same two homes the number has since sign-up: auth metadata + profiles.
    const { error } = await supabase.auth.updateUser({
      data: { full_name: cleaned, phone_number: cleanedPhone },
    });
    // Keep the profiles row in sync (RLS allows updating one's own row only).
    await supabase
      .from("profiles")
      .update({ full_name: cleaned, phone_number: cleanedPhone })
      .eq("id", userId);
    setSavingName(false);
    if (error) {
      toast.error("Yadda saxlanmadı.");
      return;
    }
    setName(cleaned);
    setPhone(cleanedPhone);
    toast.success("Məlumatlar yeniləndi.");
    router.refresh();
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Cari şifrəni daxil edin.");
      return;
    }
    if (currentPassword === password) {
      toast.error("Yeni şifrə cari şifrədən fərqli olmalıdır.");
      return;
    }

    setSavingPw(true);

    const captchaToken = (await captcha.waitForToken()) || undefined;
    if (captcha.enabled && !captchaToken) {
      setSavingPw(false);
      toast.error(
        captcha.unavailable()
          ? TURNSTILE_UNAVAILABLE_MESSAGE
          : TURNSTILE_INCOMPLETE_MESSAGE,
      );
      return;
    }

    // One round trip. Strength rules, throttling, the re-authentication and the
    // failure counter all live server-side — this component is told the result
    // and never asked to report one.
    const result = await changePassword({
      currentPassword,
      newPassword: password,
      captchaToken,
    });
    // Spent either way, and this form stays mounted for a second attempt.
    captcha.reset();

    setSavingPw(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setCurrentPassword("");
    setPassword("");
    toast.success("Şifrə yeniləndi. Digər cihazlardakı sessiyalar bağlandı.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Account info */}
      <section className="border-border bg-card rounded-xl border p-6">
        <h2 className="font-display text-foreground text-lg font-bold">
          Hesab məlumatı
        </h2>
        <form onSubmit={saveInfo} className="mt-4 space-y-4">
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
            <Label htmlFor="s-phone">Telefon</Label>
            <Input
              id="s-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={onPhoneChange}
              placeholder="+994501234567"
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
            <Label htmlFor="s-pw-current">Cari şifrə</Label>
            <Input
              id="s-pw-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 max-w-sm"
            />
          </div>
          <div>
            <Label htmlFor="s-pw">Yeni şifrə</Label>
            <Input
              id="s-pw"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 max-w-sm"
            />
            <p className="text-muted-foreground mt-1.5 text-xs">
              Ən azı {MIN_PASSWORD_LENGTH} simvol; böyük hərf, kiçik hərf və rəqəm.
            </p>
          </div>
          <div>
            <TurnstileField {...captcha.fieldProps} action="password-change" />
            <Button
              type="submit"
              variant="outline"
              disabled={savingPw || !password || !currentPassword}
            >
              {savingPw && <Loader2 className="animate-spin" />} Şifrəni yenilə
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
