"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FileText, CheckCircle2, XCircle, CreditCard, Loader2 } from "lucide-react";
import { getBillingDockets, generateBillForDockets, type DocketsResponse, type DocketListItem } from "../_lib/actions";
import { Pagination } from "./pagination";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { DataTable, DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { useAsyncResource } from "@/hooks/use-async-resource";

function getSelectionKey(queryKey: string, data: DocketsResponse) {
  return `${queryKey}|${data.results.map((row) => row.id).join(",")}`;
}

export function BillingList() {
  const { activeMembership } = useAuth();
  const branchId = activeMembership?.branch;
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const checkboxRef = useRef<HTMLInputElement>(null);
  const lastSelectionKeyRef = useRef<string | null>(null);
  const suppressAutoSelectForKeyRef = useRef<string | null>(null);

  const filters = useMemo(
    () => ({
        page: Number(searchParams.get("page")) || 1,
        page_size: 100, // Show more for billing
        from_date: searchParams.get("from_date") || undefined,
        to_date: searchParams.get("to_date") || undefined,
        search: searchParams.get("search") || undefined,
        customer_id: searchParams.get("customer_id") || undefined,
        show_billed: searchParams.get("show_billed") === "true",
        basis: searchParams.get("basis") || undefined,
        due_only: searchParams.get("due_only") === "true",
        status: "BOOKED",
        origin_branch: branchId || undefined,
      }),
    [searchParams, branchId],
  );
  const billingQueryKey = useMemo(
    () => `${branchId || ""}|${searchParamsString}`,
    [branchId, searchParamsString],
  );

  const {
    data,
    error,
    isLoading,
    refetch,
    setData,
  } = useAsyncResource<DocketsResponse>(
    async ({ signal }) => {
      const result = await getBillingDockets(filters, { signal });
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error || "Could not load billing dockets.");
    },
    { deps: [billingQueryKey] },
  );

  useEffect(() => {
    if (!(error instanceof Error)) return;
    if (error.message !== "Authentication session expired.") {
      toast.error(error.message);
    }
  }, [error]);

  useEffect(() => {
    if (!data) return;

    const nextSelectionKey = getSelectionKey(billingQueryKey, data);
    if (lastSelectionKeyRef.current === nextSelectionKey) return;

    lastSelectionKeyRef.current = nextSelectionKey;
    if (suppressAutoSelectForKeyRef.current === billingQueryKey) {
      suppressAutoSelectForKeyRef.current = null;
      return;
    }

    setSelectedIds(new Set(data.results.map((row) => row.id)));
  }, [billingQueryKey, data]);

  const toggleAll = () => {
    if (selectedIds.size === data?.results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data?.results.map(r => r.id) || []));
    }
  };

  useEffect(() => {
    if (checkboxRef.current) {
      const isSomeSelected = selectedIds.size > 0 && selectedIds.size < (data?.results.length || 0);
      checkboxRef.current.indeterminate = isSomeSelected;
    }
  }, [selectedIds, data]);

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const totalSelectedAmount = useMemo(() => {
    if (!data) return 0;
    return data.results
      .filter(r => selectedIds.has(r.id))
      .reduce((sum, r) => sum + Number(r.total_amount), 0);
  }, [data, selectedIds]);

  const handleGenerateBill = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one docket.");
      return;
    }

    setIsGenerating(true);
    const result = await generateBillForDockets(Array.from(selectedIds), searchParams.get("customer_id") || undefined);
    if (result.success) {
      toast.success(`Bill generated successfully for ${selectedIds.size} dockets.`);
      const refreshResult = await getBillingDockets(filters);
      if (refreshResult.success && refreshResult.data) {
        lastSelectionKeyRef.current = getSelectionKey(
          billingQueryKey,
          refreshResult.data,
        );
        setData(refreshResult.data);
        setSelectedIds(new Set());
      } else {
        suppressAutoSelectForKeyRef.current = billingQueryKey;
        setSelectedIds(new Set());
        refetch();
      }
    } else {
      toast.error(result.error || "Could not generate bill.");
    }
    setIsGenerating(false);
  };

  const columns: DataTableColumn<DocketListItem>[] = [
    {
      header: (
        <div className="flex items-center justify-center h-full w-full">
          <input 
            ref={checkboxRef}
            type="checkbox" 
            checked={data?.results.length ? selectedIds.size === data.results.length : false}
            onChange={toggleAll}
            className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
          />
        </div>
      ),
      accessorKey: "id",
      width: "50px",
      headerClassName: "w-[50px] px-0 text-center sticky left-0 z-30 bg-background",
      className: "px-0 text-center sticky left-0 z-10 bg-background",
      render: (_, row) => (
        <div className="flex items-center justify-center h-full w-full">
          <input 
            type="checkbox" 
            checked={selectedIds.has(row.id)}
            onChange={(e) => {
              e.stopPropagation();
              toggleOne(row.id);
            }}
            className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
          />
        </div>
      )
    },
    {
      header: "Docket No",
      accessorKey: "docket_no",
      className: "font-mono font-medium text-primary",
      width: "120px",
      render: (val) => val || "N/A",
    },
    {
      header: "Date",
      accessorKey: "date",
      className: "text-muted-foreground",
      width: "100px",
      render: (val) => formatDate(val as string),
    },
    {
      header: "Consignor",
      accessorKey: "consignor_name",
      className: "truncate max-w-[200px]",
    },
    {
      header: "Destination",
      accessorKey: "to_city_name",
      className: "text-muted-foreground truncate",
      width: "140px",
    },
    {
      header: "Billed",
      accessorKey: "is_billed",
      width: "80px",
      render: (val) => (
        <div className="flex items-center justify-center">
          {val ? (
            <Badge variant="success" className="h-5 px-1.5"><CheckCircle2 className="h-3 w-3" /></Badge>
          ) : (
            <Badge variant="outline" className="h-5 px-1.5 text-muted-foreground/50 border-border"><XCircle className="h-3 w-3" /></Badge>
          )}
        </div>
      ),
    },
    {
      header: "Payment",
      accessorKey: "payment_status",
      width: "100px",
      render: (val) => (
        <Badge variant={val === "PAID" ? "success" : val === "PARTIAL" ? "secondary" : "error"} className="text-xs">
          {val || "UNPAID"}
        </Badge>
      ),
    },
    {
      header: "Amount",
      accessorKey: "total_amount",
      className: "text-right font-mono text-foreground",
      headerClassName: "text-right",
      width: "110px",
      render: (val) =>
        `₹${Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    },
  ];

  if (error instanceof Error) {
    return (
      <Surface padding="lg" className="flex flex-col items-center justify-center gap-4 border-2 border-dashed p-12 text-center">
        <div className="h-16 w-16 bg-destructive/10 flex items-center justify-center rounded-full">
          <FileText className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Connection Error
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
            {error.message}
          </p>
        </div>
        <Button variant="outline" onClick={refetch}>Try Again</Button>
      </Surface>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden gap-4">
      <Surface className="flex items-center justify-between rounded-md p-4">
        <div className="flex items-center gap-8">
          <div className="flex flex-col">
            <span className="text-label mb-1">Items Selected</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold font-mono">{selectedIds.size}</span>
              <span className="text-label">/ {data?.results.length || 0}</span>
            </div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="flex flex-col">
            <span className="text-label mb-1">Total Billable</span>
            <span className="text-2xl font-semibold font-mono text-success">
              ₹{totalSelectedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <Button 
          onClick={handleGenerateBill} 
          disabled={selectedIds.size === 0 || isGenerating}
          variant="primaryStrong"
          size="xl"
          className="gap-2"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          Generate Bill Now
        </Button>
      </Surface>

      <Surface variant="inset" padding="none" className="flex-1 min-h-0 overflow-hidden relative rounded-md">
        <DataTable<DocketListItem>
          data={data?.results || []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No dockets found matching your filters."
          rowClassName="hover:bg-muted/50 transition-colors"
        />
      </Surface>

      <div className="py-2">
        <Pagination
          totalCount={data?.count || 0}
          pageSize={100}
          currentPage={Number(searchParams.get("page")) || 1}
        />
      </div>
    </div>
  );
}
