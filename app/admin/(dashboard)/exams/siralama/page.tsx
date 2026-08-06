import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAllExamsAdmin } from "@/lib/admin/exam-queries";
import { ExamReorderList } from "@/components/admin/ExamReorderList";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sıralama — Admin" };

export default async function ReorderExamsPage() {
  const exams = await getAllExamsAdmin();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/exams"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> İmtahanlar
        </Link>
        <h1 className="exam-title mt-2 text-2xl font-bold">Sıralama</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          İmtahanları tutub istədiyiniz ardıcıllığa sürüşdürün. Tələbələr onları
          məhz bu ardıcıllıqla görəcək — yüklənmə tarixinin əhəmiyyəti yoxdur.
          Dəyişiklik yalnız “Yadda saxla” düyməsindən sonra qeydə alınır.
        </p>
      </div>

      <ExamReorderList exams={exams} />
    </div>
  );
}
