"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, LayoutDashboard, Settings, LogOut, ShieldCheck } from "lucide-react";
import { useSessionUser } from "@/lib/account/use-user";
import { SignOutButton } from "@/components/account/SignOutButton";
import type { NavItem } from "./nav-items";

/** Responsive drawer for the platform navbar (mobile / tablet). */
export function SiteMobileMenu({ items }: { items: readonly NavItem[] }) {
  const [open, setOpen] = useState(false);
  const user = useSessionUser();
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        aria-label="Menyu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="hover:bg-muted rounded-md p-2"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={close}>
          <div
            className="bg-background absolute top-0 right-0 flex h-full w-80 max-w-[85%] flex-col overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-8 flex items-center justify-between">
              <span className="font-display text-lg font-bold">Menyu</span>
              <button
                type="button"
                aria-label="Bağla"
                onClick={close}
                className="hover:bg-muted rounded-md p-2"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="text-foreground/90 hover:bg-accent hover:text-primary rounded-xl px-3 py-2.5 text-base font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="border-border mt-auto border-t pt-6">
              {user ? (
                <div className="space-y-1">
                  <div className="px-3 pb-2">
                    <p className="text-foreground truncate text-sm font-semibold">
                      {user.name ?? "Tələbə"}
                    </p>
                    {user.email && (
                      <p className="text-muted-foreground truncate text-xs">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <Link
                    href="/panel"
                    onClick={close}
                    className="text-foreground/90 hover:bg-muted flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-base font-medium"
                  >
                    <LayoutDashboard className="size-4" /> Panel
                  </Link>
                  <Link
                    href="/panel/tenzimleme"
                    onClick={close}
                    className="text-foreground/90 hover:bg-muted flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-base font-medium"
                  >
                    <Settings className="size-4" /> Tənzimləmələr
                  </Link>
                  {user.isAdmin && (
                    <Link
                      href="/admin/dashboard"
                      onClick={close}
                      className="text-primary hover:bg-accent flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-base font-semibold"
                    >
                      <ShieldCheck className="size-4" /> Admin panel
                    </Link>
                  )}
                  <SignOutButton
                    onClick={close}
                    className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-base font-medium"
                  >
                    <LogOut className="size-4" /> Çıxış
                  </SignOutButton>
                </div>
              ) : (
                <div className="space-y-2">
                  <Link
                    href="/qeydiyyat"
                    onClick={close}
                    className="bg-primary text-primary-foreground hover:bg-primary-hover flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold"
                  >
                    Qeydiyyat
                  </Link>
                  <Link
                    href="/daxil-ol"
                    onClick={close}
                    className="border-border text-foreground hover:bg-muted flex items-center justify-center rounded-full border px-4 py-2.5 text-sm font-semibold"
                  >
                    Daxil ol
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
