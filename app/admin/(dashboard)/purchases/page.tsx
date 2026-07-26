import { getPurchasesAdmin } from "@/lib/admin/purchases";
import { PurchaseTable } from "@/components/admin/PurchaseTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ödənişlər — Admin" };

export default async function AdminPurchasesPage() {
  const all = await getPurchasesAdmin();
  const pending = all.filter((p) => p.status === "pending");
  const reviewed = all.filter((p) => p.status !== "pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="exam-title text-2xl font-bold">Ödəniş sorğuları</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Bank köçürməsini yoxlayıb təsdiqləyin. Təsdiqdən sonra imtahan tələbənin
          panelində avtomatik açılır.
        </p>
      </div>

      <section>
        <h2 className="text-foreground mb-3 text-sm font-semibold">
          Gözləyən sorğular
          {pending.length > 0 && (
            <span className="bg-amber-100 text-amber-800 ml-2 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
              {pending.length}
            </span>
          )}
        </h2>
        <PurchaseTable purchases={pending} />
      </section>

      {reviewed.length > 0 && (
        <section>
          <h2 className="text-muted-foreground mb-3 text-sm font-semibold">
            Baxılmış sorğular
          </h2>
          <PurchaseTable purchases={reviewed} />
        </section>
      )}
    </div>
  );
}
