export function DocketsSkeleton() {
  return (
    <div className="flex flex-col gap-6 h-full lg:overflow-hidden">
      {/* Filters Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={i === 2 ? "lg:col-span-2" : ""}>
            <div className="h-3 w-16 uber-loader animate-pulse rounded mb-1" />
            <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
          </div>
        ))}
        <div className="flex gap-2 items-end">
          <div className="h-8 flex-1 uber-loader animate-pulse rounded-[var(--radius)]" />
          <div className="h-8 w-10 uber-loader animate-pulse rounded-[var(--radius)]" />
        </div>
        <div className="lg:col-span-2 flex justify-end items-end">
          <div className="h-8 w-32 uber-loader animate-pulse rounded-[var(--radius)]" />
        </div>
      </div>

      {/* List Skeleton */}
      <div className="flex flex-col h-full lg:overflow-hidden border-t border-border pt-4">
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div 
                key={i} 
                className="h-10 w-full uber-loader animate-pulse rounded-[var(--radius)]"
                style={{ opacity: 1 - i * 0.1 }}
              />
            ))}
          </div>
        </div>
        <div className="pt-2 border-t border-border mt-auto flex justify-center">
          <div className="h-8 w-64 uber-loader animate-pulse rounded-[var(--radius)]" />
        </div>
      </div>
    </div>
  );
}
