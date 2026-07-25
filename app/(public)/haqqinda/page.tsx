import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Haqqında",
  description: `${SITE.name} — ${SITE.description}`,
  alternates: { canonical: "/haqqinda" },
};

const TOPICS = [
  { emoji: "📐", title: "Həndəsə", text: "Klassik və müasir həndəsi ideyalar." },
  { emoji: "➕", title: "Cəbr", text: "Tənliklər, strukturlar və çevirmələr." },
  {
    emoji: "🧩",
    title: "Kombinatorika",
    text: "Sayma üsulları və diskret riyaziyyat.",
  },
  {
    emoji: "π",
    title: "Ədədlər nəzəriyyəsi",
    text: "Bölünmə, sadə ədədlər və modulyar arifmetika.",
  },
  { emoji: "🏆", title: "Olimpiada", text: "Müsabiqə məsələləri və zərif həllər." },
  { emoji: "💡", title: "Teoremlər", text: "İsbatlar və riyazi mühakimə." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="bg-accent text-primary inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
        Haqqında
      </span>

      <h1 className="font-display text-foreground mt-5 text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
        {SITE.name}
      </h1>

      <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
        {SITE.description}
      </p>

      <div className="text-foreground/90 mt-6 space-y-4 leading-relaxed">
        <p>
          Bu bloq riyaziyyatı sevənlər üçün nəzərdə tutulub. Burada olimpiada
          məsələləri, zərif isbatlar, teoremlər və dərin riyazi ideyalar
          Azərbaycan dilində paylaşılır.
        </p>
        <p>
          Məqalələr LaTeX ilə yazılır və birbaşa saytda səliqəli, akademik
          formatda dərc olunur — düsturlar, teoremlər və sübutlar tam
          oxunaqlılıqla.
        </p>
      </div>

      <h2 className="font-display text-foreground mt-14 text-2xl font-bold tracking-tight">
        Mövzular
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {TOPICS.map((t) => (
          <div
            key={t.title}
            className="border-border bg-card flex gap-4 rounded-2xl border p-5"
          >
            <span
              aria-hidden
              className="bg-accent grid size-11 shrink-0 place-items-center rounded-xl text-xl"
            >
              {t.emoji}
            </span>
            <div>
              <h3 className="font-display text-foreground text-base font-bold">
                {t.title}
              </h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {t.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-border bg-card mt-14 flex flex-col items-start justify-between gap-4 rounded-2xl border p-8 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-foreground text-xl font-bold">
            Oxumağa başla
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Ən son məqalələrə göz at və kəşf etməyə başla.
          </p>
        </div>
        <Link
          href="/#articles"
          className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5"
        >
          Məqalələrə bax
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
