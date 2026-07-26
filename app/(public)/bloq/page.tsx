import type { Metadata } from "next";
import { getPublishedPosts } from "@/lib/posts";
import { ArticleRow } from "@/components/site/ArticleRow";
import { Sidebar } from "@/components/site/Sidebar";
import { Hero } from "@/components/site/Hero";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Bloq",
  description:
    "Olimpiada məsələləri, həllər, teoremlər və riyazi ideyalar — pulsuz və Azərbaycan dilində.",
  alternates: { canonical: "/bloq" },
};

export default async function BlogPage() {
  const posts = await getPublishedPosts(30);

  return (
    <>
      <Hero />

      <div
        id="articles"
        className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 sm:px-6 lg:grid lg:grid-cols-[1fr_300px] lg:gap-12"
      >
        <main className="min-w-0">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                Son Məqalələr
              </h2>
              <p className="text-muted-foreground mt-1.5 text-sm">
                Ən son dərc edilmiş yazılar və həllər.
              </p>
            </div>
          </div>

          {posts.length ? (
            <div className="mt-8">
              {posts.map((post, i) => (
                <ArticleRow key={post.id} post={post} index={i % 6} />
              ))}
            </div>
          ) : (
            <div className="border-border text-muted-foreground bg-card mt-8 rounded-2xl border border-dashed p-16 text-center">
              Hələ məqalə dərc edilməyib.
            </div>
          )}
        </main>

        <div className="mt-12 lg:mt-0">
          <Sidebar />
        </div>
      </div>
    </>
  );
}
