/** Skeleton for admin pages while their (force-dynamic) data loads. */
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-muted h-7 w-52 rounded" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-lg border p-5">
            <div className="bg-muted/70 h-3 w-24 rounded" />
            <div className="bg-muted mt-2 h-8 w-12 rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border bg-card h-16 rounded-xl border" />
        ))}
      </div>
    </div>
  );
}
