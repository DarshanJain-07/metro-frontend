"use client";

import { useState, useEffect, useMemo } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { 
  Loader2, 
  IndianRupee,
  Calendar as CalendarIcon,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Surface } from "@/components/ui/surface";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useAuth } from "@/lib/auth-context";
import { cashbookKeys } from "@/lib/query-keys";

interface CashbookSummary {
  opening_balance: number;
  total_income: number;
  total_expense: number;
  closing_balance: number;
}

interface DailyRecord {
  date: string;
  opening_balance: number;
  income: number;
  expense: number;
  closing_balance: number;
}

interface CashbookData {
  summary: CashbookSummary;
  daily_records: DailyRecord[];
}

export function CashbookDashboard() {
  const { activeMembership } = useAuth();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });
  const activeMembershipId = activeMembership?.id;

  const formattedRange = useMemo(() => {
    const fromStr = format(dateRange.from, "yyyy-MM-dd");
    const toStr = format(dateRange.to, "yyyy-MM-dd");
    return { from: fromStr, to: toStr };
  }, [dateRange]);

  const { data, error, isLoading } = useQuery<CashbookData>({
    queryKey: cashbookKeys.range(
      activeMembershipId,
      formattedRange.from,
      formattedRange.to,
    ),
    queryFn: async ({ signal }) => {
      const res = await fetchWithAuth(
        `/api/v1/accounts/cashbook/?start_date=${formattedRange.from}&end_date=${formattedRange.to}`,
        { signal },
      );
      if (res.status === 401) {
        throw new Error("Authentication session expired.");
      }
      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not load cashbook data."));
      }
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!(error instanceof Error)) return;
    if (error.message !== "Authentication session expired.") {
      toast.error(error.message);
    }
  }, [error]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Cashbook"
        description="Daily income and expense tracking with rolling balances."
        actions={
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger className={cn(buttonVariants({ variant: "outline" }), "h-9 font-semibold")}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                {format(dateRange.from, "MMM d")} - {format(dateRange.to, "MMM d, yyyy")}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range: DateRange | undefined) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Button 
              variant="secondary" 
              className="h-9"
              onClick={() => {
                void queryClient.invalidateQueries({
                  queryKey: cashbookKeys.range(
                    activeMembershipId,
                    formattedRange.from,
                    formattedRange.to,
                  ),
                });
              }}
            >
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <SummaryCard 
            label="Opening Balance" 
            value={data?.summary.opening_balance || 0} 
            icon={Wallet}
            description={`As of ${format(dateRange.from, "MMM d, yyyy")}`}
          />
          <SummaryCard 
            label="Total Income" 
            value={data?.summary.total_income || 0} 
            icon={ArrowUpCircle}
            valueClassName="text-success"
            description="Bookings & Receipts"
          />
          <SummaryCard 
            label="Total Expense" 
            value={data?.summary.total_expense || 0} 
            icon={ArrowDownCircle}
            valueClassName="text-destructive"
            description="Operational Costs"
          />
          <SummaryCard 
            label="Closing Balance" 
            value={data?.summary.closing_balance || 0} 
            icon={IndianRupee}
            description={`As of ${format(dateRange.to, "MMM d, yyyy")}`}
          />
        </div>

        <Surface variant="elevated" padding="none" className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
              </div>
            ) : (
              <Table>
                <TableHeader sticky>
                  <TableRow>
                    <TableHead className="w-[20%]">Date</TableHead>
                    <TableHead className="w-[20%] text-right">Opening</TableHead>
                    <TableHead className="w-[20%] text-right">Income</TableHead>
                    <TableHead className="w-[20%] text-right">Expense</TableHead>
                    <TableHead className="w-[20%] text-right">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.daily_records.map((record) => (
                    <TableRow key={record.date}>
                      <TableCell className="font-medium text-sm">
                        {format(new Date(record.date), "MMM d, yyyy (EEE)")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm opacity-60">
                        ₹{Number(record.opening_balance).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-sm text-success">
                        +₹{Number(record.income).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-sm text-destructive">
                        -₹{Number(record.expense).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-sm text-foreground">
                        ₹{Number(record.closing_balance).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data || data.daily_records.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground/30">
                          <IndianRupee className="h-10 w-10" />
                          <p className="text-sm font-medium">No records found for this period</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Surface>
      </div>
    </div>
  );
}

function SummaryCard({ 
  label, 
  value, 
  icon: Icon, 
  className,
  valueClassName,
  variant,
  description 
}: { 
  label: string; 
  value: number; 
  icon: LucideIcon; 
  className?: string;
  valueClassName?: string;
  variant?: "default" | "primary";
  description?: string;
}) {
  const isPrimary = variant === "primary" || className?.includes("bg-primary");

  return (
    <Surface
      variant={isPrimary ? "primary" : "elevated"}
      padding="none"
      className={cn(
        "p-5 flex flex-col gap-3",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-label opacity-60",
          isPrimary ? "text-primary-foreground" : ""
        )}>{label}</span>
        <Icon className={cn(
          "h-4 w-4 opacity-40",
          isPrimary ? "text-primary-foreground" : ""
        )} />
      </div>
      <div className="flex flex-col">
        <span className={cn(
          "text-2xl font-semibold tracking-tight leading-none",
          isPrimary ? "text-primary-foreground" : valueClassName
        )}>
          ₹{Number(value).toLocaleString()}
        </span>
        {description && (
          <span className={cn(
            "text-label mt-2 opacity-40",
            isPrimary ? "text-primary-foreground" : ""
          )}>{description}</span>
        )}
      </div>
    </Surface>
  );
}
