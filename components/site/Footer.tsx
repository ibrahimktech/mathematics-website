import Link from "next/link";
import { Rss } from "lucide-react";
import { SITE } from "@/lib/site";

/** GitHub mark (lucide removed brand icons, so we inline it). */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
    </svg>
  );
}

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-foreground mb-4 text-xs font-semibold tracking-[0.12em] uppercase">
      {children}
    </h3>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-muted-foreground hover:text-primary text-sm transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}

export function Footer() {
  const { instagram_teacher, instagram_developer } = SITE.links;

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
              İmtahanlar, məsələlər və pulsuz təhsil materialları ilə riyazi
              məsələ həlli bacarığını inkişaf etdirən platforma.
            </p>
          </div>

          {/* Platform */}
          <nav>
            <ColumnHeading>Platforma</ColumnHeading>
            <ul className="space-y-3">
              <FooterLink href="/imtahanlar">İmtahanlar</FooterLink>
              <FooterLink href="/resurslar">Resurslar</FooterLink>
              <FooterLink href="/bloq">Bloq</FooterLink>
              <FooterLink href="/haqqinda">Haqqında</FooterLink>
            </ul>
          </nav>

          {/* Account */}
          <nav>
            <ColumnHeading>Hesab</ColumnHeading>
            <ul className="space-y-3">
              <FooterLink href="/qeydiyyat">Qeydiyyat</FooterLink>
              <FooterLink href="/daxil-ol">Daxil ol</FooterLink>
              <FooterLink href="/panel">Panel</FooterLink>
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
              {instagram_teacher && (
                <li>
                  <a
                    href={instagram_teacher}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary text-sm transition-colors flex gap-1 items-center"
                  >
                    <InstagramIcon className="size-4" /> Camal Qədirov - müəllim
                  </a>
                </li>
              )}
              {instagram_developer && (
                <li>
                  <a
                    href={instagram_developer}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-primary text-sm transition-colors flex gap-1.5 items-center"
                  >
                    <InstagramIcon className="size-4" /> İbrahim Kərimov
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
            Riyaziyyatı öyrənən və öyrədənlər üçün.
          </p>
        </div>
      </div>
    </footer>
  );
}
