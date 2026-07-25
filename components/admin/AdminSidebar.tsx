"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FilePlus2,
  FileText,
  FilePen,
  CheckCircle2,
  Tags,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { SITE } from "@/lib/site";

const NAV = [
  { href: "/admin/articles/new", label: "Yeni Məqalə", icon: FilePlus2 },
  { href: "/admin/articles", label: "Məqalələr", icon: FileText },
  { href: "/admin/drafts", label: "Qaralamalar", icon: FilePen },
  { href: "/admin/published", label: "Dərc Edilmiş", icon: CheckCircle2 },
  { href: "/admin/categories", label: "Kateqoriyalar", icon: Tags },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin/articles"
            ? pathname === href || pathname.startsWith("/admin/articles/")
            : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
      >
        <LogOut className="size-4" />
        Çıxış
      </button>
    </form>
  );
}

function Brand() {
  return (
    <Link href="/admin/dashboard" className="flex items-center gap-2 px-1">
      <span className="font-heading text-lg font-bold">{SITE.shortName}</span>
      <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Admin
      </span>
    </Link>
  );
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="border-border bg-card hidden w-60 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks />
        </div>
        <div className="border-border space-y-1 border-t p-3">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          >
            <ExternalLink className="size-4" />
            Sayta bax
          </a>
          <SignOut />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="border-border bg-card sticky top-0 z-20 flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-label="Menyu"
          onClick={() => setOpen((o) => !o)}
          className="hover:bg-muted rounded-md p-2"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-10 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card absolute top-14 right-0 left-0 border-b p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-2 border-t pt-2">
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium"
              >
                <ExternalLink className="size-4" />
                Sayta bax
              </a>
              <SignOut />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
