import { Suspense } from "react";

import { ContentSkeleton } from "@/components/app-skeleton";
import { PageContainer } from "@/components/page-container";
import { DocketsFilters } from "@/app/dockets/_components/dockets-filters";
import { DocketsList } from "@/app/dockets/_components/dockets-list";

const incomingStatusOptions = [
  { label: "Booked", value: "BOOKED" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Received", value: "RECEIVED" },
  { label: "Out for Delivery", value: "OUT_FOR_DELIVERY" },
];

export default function IncomingParcelsPage() {
  return (
    <PageContainer className="h-full flex flex-col gap-6 overflow-hidden" maxWidth="full">
      <Suspense fallback={<ContentSkeleton />}>
        <div className="flex h-full flex-col gap-6 overflow-hidden">
          <DocketsFilters
            title="Incoming Parcels"
            clearPath="/incoming-parcels?status=BOOKED"
            showNewDocket={false}
            statusOptions={incomingStatusOptions}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            <DocketsList scope="incoming" apiPath="/api/v1/shipments/incoming/" />
          </div>
        </div>
      </Suspense>
    </PageContainer>
  );
}
