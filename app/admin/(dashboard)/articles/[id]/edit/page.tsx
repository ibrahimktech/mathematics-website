import { notFound } from "next/navigation";
import { getPostByIdAdmin } from "@/lib/admin/queries";
import { getCategories } from "@/lib/categories";
import { ArticleForm } from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Məqaləni redaktə et" };

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [post, categories] = await Promise.all([
    getPostByIdAdmin(id),
    getCategories(),
  ]);
  if (!post) notFound();
  return <ArticleForm initial={post} categories={categories} />;
}
