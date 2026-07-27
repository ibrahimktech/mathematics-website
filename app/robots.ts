import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The password-reset pages are reached with a one-time recovery token
        // in the URL — they must never be crawled, indexed or cached.
        disallow: [
          "/admin",
          "/axtar",
          "/panel",
          "/daxil-ol",
          "/qeydiyyat",
          "/sifre-sifirlama",
          "/sifre-yenile",
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
