import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";

/**
 * A single, tasteful blog → exam prompt shown on an article when a matching
 * exam topic exists. Deliberately one per article (never repeated inline) so it
 * reads as a helpful next step, not a spammy CTA.
 */
export function RelatedExamCallout({
  categorySlug,
  topic,
}: {
  categorySlug: string;
  topic: string;
}) {
  return (
    <aside className="border-primary/15 bg-surface-soft mt-12 flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="border-primary/15 bg-card text-primary grid size-10 shrink-0 place-items-center rounded-xl border">
          <Target className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-foreground text-base font-bold tracking-tight">
            Özünü sınamaq istəyirsən?
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {topic} üzrə imtahanla biliyini praktikada yoxla.
          </p>
        </div>
      </div>
      <Link
        href={`/imtahanlar?kateqoriya=${categorySlug}`}
        className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5"
      >
        İmtahana bax
        <ArrowRight className="size-4" />
      </Link>
    </aside>
  );
}
