"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, PackageCheck, Printer } from "lucide-react";
import { toast } from "sonner";

import {
  getDockets,
  markDelivered,
  receiveDocket,
  type DocketFilters,
  type DocketListItem,
} from "@/app/dockets/_lib/actions";
import { Pagination } from "@/app/dockets/_components/pagination";
import { DataTable, DataTableColumn } from "@/components/data-table";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CompactInput, CompactTextarea, FormLabel } from "@/components/ui/form-elements";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { docketKeys } from "@/lib/query-keys";

interface DeliveryListProps {
  apiPath?: string;
  defaultStatus?: string | null;
  emptyMessage?: string;
  fixedFilters?: Partial<Pick<DocketFilters, "delivery_type">>;
}

type PodFormState = {
  received_by_name: string;
  received_by_phone: string;
  delivery_notes: string;
};

const PAGE_SIZE = 25;
const DEFAULT_DELIVERY_FILTERS = { delivery_type: "DOOR" } as const;

const statusLabels: Record<string, string> = {
  BOOKED: "Booked",
  IN_TRANSIT: "In Transit",
  RECEIVED: "Received",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

function statusVariant(status: string) {
  if (status === "DELIVERED") return "success";
  if (status === "OUT_FOR_DELIVERY") return "info";
  if (status === "RECEIVED") return "warning";
  if (status === "CANCELLED") return "error";
  return "secondary";
}

function money(value?: string | number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
  })}`;
}

export function DeliveryList({
  apiPath = "/api/v1/shipments/incoming/",
  defaultStatus = null,
  emptyMessage = "No delivery dockets found matching your filters.",
  fixedFilters = DEFAULT_DELIVERY_FILTERS,
}: DeliveryListProps) {
  const { activeMembership, can, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const branchId = activeMembership?.branch;
  const activeMembershipId = activeMembership?.id;
  const canAccessAllBranches = can("*");
  const canReceive = can("shipment:receive");
  const requiresBranchScope = !canAccessAllBranches;
  const contextError =
    !isAuthLoading && (!activeMembershipId || (requiresBranchScope && !branchId))
      ? "Active branch context is required."
      : null;
  const [deliveryTarget, setDeliveryTarget] = useState<DocketListItem | null>(null);
  const [podForm, setPodForm] = useState<PodFormState>({
    received_by_name: "",
    received_by_phone: "",
    delivery_notes: "",
  });

  const filters: DocketFilters = useMemo(() => {
    const status = searchParams.get("status") || defaultStatus || undefined;

    return {
      page: Number(searchParams.get("page")) || 1,
      page_size: PAGE_SIZE,
      scope: "incoming",
      from_date: searchParams.get("from_date") || undefined,
      to_date: searchParams.get("to_date") || undefined,
      search: searchParams.get("search") || undefined,
      destination_branch: branchId || undefined,
      status,
      ...fixedFilters,
    };
  }, [branchId, defaultStatus, fixedFilters, searchParams]);
  const effectiveApiPath =
    filters.status === "DELIVERED" ? "/api/v1/shipments/" : apiPath;

  const deliveryQuery = useQuery({
    queryKey: docketKeys.list(activeMembershipId, effectiveApiPath, filters),
    queryFn: async ({ signal }) => {
      const result = await getDockets(filters, { apiPath: effectiveApiPath, signal });
      if (result.success && result.data) return result.data;
      throw new Error(result.error || "Could not load delivery dockets.");
    },
    enabled: !isAuthLoading && !contextError,
    placeholderData: keepPreviousData,
  });

  const receiveMutation = useMutation({
    mutationFn: (docketId: string) => receiveDocket(docketId),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error || "Could not receive docket.");
        return;
      }
      toast.success("Docket received.");
      void queryClient.invalidateQueries({ queryKey: docketKeys.lists() });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: ({
      docketId,
      payload,
    }: {
      docketId: string;
      payload: PodFormState;
    }) =>
      markDelivered(docketId, {
        received_by_name: payload.received_by_name,
        received_by_phone: payload.received_by_phone,
        delivery_notes: payload.delivery_notes || undefined,
      }),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error || "Could not mark docket as delivered.");
        return;
      }
      toast.success("Docket marked delivered.");
      setDeliveryTarget(null);
      void queryClient.invalidateQueries({ queryKey: docketKeys.lists() });
    },
  });

  const rows = deliveryQuery.data?.results || [];
  const queryError =
    deliveryQuery.error instanceof Error ? deliveryQuery.error.message : null;
  const error = contextError || queryError;
  const isLoading = isAuthLoading || deliveryQuery.isLoading;

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
      render: (value) => value || "N/A",
    },
    {
      header: "Date",
      accessorKey: "date",
      className: "text-muted-foreground",
      width: "100px",
      render: (value) => formatDate(value as string),
    },
    {
      header: "Consignee",
      accessorKey: "consignee_name",
      className: "truncate max-w-[180px]",
      width: "180px",
    },
    {
      header: "Origin",
      accessorKey: "origin_office_name",
      className: "truncate text-muted-foreground",
      width: "160px",
    },
    {
      header: "Status",
      accessorKey: "status",
      width: "150px",
      render: (value) => {
        const status = String(value || "");
        return (
          <Badge variant={statusVariant(status)}>
            {statusLabels[status] || status}
          </Badge>
        );
      },
    },
    {
      header: "Amount",
      accessorKey: "total_amount",
      className: "text-right font-mono",
      headerClassName: "text-right",
      width: "120px",
      render: (value) => money(value as string | number),
    },
  ];

  function openDeliveryDialog(docket: DocketListItem) {
    setPodForm({
      received_by_name: docket.consignee_name || "",
      received_by_phone: "",
      delivery_notes: "",
    });
    setDeliveryTarget(docket);
  }

  function submitDelivery() {
    if (!deliveryTarget) return;
    if (!podForm.received_by_name.trim()) {
      toast.error("Receiver name is required.");
      return;
    }
    if (!/^\d{10}$/.test(podForm.received_by_phone.trim())) {
      toast.error("Receiver phone must be exactly 10 digits.");
      return;
    }

    deliverMutation.mutate({
      docketId: String(deliveryTarget.id),
      payload: {
        ...podForm,
        received_by_name: podForm.received_by_name.trim(),
        received_by_phone: podForm.received_by_phone.trim(),
        delivery_notes: podForm.delivery_notes.trim(),
      },
    });
  }

  if (error) {
    return (
      <Surface padding="lg" className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="h-16 w-16 bg-red-50 dark:bg-red-950/30 flex items-center justify-center rounded-md">
          <FileText className="h-8 w-8 text-red-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">
            Error Loading Delivery
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
            {error}
          </p>
        </div>
      </Surface>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 min-h-0 overflow-hidden">
          <DataTable<DocketListItem>
            data={rows}
            columns={columns}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
            actions={(docket) => {
              const canReceiveDocket =
                canReceive &&
                ["BOOKED", "IN_TRANSIT"].includes(docket.status) &&
                (docket.available_actions?.includes("shipment:receive") ?? true);
              const canDeliverDocket =
                canReceive &&
                ["RECEIVED", "OUT_FOR_DELIVERY"].includes(docket.status) &&
                (docket.available_actions?.includes("shipment:receive") ?? true);

              return (
                <div className="flex items-center justify-center gap-2">
                  {canReceiveDocket && (
                    <Button
                      type="button"
                      variant="subtle"
                      size="icon"
                      title="Receive Docket"
                      disabled={receiveMutation.isPending}
                      onClick={() => receiveMutation.mutate(String(docket.id))}
                    >
                      {receiveMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PackageCheck className="h-4 w-4 text-foreground" />
                      )}
                    </Button>
                  )}
                  {canDeliverDocket && (
                    <Button
                      type="button"
                      variant="subtle"
                      size="icon"
                      title="Mark Delivered"
                      onClick={() => openDeliveryDialog(docket)}
                    >
                      <CheckCircle2 className="h-4 w-4 text-foreground" />
                    </Button>
                  )}
                  <Button asChild variant="subtle" size="icon" title="View Docket">
                    <Link href={`/dockets/${docket.id}`}>
                      <FileText className="h-4 w-4 text-foreground" />
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="subtle"
                    size="icon"
                    title="Print Docket"
                    onClick={() => window.open(`/dockets/${docket.id}/print`, "_blank")}
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
            totalCount={deliveryQuery.data?.count || 0}
            pageSize={PAGE_SIZE}
            currentPage={Number(searchParams.get("page")) || 1}
          />
        </div>
      </div>

      <Dialog open={!!deliveryTarget} onOpenChange={(open) => !open && setDeliveryTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Delivered</DialogTitle>
            <DialogDescription>
              Capture proof of delivery for docket {deliveryTarget?.docket_no || "N/A"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <FormLabel>Received By</FormLabel>
              <CompactInput
                value={podForm.received_by_name}
                onChange={(event) =>
                  setPodForm((current) => ({
                    ...current,
                    received_by_name: event.target.value,
                  }))
                }
                placeholder="Receiver name"
              />
            </div>
            <div className="grid gap-1.5">
              <FormLabel>Receiver Phone</FormLabel>
              <CompactInput
                value={podForm.received_by_phone}
                onChange={(event) =>
                  setPodForm((current) => ({
                    ...current,
                    received_by_phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
                placeholder="10 digit mobile"
              />
            </div>
            <div className="grid gap-1.5">
              <FormLabel>Notes</FormLabel>
              <CompactTextarea
                value={podForm.delivery_notes}
                onChange={(event) =>
                  setPodForm((current) => ({
                    ...current,
                    delivery_notes: event.target.value,
                  }))
                }
                placeholder="Optional delivery notes"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="primaryStrong"
              disabled={deliverMutation.isPending}
              onClick={submitDelivery}
            >
              {deliverMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Mark Delivered
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
