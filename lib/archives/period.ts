/**
 * Archive period helpers. A period is the string "YYYY-MM" (e.g. "2026-06").
 *
 * Pure — no I/O, no `server-only` — so client components may import it (same
 * split as `lib/exams/types.ts` next to the server-only `lib/exams.ts`).
 *
 * Months are bucketed in **Asia/Baku**, matching `lib/analytics/time.ts` and the
 * analytics RPCs: Azerbaijan is a fixed UTC+4 (no DST since 2016), so a stored
 * UTC instant is shifted by that offset before its calendar month is read.
 */

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

/**
 * Azerbaijani month names, nominative and capitalized — these label a standalone
 * list entry ("İyun 2026"), not a full date. Spelled out rather than taken from
 * Intl so the sidebar never depends on the runtime's ICU locale data.
 */
const AZ_MONTHS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "İyun",
  "İyul",
  "Avqust",
  "Sentyabr",
  "Oktyabr",
  "Noyabr",
  "Dekabr",
] as const;

/** A calendar month. `month` is 1-12 (not the JS 0-11). */
export interface ArchivePeriod {
  year: number;
  month: number;
}

/** One sidebar row: a month and how many published posts it holds. */
export interface ArchiveEntry {
  /** "YYYY-MM" — the URL segment and React key. */
  period: string;
  /** "İyun 2026" — the visible label. */
  label: string;
  post_count: number;
}

/** Parse a "YYYY-MM" URL segment. Returns null for anything malformed. */
export function parseArchivePeriod(
  raw: string | null | undefined,
): ArchivePeriod | null {
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (year < 1970 || year > 9999) return null;
  return { year, month };
}

/** { year: 2026, month: 6 } → "2026-06". */
export function formatArchivePeriod({ year, month }: ArchivePeriod): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** "2026-06" (or a parsed period) → "İyun 2026". Unparseable input passes through. */
export function archiveLabel(value: string | ArchivePeriod): string {
  const period = typeof value === "string" ? parseArchivePeriod(value) : value;
  if (!period) return typeof value === "string" ? value : "";
  return `${AZ_MONTHS[period.month - 1]} ${period.year}`;
}

/**
 * The half-open UTC instant range `[start, end)` covering the given Baku month —
 * what a `published_at` filter compares against (Baku June 2026 starts at
 * 2026-05-31T20:00:00Z).
 */
export function archiveRange(period: ArchivePeriod): {
  start: string;
  end: string;
} {
  const startWall = Date.UTC(period.year, period.month - 1, 1);
  const endWall = Date.UTC(period.year, period.month, 1);
  return {
    start: new Date(startWall - BAKU_OFFSET_MS).toISOString(),
    end: new Date(endWall - BAKU_OFFSET_MS).toISOString(),
  };
}

/** The Baku month an instant falls into, as "YYYY-MM" ("" if unparseable). */
export function bakuMonthKey(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA yields "YYYY-MM-DD"; Asia/Baku via the tz database. The day is asked
  // for (and sliced off) because a year+month-only format is not ISO-ordered.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d)
    .slice(0, 7);
}

/** Newest month first — the sidebar's order. */
export function compareArchivesDesc(a: ArchiveEntry, b: ArchiveEntry): number {
  return b.period.localeCompare(a.period);
}
