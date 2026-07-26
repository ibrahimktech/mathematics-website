/**
 * Asia/Baku time bucketing for analytics. Azerbaijan is a fixed UTC+4 (no DST
 * since 2016), so window boundaries are computed against that offset; DISPLAY
 * still goes through Intl (lib/format.ts). Pure — no I/O, client-safe.
 */

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;

/** The instant's Baku calendar-day key, "YYYY-MM-DD". */
export function bakuDayKey(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Baku wall-clock as a Date whose UTC fields equal the Baku local fields. */
function bakuWall(now = new Date()): Date {
  return new Date(now.getTime() + BAKU_OFFSET_MS);
}
function toInstant(bakuWallMs: number): string {
  return new Date(bakuWallMs - BAKU_OFFSET_MS).toISOString();
}

/** Start instants (UTC ISO) of the current Baku day / week(Mon) / month / year. */
export function bakuWindowStarts(now = new Date()): {
  today: string;
  week: string;
  month: string;
  year: string;
} {
  const w = bakuWall(now);
  const y = w.getUTCFullYear();
  const m = w.getUTCMonth();
  const day = w.getUTCDate();
  const dow = w.getUTCDay(); // 0=Sun..6=Sat
  const mondayDiff = (dow + 6) % 7;
  return {
    today: toInstant(Date.UTC(y, m, day)),
    week: toInstant(Date.UTC(y, m, day - mondayDiff)),
    month: toInstant(Date.UTC(y, m, 1)),
    year: toInstant(Date.UTC(y, 0, 1)),
  };
}

/** Last `n` Baku day keys, oldest → newest, ending today. */
export function lastNBakuDays(n: number, now = new Date()): string[] {
  const w = bakuWall(now);
  const base = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate());
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base - i * 24 * 60 * 60 * 1000);
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate(),
      ).padStart(2, "0")}`,
    );
  }
  return out;
}

/** "26.07" short label for a "YYYY-MM-DD" day key (chart axis). */
export function shortDayLabel(dayKey: string): string {
  const [, m, d] = dayKey.split("-");
  return m && d ? `${d}.${m}` : dayKey;
}
