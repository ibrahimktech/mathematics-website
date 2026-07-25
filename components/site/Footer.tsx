import Link from "next/link";
import { Mail, Rss } from "lucide-react";
import { getCategoriesWithCount } from "@/lib/categories";
import { SITE } from "@/lib/site";

/** GitHub mark (lucide removed brand icons, so we inline it). */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

const NAV = [
  { href: "/", label: "Ana Səhifə" },
  { href: "/#articles", label: "Məqalələr" },
  { href: "/#categories", label: "Kateqoriyalar" },
  { href: "/haqqinda", label: "Haqqında" },
];

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-foreground mb-4 text-xs font-semibold tracking-[0.12em] uppercase">
      {children}
    </h3>
  );
}

export async function Footer() {
  const categories = await getCategoriesWithCount();
  const topCategories = categories.slice(0, 6);
  const { github, email } = SITE.links;

  return (
    <footer className="border-border bg-card mt-24 border-t">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <span
                aria-hidden
                className="bg-primary text-primary-foreground font-heading grid size-9 place-items-center rounded-xl text-lg font-bold"
              >
                π
              </span>
              <span className="font-display text-foreground text-lg font-bold tracking-tight">
                {SITE.name}
              </span>
            </Link>
            <p className="text-muted-foreground mt-4 max-w-xs text-sm leading-relaxed">
              {SITE.description}
            </p>
          </div>

          {/* Navigation */}
          <nav>
            <ColumnHeading>Naviqasiya</ColumnHeading>
            <ul className="space-y-3">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground hover:text-primary text-sm transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Categories */}
          <nav>
            <ColumnHeading>Kateqoriyalar</ColumnHeading>
            <ul className="space-y-3">
              {topCategories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/kateqoriya/${c.slug}`}
                    className="text-muted-foreground hover:text-primary text-sm transition-colors"
                  >
                    {c.emoji ? `${c.emoji} ` : ""}
                    {c.name}
                  </Link>
                </li>
              ))}
              {topCategories.length === 0 && (
                <li className="text-muted-foreground text-sm">—</li>
              )}
            </ul>
          </nav>

          {/* Connect */}
          <nav>
            <ColumnHeading>Əlaqə</ColumnHeading>
            <ul className="space-y-3">
              <li>
                <a
                  href="/rss.xml"
                  className="text-muted-foreground hover:text-primary inline-flex items-center gap-2 text-sm transition-colors"
                >
                  <Rss className="size-4" /> RSS
                </a>
              </li>
              {github && (
                <li>
                  <a
                    href={github}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary inline-flex items-center gap-2 text-sm transition-colors"
                  >
                    <GithubIcon className="size-4" /> GitHub
                  </a>
                </li>
              )}
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="text-muted-foreground hover:text-primary inline-flex items-center gap-2 text-sm transition-colors"
                  >
                    <Mail className="size-4" /> Əlaqə
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>

        <div className="border-border text-muted-foreground mt-14 flex flex-col items-center justify-between gap-3 border-t pt-8 text-sm sm:flex-row">
          <p>
            © {new Date().getFullYear()} {SITE.name}. Bütün hüquqlar qorunur.
          </p>
          <p className="text-muted-foreground/80">
            Riyaziyyat həvəskarları üçün hazırlanmışdır.
          </p>
        </div>
      </div>
    </footer>
  );
}
