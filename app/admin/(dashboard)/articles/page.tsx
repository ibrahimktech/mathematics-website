import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { getAllPostsAdmin } from "@/lib/admin/queries";
import { ArticleTable } from "@/components/admin/ArticleTable";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Məqalələr" };

export default async function ArticlesPage() {
  const posts = await getAllPostsAdmin();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Məqalələr</h1>
        <Link href="/admin/articles/new" className={buttonVariants()}>
          <FilePlus2 /> Yeni Məqalə
        </Link>
      </div>
      <ArticleTable posts={posts} />
    </div>
  );
}
