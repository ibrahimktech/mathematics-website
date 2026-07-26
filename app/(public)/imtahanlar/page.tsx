import type { Metadata } from "next";
import Link from "next/link";
import { getExams, getExamTopics } from "@/lib/exams";
import { ExamCard } from "@/components/platform/ExamCard";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "İmtahanlar",
  description:
    "Mövzuya və çətinliyə görə seçilmiş riyaziyyat imtahanları — həndəsə, cəbr, ədədlər nəzəriyyəsi, kombinatorika və olimpiada hazırlığı.",
  alternates: { canonical: "/imtahanlar" },
};

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40 border",
      )}
    >
      {children}
    </Link>
  );
}

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ kateqoriya?: string }>;
}) {
  const { kateqoriya } = await searchParams;
  const [all, topics] = await Promise.all([getExams(), getExamTopics()]);
  const active = kateqoriya ?? null;
  const exams = active
    ? all.filter((e) => e.categorySlug === active)
    : all;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="max-w-2xl">
        <span className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
          İmtahanlar
        </span>
        <h1 className="font-display text-foreground mt-2.5 text-3xl font-bold tracking-tight sm:text-4xl">
          Riyaziyyat imtahanları
        </h1>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          Hər imtahan müəyyən mövzu üçün diqqətlə seçilmiş məsələlərdən ibarətdir.
          Çətinlik səviyyəsini seç, özünü sına və harada dayandığını gör.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap gap-2">
        <FilterChip href="/imtahanlar" active={!active}>
          Hamısı
        </FilterChip>
        {topics.map((t) => (
          <FilterChip
            key={t.categorySlug}
            href={`/imtahanlar?kateqoriya=${t.categorySlug}`}
            active={active === t.categorySlug}
          >
            {t.topic}
          </FilterChip>
        ))}
      </div>

      {exams.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam, i) => (
            <ExamCard key={exam.id} exam={exam} index={i % 6} />
          ))}
        </div>
      ) : (
        <div className="border-border text-muted-foreground bg-card mt-10 rounded-2xl border border-dashed p-16 text-center">
          Bu mövzuda hələ imtahan yoxdur.
        </div>
      )}
    </div>
  );
}
