"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AdminUser } from "@/lib/admin/users";

/** Read-only account list with a client-side filter over name / surname / email. */
export function UserTable({ users }: { users: AdminUser[] }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("az");
    if (!q) return users;
    return users.filter((u) =>
      [u.firstName, u.lastName, u.email]
        .join(" ")
        .toLocaleLowerCase("az")
        .includes(q),
    );
  }, [users, query]);

  return (
    <div className="space-y-4">
      <div className="group relative max-w-md">
        <Search className="text-muted-foreground group-focus-within:text-primary pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 transition-colors" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ad, soyad və ya e-poçt üzrə axtar…"
          aria-label="İstifadəçi axtar"
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 h-10 w-full rounded-md border pr-4 pl-10 text-sm outline-none focus-visible:ring-[3px]"
        />
      </div>

      {rows.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          {users.length === 0
            ? "Hələ qeydiyyatdan keçən istifadəçi yoxdur."
            : "Axtarışa uyğun istifadəçi tapılmadı."}
        </div>
      ) : (
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
                <th className="px-4 py-3 font-semibold">Ad</th>
                <th className="px-4 py-3 font-semibold">Soyad</th>
                <th className="px-4 py-3 font-semibold">E-poçt</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-muted/40">
                  <td className="text-foreground px-4 py-3 font-medium">
                    {u.firstName || "—"}
                  </td>
                  <td className="text-foreground px-4 py-3">{u.lastName || "—"}</td>
                  <td className="text-muted-foreground px-4 py-3">{u.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
