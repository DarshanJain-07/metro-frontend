"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompactSelect, FormLabel } from "@/components/ui/form-elements";
import { SearchInput } from "@/components/ui/search-input";
import Link from "next/link";

import { formatDateForInput, formatDateForApi } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth-context";
import { Surface } from "@/components/ui/surface";

interface DocketsFiltersProps {
  title?: string;
  clearPath?: string;
  showNewDocket?: boolean;
  statusOptions?: Array<{ label: string; value: string }>;
  statusPlaceholder?: string;
  defaultStatus?: string | null;
}

const defaultStatusOptions = [
  { label: "Booked", value: "BOOKED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export function DocketsFilters({
  title = "Dockets",
  clearPath = "/dockets?status=BOOKED",
  showNewDocket = true,
  statusOptions = defaultStatusOptions,
  statusPlaceholder = "Select status",
  defaultStatus,
}: DocketsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can } = useAuth();
  const canCreateDockets = can("shipment:create");
  const fallbackStatus = defaultStatus === undefined ? statusOptions[0]?.value || "BOOKED" : defaultStatus;
  const validStatusValues = useMemo(
    () => new Set(statusOptions.map((option) => option.value)),
    [statusOptions],
  );
  const normalizeStatus = useCallback(
    (value: string | null) =>
      value && validStatusValues.has(value) ? value : fallbackStatus || "",
    [fallbackStatus, validStatusValues],
  );

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(normalizeStatus(searchParams.get("status")));
  const [startDate, setStartDate] = useState(formatDateForInput(searchParams.get("from_date") || ""));
  const [endDate, setEndDate] = useState(formatDateForInput(searchParams.get("to_date") || ""));

  // Sync state with URL during render (e.g. on back button or clear)
  // This is the recommended way to sync state from props/external source
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams.toString());
  if (searchParams.toString() !== prevSearchParams) {
    setPrevSearchParams(searchParams.toString());
    setSearch(searchParams.get("search") || "");
    setStatus(normalizeStatus(searchParams.get("status")));
    setStartDate(formatDateForInput(searchParams.get("from_date") || ""));
    setEndDate(formatDateForInput(searchParams.get("to_date") || ""));
  }

  useEffect(() => {
    const urlStatus = searchParams.get("status");
    if (!urlStatus || validStatusValues.has(urlStatus)) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (fallbackStatus) {
      params.set("status", fallbackStatus);
    } else {
      params.delete("status");
    }
    params.set("page", "1");
    router.replace("?" + params.toString());
  }, [fallbackStatus, router, searchParams, validStatusValues]);

  // Unified search function
  const updateFilters = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (updates.search !== undefined) {
      if (updates.search) params.set("search", updates.search);
      else params.delete("search");
    }

    if (updates.status !== undefined) {
      if (updates.status) params.set("status", updates.status);
      else params.delete("status");
    }

    if (updates.from_date !== undefined) {
      const apiDate = formatDateForApi(updates.from_date);
      if (apiDate) params.set("from_date", apiDate);
      else params.delete("from_date");
    }

    if (updates.to_date !== undefined) {
      const apiDate = formatDateForApi(updates.to_date);
      if (apiDate) params.set("to_date", apiDate);
      else params.delete("to_date");
    }
    
    params.set("page", "1");
    router.push("?" + params.toString());
  }, [router, searchParams]);

  // Handle Search Input (as you type)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (searchParams.get("search") || "")) {
        updateFilters({ search });
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [search, searchParams, updateFilters]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title={title}
        description="Manage and track your dockets here."
        actions={showNewDocket && canCreateDockets ? (
          <Link href="/dockets/new" className="shrink-0">
            <Button className="font-semibold">
              <Plus className="h-4 w-4 mr-2" /> New Docket
            </Button>
          </Link>
        ) : null}
      />

      {/* Filter Row: Search and Dates */}
      <Surface className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[300px]">
          <FormLabel>Search Dockets</FormLabel>
          <SearchInput
            placeholder="Search by docket no, party, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="w-44">
          <FormLabel>Status</FormLabel>
          <CompactSelect
            value={status}
            options={statusOptions}
            placeholder={statusPlaceholder}
            onValueChange={(val) => {
              setStatus(val);
              updateFilters({ status: val });
            }}
          />
        </div>

        <div className="w-40">
          <FormLabel>Start Date</FormLabel>
          <DatePicker
            value={startDate}
            onChange={(val) => {
              setStartDate(val);
              updateFilters({ from_date: val });
            }}
            placeholder="Start date"
          />
        </div>
        
        <div className="w-40">
          <FormLabel>End Date</FormLabel>
          <DatePicker
            value={endDate}
            onChange={(val) => {
              setEndDate(val);
              updateFilters({ to_date: val });
            }}
            placeholder="End date"
          />
        </div>

        <Button 
          variant="ghost" 
          onClick={() => {
            setSearch("");
            setStatus(fallbackStatus || "");
            setStartDate("");
            setEndDate("");
            router.push(clearPath);
          }} 
          className="h-9 px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Clear All
        </Button>
      </Surface>
    </div>
  );
}
