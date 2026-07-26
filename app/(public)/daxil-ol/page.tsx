import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "@/components/account/SignInForm";

export const metadata: Metadata = {
  title: "Daxil ol",
  description: "Hesabına daxil ol və imtahanlarına davam et.",
  alternates: { canonical: "/daxil-ol" },
  robots: { index: false, follow: true },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const signUpHref = redirect
    ? `/qeydiyyat?redirect=${encodeURIComponent(redirect)}`
    : "/qeydiyyat";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="border-border bg-card rounded-2xl border p-8 shadow-sm">
        <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
          Daxil ol
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Hesabına daxil ol və məşqə davam et.
        </p>
        <div className="mt-6">
          <Suspense fallback={<div className="h-56" />}>
            <SignInForm />
          </Suspense>
        </div>
      </div>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Hesabın yoxdur?{" "}
        <Link href={signUpHref} className="text-primary font-semibold hover:underline">
          Qeydiyyatdan keç
        </Link>
      </p>
    </div>
  );
}
