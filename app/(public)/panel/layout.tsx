import { requireUser } from "@/lib/account/auth";

export const dynamic = "force-dynamic";

/**
 * Authoritative gate for EVERY /panel/* route (dashboard, exam-taking, results).
 * Anonymous visitors are redirected to login (middleware also does this first,
 * for a faster redirect). RLS in the database is the final enforcement layer.
 * `app-ui` switches this whole area to the readable sans-serif.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/panel");
  return <div className="app-ui">{children}</div>;
}
