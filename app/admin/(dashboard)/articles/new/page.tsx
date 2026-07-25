import { getCategories } from "@/lib/categories";
import { ArticleForm } from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yeni Məqalə" };

export default async function NewArticlePage() {
  const categories = await getCategories();
  return <ArticleForm categories={categories} />;
}
