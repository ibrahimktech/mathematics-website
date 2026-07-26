"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Signs out via the BROWSER Supabase client so `onAuthStateChange` fires and the
 * navbar flips to its logged-out state immediately — no manual refresh. The
 * browser client also clears the auth cookies, so the server/middleware see the
 * sign-out on the next request.
 */
export function SignOutButton({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    onClick?.();
    startTransition(async () => {
      await createClient().auth.signOut();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={className}
    >
      {children}
    </button>
  );
}
