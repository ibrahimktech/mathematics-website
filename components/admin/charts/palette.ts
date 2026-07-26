/**
 * Categorical chart palette — the data-viz skill's validated reference order
 * (light mode; this app is light-only). Assign in FIXED order, never cycled;
 * a 9th category folds into "Other". Worst adjacent CVD ΔE 9.1 / normal-vision
 * 19.6 on the light surface. Always paired with a legend + value labels, so
 * identity never rests on hue alone.
 */
export const CATEGORICAL = [
  "#2a78d6", // blue
  "#008300", // green
  "#e87ba4", // magenta
  "#eda100", // yellow
  "#1baf7a", // aqua
  "#eb6834", // orange
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

export const OTHER_COLOR = "#9ca3af";

/** Assign colors by rank, folding everything past `keep` into a single "Other". */
export function foldToOther<T extends { value: number }>(
  items: (T & { label: string })[],
  keep = 6,
): { label: string; value: number; color: string }[] {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const head: { label: string; value: number; color: string }[] = sorted
    .slice(0, keep)
    .map((it, i) => ({
      label: it.label,
      value: it.value,
      color: CATEGORICAL[i] ?? OTHER_COLOR,
    }));
  const rest = sorted.slice(keep);
  if (rest.length) {
    head.push({
      label: "Digər",
      value: rest.reduce((s, r) => s + r.value, 0),
      color: OTHER_COLOR,
    });
  }
  return head;
}
