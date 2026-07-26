"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { approvePurchase, denyPurchase } from "@/lib/actions/purchases";
import { ReceiptViewer } from "./ReceiptViewer";
import { formatPrice } from "@/lib/exams/display";
import { formatDate } from "@/lib/format";
import type { AdminPurchase } from "@/lib/admin/purchases";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<AdminPurchase["status"], string> = {
  pending: "Gözləyir",
  approved: "Təsdiqlənib",
  denied: "Rədd edilib",
};
const STATUS_CLASS: Record<AdminPurchase["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  denied: "bg-destructive/10 text-destructive",
};

function studentName(p: AdminPurchase): string {
  const s = p.student;
  if (!s) return "—";
  const full =
    s.full_name ||
    [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
  return full || s.email || "—";
}

export function PurchaseTable({ purchases }: { purchases: AdminPurchase[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function act(p: AdminPurchase, kind: "approve" | "deny") {
    if (kind === "deny" && !window.confirm("Bu sorğunu rədd etmək istəyirsiniz?"))
      return;
    setBusyId(p.id);
    const note = notes[p.id]?.trim() || undefined;
    const res =
      kind === "approve"
        ? await approvePurchase(p.id, note)
        : await denyPurchase(p.id, note);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error);
      router.refresh(); // in case another admin already handled it
      return;
    }
    toast.success(kind === "approve" ? "Təsdiqləndi — giriş verildi" : "Rədd edildi");
    router.refresh();
  }

  if (purchases.length === 0) {
    return (
      <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
        Sorğu yoxdur.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {purchases.map((p) => {
        const pending = p.status === "pending";
        return (
          <div
            key={p.id}
            className="border-border bg-card rounded-xl border p-4 sm:p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {p.student?.student_number && (
                    <span className="bg-secondary text-muted-foreground rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums">
                      #{p.student.student_number}
                    </span>
                  )}
                  <span className="text-foreground font-semibold">
                    {studentName(p)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      STATUS_CLASS[p.status],
                    )}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>

                <div className="text-muted-foreground mt-1.5 space-y-0.5 text-sm">
                  {p.student?.email && <p className="truncate">{p.student.email}</p>}
                  <p>
                    İmtahan:{" "}
                    <span className="text-foreground font-medium">
                      {p.exam?.title ?? p.exam_id}
                    </span>
                  </p>
                  <p>
                    Məbləğ:{" "}
                    <span className="text-foreground font-medium">
                      {formatPrice(Number(p.amount), p.currency)}
                    </span>
                    <span className="mx-1.5">·</span>
                    {formatDate(p.created_at)}
                  </p>
                  {!pending && p.reviewed_at && (
                    <p className="text-xs">
                      Baxıldı: {formatDate(p.reviewed_at)}
                    </p>
                  )}
                  {p.admin_note && (
                    <p className="text-xs italic">Qeyd: {p.admin_note}</p>
                  )}
                </div>

                <div className="mt-3">
                  <ReceiptViewer
                    receiptPath={p.receipt_path}
                    receiptUnavailable={p.receipt_unavailable}
                  />
                </div>
              </div>

              {pending && (
                <div className="w-full shrink-0 space-y-2 lg:w-64">
                  <input
                    value={notes[p.id] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [p.id]: e.target.value }))
                    }
                    placeholder="Qeyd (istəyə bağlı)"
                    className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => act(p, "approve")}
                      disabled={busyId === p.id}
                      className="bg-primary text-primary-foreground hover:bg-primary-hover inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    >
                      {busyId === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                      Təsdiqlə
                    </button>
                    <button
                      type="button"
                      onClick={() => act(p, "deny")}
                      disabled={busyId === p.id}
                      className="border-border text-destructive hover:bg-destructive/10 inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    >
                      <X className="size-4" /> Rədd et
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
