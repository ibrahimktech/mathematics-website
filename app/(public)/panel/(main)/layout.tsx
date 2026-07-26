import { DashboardNav } from "@/components/platform/DashboardNav";

/** Wraps the main dashboard pages (overview, exams, results, settings) with the
 * tab nav. The focused exam-taking / results pages live outside this group. */
export default function DashboardMainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <DashboardNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
