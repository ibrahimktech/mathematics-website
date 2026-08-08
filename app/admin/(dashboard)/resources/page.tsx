import { getResources } from "@/lib/resources";
import { getCategories } from "@/lib/categories";
import { ResourceManager } from "@/components/admin/ResourceManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resurslar — Admin" };

/**
 * The teacher's PDF library. The `(dashboard)` layout has already run
 * `requireAdminPage()`, and every write below is re-checked against
 * `is_admin()` in the server action AND in RLS — this page is only the UI.
 */
export default async function AdminResourcesPage() {
  const [resources, categories] = await Promise.all([
    getResources(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="exam-title text-2xl font-bold">Resurslar</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          PDF kitab və materiallar. Bütün qeydiyyatdan keçmiş tələbələr onları
          panelində oxuya və yükləyə bilər.
        </p>
      </div>

      <ResourceManager resources={resources} categories={categories} />
    </div>
  );
}
