import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { cn } from "@/lib/utils";
import type { ArchiveEntry } from "@/lib/archives/period";
import type { CategoryWithCount, PostWithCategory } from "@/lib/types";

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.12em] uppercase">
      {children}
    </h3>
  );
}

/**
 * One filter row in the sidebar — label on the left, post count aligned right.
 * Shared by Categories and Archives so the two lists can never drift apart in
 * typography, spacing or hover behaviour. Focus is the browser's default ring
 * (nothing suppresses the outline), as everywhere else in the sidebar.
 */
function FilterRow({
  href,
  label,
  count,
  active,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  /** Optional leading glyph (categories show their emoji; archives have none). */
  icon?: string | null;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground/80 hover:bg-accent hover:text-primary hover:translate-x-0.5",
        )}
      >
        {icon !== undefined && (
          <span
            aria-hidden
            className="w-5 shrink-0 text-center text-base leading-none"
          >
            {icon ?? "•"}
          </span>
        )}
        <span className="truncate">{label}</span>
        <span
          className={cn(
            "ml-auto text-xs tabular-nums",
            active ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      </Link>
    </li>
  );
}

export function SidebarSections({
  categories,
  archives,
  recent,
  activeSlug,
  activeArchive,
  onNavigate,
}: {
  categories: CategoryWithCount[];
  archives: ArchiveEntry[];
  recent: PostWithCategory[];
  activeSlug?: string;
  /** Active archive period, "YYYY-MM". */
  activeArchive?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <Heading>Axtar</Heading>
        <SearchBar onSubmitted={onNavigate} />
      </section>

      <section id="categories" className="scroll-mt-24">
        <Heading>Kateqoriyalar</Heading>
        <ul className="space-y-1">
          {categories.map((c) => (
            <FilterRow
              key={c.id}
              href={`/kateqoriya/${c.slug}`}
              label={c.name}
              count={c.post_count}
              active={c.slug === activeSlug}
              icon={c.emoji}
              onNavigate={onNavigate}
            />
          ))}
          {categories.length === 0 && (
            <li className="text-muted-foreground px-3 text-sm">—</li>
          )}
        </ul>
      </section>

      {/* Derived from published posts; hidden entirely when there are none. */}
      {archives.length > 0 && (
        <section id="archives" className="scroll-mt-24">
          <Heading>Arxiv</Heading>
          <ul className="space-y-1">
            {archives.map((a) => (
              <FilterRow
                key={a.period}
                href={`/arxiv/${a.period}`}
                label={a.label}
                count={a.post_count}
                active={a.period === activeArchive}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </section>
      )}

      <section>
        <Heading>Son Məqalələr</Heading>
        <ul className="space-y-3.5">
          {recent.map((p) => (
            <li key={p.id}>
              <Link
                href={`/meqale/${p.slug}`}
                onClick={onNavigate}
                className="text-foreground/90 hover:text-primary block text-sm leading-snug font-medium underline-offset-4 transition-colors hover:underline"
              >
                {p.title}
              </Link>
            </li>
          ))}
          {recent.length === 0 && (
            <li className="text-muted-foreground text-sm">Hələ məqalə yoxdur.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
