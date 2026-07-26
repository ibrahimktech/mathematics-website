import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/account/SignUpForm";

export const metadata: Metadata = {
  title: "Qeydiyyat",
  description: "Pulsuz hesab yarat və imtahanlara başla.",
  alternates: { canonical: "/qeydiyyat" },
  robots: { index: false, follow: true },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const signInHref = redirect
    ? `/daxil-ol?redirect=${encodeURIComponent(redirect)}`
    : "/daxil-ol";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="border-border bg-card rounded-2xl border p-8 shadow-sm">
        <h1 className="font-display text-foreground text-2xl font-bold tracking-tight">
          Hesab yarat
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Pulsuz qeydiyyatdan keç və məşqə başla.
        </p>
        <div className="mt-6">
          <Suspense fallback={<div className="h-72" />}>
            <SignUpForm />
          </Suspense>
        </div>
      </div>
      <p className="text-muted-foreground mt-6 text-center text-sm">
        Artıq hesabın var?{" "}
        <Link href={signInHref} className="text-primary font-semibold hover:underline">
          Daxil ol
        </Link>
      </p>
    </div>
  );
}
