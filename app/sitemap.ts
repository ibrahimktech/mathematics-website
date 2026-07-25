import type { MetadataRoute } from "next";
import { SITE, absoluteUrl } from "@/lib/site";
import { getAllPublishedSlugs } from "@/lib/posts";
import { getCategories } from "@/lib/categories";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([
    getAllPublishedSlugs(),
    getCategories(),
  ]);
  const now = new Date();

  return [
    {
      url: SITE.url,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
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
  ];
}
