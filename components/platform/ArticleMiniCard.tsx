import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PostWithCategory } from "@/lib/types";
import { formatDate, toIsoDate } from "@/lib/format";

/** Compact blog-article card — homepage blog section + exam→blog cross-links. */
export function ArticleMiniCard({ post }: { post: PostWithCategory }) {
  return (
    <article className="h-full">
      <Link
        href={`/meqale/${post.slug}`}
        className="article-card group border-border bg-card flex h-full flex-col border p-5 focus-visible:outline-none"
      >
        {post.category && (
          <span className="bg-accent text-primary inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold">
            {post.category.emoji ? `${post.category.emoji} ` : ""}
            {post.category.name}
          </span>
        )}
        <h3 className="font-display text-foreground group-hover:text-primary mt-3.5 text-lg leading-snug font-bold tracking-tight transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm leading-relaxed">
            {post.excerpt}
          </p>
        )}
        <div className="text-muted-foreground mt-auto flex items-center gap-2 pt-4 text-xs">
          <time dateTime={toIsoDate(post.published_at)}>
            {formatDate(post.published_at)}
          </time>
          <span aria-hidden className="text-border">•</span>
          <span className="text-primary inline-flex items-center gap-1 font-semibold">
            Oxu
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    </article>
  );
}
