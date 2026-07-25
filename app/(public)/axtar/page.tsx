import type { Metadata } from "next";
import { searchPosts } from "@/lib/posts";
import { ArticleRow } from "@/components/site/ArticleRow";
import { Sidebar } from "@/components/site/Sidebar";
import { SearchBar } from "@/components/site/SearchBar";

export const metadata: Metadata = {
  title: "Axtarış",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await searchPosts(query) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:grid lg:grid-cols-[1fr_300px] lg:gap-12">
      <main className="min-w-0">
        <h1 className="font-display text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
          Axtarış
        </h1>

        <div className="mt-6 max-w-md">
          <SearchBar
            initialQuery={query}
            autoFocus
            placeholder="Başlıq, mətn və ya teq…"
          />
        </div>

        {query && (
          <p className="text-muted-foreground mt-5 text-sm">
            <span className="text-foreground font-semibold">“{query}”</span> üçün{" "}
            {results.length} nəticə
          </p>
        )}

        {results.length ? (
          <div className="mt-6">
            {results.map((post, i) => (
              <ArticleRow key={post.id} post={post} index={i % 6} />
            ))}
          </div>
        ) : query ? (
          <div className="border-border text-muted-foreground bg-card mt-8 rounded-2xl border border-dashed p-16 text-center">
            Nəticə tapılmadı.
          </div>
        ) : null}
      </main>

      <div className="mt-12 lg:mt-0">
        <Sidebar />
      </div>
    </div>
  );
}
