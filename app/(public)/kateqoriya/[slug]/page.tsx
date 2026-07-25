import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostsByCategorySlug } from "@/lib/posts";
import { ArticleRow } from "@/components/site/ArticleRow";
import { Sidebar } from "@/components/site/Sidebar";

const getData = cache(getPostsByCategorySlug);

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await getData(slug);
  if (!category) return { title: "Kateqoriya tapılmadı" };
  return {
    title: category.name,
    description:
      category.description ??
      `${category.name} kateqoriyasındakı riyaziyyat məqalələri.`,
    alternates: { canonical: `/kateqoriya/${category.slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { category, posts } = await getData(slug);
  if (!category) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:grid lg:grid-cols-[1fr_300px] lg:gap-12">
      <main className="min-w-0">
        <header className="border-border border-b pb-8">
          <span className="text-muted-foreground text-sm font-medium">
            Kateqoriya
          </span>
          <h1 className="font-display text-foreground mt-2 flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {category.emoji && (
              <span className="bg-accent grid size-12 place-items-center rounded-2xl text-2xl">
                {category.emoji}
              </span>
            )}
            {category.name}
          </h1>
          {category.description && (
            <p className="text-muted-foreground mt-4 max-w-2xl leading-relaxed">
              {category.description}
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
            Bu kateqoriyada hələ məqalə yoxdur.
          </div>
        )}
      </main>

      <div className="mt-12 lg:mt-0">
        <Sidebar activeSlug={category.slug} />
      </div>
    </div>
  );
}
