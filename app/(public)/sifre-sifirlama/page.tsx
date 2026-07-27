import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "@/components/account/ResetRequestForm";

export const metadata: Metadata = {
  title: "Şifrəni sıfırla",
  description: "Hesabının şifrəsini yenilə.",
  alternates: { canonical: "/sifre-sifirlama" },
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="border-border bg-card rounded-2xl border p-8 shadow-sm">
        <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
          Şifrəni sıfırla
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          E-poçt ünvanını yaz — şifrəni yeniləmək üçün link göndərəcəyik.
        </p>
        <div className="mt-6">
          <Suspense fallback={<div className="h-40" />}>
            <ResetRequestForm />
          </Suspense>
        </div>
      </div>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Şifrəni xatırladın?{" "}
        <Link href="/daxil-ol" className="text-primary font-semibold hover:underline">
          Daxil ol
        </Link>
      </p>
    </div>
  );
}
