"use client";

import Link from "next/link";
import { useSessionUser } from "@/lib/account/use-user";
import { AccountMenu } from "./AccountMenu";

/**
 * Right-hand auth control for the desktop navbar. Renders the logged-out state
 * (Daxil ol / Qeydiyyat) by default — which is also what the static HTML ships —
 * and flips to Panel + account menu the instant the session changes, with no
 * page refresh (see `useSessionUser` + browser-client auth).
 */
export function NavAuth() {
  const user = useSessionUser();

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/panel"
          className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
        >
          Panel
        </Link>
        <AccountMenu user={user} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/daxil-ol"
        className="text-muted-foreground hover:text-foreground rounded-full px-3.5 py-2 text-sm font-semibold transition-colors"
      >
        Daxil ol
      </Link>
      <Link
        href="/qeydiyyat"
        className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-colors"
      >
        Qeydiyyat
      </Link>
    </div>
  );
}
