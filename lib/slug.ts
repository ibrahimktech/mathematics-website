/**
 * Azerbaijani → ASCII transliteration for clean, shareable URL slugs.
 * Titles, search, categories and tags keep full Unicode everywhere else;
 * only the URL slug is transliterated (avoids percent-encoded URLs).
 */
const AZ_MAP: Record<string, string> = {
  ə: "e",
  Ə: "e",
  ı: "i",
  İ: "i",
  ü: "u",
  Ü: "u",
  ö: "o",
  Ö: "o",
  ç: "c",
  Ç: "c",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
};

export function slugify(input: string): string {
  return (
    input
      .trim()
      .replace(/[əƏıİüÜöÖçÇşŞğĞ]/g, (ch) => AZ_MAP[ch] ?? ch)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip any remaining diacritics
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "meqale"
  );
}
