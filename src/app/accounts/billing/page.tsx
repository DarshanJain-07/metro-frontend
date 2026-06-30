import { Suspense } from "react";
import { BillingList } from "./_components/billing-list";
import { BillingFilters } from "./_components/billing-filters";
import { ContentSkeleton } from "@/components/app-skeleton";
import { PageContainer } from "@/components/page-container";

export default function BillingPage() {
  return (
    <PageContainer className="h-full flex flex-col gap-6 overflow-hidden" maxWidth="full">
      <Suspense fallback={<ContentSkeleton />}>
        <div className="flex flex-col gap-6 h-full overflow-hidden">
          <BillingFilters />
          <div className="flex-1 min-h-0 overflow-hidden">
            <BillingList />
          </div>
        </div>
      </Suspense>
    </PageContainer>
  );
}
