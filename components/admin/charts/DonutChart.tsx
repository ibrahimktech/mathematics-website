"use client";

import { useState } from "react";

/**
 * Category share (part-to-whole) as a donut. Categorical color in fixed order,
 * a 2px surface gap between arcs, and a legend that lists each value + share —
 * so identity and magnitude are both readable without relying on hue. Hovering
 * an arc or legend row emphasizes it and shows its value in the center.
 */
export function DonutChart({
  items,
  formatValue = (n) => String(n),
}: {
  items: { label: string; value: number; color: string }[];
  formatValue?: (n: number) => string;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0);
  const C = 100;
  const R = 82;
  const IR = 52;

  function polar(r: number, ang: number): [number, number] {
    return [C + r * Math.cos(ang), C + r * Math.sin(ang)];
  }
  function arc(a0: number, a1: number): string {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [ox0, oy0] = polar(R, a0);
    const [ox1, oy1] = polar(R, a1);
    const [ix1, iy1] = polar(IR, a1);
    const [ix0, iy0] = polar(IR, a0);
    return `M${ox0.toFixed(2)} ${oy0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)} L${ix1.toFixed(2)} ${iy1.toFixed(2)} A${IR} ${IR} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)} Z`;
  }

  let angle = -Math.PI / 2;
  const segs = items.map((it) => {
    const frac = total > 0 ? it.value / total : 0;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    return { ...it, a0, a1, frac };
  });

  const center =
    hi !== null && segs[hi]
      ? { label: segs[hi].label, value: formatValue(segs[hi].value) }
      : { label: "Cəmi", value: formatValue(total) };

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative shrink-0">
        <svg viewBox="0 0 200 200" className="h-44 w-44" role="img">
          {total === 0 ? (
            <circle cx={C} cy={C} r={(R + IR) / 2} fill="none" stroke="var(--secondary)" strokeWidth={R - IR} />
          ) : (
            segs.map((s, i) => (
              <path
                key={i}
                d={arc(s.a0, s.a1)}
                fill={s.color}
                stroke="var(--card)"
                strokeWidth={2}
                opacity={hi === null || hi === i ? 1 : 0.35}
                onMouseEnter={() => setHi(i)}
                onMouseLeave={() => setHi(null)}
              >
                <title>{`${s.label}: ${formatValue(s.value)} (${Math.round(s.frac * 100)}%)`}</title>
              </path>
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-muted-foreground text-xs">{center.label}</span>
          <span className="exam-title text-foreground text-lg font-bold tabular-nums">
            {center.value}
          </span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {segs.length === 0 && (
          <li className="text-muted-foreground text-sm">Məlumat yoxdur.</li>
        )}
        {segs.map((s, i) => (
          <li
            key={i}
            onMouseEnter={() => setHi(i)}
            onMouseLeave={() => setHi(null)}
            className="flex items-center gap-2.5 text-sm"
          >
            <span
              className="size-3 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="text-foreground min-w-0 flex-1 truncate">{s.label}</span>
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {formatValue(s.value)}
            </span>
            <span className="text-muted-foreground w-10 shrink-0 text-right tabular-nums">
              {Math.round(s.frac * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
