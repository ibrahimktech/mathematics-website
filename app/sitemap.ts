import type { MetadataRoute } from "next";
import { SITE, absoluteUrl } from "@/lib/site";
import { getAllPublishedSlugs } from "@/lib/posts";
import { getCategories } from "@/lib/categories";
import { getArchives } from "@/lib/archives";
import { getExams } from "@/lib/exams";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories, archives, exams] = await Promise.all([
    getAllPublishedSlugs(),
    getCategories(),
    getArchives(),
    getExams(),
  ]);
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified: now, changeFrequency: "daily", priority: 1 },
    {
      url: absoluteUrl("/imtahanlar"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/bloq"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/haqqinda"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  return [
    ...staticPages,
    ...exams.map((e) => ({
      url: absoluteUrl(`/imtahanlar/${e.slug}`),
      lastModified: new Date(e.updatedAt || now),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...posts.map((p) => ({
      url: absoluteUrl(`/meqale/${p.slug}`),
      lastModified: new Date(p.updated_at || p.published_at || now),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((c) => ({
      url: absoluteUrl(`/kateqoriya/${c.slug}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...archives.map((a) => ({
      url: absoluteUrl(`/arxiv/${a.period}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
  ];
}
