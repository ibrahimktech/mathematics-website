import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { requireUser } from "@/lib/account/auth";
import { getExamById, formatPrice, difficultyLabel } from "@/lib/exams";
import { getMyAccessExamIds, getMyPurchases } from "@/lib/student/queries";
import { getPlatformSettings } from "@/lib/settings";
import { PurchasePanel } from "@/components/platform/PurchasePanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ödəniş",
  robots: { index: false, follow: false },
};

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser("/panel/imtahanlar");
  const { id } = await params;

  const exam = await getExamById(id);
  // Only PUBLISHED, PAID exams are purchasable. Free/draft/missing → bounce.
  if (!exam || exam.price <= 0) redirect("/panel/imtahanlar");

  const [accessIds, purchases, settings] = await Promise.all([
    getMyAccessExamIds(),
    getMyPurchases(),
    getPlatformSettings(),
  ]);

  // Already owned → nothing to pay.
  if (accessIds.has(exam.id)) redirect("/panel/imtahanlar");

  const latest = purchases.find((p) => p.exam_id === exam.id) ?? null;
  const pending = latest?.status === "pending";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:py-10">
      <Link
        href="/panel/imtahanlar"
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> İmtahanlar
      </Link>

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          {exam.topic && (
            <span className="bg-accent text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {exam.topic}
            </span>
          )}
          <span className="text-muted-foreground text-xs">
            {difficultyLabel(exam.difficulty)} · {exam.problemCount} sual
          </span>
        </div>
        <h1 className="exam-title text-foreground mt-2 text-2xl font-bold tracking-tight">
          {exam.title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {formatPrice(exam.price, exam.currency)} — birdəfəlik ödəniş
        </p>
      </header>

      <div className="mt-8">
        {pending ? (
          <div className="border-border bg-card rounded-2xl border p-6 sm:p-8">
            <div className="bg-amber-50 text-amber-600 grid size-12 place-items-center rounded-full">
              <Clock className="size-6" />
            </div>
            <h2 className="exam-title text-foreground mt-4 text-lg font-bold">
              Ödəniş yoxlanılır
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Bu imtahan üçün ödəniş sorğunuz artıq göndərilib və hazırda
              yoxlanılır. Təsdiqləndikdən sonra imtahan panelinizdə avtomatik
              açılacaq.
            </p>
            <Link
              href="/panel/imtahanlar"
              className="text-primary mt-5 inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              <ArrowLeft className="size-4" /> İmtahanlarıma qayıt
            </Link>
          </div>
        ) : (
          <PurchasePanel
            examId={exam.id}
            amount={exam.price}
            currency={exam.currency}
            settings={settings}
            deniedNote={latest?.status === "denied" ? latest.admin_note : undefined}
          />
        )}
      </div>
    </div>
  );
}
