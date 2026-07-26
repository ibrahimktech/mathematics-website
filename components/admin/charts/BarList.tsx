import { cn } from "@/lib/utils";

/**
 * Horizontal bar ranking (magnitude by identity) — pure HTML/CSS, fully
 * responsive, no dependency. Each row is labeled and value-labeled, so identity
 * never rests on color. Single hue (brand primary) since bars share one series.
 * Native title tooltip on hover. Empty state handled by the caller.
 */
export function BarList({
  items,
}: {
  items: { label: string; value: number; display: string; href?: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((it, i) => {
        const pct = Math.max(2, Math.round((it.value / max) * 100));
        return (
          <li key={i} title={`${it.label}: ${it.display}`}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground min-w-0 flex-1 truncate font-medium">
                {it.label}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {it.display}
              </span>
            </div>
            <div className="bg-secondary mt-1.5 h-2 overflow-hidden rounded-full">
              <div
                className={cn("bg-primary h-full rounded-full")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
