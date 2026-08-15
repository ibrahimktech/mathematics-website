import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/account/auth";
import { getMyPhoneNumber } from "@/lib/student/queries";
import { AccountSettings } from "@/components/account/AccountSettings";
import { SignOutButton } from "@/components/account/SignOutButton";

export const metadata: Metadata = { title: "Tənzimləmələr", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const user = await requireUser("/panel/tenzimleme");
  const initialPhone = await getMyPhoneNumber(user.id);

  return (
    <div>
      <header>
        <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
          Tənzimləmələr
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Hesab məlumatlarını idarə et.
        </p>
      </header>

      <div className="mt-6">
        <AccountSettings
          userId={user.id}
          initialName={user.name ?? ""}
          initialPhone={initialPhone}
          email={user.email ?? ""}
        />

        <section className="border-border bg-card mt-6 flex flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-foreground text-lg font-bold">
              Sessiya
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Bu cihazdan hesabdan çıx.
            </p>
          </div>
          <SignOutButton className="border-border text-foreground hover:bg-muted inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold">
            <LogOut className="size-4" /> Çıxış
          </SignOutButton>
        </section>
      </div>
    </div>
  );
}
