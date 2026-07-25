import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDate, toIsoDate } from "@/lib/format";
import { readingTimeLabel } from "@/lib/reading-time";
import type { PostWithCategory } from "@/lib/types";

/**
 * A single article rendered as a full-width publication row (Medium / Quanta /
 * Stripe Docs feel) — no card, no shadow, no heavy border box. Each row sits on
 * its own whisper-soft background tint that cycles through six hues (via
 * `data-tint` → `.article-row` in globals.css), so adjacent articles read as
 * distinct panels. Hover deepens the same tint, with a darker title and a blue
 * link.
 */
export function ArticleRow({
  post,
  index,
}: {
  post: PostWithCategory;
  index?: number;
}) {
  return (
    <article
      data-index={index}
      className="animate-fade-rise not-first:mt-2"
    >
      <Link
        href={`/meqale/${post.slug}`}
        data-tint={(index ?? 0) % 6}
        className="article-row group -mx-4 block rounded-2xl px-4 py-9 transition-colors duration-250 focus-visible:outline-none sm:-mx-6 sm:px-6 sm:py-10"
      >
        {post.category && (
          <span className="bg-accent text-primary inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
            {post.category.emoji ? <span>{post.category.emoji}</span> : null}
            {post.category.name}
          </span>
        )}

        <h2 className="font-display text-foreground/90 group-hover:text-foreground mt-3.5 text-2xl leading-tight font-bold tracking-tight transition-colors sm:text-[1.75rem]">
          {post.title}
        </h2>

        {post.excerpt && (
          <p className="text-muted-foreground mt-3 line-clamp-3 max-w-3xl text-base leading-relaxed">
            {post.excerpt}
          </p>
        )}

        <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <time dateTime={toIsoDate(post.published_at)}>
            {formatDate(post.published_at)}
          </time>
          <span aria-hidden className="text-border">
            •
          </span>
          <span>{readingTimeLabel(post.reading_time_minutes)}</span>
          <span aria-hidden className="text-border">
            •
          </span>
          <span className="text-foreground/70 group-hover:text-primary inline-flex items-center gap-1.5 font-semibold transition-colors">
            Məqaləni oxu
            <ArrowRight className="size-4 transition-transform duration-250 group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </article>
  );
}
