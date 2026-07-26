import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getFreeExams } from "@/lib/exams";
import { ExamCard } from "@/components/platform/ExamCard";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Məsələlər",
  description:
    "Pulsuz məşq məsələləri və başlanğıc toplular — riyazi düşüncəni ödənişsiz inkişaf etdir.",
  alternates: { canonical: "/meseleler" },
};

export default async function PracticePage() {
  const freeExams = await getFreeExams();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="max-w-2xl">
        <span className="text-primary text-xs font-semibold tracking-[0.14em] uppercase">
          Məsələlər
        </span>
        <h1 className="font-display text-foreground mt-2.5 text-3xl font-bold tracking-tight sm:text-4xl">
          Pulsuz məşq et
        </h1>
        <p className="text-muted-foreground mt-4 leading-relaxed">
          Ödəniş etmədən başla. Bu pulsuz məşq toplularında əsas bacarıqları
          möhkəmləndir və platformanın üslubu ilə tanış ol — hazır olduqda tam
          imtahanlara keç.
        </p>
      </header>

      {freeExams.length ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {freeExams.map((exam, i) => (
            <ExamCard key={exam.id} exam={exam} index={i} />
          ))}
        </div>
      ) : (
        <div className="border-border text-muted-foreground bg-card mt-10 rounded-2xl border border-dashed p-16 text-center">
          Pulsuz məsələlər tezliklə əlavə olunacaq.
        </div>
      )}

      {/* Practice → blog + full exams */}
      <div className="border-border bg-card mt-14 grid gap-6 rounded-2xl border p-8 sm:grid-cols-2">
        <div>
          <h2 className="font-display text-foreground text-lg font-bold tracking-tight">
            Əvvəl anlamaq istəyirsən?
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            Bloqdakı pulsuz məqalələr teoremləri və həll üsullarını izah edir.
          </p>
          <Link
            href="/bloq"
            className="text-primary hover:text-primary-hover mt-3 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
          >
            Bloqu oxu <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="sm:border-border sm:border-l sm:pl-6">
          <h2 className="font-display text-foreground text-lg font-bold tracking-tight">
            Daha çətin məsələlər?
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            Tam imtahanlar olimpiada səviyyəsinə qədər çətinlik təklif edir.
          </p>
          <Link
            href="/imtahanlar"
            className="text-primary hover:text-primary-hover mt-3 inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
          >
            İmtahanlara bax <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
