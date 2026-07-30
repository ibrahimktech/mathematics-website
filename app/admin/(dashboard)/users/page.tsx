import { getUsersAdmin } from "@/lib/admin/users";
import { UserTable } from "@/components/admin/UserTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "İstifadəçilər — Admin" };

export default async function AdminUsersPage() {
  const users = await getUsersAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="exam-title text-2xl font-bold">İstifadəçilər</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Qeydiyyatdan keçmiş hesabların siyahısı ({users.length}). Yalnız
          baxış üçündür.
        </p>
      </div>

      <UserTable users={users} />
    </div>
  );
}
