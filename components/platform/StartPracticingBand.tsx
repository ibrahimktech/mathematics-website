import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Slim account-creation CTA that sits directly beneath the hero. */
export function StartPracticingBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
      <div className="border-border bg-card flex flex-col items-start gap-5 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <h2 className="font-display text-foreground text-xl font-bold tracking-tight">
            Sınaqları həll etməyə başla!
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link
            href="/qeydiyyat"
            className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5"
          >
            Pulsuz qeydiyyatdan keç
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/meseleler"
            className="text-muted-foreground hover:text-primary text-sm font-semibold transition-colors"
          >
            Sınaqlarımızda özünü yoxla!
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
