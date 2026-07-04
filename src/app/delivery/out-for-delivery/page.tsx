import { Suspense } from "react";

import { ContentSkeleton } from "@/components/app-skeleton";
import { PageContainer } from "@/components/page-container";
import { DocketsFilters } from "@/app/dockets/_components/dockets-filters";
import { DeliveryTabs } from "@/app/delivery/_components/delivery-tabs";
import { DeliveryList } from "@/app/delivery/_components/delivery-list";

const statusOptions = [
  { label: "Out for Delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Received", value: "RECEIVED" },
];

export default function OutForDeliveryPage() {
  return (
    <PageContainer className="h-full flex flex-col gap-6 overflow-hidden" maxWidth="full">
      <Suspense fallback={<ContentSkeleton />}>
        <div className="flex h-full flex-col gap-6 overflow-hidden">
          <DocketsFilters
            title="Out for Delivery"
            clearPath="/delivery/out-for-delivery?status=OUT_FOR_DELIVERY"
            showNewDocket={false}
            statusOptions={statusOptions}
            defaultStatus="OUT_FOR_DELIVERY"
          />
          <DeliveryTabs />
          <div className="min-h-0 flex-1 overflow-hidden">
            <DeliveryList
              defaultStatus="OUT_FOR_DELIVERY"
              emptyMessage="No out-for-delivery dockets found matching your filters."
            />
          </div>
        </div>
      </Suspense>
    </PageContainer>
  );
}
