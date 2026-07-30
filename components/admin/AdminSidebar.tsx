"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  FilePlus2,
  FileText,
  FilePen,
  CheckCircle2,
  Tags,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  LineChart,
  BarChart3,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/actions/auth";
import { SITE } from "@/lib/site";

type NavEntry = { href: string; label: string; icon: typeof FileText; match?: string };
type NavGroup = { title: string; items: NavEntry[] };

const GROUPS: NavGroup[] = [
  {
    title: "Ümumi",
    items: [
      { href: "/admin/dashboard", label: "İdarə paneli", icon: LayoutDashboard },
      { href: "/admin/purchases", label: "Ödənişlər", icon: Receipt },
      { href: "/admin/users", label: "İstifadəçilər", icon: Users },
    ],
  },
  {
    title: "Analitika",
    items: [
      { href: "/admin/analytics/satis", label: "Satış analitikası", icon: LineChart },
      { href: "/admin/analytics/bloq", label: "Bloq analitikası", icon: BarChart3 },
    ],
  },
  {
    title: "İmtahanlar",
    items: [
      { href: "/admin/exams", label: "İmtahanlar", icon: GraduationCap, match: "/admin/exams" },
      { href: "/admin/exams/new", label: "Yeni imtahan", icon: FilePlus2 },
    ],
  },
  {
    title: "Bloq",
    items: [
      { href: "/admin/articles", label: "Məqalələr", icon: FileText, match: "/admin/articles" },
      { href: "/admin/articles/new", label: "Yeni məqalə", icon: FilePlus2 },
      { href: "/admin/drafts", label: "Qaralamalar", icon: FilePen },
      { href: "/admin/published", label: "Dərc edilmiş", icon: CheckCircle2 },
      { href: "/admin/categories", label: "Kateqoriyalar", icon: Tags },
    ],
  },
  {
    title: "Sistem",
    items: [{ href: "/admin/settings", label: "Ödəniş tənzimləmələri", icon: Settings }],
  },
];

function isActive(pathname: string, entry: NavEntry): boolean {
  if (entry.match) {
    // A "match" prefix marks the section active, but not its own "new" sibling.
    if (entry.href.endsWith("/new")) return pathname === entry.href;
    return pathname === entry.href || pathname.startsWith(entry.match + "/");
  }
  return pathname === entry.href;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="text-muted-foreground/70 px-3 pb-1.5 text-[10px] font-semibold tracking-wider uppercase">
            {group.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon, match }) => {
              const active = isActive(pathname, { href, label, icon: Icon, match });
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
          </div>
        </div>
      ))}
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
      <span className="exam-title text-lg font-bold">{SITE.shortName}</span>
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
            className="bg-card absolute top-14 right-0 left-0 max-h-[80vh] overflow-y-auto border-b p-3 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-3 border-t pt-3">
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
