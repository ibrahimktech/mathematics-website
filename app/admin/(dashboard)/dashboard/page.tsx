import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { getAllPostsAdmin, getPostCounts } from "@/lib/admin/queries";
import { ArticleTable } from "@/components/admin/ArticleTable";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "İdarə paneli" };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-border bg-card rounded-lg border p-5">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="font-heading mt-1 text-3xl font-bold">{value}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const [counts, posts] = await Promise.all([
    getPostCounts(),
    getAllPostsAdmin(),
  ]);
  const recent = posts.slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">İdarə paneli</h1>
        <Link href="/admin/articles/new" className={buttonVariants()}>
          <FilePlus2 /> Yeni Məqalə
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ümumi məqalə" value={counts.total} />
        <Stat label="Dərc edilmiş" value={counts.published} />
        <Stat label="Qaralama" value={counts.draft} />
      </div>

      <div>
        <h2 className="font-heading mb-3 text-lg font-semibold">Son məqalələr</h2>
        <ArticleTable posts={recent} />
      </div>
    </div>
  );
}
