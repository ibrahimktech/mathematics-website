"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Ana Səhifə" },
  { href: "/#articles", label: "Məqalələr" },
  { href: "/#categories", label: "Kateqoriyalar" },
  { href: "/haqqinda", label: "Haqqında" },
] as const;

/**
 * Sticky, white navbar. Stays flat at the top of the page and gains a subtle
 * shadow + hairline border once the user scrolls — the premium "lifts off the
 * page" effect. Renders the brand + nav; search and mobile menu come in as
 * children (they are their own client components).
 */
export function HeaderShell({
  brand,
  search,
  mobile,
}: {
  brand: React.ReactNode;
  search: React.ReactNode;
  mobile: React.ReactNode;
}) {
  const pathname = usePathname();
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
        {brand}

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href.split("#")[0]) &&
                  item.href !== "/#articles" &&
                  item.href !== "/#categories";
            return (
              <Link
                key={item.href}
                href={item.href}
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

        <div className="ml-auto hidden w-64 md:block">{search}</div>

        <div className="ml-auto md:hidden">{mobile}</div>
      </div>
    </header>
  );
}
