import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Giriş",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold">{SITE.shortName}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Admin panelinə giriş
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
