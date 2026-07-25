import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Scattered math glyphs for the hero's subtle background texture. */
const GLYPHS = [
  { c: "π", top: "12%", left: "6%", size: "5.5rem", rotate: "-8deg" },
  { c: "∫", top: "44%", left: "16%", size: "7rem", rotate: "6deg" },
  { c: "Σ", top: "68%", left: "8%", size: "4.5rem", rotate: "-4deg" },
  { c: "∞", top: "20%", left: "40%", size: "4rem", rotate: "10deg" },
  { c: "√", top: "60%", left: "48%", size: "5rem", rotate: "-6deg" },
  { c: "∂", top: "14%", left: "72%", size: "5rem", rotate: "8deg" },
  { c: "Σ", top: "52%", left: "82%", size: "6rem", rotate: "-10deg" },
  { c: "π", top: "74%", left: "68%", size: "4.5rem", rotate: "4deg" },
  { c: "∞", top: "82%", left: "90%", size: "3.5rem", rotate: "-8deg" },
];

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
      <div className="hero-surface animate-fade-rise rounded-3xl px-6 py-16 text-center sm:px-12 sm:py-20 lg:py-24">
        <div className="hero-pattern" aria-hidden>
          {GLYPHS.map((g, i) => (
            <span
              key={i}
              style={{
                top: g.top,
                left: g.left,
                fontSize: g.size,
                transform: `rotate(${g.rotate})`,
              }}
            >
              {g.c}
            </span>
          ))}
        </div>

        <span className="border-primary/20 bg-card/70 text-primary inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wide">
          Akademik riyaziyyat jurnalı
        </span>

        <h1 className="font-display text-foreground mx-auto mt-6 max-w-3xl text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Riyaziyyatın gözəlliyini kəşf et
        </h1>

        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
          Zərif isbatlar, olimpiada həlləri və riyazi ideyalar — həndəsə,
          cəbr, kombinatorika və ədədlər nəzəriyyəsinə dərin baxışlar.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="#articles"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            Məqalələrə bax
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/haqqinda"
            className="border-border bg-card text-foreground hover:border-primary/40 hover:text-primary inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
          >
            Haqqında
          </Link>
        </div>
      </div>
    </section>
  );
}
