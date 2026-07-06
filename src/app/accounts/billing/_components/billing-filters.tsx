"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CreditCard, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormLabel } from "@/components/ui/form-elements";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import { formatDateForInput, formatDateForApi } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { PageHeader } from "@/components/page-header";
import { ImportExportActions } from "@/components/import-export-actions";
import { getParties } from "../_lib/actions";
import { Surface } from "@/components/ui/surface";
import { useAuth } from "@/lib/auth-context";
import { billingKeys, masterKeys } from "@/lib/query-keys";

type Party = {
  id: string;
  name: string;
};

type PartyOption = {
  label: string;
  value: string;
};

export function BillingFilters() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { activeMembership, can } = useAuth();

  const customerId = searchParams.get("customer_id") || "";
  const startDate = formatDateForInput(searchParams.get("from_date") || "");
  const endDate = formatDateForInput(searchParams.get("to_date") || "");

  const { data: loadedParties } = useQuery<Party[]>({
    queryKey: masterKeys.parties(activeMembership?.id),
    queryFn: async ({ signal }) => {
      const result = await getParties({ signal });
      if (result.success) return result.data;
      throw new Error(result.error || "Could not load parties.");
    },
    initialData: [] as Party[],
  });
  const parties = loadedParties ?? [];
  const partyOptions: PartyOption[] = parties.map(p => ({ label: p.name, value: p.id }));
  const selectedCustomer = partyOptions.find(opt => opt.value === customerId) || null;

  const updateFilters = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key === "from_date" || key === "to_date") {
        const apiDate = value ? formatDateForApi(value) : null;
        if (apiDate) params.set(key, apiDate);
        else params.delete(key);
      } else if (value !== null && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    
    params.set("page", "1");
    router.push("?" + params.toString());
  }, [router, searchParams]);

  const setLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    updateFilters({ 
      from_date: startStr, 
      to_date: endStr 
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Billing Dashboard"
        description="Automate your customer billing with one-click generation."
        actions={
          <ImportExportActions
            title="Invoices"
            apiPath="/api/v1/accounts/invoices/"
            canImport={can("invoice:create")}
            onImported={() => {
              void queryClient.invalidateQueries({ queryKey: billingKeys.all });
            }}
          />
        }
      />

      <Surface className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="min-w-[300px] flex-1 lg:flex-[2]">
          <FormLabel className="mb-1.5 block flex items-center gap-2">
            <CreditCard className="h-3.5 w-3.5" />
            Select Customer
          </FormLabel>
          <Combobox
            items={partyOptions}
            value={selectedCustomer}
            onValueChange={(val: PartyOption | null) => {
              const newId = val?.value || "";
              updateFilters({ customer_id: newId });
            }}
            itemToStringLabel={(item: PartyOption | null) => item?.label || ""}
            itemToStringValue={(item: PartyOption | null) => item?.value || ""}
            isItemEqualToValue={(item: PartyOption | null, value: PartyOption | null) => item?.value === value?.value}
          >
            <ComboboxInput 
              placeholder="Search customers..." 
              className="h-10 font-medium border-border"
              showClear
            />
            <ComboboxContent>
              <ComboboxList>
                {(opt: PartyOption) => (
                  <ComboboxItem key={opt.value} value={opt}>
                    {opt.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>

        <div className="w-44">
          <FormLabel className="mb-1.5 block flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            From Date
          </FormLabel>
          <DatePicker
            value={startDate}
            onChange={(val) => {
              updateFilters({ from_date: val });
            }}
            placeholder="Start date"
          />
        </div>
        
        <div className="w-44">
          <FormLabel className="mb-1.5 block flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            To Date
          </FormLabel>
          <DatePicker
            value={endDate}
            onChange={(val) => {
              updateFilters({ to_date: val });
            }}
            placeholder="End date"
          />
        </div>

        <div className="flex items-center gap-2 pb-0.5">
          <Button 
            variant="outline" 
            size="sm"
            onClick={setLast30Days}
            className="h-9 px-4 gap-2 font-medium w-fit shadow-sm"
          >
            <Clock className="h-3.5 w-3.5 text-primary" />
            Last 30 Days
          </Button>

          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              router.push("/accounts/billing");
            }} 
            className="h-9 px-4 gap-2 text-muted-foreground hover:text-foreground w-fit font-medium"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </Surface>

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <Button
          variant={searchParams.get("show_billed") === "true" ? "default" : "secondary"}
          size="sm"
          onClick={() => updateFilters({ show_billed: searchParams.get("show_billed") === "true" ? null : "true" })}
          className="rounded-full px-4 h-8 text-xs font-medium"
        >
          Show Billed
        </Button>
        <Button
          variant={searchParams.get("basis") === "TBB" ? "default" : "secondary"}
          size="sm"
          onClick={() => updateFilters({ basis: searchParams.get("basis") === "TBB" ? null : "TBB" })}
          className="rounded-full px-4 h-8 text-xs font-medium"
        >
          TBB Shipments
        </Button>
        <Button
          variant={searchParams.get("due_only") === "true" ? "default" : "secondary"}
          size="sm"
          onClick={() => updateFilters({ due_only: searchParams.get("due_only") === "true" ? null : "true" })}
          className="rounded-full px-4 h-8 text-xs font-medium"
        >
          Payment Due
        </Button>
      </div>
    </div>
  );
}
