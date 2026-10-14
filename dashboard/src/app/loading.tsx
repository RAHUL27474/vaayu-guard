// Shown instantly on navigation while a page's server data loads, so clicks
// feel responsive instead of the old page sitting there until the new one
// is ready.
export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-40 rounded bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-200" />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="h-5 w-48 rounded bg-slate-200" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
