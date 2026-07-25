import { getAllPostsAdmin } from "@/lib/admin/queries";
import { ArticleTable } from "@/components/admin/ArticleTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dərc Edilmiş" };

export default async function PublishedPage() {
  const posts = await getAllPostsAdmin("published");
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Dərc Edilmiş</h1>
      <ArticleTable posts={posts} empty="Dərc edilmiş məqalə yoxdur." />
    </div>
  );
}
