"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, Settings, LogOut, ShieldCheck } from "lucide-react";
import { SignOutButton } from "@/components/account/SignOutButton";
import type { ClientUser } from "@/lib/account/use-user";

/**
 * Compact account dropdown for the navbar (desktop). Self-contained (click-
 * outside + Escape) to avoid coupling to a UI-kit menu; styling stays minimal.
 */
export function AccountMenu({ user }: { user: ClientUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = user.name ?? user.email ?? "Tələbə";
  const initial = label.trim().charAt(0).toUpperCase() || "T";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="border-border hover:bg-muted flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-1 transition-colors"
      >
        <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-full text-xs font-bold">
          {initial}
        </span>
        <ChevronDown className="text-muted-foreground size-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-popover absolute top-[calc(100%+8px)] right-0 z-50 w-60 rounded-xl border p-1.5 shadow-lg"
        >
          <div className="px-2.5 py-2">
            <p className="text-foreground truncate text-sm font-semibold">
              {user.name ?? "Tələbə"}
            </p>
            {user.email && (
              <p className="text-muted-foreground truncate text-xs">
                {user.email}
              </p>
            )}
          </div>
          <div className="bg-border my-1 h-px" />
          <Link
            href="/panel"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="text-foreground/90 hover:bg-muted flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium"
          >
            <LayoutDashboard className="size-4" /> Panel
          </Link>
          <Link
            href="/panel/tenzimleme"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="text-foreground/90 hover:bg-muted flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium"
          >
            <Settings className="size-4" /> Tənzimləmələr
          </Link>
          {user.isAdmin && (
            <>
              <div className="bg-border my-1 h-px" />
              <Link
                href="/admin/dashboard"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="text-primary hover:bg-accent flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold"
              >
                <ShieldCheck className="size-4" /> Admin panel
              </Link>
            </>
          )}
          <div className="bg-border my-1 h-px" />
          <SignOutButton
            onClick={() => setOpen(false)}
            className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium"
          >
            <LogOut className="size-4" /> Çıxış
          </SignOutButton>
        </div>
      )}
    </div>
  );
}
