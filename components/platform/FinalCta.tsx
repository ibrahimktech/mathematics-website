import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Closing call-to-action. */
export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <div className="border-primary/15 rounded-3xl border bg-[#eef4ff] px-6 py-14 text-center sm:px-12 sm:py-16">
        <h2 className="font-display text-foreground mx-auto max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Riyaziyyatını sınamağa hazırsan?
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl leading-relaxed text-pretty">
          Bir imtahan seç, məsələləri həll et və biliyinin harada dayandığını
          gör. Hər cəhd səni bir addım irəli aparır.
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
            href="/qeydiyyat"
            className="border-border bg-card text-foreground hover:border-primary/40 hover:text-primary inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
          >
            Hesab yarat
          </Link>
        </div>
      </div>
    </section>
  );
}
