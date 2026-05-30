import { Suspense } from "react";
import { DocketsList } from "./_components/dockets-list";
import { DocketsFilters } from "./_components/dockets-filters";
import { DocketsSkeleton } from "./_components/dockets-skeleton";

export default function DocketsPage() {
  return (
    <div className="w-full h-full flex flex-col bg-card text-card-foreground">
      <div className="bg-card text-card-foreground flex-1 flex flex-col lg:overflow-hidden">
        <div className="px-4 md:px-6 pt-4 pb-0 flex-1 flex flex-col gap-6 lg:overflow-hidden">
          <Suspense fallback={<DocketsSkeleton />}>
            <div className="flex flex-col gap-6 h-full lg:overflow-hidden">
              <DocketsFilters />
              <div className="flex-1 min-h-0 lg:overflow-hidden">
                <DocketsList />
              </div>
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
