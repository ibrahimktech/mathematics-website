"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/panel", label: "Ümumi Baxış" },
  { href: "/panel/imtahanlar", label: "İmtahanlarım" },
  { href: "/panel/neticeler", label: "Nəticələr" },
  { href: "/panel/tenzimleme", label: "Tənzimləmələr" },
] as const;

/** Horizontal tab nav for the dashboard (scrolls horizontally on mobile). */
export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="border-border -mb-px flex gap-1 overflow-x-auto border-b">
      {TABS.map((t) => {
        const active =
          t.href === "/panel" ? pathname === "/panel" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3.5 py-3 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
