import { getCategoriesWithCount } from "@/lib/categories";
import { getArchives } from "@/lib/archives";
import { getPublishedPosts } from "@/lib/posts";
import { SidebarSections } from "./SidebarSections";

/** Desktop sidebar for listing pages (home, category, archive, search). */
export async function Sidebar({
  activeSlug,
  activeArchive,
}: {
  activeSlug?: string;
  /** Active archive period, "YYYY-MM". */
  activeArchive?: string;
}) {
  const [categories, archives, recent] = await Promise.all([
    getCategoriesWithCount(),
    getArchives(),
    getPublishedPosts(5),
  ]);
  return (
    <aside className="lg:sticky lg:top-24 lg:h-fit">
      <div className="border-border bg-card rounded-2xl border p-6 shadow-sm">
        <SidebarSections
          categories={categories}
          archives={archives}
          recent={recent}
          activeSlug={activeSlug}
          activeArchive={activeArchive}
        />
      </div>
    </aside>
  );
}
