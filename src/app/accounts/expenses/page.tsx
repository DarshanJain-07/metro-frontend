"use client";

import { PageContainer } from "@/components/page-container";
import { ExpensesDashboard } from "./_components/expenses-dashboard";

export default function ExpensesPage() {
  return (
    <PageContainer className="h-full flex flex-col gap-6 overflow-hidden" maxWidth="full">
      <ExpensesDashboard />
    </PageContainer>
  );
}
