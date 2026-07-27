import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ListChecks, Clock, Check } from "lucide-react";
import {
  getExamBySlug,
  getExams,
  getRelatedExams,
  difficultyLabel,
  difficultyChipClass,
  formatDuration,
} from "@/lib/exams";
import { getPostsByCategorySlug } from "@/lib/posts";
import { formatDate } from "@/lib/format";
import { ExamPurchasePanel } from "@/components/platform/ExamPurchasePanel";
import { ExamCard } from "@/components/platform/ExamCard";
import { ArticleMiniCard } from "@/components/platform/ArticleMiniCard";
import { SITE, absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import { jsonLdScript } from "@/lib/json-ld";

const getExam = cache(getExamBySlug);

export const revalidate = 300;

export async function generateStaticParams() {
  const exams = await getExams();
  return exams.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exam = await getExam(slug);
  if (!exam) return { title: "İmtahan tapılmadı" };
  return {
    title: exam.title,
    description: exam.summary,
    alternates: { canonical: `/imtahanlar/${exam.slug}` },
    openGraph: {
      type: "website",
      url: absoluteUrl(`/imtahanlar/${exam.slug}`),
      title: exam.title,
      description: exam.summary,
    },
  };
}

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exam = await getExam(slug);
  if (!exam) notFound();

  const [{ posts: relatedArticles }, relatedExams] = await Promise.all([
    getPostsByCategorySlug(exam.categorySlug, 3),
    getRelatedExams(exam.categorySlug, exam.id, 3),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: exam.title,
    description: exam.summary,
    inLanguage: "az",
    provider: { "@type": "Organization", name: SITE.name, sameAs: SITE.url },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />

      <Link
        href="/imtahanlar"
        className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> İmtahanlar
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-12">
        <main className="min-w-0">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/imtahanlar?kateqoriya=${exam.categorySlug}`}
                className="bg-accent text-primary hover:bg-primary hover:text-primary-foreground inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold transition-colors"
              >
                {exam.topic}
              </Link>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
                  difficultyChipClass(exam.difficulty),
                )}
              >
                {difficultyLabel(exam.difficulty)}
              </span>
            </div>

            <h1 className="exam-title text-foreground mt-4 text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              {exam.title}
            </h1>

            <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="size-4" /> {exam.problemCount} məsələ
              </span>
              <span aria-hidden className="text-border">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" /> {formatDuration(exam.durationMinutes)}
              </span>
              {exam.updatedAt && (
                <>
                  <span aria-hidden className="text-border">•</span>
                  <span>Yenilənib: {formatDate(exam.updatedAt)}</span>
                </>
              )}
            </div>
          </header>

          {exam.description && (
            <p className="text-foreground/90 mt-8 text-lg leading-relaxed whitespace-pre-line">
              {exam.description}
            </p>
          )}

          {exam.covers.length > 0 && (
            <section className="mt-10">
              <h2 className="exam-title text-foreground text-xl font-bold tracking-tight">
                İmtahanda nələr var
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {exam.covers.map((c) => (
                  <li key={c} className="text-foreground/85 flex items-start gap-2.5 text-sm">
                    <span className="bg-accent text-primary mt-0.5 grid size-5 shrink-0 place-items-center rounded-full">
                      <Check className="size-3" />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="border-border bg-card mt-10 rounded-2xl border p-6">
            <h2 className="exam-title text-foreground text-lg font-bold tracking-tight">
              Necə işləyir
            </h2>
            <ol className="text-foreground/85 mt-4 space-y-2.5 text-sm">
              <li>1. İmtahanı al və bank köçürməsi ilə ödə.</li>
              <li>2. Qəbzini yüklə — ödənişin əl ilə yoxlanılır.</li>
              <li>3. Təsdiqdən sonra imtahan panelində açılır və başlaya bilərsən.</li>
            </ol>
          </section>
        </main>

        <aside>
          <ExamPurchasePanel exam={exam} />
        </aside>
      </div>

      {/* Exam → blog: review the concepts */}
      {relatedArticles.length > 0 && (
        <section className="border-border mt-16 border-t pt-12">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <h2 className="exam-title text-foreground text-2xl font-bold tracking-tight">
                Anlayışları təkrarla
              </h2>
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                Bu mövzudakı pulsuz məqalələr imtahandan əvvəl əsasları
                möhkəmləndirməyə kömək edir.
              </p>
            </div>
            <Link
              href={`/kateqoriya/${exam.categorySlug}`}
              className="text-primary hover:text-primary-hover inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold transition-colors"
            >
              Bütün məqalələr
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {relatedArticles.map((post) => (
              <ArticleMiniCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Related exams */}
      {relatedExams.length > 0 && (
        <section className="border-border mt-16 border-t pt-12">
          <h2 className="exam-title text-foreground text-2xl font-bold tracking-tight">
            Bənzər imtahanlar
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {relatedExams.map((e, i) => (
              <ExamCard key={e.id} exam={e} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
