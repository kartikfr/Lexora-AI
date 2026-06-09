export default function SkeletonBlock({ lines = 4, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-slate-200 dark:bg-slate-700 rounded"
          style={{ width: `${85 - (i % 3) * 15}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 ${className}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        </div>
      </div>
      <SkeletonBlock lines={3} />
    </div>
  );
}
