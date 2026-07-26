/** Azerbaijani-localized date + money formatting. */

/** Money in AZN (manat): "1 234 ₼". Unlike exam `formatPrice`, 0 → "0 ₼". */
export function formatMoney(value: number, currency = "AZN"): string {
  const n = Math.round((Number(value) || 0) * 100) / 100;
  const num = new Intl.NumberFormat("az-AZ", { maximumFractionDigits: 2 }).format(n);
  return currency === "AZN" ? `${num} ₼` : `${num} ${currency}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("az-AZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("az-AZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/** ISO date (YYYY-MM-DD) for <time dateTime> and structured data. */
export function toIsoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/* ---------------------------------------------------------------------------
 * Asia/Baku (Azerbaijan) local time. Timestamps are stored as UTC instants
 * (timestamptz); these convert to Baku wall-clock for DISPLAY. Used everywhere
 * purchases/dates appear in the admin panel — never show UTC to the user.
 * ------------------------------------------------------------------------- */

const BAKU_TZ = "Asia/Baku";

function bakuParts(value: string | null | undefined): Record<string, string> | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("az-AZ", {
    timeZone: BAKU_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const out: Record<string, string> = {};
  for (const p of parts) out[p.type] = p.value;
  return out;
}

/** "26.07.2026" in Baku time. */
export function formatBakuDate(value: string | null | undefined): string {
  const p = bakuParts(value);
  return p ? `${p.day}.${p.month}.${p.year}` : "";
}

/** "15:42" in Baku time. */
export function formatBakuTime(value: string | null | undefined): string {
  const p = bakuParts(value);
  // Intl may emit "24" for midnight in some engines; normalize to "00".
  const hour = p?.hour === "24" ? "00" : p?.hour;
  return p ? `${hour}:${p.minute}` : "";
}

/** "26.07.2026 15:42" in Baku time — the standard admin timestamp format. */
export function formatBakuDateTime(value: string | null | undefined): string {
  const date = formatBakuDate(value);
  const time = formatBakuTime(value);
  return date && time ? `${date} ${time}` : date;
}
