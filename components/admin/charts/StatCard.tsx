import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KPI tile. The value is a pre-formatted string (currency/number formatted by
 * the caller). Hero figure in ink tokens with tabular figures — never a series
 * color. Kept presentational (no client JS).
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card rounded-xl border p-5",
        accent && "border-primary/30 bg-accent/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{label}</p>
        {Icon && <Icon className="text-muted-foreground/70 size-4 shrink-0" />}
      </div>
      <p className="exam-title text-foreground mt-1.5 text-2xl font-bold tabular-nums">
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
  );
}
