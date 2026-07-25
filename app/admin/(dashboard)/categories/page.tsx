import { getCategoriesWithCount } from "@/lib/categories";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kateqoriyalar" };

export default async function CategoriesPage() {
  const categories = await getCategoriesWithCount();
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">Kateqoriyalar</h1>
      <CategoryManager categories={categories} />
    </div>
  );
}
