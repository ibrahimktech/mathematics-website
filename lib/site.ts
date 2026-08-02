/**
 * Global site configuration. Used by metadata, RSS, sitemap and the UI shell.
 * Rename `name` / `description` to suit the teacher's blog.
 */
export const SITE = {
  name: "ANTG Olimpiada",
  shortName: "ANTG",
  description:
    "Olimpiada sınaqları və riyazi bloqlar üçün riyaziyyat təhsil platforması.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  ),
  locale: "az_AZ",
  /**
   * Optional external links shown in the footer. Leave a value empty ("") to
   * hide that link. Fill these in to point at your own profiles.
   */
  links: {
    github: "",
    email: "",
  },
} as const;

/** Absolute URL helper for canonical links, OG images, RSS, sitemap. */
export function absoluteUrl(path = ""): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
