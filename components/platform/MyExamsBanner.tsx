"use client";

import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { useSessionUser } from "@/lib/account/use-user";

/**
 * Signed-in-only callout at the top of the PUBLIC exam catalogue pointing to
 * the student's own panel — students kept buying here and never discovering
 * `/panel/imtahanlar`. Renders nothing in the static HTML and for signed-out
 * visitors (the page stays static/ISR); appears after hydration once the
 * client session resolves. Same house style as `RelatedExamCallout`.
 */
export function MyExamsBanner() {
  const user = useSessionUser();
  if (!user) return null;

  return (
    <aside className="border-primary/15 bg-surface-soft mt-8 flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="border-primary/15 bg-card text-primary grid size-10 shrink-0 place-items-center rounded-xl border">
          <ListChecks className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-foreground text-base font-bold tracking-tight">
            Aldığın imtahanlar panelindədir
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Cəhdlərinə və nəticələrinə «İmtahanlarım» bölməsindən bax.
          </p>
        </div>
      </div>
      <Link
        href="/panel/imtahanlar"
        className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5"
      >
        İmtahanlarım
        <ArrowRight className="size-4" />
      </Link>
    </aside>
  );
}
