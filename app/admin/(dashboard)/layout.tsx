import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Verified per-request (not statically), so the admin gate always runs.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative server-side gate for every page in the (dashboard) group:
  // not signed in → /daxil-ol; signed in but not an admin → /.
  await requireAdminPage();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
