import { Suspense } from "react";
import { DocketsList } from "./_components/dockets-list";
import { DocketsFilters } from "./_components/dockets-filters";
import { ContentSkeleton } from "@/components/app-skeleton";
import { PageContainer } from "@/components/page-container";

export default function DocketsPage() {
  return (
    <PageContainer className="h-full flex flex-col gap-6 overflow-hidden" maxWidth="full">
      <Suspense fallback={<ContentSkeleton />}>
        <div className="flex flex-col gap-6 h-full overflow-hidden">
          <DocketsFilters />
          <div className="flex-1 min-h-0 overflow-hidden">
            <DocketsList />
          </div>
        </div>
      </Suspense>
    </PageContainer>
  );
}
