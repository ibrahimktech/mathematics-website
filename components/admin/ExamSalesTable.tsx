"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { formatMoney, formatBakuDate } from "@/lib/format";
import { formatPrice } from "@/lib/exams/display";
import type { ExamSale } from "@/lib/analytics/queries";

type Sort = "sold" | "revenue" | "newest" | "oldest";
const SORTS: { value: Sort; label: string }[] = [
  { value: "sold", label: "Ən çox satılan" },
  { value: "revenue", label: "Ən yüksək gəlir" },
  { value: "newest", label: "Ən yeni" },
  { value: "oldest", label: "Ən köhnə" },
];

export function ExamSalesTable({ sales }: { sales: ExamSale[] }) {
  const [sort, setSort] = useState<Sort>("sold");

  const rows = [...sales].sort((a, b) => {
    switch (sort) {
      case "revenue":
        return b.revenue - a.revenue;
      case "newest":
        return b.createdAt.localeCompare(a.createdAt);
      case "oldest":
        return a.createdAt.localeCompare(b.createdAt);
      default:
        return b.purchaseCount - a.purchaseCount || b.revenue - a.revenue;
    }
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-foreground text-lg font-semibold">İmtahan satışları</h2>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sırala"
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          Hələ imtahan yoxdur.
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">İmtahan</th>
                <th className="px-4 py-3 font-semibold">Kateqoriya</th>
                <th className="px-4 py-3 font-semibold">Qiymət</th>
                <th className="px-4 py-3 font-semibold">Satış</th>
                <th className="px-4 py-3 font-semibold">Gəlir</th>
                <th className="px-4 py-3 font-semibold">Son satış</th>
                <th className="px-4 py-3 font-semibold">Aktiv</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((e) => (
                <tr key={e.examId} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/exams/${e.examId}/edit`}
                      className="text-foreground hover:text-primary font-medium"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{e.categoryName}</td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {formatPrice(e.price, e.currency)}
                  </td>
                  <td className="text-foreground px-4 py-3 font-semibold tabular-nums">
                    {e.purchaseCount}
                  </td>
                  <td className="text-foreground px-4 py-3 font-semibold tabular-nums">
                    {formatMoney(e.revenue, e.currency)}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {e.lastPurchaseAt ? formatBakuDate(e.lastPurchaseAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {e.active ? (
                      <Check className="size-4 text-emerald-600" />
                    ) : (
                      <Minus className="text-muted-foreground size-4" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
