import { notFound } from "next/navigation";
import { getCategories } from "@/lib/categories";
import { getExamByIdAdmin, getExamQuestionsAdmin } from "@/lib/admin/exam-queries";
import { ExamForm } from "@/components/admin/ExamForm";
import { QuestionEditor } from "@/components/admin/QuestionEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "İmtahanı redaktə et — Admin" };

export default async function EditExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [exam, categories, questions] = await Promise.all([
    getExamByIdAdmin(id),
    getCategories(),
    getExamQuestionsAdmin(id),
  ]);
  if (!exam) notFound();

  return (
    <div>
      <ExamForm initial={exam} categories={categories} />
      <div className="border-border mt-4 border-t pt-2">
        <QuestionEditor examId={exam.id} questions={questions} />
      </div>
    </div>
  );
}
