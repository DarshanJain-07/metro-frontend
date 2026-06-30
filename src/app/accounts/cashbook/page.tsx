"use client";

import { PageContainer } from "@/components/page-container";
import { CashbookDashboard } from "./_components/cashbook-dashboard";

export default function CashbookPage() {
  return (
    <PageContainer className="h-full flex flex-col gap-6 overflow-hidden" maxWidth="full">
      <CashbookDashboard />
    </PageContainer>
  );
}
