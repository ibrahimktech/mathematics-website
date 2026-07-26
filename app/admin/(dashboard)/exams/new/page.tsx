import { getCategories } from "@/lib/categories";
import { ExamForm } from "@/components/admin/ExamForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yeni imtahan — Admin" };

export default async function NewExamPage() {
  const categories = await getCategories();
  return (
    <div>
      <p className="text-muted-foreground mb-4 text-sm">
        Əvvəlcə imtahan məlumatını yadda saxlayın — sonra sual əlavə edə bilərsiniz.
      </p>
      <ExamForm categories={categories} />
    </div>
  );
}
