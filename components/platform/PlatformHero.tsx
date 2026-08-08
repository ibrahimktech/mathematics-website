import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PLATFORM } from "@/lib/platform";

/** Homepage hero: a single centred column of copy + CTAs. */
export function PlatformHero() {
  return (
    <section className="relative isolate mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
      {/* Faint photographic backdrop. `isolate` on the section is required: a
          -z-10 child in a stacking context that does not exist would paint
          behind the body background and vanish. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-cover bg-no-repeat opacity-[0.23]"
        style={{
          backgroundImage: 'url("/hero-img-ant.jpg")',
          backgroundPosition: "center 45%",
        }}
      />

      <div className="animate-fade-rise mx-auto max-w-3xl text-center">
        <span className="border-primary/20 bg-accent/40 text-primary inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide">
          {PLATFORM.eyebrow}
        </span>

        <h1 className="font-display text-foreground mt-6 text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.35rem]">
          {PLATFORM.headline}
        </h1>

        <p className=" italic mx-auto mt-6 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          {PLATFORM.subheadline}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/imtahanlar"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            İmtahanları kəşf et
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/bloq"
            className="border-border bg-card text-foreground hover:border-primary/40 hover:text-primary inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
          >
            Bloqu oxu
          </Link>
        </div>
      </div>
    </section>
  );
}
