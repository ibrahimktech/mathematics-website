/**
 * Pure, CLIENT-SAFE display helpers for exams (labels, chips, formatting). No
 * data access and no `server-only`, so client components can import these
 * directly. Kept separate from `lib/exams.ts` (server-only DB access).
 */
import type { ExamDifficulty, ExamStatus } from "./types";

const DIFFICULTY_LABELS: Record<ExamDifficulty, string> = {
  beginner: "Başlanğıc",
  intermediate: "Orta",
  advanced: "Çətin",
  olympiad: "Olimpiada",
};

export function difficultyLabel(d: ExamDifficulty): string {
  return DIFFICULTY_LABELS[d] ?? d;
}

/** All difficulty options (for the admin exam form select). */
export const DIFFICULTY_OPTIONS: { value: ExamDifficulty; label: string }[] = (
  Object.keys(DIFFICULTY_LABELS) as ExamDifficulty[]
).map((value) => ({ value, label: DIFFICULTY_LABELS[value] }));

/** Tailwind classes for the difficulty chip — restrained, palette-aligned. */
export function difficultyChipClass(d: ExamDifficulty): string {
  switch (d) {
    case "beginner":
      return "bg-emerald-50 text-emerald-700";
    case "intermediate":
      return "bg-sky-50 text-sky-700";
    case "advanced":
      return "bg-amber-50 text-amber-700";
    case "olympiad":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

/**
 * PUBLICATION status of an exam (draft / published / archived), as shown in the
 * admin table and the reorder page. Distinct from the STUDENT's per-exam state
 * (locked / owned / in progress …), which lives in `lib/student/status.ts`.
 */
const PUBLISH_STATUS: Record<ExamStatus, { label: string; chipClass: string }> = {
  published: { label: "Dərc edilib", chipClass: "bg-primary/10 text-primary" },
  draft: { label: "Qaralama", chipClass: "bg-secondary text-muted-foreground" },
  archived: { label: "Arxiv", chipClass: "bg-destructive/10 text-destructive" },
};

export function examPublishLabel(status: ExamStatus): string {
  return (PUBLISH_STATUS[status] ?? PUBLISH_STATUS.draft).label;
}

export function examPublishChipClass(status: ExamStatus): string {
  return (PUBLISH_STATUS[status] ?? PUBLISH_STATUS.draft).chipClass;
}

/** Localized price label. 0 → "Pulsuz". Currency comes from the DB. */
export function formatPrice(price: number, currency = "AZN"): string {
  if (price === 0) return "Pulsuz";
  const symbol = currency === "AZN" ? "₼" : currency;
  return currency === "AZN" ? `${price} ${symbol}` : `${price} ${symbol}`;
}

/** "180 dəqiqə" → "3 saat" style human duration. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "Vaxtsız";
  if (minutes < 60) return `${minutes} dəqiqə`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} saat ${m} dəq` : `${h} saat`;
}
