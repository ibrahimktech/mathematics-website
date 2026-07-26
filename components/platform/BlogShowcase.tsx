import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PostWithCategory } from "@/lib/types";
import { SectionHeading } from "./SectionHeading";
import { ArticleMiniCard } from "./ArticleMiniCard";

/** Recent blog articles on the homepage — the free → paid learning bridge. */
export function BlogShowcase({ posts }: { posts: PostWithCategory[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Bloq"
          title="Məşqdən əvvəl öyrən"
          description="Teoremlər, həllər və riyazi ideyalar — hamısı pulsuz. Əvvəl oxu, sonra imtahanla özünü sına."
        />
        <Link
          href="/bloq"
          className="text-primary hover:text-primary-hover inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors"
        >
          Bloqu araşdır
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {posts.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <ArticleMiniCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="border-border text-muted-foreground mt-10 rounded-2xl border border-dashed p-12 text-center text-sm">
          Məqalələr tezliklə burada görünəcək.{" "}
          <Link href="/bloq" className="text-primary font-semibold">
            Bloqa keç
          </Link>
        </div>
      )}
    </section>
  );
}
