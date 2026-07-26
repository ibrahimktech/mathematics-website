import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { PLATFORM } from "@/lib/platform";

/** Homepage hero: copy + CTAs on the left, the teacher's portrait on the right. */
export function PlatformHero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12 pb-4 sm:px-6 sm:pt-16 lg:pt-20">
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="animate-fade-rise lg:col-span-7">
          <span className="border-primary/20 bg-accent/40 text-primary inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide">
            {PLATFORM.eyebrow}
          </span>

          <h1 className="font-display text-foreground mt-6 text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.35rem]">
            {PLATFORM.headline}
          </h1>

          <p className="text-muted-foreground mt-6 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
            {PLATFORM.subheadline}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
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

        <div className="animate-fade-rise lg:col-span-5" data-index={1}>
          <div className="border-border relative mx-auto w-full max-w-[18rem] overflow-hidden rounded-3xl border bg-[#eef4ff] sm:max-w-sm lg:max-w-none">
            <Image
              src="/hero-image.png"
              alt="ANTG Olimpiada — riyaziyyat müəllimi"
              width={331}
              height={408}
              priority
              sizes="(max-width: 640px) 18rem, (max-width: 1024px) 24rem, 460px"
              className="mx-auto h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
