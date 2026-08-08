import type { Metadata } from "next";
import { requireUser } from "@/lib/account/auth";
import { getResources } from "@/lib/resources";
import { getCategories } from "@/lib/categories";
import { ResourceLibrary } from "@/components/platform/ResourceLibrary";

/**
 * The PDF library — a PUBLIC-shell page with a members-only body.
 *
 * The link is in the main navbar so every visitor discovers it, but the content
 * needs an account: `requireUser()` sends an anonymous visitor to `/daxil-ol`
 * with a `redirect` back here, so they land on the library the moment they sign
 * in. Three gates, as everywhere else — middleware first (fast redirect), this
 * per-request check (authoritative), and RLS last: `public.resources` has no
 * anon policy, so even a direct PostgREST call without a session returns
 * nothing. The redirect is UX; the database is the boundary.
 *
 * Dynamic per request: it reads the session, so it can never be a static page
 * shared between visitors.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resurslar",
  description:
    "Riyaziyyat kitabları və dərs materialları — qeydiyyatdan keçmiş istifadəçilər üçün PDF kitabxana.",
  // Requires an account, so there is nothing for a crawler to index.
  robots: { index: false, follow: false },
};

export default async function ResourcesPage() {
  await requireUser("/resurslar");

  const [resources, categories] = await Promise.all([
    getResources(),
    getCategories(),
  ]);

  const categoryNames = Object.fromEntries(
    categories.map((c) => [c.slug, c.name]),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="max-w-2xl">
        <span className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
          Kitabxana
        </span>
        <h1 className="font-display text-foreground mt-2.5 text-3xl font-bold tracking-tight sm:text-4xl">
          Resurslar
        </h1>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          Kitablar, dərs materialları və məsələ toplularının PDF arxivi. İstədiyini
          birbaşa brauzerdə oxu və ya cihazına yüklə.
        </p>
      </header>

      <div className="mt-10">
        <ResourceLibrary resources={resources} categoryNames={categoryNames} />
      </div>
    </div>
  );
}
