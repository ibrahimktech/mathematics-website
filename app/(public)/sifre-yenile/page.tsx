import { Suspense } from "react";
import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/account/NewPasswordForm";

export const metadata: Metadata = {
  title: "Yeni şifrə",
  description: "Yeni şifrəni təyin et.",
  alternates: { canonical: "/sifre-yenile" },
  // noindex AND nofollow: this URL is reached with a one-time recovery token.
  robots: { index: false, follow: false },
};

export default function NewPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="border-border bg-card rounded-2xl border p-8 shadow-sm">
        <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
          Yeni şifrə
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Hesabın üçün yeni şifrə təyin et.
        </p>
        <div className="mt-6">
          <Suspense fallback={<div className="h-48" />}>
            <NewPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
