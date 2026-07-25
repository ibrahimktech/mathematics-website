import Link from "next/link";
import { SearchBar } from "./SearchBar";
import { cn } from "@/lib/utils";
import type { CategoryWithCount, PostWithCategory } from "@/lib/types";

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-[0.12em] uppercase">
      {children}
    </h3>
  );
}

export function SidebarSections({
  categories,
  recent,
  activeSlug,
  onNavigate,
}: {
  categories: CategoryWithCount[];
  recent: PostWithCategory[];
  activeSlug?: string;
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
          {categories.map((c) => {
            const active = c.slug === activeSlug;
            return (
              <li key={c.id}>
                <Link
                  href={`/kateqoriya/${c.slug}`}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground/80 hover:bg-accent hover:text-primary hover:translate-x-0.5",
                  )}
                >
                  <span
                    aria-hidden
                    className="w-5 shrink-0 text-center text-base leading-none"
                  >
                    {c.emoji ?? "•"}
                  </span>
                  <span className="truncate">{c.name}</span>
                  <span
                    className={cn(
                      "ml-auto text-xs tabular-nums",
                      active ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {c.post_count}
                  </span>
                </Link>
              </li>
            );
          })}
          {categories.length === 0 && (
            <li className="text-muted-foreground px-3 text-sm">—</li>
          )}
        </ul>
      </section>

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
