import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="w-full h-full flex flex-col">
      <Card className="bg-card border-none shadow-none rounded-[var(--radius)] flex-1 flex flex-col overflow-hidden">
        <div className="p-4 md:p-6 space-y-8">
          <div className="form-grid-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-2 w-12 uber-loader animate-pulse rounded" />
                <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
              </div>
            ))}
          </div>
          <div className="form-grid-2">
            <div className="space-y-4">
              <div className="h-3 w-20 uber-loader animate-pulse rounded" />
              <div className="space-y-2">
                <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
                <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-3 w-20 uber-loader animate-pulse rounded" />
              <div className="space-y-2">
                <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
                <div className="h-8 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-4">
            <div className="h-20 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
          </div>
        </div>
      </Card>
    </div>
  );
}
