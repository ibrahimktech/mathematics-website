import { formatMoney, formatBakuDate, formatBakuTime } from "@/lib/format";
import type { AdminPurchase } from "@/lib/admin/purchases";
import { cn } from "@/lib/utils";

const STATUS: Record<AdminPurchase["status"], { label: string; cls: string }> = {
  pending: { label: "Gözləyir", cls: "bg-amber-50 text-amber-700" },
  approved: { label: "Təsdiqlənib", cls: "bg-emerald-50 text-emerald-700" },
  denied: { label: "Rədd edilib", cls: "bg-destructive/10 text-destructive" },
};

function name(p: AdminPurchase): string {
  const s = p.student;
  if (!s) return "—";
  return (
    s.full_name ||
    [s.first_name, s.last_name].filter(Boolean).join(" ").trim() ||
    s.email ||
    "—"
  );
}

/** Read-only recent purchases. All timestamps are Asia/Baku (never UTC). */
export function RecentPurchasesTable({
  purchases,
}: {
  purchases: AdminPurchase[];
}) {
  if (purchases.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
        Hələ satış yoxdur.
      </div>
    );
  }
  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
            <th className="px-4 py-3 font-semibold">Tələbə</th>
            <th className="px-4 py-3 font-semibold">E-poçt</th>
            <th className="px-4 py-3 font-semibold">İmtahan</th>
            <th className="px-4 py-3 font-semibold">Məbləğ</th>
            <th className="px-4 py-3 font-semibold">Tarix</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">ID</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {purchases.map((p) => {
            const st = STATUS[p.status];
            return (
              <tr key={p.id} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.student?.student_number && (
                      <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                        #{p.student.student_number}
                      </span>
                    )}
                    <span className="text-foreground font-medium">{name(p)}</span>
                  </div>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  <span className="block max-w-[14rem] truncate">
                    {p.student?.email ?? "—"}
                  </span>
                </td>
                <td className="text-muted-foreground px-4 py-3">
                  {p.exam?.title ?? "—"}
                </td>
                <td className="text-foreground px-4 py-3 font-semibold tabular-nums">
                  {formatMoney(Number(p.amount), p.currency)}
                </td>
                <td className="text-muted-foreground px-4 py-3 tabular-nums">
                  {formatBakuDate(p.created_at)}{" "}
                  <span className="text-muted-foreground/70">
                    {formatBakuTime(p.created_at)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      st.cls,
                    )}
                  >
                    {st.label}
                  </span>
                </td>
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                  {p.id.slice(0, 8)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
