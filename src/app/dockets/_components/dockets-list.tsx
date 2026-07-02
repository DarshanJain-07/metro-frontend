"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Edit, Printer } from "lucide-react";
import { getDockets, type DocketFilters, type DocketListItem } from "../_lib/actions";
import { Pagination } from "./pagination";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { DataTable, DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { docketKeys } from "@/lib/query-keys";

interface DocketsListProps {
  scope?: "outgoing" | "incoming";
  apiPath?: string;
  defaultStatus?: string | null;
  fixedFilters?: Partial<Pick<DocketFilters, "delivery_type">>;
}

export function DocketsList({
  scope = "outgoing",
  apiPath = "/api/v1/shipments/",
  defaultStatus = "BOOKED",
  fixedFilters,
}: DocketsListProps) {
  const { activeMembership, can, isLoading: isAuthLoading } = useAuth();
  const branchId = activeMembership?.branch;
  const canAccessAllBranches = can("*");
  const searchParams = useSearchParams();
  const activeMembershipId = activeMembership?.id;
  const requiresBranchScope = !canAccessAllBranches;
  const contextError =
    !isAuthLoading && (!activeMembershipId || (requiresBranchScope && !branchId))
      ? "Active branch context is required."
      : null;
  const filters: DocketFilters = useMemo(() => {
      const status = searchParams.get("status") || defaultStatus || undefined;
      return {
        page: Number(searchParams.get("page")) || 1,
        page_size: 25,
        scope,
        from_date: searchParams.get("from_date") || undefined,
        to_date: searchParams.get("to_date") || undefined,
        search: searchParams.get("search") || undefined,
        origin_branch: scope === "outgoing" ? branchId || undefined : undefined,
        destination_branch: scope === "incoming" ? branchId || undefined : undefined,
        status,
        ...fixedFilters,
      };
    }, [
      branchId,
      defaultStatus,
      fixedFilters,
      scope,
      searchParams,
    ]);

  const docketListQuery = useQuery({
    queryKey: docketKeys.list(activeMembershipId, apiPath, filters),
    queryFn: async ({ signal }) => {
      const result = await getDockets(filters, { apiPath, signal });
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.error || "Could not load dockets.");
    },
    enabled: !isAuthLoading && !contextError,
    placeholderData: keepPreviousData,
  });

  const data = docketListQuery.data ?? null;
  const rows = data?.results || [];
  const queryError =
    docketListQuery.error instanceof Error ? docketListQuery.error.message : null;
  const error = contextError || queryError;
  const isLoading = isAuthLoading || docketListQuery.isLoading;

  useEffect(() => {
    if (!queryError || queryError === "Authentication session expired.") return;
    toast.error(queryError);
  }, [queryError]);

  const columns: DataTableColumn<DocketListItem>[] = [
    {
      header: "Docket No",
      accessorKey: "docket_no",
      className: "font-mono font-bold",
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
      header: "Consignee",
      accessorKey: "consignee_name",
      className: "truncate max-w-[200px]",
    },
    {
      header: scope === "incoming" ? "Origin" : "Destination",
      accessorKey: scope === "incoming" ? "origin_office_name" : "to_city_name",
      className: "text-muted-foreground truncate",
      width: "150px",
    },
    {
      header: "Status",
      accessorKey: "status",
      width: "140px",
      render: (val) => (
        <Badge variant={val === "BOOKED" ? "success" : val === "CANCELLED" ? "error" : "secondary"}>
          {val as string}
        </Badge>
      ),
    },
    {
      header: "Amount",
      accessorKey: "total_amount",
      className: "text-right font-mono",
      headerClassName: "text-right",
      width: "110px",
      render: (val) =>
        `₹${Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    },
  ];

  if (error) {
    return (
      <Surface padding="lg" className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-16 w-16 bg-red-50 dark:bg-red-950/30 flex items-center justify-center rounded-md">
          <FileText className="h-8 w-8 text-red-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">
            Error Loading Dockets
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
            {error}
          </p>
        </div>
      </Surface>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <DataTable<DocketListItem>
          data={rows}
          columns={columns}
          isLoading={isLoading}
          emptyMessage={
            scope === "incoming"
              ? "No incoming parcels found matching your filters."
              : "No dockets found matching your filters."
          }
          actions={(docket) => {
            const canUpdateDocket =
              docket.available_actions?.includes("shipment:edit") ??
              can("shipment:edit");

            return (
              <div className="flex items-center gap-2 justify-center">
                <Button
                  asChild
                  variant="subtle"
                  size="icon"
                  title={canUpdateDocket ? "Update Docket" : "View Docket"}
                >
                <Link
                  href={`/dockets/${docket.id}`}
                >
                  {canUpdateDocket ? (
                    <Edit className="h-4 w-4 text-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-foreground" />
                  )}
                </Link>
                </Button>
                <Button
                  type="button"
                  variant="subtle"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/dockets/${docket.id}/print`, "_blank");
                  }}
                  title="Print Docket"
                >
                  <Printer className="h-4 w-4 text-foreground" />
                </Button>
              </div>
            );
          }}
        />
      </div>


      <div className="mt-6 pt-4">
        <Pagination
          totalCount={data?.count || 0}
          pageSize={25}
          currentPage={Number(searchParams.get("page")) || 1}
        />
      </div>
    </div>
  );
}
