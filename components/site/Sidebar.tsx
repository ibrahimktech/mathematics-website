import { getCategoriesWithCount } from "@/lib/categories";
import { getPublishedPosts } from "@/lib/posts";
import { SidebarSections } from "./SidebarSections";

/** Desktop sidebar for listing pages (home, category, search). */
export async function Sidebar({ activeSlug }: { activeSlug?: string }) {
  const [categories, recent] = await Promise.all([
    getCategoriesWithCount(),
    getPublishedPosts(5),
  ]);
  return (
    <aside className="lg:sticky lg:top-24 lg:h-fit">
      <div className="border-border bg-card rounded-2xl border p-6 shadow-sm">
        <SidebarSections
          categories={categories}
          recent={recent}
          activeSlug={activeSlug}
        />
      </div>
    </aside>
  );
}
