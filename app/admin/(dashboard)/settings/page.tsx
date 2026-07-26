import { getPlatformSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ödəniş tənzimləmələri — Admin" };

export default async function AdminSettingsPage() {
  const settings = await getPlatformSettings();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="exam-title text-2xl font-bold">Ödəniş tənzimləmələri</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Tələbələrə ödəniş səhifəsində göstərilən bank rekvizitləri.
        </p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
