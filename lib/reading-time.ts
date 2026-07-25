/**
 * Estimate reading time in minutes from LaTeX source. Strips commands, math
 * and environments before counting words. Minimum 1 minute.
 */
export function calculateReadingTime(source: string): number {
  const text = source
    .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ") // display math
    .replace(/\\\[[\s\S]*?\\\]/g, " ") // \[ ... \]
    .replace(/\$[^$]*\$/g, " ") // inline math
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, " ") // commands (+ optional arg)
    .replace(/[{}\\&~^_#%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = text ? text.split(" ").filter(Boolean).length : 0;
  return Math.max(1, Math.round(words / 200));
}

/** Localized label, e.g. "5 dəqiqəlik oxuma". */
export function readingTimeLabel(minutes: number): string {
  return `${minutes} dəqiqəlik oxuma`;
}
