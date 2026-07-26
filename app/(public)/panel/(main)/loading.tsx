/** Lightweight skeleton shown while a dashboard page's data loads (it makes a
 * real per-user request, so an instant skeleton beats a blank frame). */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="bg-muted h-7 w-48 rounded" />
      <div className="bg-muted/70 mt-2 h-4 w-64 rounded" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-xl border p-5">
            <div className="bg-muted h-8 w-14 rounded" />
            <div className="bg-muted/70 mt-2 h-3 w-20 rounded" />
          </div>
        ))}
      </div>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border bg-card h-16 rounded-xl border" />
        ))}
      </div>
    </div>
  );
}
