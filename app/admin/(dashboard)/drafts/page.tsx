import { getAllPostsAdmin } from "@/lib/admin/queries";
import { ArticleTable } from "@/components/admin/ArticleTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Qaralamalar" };

export default async function DraftsPage() {
  const posts = await getAllPostsAdmin("draft");
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Qaralamalar</h1>
      <ArticleTable posts={posts} empty="Qaralama yoxdur." />
    </div>
  );
}
