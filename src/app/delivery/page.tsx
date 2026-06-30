import { Suspense } from "react";

import { ContentSkeleton } from "@/components/app-skeleton";
import { PageContainer } from "@/components/page-container";
import { DocketsFilters } from "@/app/dockets/_components/dockets-filters";
import { DocketsList } from "@/app/dockets/_components/dockets-list";

const deliveryStatusOptions = [
  { label: "Booked", value: "BOOKED" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Received", value: "RECEIVED" },
  { label: "Out for Delivery", value: "OUT_FOR_DELIVERY" },
];

export default function DeliveryPage() {
  return (
    <PageContainer className="h-full flex flex-col gap-6 overflow-hidden" maxWidth="full">
      <Suspense fallback={<ContentSkeleton />}>
        <div className="flex h-full flex-col gap-6 overflow-hidden">
          <DocketsFilters
            title="Delivery"
            clearPath="/delivery"
            showNewDocket={false}
            statusOptions={deliveryStatusOptions}
            statusPlaceholder="All Pending"
            defaultStatus={null}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            <DocketsList
              scope="incoming"
              apiPath="/api/v1/shipments/incoming/"
              defaultStatus={null}
              fixedFilters={{ delivery_type: "DOOR" }}
            />
          </div>
        </div>
      </Suspense>
    </PageContainer>
  );
}
