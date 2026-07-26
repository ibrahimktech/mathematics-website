import type { Metadata } from "next";
import { getPublishedPosts } from "@/lib/posts";
import { getFeaturedExams } from "@/lib/exams";
import { SITE, absoluteUrl } from "@/lib/site";
import { PlatformHero } from "@/components/platform/PlatformHero";
import { StartPracticingBand } from "@/components/platform/StartPracticingBand";
import { PlatformAbout } from "@/components/platform/PlatformAbout";
import { ExamsShowcase } from "@/components/platform/ExamsShowcase";
import { HowItWorks } from "@/components/platform/HowItWorks";
import { BlogShowcase } from "@/components/platform/BlogShowcase";
import { TeacherSection } from "@/components/platform/TeacherSection";
import { FinalCta } from "@/components/platform/FinalCta";

export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    absolute: `${SITE.name} — Riyaziyyat imtahanları, məsələlər və həllər`,
  },
  description:
    "Diqqətlə hazırlanmış riyaziyyat imtahanları, məsələlər və pulsuz bloq. Məsələ həlli bacarığını inkişaf etdirmək istəyən tələbələr üçün təhsil platforması.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE.url,
    title: `${SITE.name} — Riyaziyyat təhsil platforması`,
    description:
      "İmtahanlar, məsələlər və pulsuz bloq ilə riyazi problem həlli bacarığını inkişaf etdir.",
  },
};

export default async function HomePage() {
  const [featuredExams, recentPosts] = await Promise.all([
    getFeaturedExams(3),
    getPublishedPosts(3),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    inLanguage: "az",
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/axtar")}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PlatformHero />
      <StartPracticingBand />
      <PlatformAbout />
      <ExamsShowcase exams={featuredExams} />
      <HowItWorks />
      <BlogShowcase posts={recentPosts} />
      <TeacherSection />
      <FinalCta />
    </>
  );
}
