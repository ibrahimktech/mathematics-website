"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";
import { PRIMARY_NAV, isNavActive } from "./nav-items";
import { NavAuth } from "./NavAuth";
import { SiteMobileMenu } from "./SiteMobileMenu";
import { useSessionUser } from "@/lib/account/use-user";

/**
 * Unified platform navbar, shared by every public page (blog + exam platform)
 * so the two halves read as one brand. Flat white bar that gains a hairline
 * border + soft shadow once scrolled. Session-aware auth controls (see NavAuth)
 * render on the client so the surrounding pages stay statically rendered.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const user = useSessionUser();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-white transition-shadow duration-300",
        scrolled
          ? "border-border border-b shadow-[0_1px_3px_rgba(16,24,40,0.06),0_8px_24px_-16px_rgba(16,24,40,0.18)]"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2"
          aria-label={SITE.name}
        >
          <span
            aria-hidden
            className="bg-primary text-primary-foreground font-heading grid size-9 place-items-center rounded-xl text-lg font-bold shadow-sm transition-transform group-hover:-translate-y-0.5"
          >
            π
          </span>
          <span className="font-display text-foreground hidden text-lg font-bold tracking-tight sm:inline">
            {SITE.name}
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((item) => {
            const active = isNavActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-primary bg-accent/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden md:block">
          <NavAuth />
        </div>

        <div className="ml-auto flex items-center gap-1.5 md:hidden">
          {user && (
            <Link
              href="/panel/imtahanlar"
              className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap shadow-sm transition-colors"
            >
              İmtahanlarım
            </Link>
          )}
          <SiteMobileMenu items={PRIMARY_NAV} />
        </div>
      </div>
    </header>
  );
}
