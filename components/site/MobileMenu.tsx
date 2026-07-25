"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { SidebarSections } from "./SidebarSections";
import type { CategoryWithCount, PostWithCategory } from "@/lib/types";

const NAV = [
  { href: "/", label: "Ana Səhifə" },
  { href: "/#articles", label: "Məqalələr" },
  { href: "/#categories", label: "Kateqoriyalar" },
  { href: "/haqqinda", label: "Haqqında" },
] as const;

export function MobileMenu({
  categories,
  recent,
}: {
  categories: CategoryWithCount[];
  recent: PostWithCategory[];
}) {
  const [open, setOpen] = useState(false);

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
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background absolute top-0 right-0 h-full w-80 max-w-[85%] overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="font-display text-lg font-bold">Menyu</span>
              <button
                type="button"
                aria-label="Bağla"
                onClick={() => setOpen(false)}
                className="hover:bg-muted rounded-md p-2"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="mb-8 flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="text-foreground/90 hover:bg-accent hover:text-primary rounded-xl px-3 py-2.5 text-base font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <SidebarSections
              categories={categories}
              recent={recent}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
