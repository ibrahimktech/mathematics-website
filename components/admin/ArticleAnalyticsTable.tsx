"use client";

import { useState } from "react";
import Link from "next/link";
import { formatBakuDate, formatBakuDateTime } from "@/lib/format";
import type { ArticleAnalytics } from "@/lib/analytics/queries";

type Sort = "most" | "least" | "newest" | "oldest";
const SORTS: { value: Sort; label: string }[] = [
  { value: "most", label: "Ən çox baxılan" },
  { value: "least", label: "Ən az baxılan" },
  { value: "newest", label: "Ən yeni" },
  { value: "oldest", label: "Ən köhnə" },
];

export function ArticleAnalyticsTable({ articles }: { articles: ArticleAnalytics[] }) {
  const [sort, setSort] = useState<Sort>("most");

  const rows = [...articles].sort((a, b) => {
    switch (sort) {
      case "least":
        return a.totalViews - b.totalViews;
      case "newest":
        return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
      case "oldest":
        return (a.publishedAt ?? "").localeCompare(b.publishedAt ?? "");
      default:
        return b.totalViews - a.totalViews;
    }
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-foreground text-lg font-semibold">Məqalə statistikası</h2>
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
          Hələ məqalə yoxdur.
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-semibold">Məqalə</th>
                <th className="px-4 py-3 font-semibold">Kateqoriya</th>
                <th className="px-4 py-3 font-semibold">Dərc</th>
                <th className="px-4 py-3 font-semibold">Baxış</th>
                <th className="px-4 py-3 font-semibold">Unikal</th>
                <th className="px-4 py-3 font-semibold">Təkrar</th>
                <th className="px-4 py-3 font-semibold">Oxu</th>
                <th className="px-4 py-3 font-semibold">Son baxış</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((a) => (
                <tr key={a.postId} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/articles/${a.postId}/edit`}
                      className="text-foreground hover:text-primary font-medium"
                    >
                      {a.title}
                    </Link>
                    {a.status !== "published" && (
                      <span className="bg-secondary text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        qaralama
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">{a.categoryName}</td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {a.publishedAt ? formatBakuDate(a.publishedAt) : "—"}
                  </td>
                  <td className="text-foreground px-4 py-3 font-semibold tabular-nums">
                    {a.totalViews}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {a.uniqueVisitors}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {a.returningVisitors}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {a.readingTime} dəq
                  </td>
                  <td className="text-muted-foreground px-4 py-3 tabular-nums">
                    {a.lastViewedAt ? formatBakuDateTime(a.lastViewedAt) : "—"}
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
