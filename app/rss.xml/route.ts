import { SITE, absoluteUrl } from "@/lib/site";
import { getPublishedPosts } from "@/lib/posts";

export const revalidate = 3600;

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await getPublishedPosts(30);

  const items = posts
    .map((p) => {
      const link = absoluteUrl(`/meqale/${p.slug}`);
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>${
        p.published_at
          ? `\n      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>`
          : ""
      }${
        p.category
          ? `\n      <category>${escapeXml(p.category.name)}</category>`
          : ""
      }${
        p.excerpt
          ? `\n      <description>${escapeXml(p.excerpt)}</description>`
          : ""
      }
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE.name)}</title>
    <link>${SITE.url}</link>
    <description>${escapeXml(SITE.description)}</description>
    <language>az</language>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}
