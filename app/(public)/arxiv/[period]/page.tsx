import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostsByArchive } from "@/lib/archives";
import { archiveLabel, formatArchivePeriod } from "@/lib/archives/period";
import { ArticleRow } from "@/components/site/ArticleRow";
import { Sidebar } from "@/components/site/Sidebar";

const getData = cache(getPostsByArchive);

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ period: string }>;
}): Promise<Metadata> {
  const { period: raw } = await params;
  const { period, posts } = await getData(raw);
  if (!period) return { title: "Arxiv tapılmadı" };
  const label = archiveLabel(period);
  return {
    title: `${label} arxivi`,
    description: `${label} tarixində dərc edilmiş riyaziyyat məqalələri.`,
    alternates: { canonical: `/arxiv/${formatArchivePeriod(period)}` },
    // Any well-formed YYYY-MM resolves, so empty months are an unbounded URL
    // space — keep those out of the index (a month with posts is indexable).
    ...(posts.length === 0 && { robots: { index: false, follow: true } }),
  };
}

export default async function ArchivePage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  const { period: raw } = await params;
  const { period, posts } = await getData(raw);
  if (!period) notFound();

  const key = formatArchivePeriod(period);
  const label = archiveLabel(period);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:grid lg:grid-cols-[1fr_300px] lg:gap-12">
      <main className="min-w-0">
        <header className="border-border border-b pb-8">
          <span className="text-muted-foreground text-sm font-medium">Arxiv</span>
          <h1 className="font-display text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {label}
          </h1>
          {posts.length > 0 && (
            <p className="text-muted-foreground mt-4 text-sm">
              {posts.length} məqalə
            </p>
          )}
        </header>

        {posts.length ? (
          <div className="mt-6">
            {posts.map((post, i) => (
              <ArticleRow key={post.id} post={post} index={i % 6} />
            ))}
          </div>
        ) : (
          <div className="border-border text-muted-foreground bg-card mt-8 rounded-2xl border border-dashed p-16 text-center">
            Bu ayda dərc edilmiş məqalə yoxdur.
          </div>
        )}
      </main>

      <div className="mt-12 lg:mt-0">
        <Sidebar activeArchive={key} />
      </div>
    </div>
  );
}
