import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { formatDate, toIsoDate } from "@/lib/format";
import { readingTimeLabel } from "@/lib/reading-time";
import type { PostWithCategory } from "@/lib/types";

/** Solid article card with a clear reading action; the entire card is a link. */
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
      className="animate-fade-rise not-first:mt-5"
    >
      <Link
        href={`/meqale/${post.slug}`}
        className="article-row group block rounded-2xl p-5 sm:p-7"
      >
        <div className="flex flex-wrap items-center gap-3">
          {post.category && (
            <span className="bg-accent text-primary inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
              {post.category.emoji ? <span>{post.category.emoji}</span> : null}
              {post.category.name}
            </span>
          )}
          <span className="text-muted-foreground ml-auto inline-flex items-center gap-1.5 text-xs font-medium">
            <FileText aria-hidden="true" className="size-4" />
            Məqalə
          </span>
        </div>

        <h2 className="font-display text-foreground group-hover:text-primary group-focus-visible:text-primary mt-4 text-2xl leading-tight font-bold tracking-tight transition-colors sm:text-[1.75rem]">
          {post.title}
        </h2>

        {post.excerpt && (
          <p className="text-muted-foreground mt-3 line-clamp-3 max-w-3xl text-base leading-relaxed">
            {post.excerpt}
          </p>
        )}

        <div className="border-border mt-6 flex flex-col items-start gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
            <time dateTime={toIsoDate(post.published_at)}>
              {formatDate(post.published_at)}
            </time>
            <span aria-hidden>•</span>
            <span>{readingTimeLabel(post.reading_time_minutes)}</span>
          </div>
          <span className="bg-primary text-primary-foreground group-hover:bg-primary-hover group-focus-visible:bg-primary-hover inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors">
            Məqaləni oxu
            <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-250 group-hover:translate-x-1 group-focus-visible:translate-x-1" />
          </span>
        </div>
      </Link>
    </article>
  );
}
