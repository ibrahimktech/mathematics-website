"use client";

import { useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

/**
 * Single-series time trend (change-over-time). Responsive SVG with a fixed
 * viewBox; the 2px line uses a non-scaling stroke so it stays crisp at any
 * width. Single hue (brand primary) → no legend needed; the card title names it.
 * Ships a hover crosshair + tooltip (interaction default for HTML/SVG charts).
 *
 * `format` is a plain string (not a function) so this Client Component can be
 * used from Server Components without a non-serializable prop.
 */
export function LineChart({
  labels,
  values,
  format = "number",
  height = 240,
}: {
  labels: string[];
  values: number[];
  format?: "money" | "number";
  height?: number;
}) {
  const formatValue = (n: number) => (format === "money" ? formatMoney(n) : String(n));
  const W = 900;
  const H = height;
  const padL = 6;
  const padR = 6;
  const padT = 14;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = values.length;
  const max = Math.max(1, ...values);

  const x = (i: number) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const pts = values.map((v, i) => [x(i), y(v)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = n
    ? `${line} L${x(n - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
    : "";

  const grid = [0, 0.5, 1];
  const tickIdx = new Set<number>();
  if (n) {
    const step = Math.max(1, Math.ceil(n / 6));
    for (let i = 0; i < n; i += step) tickIdx.add(i);
    tickIdx.add(n - 1);
  }

  const ref = useRef<SVGSVGElement>(null);
  const [hi, setHi] = useState<number | null>(null);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el || n === 0) return;
    const r = el.getBoundingClientRect();
    const vbx = ((e.clientX - r.left) / r.width) * W;
    const idx = Math.max(0, Math.min(n - 1, Math.round(((vbx - padL) / plotW) * (n - 1))));
    setHi(idx);
  }

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        onMouseMove={onMove}
        onMouseLeave={() => setHi(null)}
      >
        {grid.map((f, i) => {
          const gy = padT + plotH - f * plotH;
          return (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={gy}
                y2={gy}
                stroke="var(--border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text x={padL} y={gy - 4} fontSize={12} fill="var(--muted-foreground)">
                {formatValue(Math.round(max * f))}
              </text>
            </g>
          );
        })}

        {area && <path d={area} fill="var(--primary)" fillOpacity={0.08} />}
        {n > 1 && (
          <path
            d={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* x labels */}
        {[...tickIdx].sort((a, b) => a - b).map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            fontSize={12}
            fill="var(--muted-foreground)"
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          >
            {labels[i]}
          </text>
        ))}

        {/* hover */}
        {hi !== null && (
          <>
            <line
              x1={x(hi)}
              x2={x(hi)}
              y1={padT}
              y2={padT + plotH}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(hi)} cy={y(values[hi])} r={4} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}
      </svg>

      {hi !== null && (
        <div
          className="border-border bg-popover pointer-events-none absolute -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${(x(hi) / W) * 100}%`, top: 0 }}
        >
          <div className="text-muted-foreground">{labels[hi]}</div>
          <div className="text-foreground font-semibold tabular-nums">
            {formatValue(values[hi])}
          </div>
        </div>
      )}
    </div>
  );
}
