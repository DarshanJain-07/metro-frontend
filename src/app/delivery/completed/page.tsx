import { Suspense } from "react";

import { ContentSkeleton } from "@/components/app-skeleton";
import { PageContainer } from "@/components/page-container";
import { DocketsFilters } from "@/app/dockets/_components/dockets-filters";
import { DeliveryTabs } from "@/app/delivery/_components/delivery-tabs";
import { DeliveryList } from "@/app/delivery/_components/delivery-list";

const statusOptions = [
  { label: "Delivered", value: "DELIVERED" },
];

export default function CompletedDeliveryPage() {
  return (
    <PageContainer className="h-full flex flex-col gap-6 overflow-hidden" maxWidth="full">
      <Suspense fallback={<ContentSkeleton />}>
        <div className="flex h-full flex-col gap-6 overflow-hidden">
          <DocketsFilters
            title="Completed Deliveries"
            clearPath="/delivery/completed?status=DELIVERED"
            showNewDocket={false}
            statusOptions={statusOptions}
            defaultStatus="DELIVERED"
          />
          <DeliveryTabs />
          <div className="min-h-0 flex-1 overflow-hidden">
            <DeliveryList
              apiPath="/api/v1/shipments/"
              defaultStatus="DELIVERED"
              emptyMessage="No completed deliveries found matching your filters."
            />
          </div>
        </div>
      </Suspense>
    </PageContainer>
  );
}
