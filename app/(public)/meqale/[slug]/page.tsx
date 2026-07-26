import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  getPostBySlug,
  getAdjacentPosts,
  getRelatedPosts,
} from "@/lib/posts";
import { getExamsByCategorySlug } from "@/lib/exams";
import { LatexContent } from "@/components/site/LatexContent";
import { ShareButtons } from "@/components/site/ShareButtons";
import { ArticleRow } from "@/components/site/ArticleRow";
import { RelatedExamCallout } from "@/components/platform/RelatedExamCallout";
import { formatDate, toIsoDate } from "@/lib/format";
import { readingTimeLabel } from "@/lib/reading-time";
import { SITE, absoluteUrl } from "@/lib/site";

const getPost = cache(getPostBySlug);

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Məqalə tapılmadı" };

  const description = post.excerpt ?? undefined;
  const images = post.cover_image_url ? [post.cover_image_url] : undefined;

  return {
    title: post.title,
    description,
    alternates: { canonical: `/meqale/${post.slug}` },
    openGraph: {
      type: "article",
      url: absoluteUrl(`/meqale/${post.slug}`),
      title: post.title,
      description,
      images,
      publishedTime: toIsoDate(post.published_at),
      modifiedTime: toIsoDate(post.updated_at),
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const [{ previous, next }, related, relatedExams] = await Promise.all([
    getAdjacentPosts(post),
    getRelatedPosts(post),
    post.category
      ? getExamsByCategorySlug(post.category.slug)
      : Promise.resolve([]),
  ]);

  const url = absoluteUrl(`/meqale/${post.slug}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    image: post.cover_image_url ? [post.cover_image_url] : undefined,
    datePublished: toIsoDate(post.published_at),
    dateModified: toIsoDate(post.updated_at),
    author: { "@type": "Organization", name: SITE.name },
    publisher: { "@type": "Organization", name: SITE.name },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: "az",
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Link
        href="/bloq"
        className="text-muted-foreground hover:text-primary mb-8 inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> Bloq
      </Link>

      <header className="space-y-5">
        {post.category && (
          <Link
            href={`/kateqoriya/${post.category.slug}`}
            className="bg-accent text-primary hover:bg-primary hover:text-primary-foreground inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition-colors"
          >
            {post.category.emoji ? `${post.category.emoji} ` : ""}
            {post.category.name}
          </Link>
        )}
        <h1 className="font-display text-foreground text-3xl leading-tight font-bold tracking-tight sm:text-4xl lg:text-[2.75rem]">
          {post.title}
        </h1>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <time dateTime={toIsoDate(post.published_at)}>
            {formatDate(post.published_at)}
          </time>
          <span aria-hidden className="text-border">
            •
          </span>
          <span>{readingTimeLabel(post.reading_time_minutes)}</span>
        </div>
      </header>

      {post.cover_image_url && (
        <div className="bg-muted relative mt-8 aspect-[16/9] overflow-hidden rounded-xl">
          <Image
            src={post.cover_image_url}
            alt={post.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <LatexContent content={post.content} className="mt-10" />

      {post.tags.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <span
              key={t}
              className="border-border bg-card text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="border-border mt-10 border-t pt-6">
        <ShareButtons url={url} title={post.title} />
      </div>

      {post.category && relatedExams.length > 0 && (
        <RelatedExamCallout
          categorySlug={post.category.slug}
          topic={post.category.name}
        />
      )}

      {(previous || next) && (
        <nav className="mt-10 grid gap-4 sm:grid-cols-2">
          {previous ? (
            <Link
              href={`/meqale/${previous.slug}`}
              className="border-border hover:border-primary/50 hover:bg-accent/40 bg-card group rounded-2xl border p-5 transition-colors"
            >
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                <ArrowLeft className="size-3.5" /> Əvvəlki Məqalə
              </span>
              <div className="font-display group-hover:text-primary mt-1 font-semibold">
                {previous.title}
              </div>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/meqale/${next.slug}`}
              className="border-border hover:border-primary/50 hover:bg-accent/40 bg-card group rounded-2xl border p-5 text-right transition-colors"
            >
              <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                Növbəti Məqalə <ArrowRight className="size-3.5" />
              </span>
              <div className="font-display group-hover:text-primary mt-1 font-semibold">
                {next.title}
              </div>
            </Link>
          )}
        </nav>
      )}

      {related.length > 0 && (
        <section className="border-border mt-16 border-t pt-12">
          <h2 className="font-display text-foreground mb-2 text-2xl font-bold tracking-tight">
            Əlaqəli Məqalələr
          </h2>
          <div>
            {related.map((p, i) => (
              <ArticleRow key={p.id} post={p} index={i % 6} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
