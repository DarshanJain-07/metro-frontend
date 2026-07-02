"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Loader2, 
  Building2,
  List,
  IndianRupee,
  Search,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ExpenseEntryDialog } from "./expense-entry-dialog";
import { PageHeader } from "@/components/page-header";
import { Calendar } from "@/components/ui/calendar";
import { Surface } from "@/components/ui/surface";
import { useAuth } from "@/lib/auth-context";
import { expenseKeys } from "@/lib/query-keys";

interface DailySummary {
  date: string;
  branch_count: number;
  total_amount: number;
  entry_count: number;
}

interface BranchSummary {
  date: string;
  office: string;
  office__name: string;
  total_amount: number;
  entry_count: number;
}

interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  notes: string;
  office: string;
}

const EMPTY_DAILY_SUMMARIES: DailySummary[] = [];
const EMPTY_BRANCH_SUMMARIES: BranchSummary[] = [];
const EMPTY_EXPENSES: ExpenseItem[] = [];

export function ExpensesDashboard() {
  const { activeMembership } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const activeMembershipId = activeMembership?.id;

  const formattedDate = useMemo(() => {
    if (!selectedDate) return "";
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);

  const {
    data: loadedDailySummaries,
    error: dailySummariesError,
  } = useQuery<DailySummary[]>({
    queryKey: expenseKeys.dailySummary(activeMembershipId),
    queryFn: async ({ signal }) => {
      const res = await fetchWithAuth("/api/v1/accounts/expenses/daily-summary/", {
        signal,
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not load daily expense summaries."));
      }
      return res.json();
    },
    initialData: [] as DailySummary[],
  });
  const dailySummaries = loadedDailySummaries ?? EMPTY_DAILY_SUMMARIES;

  const {
    data: loadedBranchSummaries,
    error: branchSummariesError,
    isLoading: isLoadingBranches,
  } = useQuery<BranchSummary[]>({
    queryKey: expenseKeys.branchSummary(activeMembershipId, formattedDate),
    queryFn: async ({ signal }) => {
      const res = await fetchWithAuth(
        `/api/v1/accounts/expenses/summary/?date=${formattedDate}`,
        { signal },
      );
      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not load branch summaries."));
      }
      return res.json();
    },
    enabled: Boolean(formattedDate),
    initialData: [] as BranchSummary[],
  });
  const branchSummaries = loadedBranchSummaries ?? EMPTY_BRANCH_SUMMARIES;

  const effectiveSelectedBranchId = useMemo(() => {
    if (!formattedDate || branchSummaries.length === 0) return null;
    if (
      selectedBranchId &&
      branchSummaries.some((branch) => branch.office === selectedBranchId)
    ) {
      return selectedBranchId;
    }
    return branchSummaries[0].office;
  }, [branchSummaries, formattedDate, selectedBranchId]);

  const selectedBranch = useMemo(
    () => branchSummaries.find((branch) => branch.office === effectiveSelectedBranchId),
    [branchSummaries, effectiveSelectedBranchId],
  );

  const {
    data: loadedExpenses,
    error: expensesError,
    isLoading: isLoadingEntries,
  } = useQuery<ExpenseItem[]>({
    queryKey: expenseKeys.list(
      activeMembershipId,
      formattedDate,
      effectiveSelectedBranchId,
    ),
    queryFn: async ({ signal }) => {
      const res = await fetchWithAuth(
        `/api/v1/accounts/expenses/?date=${formattedDate}&office=${effectiveSelectedBranchId}&limit=1000`,
        { signal },
      );
      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not load expenses."));
      }
      const json = await res.json();
      return json.results || json;
    },
    enabled: Boolean(formattedDate && effectiveSelectedBranchId),
    initialData: [] as ExpenseItem[],
  });
  const expenses = loadedExpenses ?? EMPTY_EXPENSES;

  useEffect(() => {
    [dailySummariesError, branchSummariesError, expensesError].forEach((error) => {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    });
  }, [dailySummariesError, branchSummariesError, expensesError]);

  const currentDayStats = dailySummaries.find(s => s.date === formattedDate);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Expenses"
        description="Unified view of branch-wise daily maintenance and office costs."
        actions={
          <Button 
            className="h-9 font-medium"
            onClick={() => setIsEntryDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        }
      />

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Pane 1: Calendar & Global Stats (Left) */}
        <div className="w-[300px] flex flex-col gap-6 shrink-0 overflow-y-auto pb-6">
          <Surface variant="elevated" padding="none" className="overflow-hidden">
            <div className="flex justify-center p-2">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="mx-auto max-w-full p-1 [--cell-size:--spacing(7)] bg-transparent border-none shadow-none"
                modifiers={{
                  hasData: (date) => {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const d = `${year}-${month}-${day}`;
                    return dailySummaries.some(s => s.date === d);
                  }
                }}
                modifiersClassNames={{
                  hasData: "font-semibold text-primary underline decoration-2 underline-offset-4"
                }}
              />
            </div>
          </Surface>

          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider px-1">Day Summary</h3>
            <div className="grid gap-3">
              <div className="flex items-center justify-between border-none bg-card p-3 rounded-md shadow-sm">
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-primary/60" />
                  <span className="text-sm font-medium">Branches</span>
                </div>
                <span className="text-sm font-semibold">{currentDayStats?.branch_count || 0}</span>
              </div>
              <div className="flex items-center justify-between border-none bg-card p-3 rounded-md shadow-sm">
                <div className="flex items-center gap-3">
                  <List className="h-4 w-4 text-primary/60" />
                  <span className="text-sm font-medium">Entries</span>
                </div>
                <span className="text-sm font-semibold">{currentDayStats?.entry_count || 0}</span>
              </div>
              <div className="flex flex-col gap-1 bg-primary p-4 text-primary-foreground rounded-md shadow-md">
                <span className="text-sm font-medium uppercase tracking-wider opacity-70">Total Amount</span>
                <span className="text-sm font-semibold tracking-tight">₹{Number(currentDayStats?.total_amount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pane 2: Branch Selection (Middle) */}
        <Surface variant="elevated" padding="none" className="w-[320px] flex flex-col overflow-hidden shrink-0">
          <div className="p-4 border-none bg-muted/40 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" />
              Branches
            </h2>
            <Badge variant="secondary" className="h-4 text-sm">{branchSummaries.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {isLoadingBranches ? (
              <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" /></div>
            ) : branchSummaries.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center gap-2 opacity-30">
                <Building2 className="h-10 w-10" />
                <p className="text-sm font-medium uppercase tracking-wider">No Data</p>
              </div>
            ) : branchSummaries.map((bs) => (
              <button
                key={bs.office}
                onClick={() => setSelectedBranchId(bs.office)}
                className={cn(
                  "w-full flex items-center justify-between border-none p-3 transition-colors duration-200 group rounded-md",
                  effectiveSelectedBranchId === bs.office
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted/50 text-foreground"
                )}
              >
                <div className="flex flex-col items-start gap-0.5">
                  <span className={cn(
                    "text-sm font-medium tracking-tight text-left truncate max-w-[180px]",
                    effectiveSelectedBranchId === bs.office ? "text-primary-foreground" : "text-foreground"
                  )}>{bs.office__name}</span>
                  <span className={cn(
                    "text-sm font-medium opacity-60",
                    effectiveSelectedBranchId === bs.office ? "text-primary-foreground" : "text-muted-foreground"
                  )}>{bs.entry_count} entries</span>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "text-sm font-semibold tracking-tight",
                    effectiveSelectedBranchId === bs.office ? "text-primary-foreground" : "text-foreground"
                  )}>₹{Number(bs.total_amount).toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
        </Surface>

        {/* Pane 3: Entries Detail (Right) */}
        <Surface variant="elevated" padding="none" className="flex-1 flex flex-col overflow-hidden">
          {effectiveSelectedBranchId ? (
            <>
              <div className="p-6 border-none bg-card/70 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 border-none bg-primary/10 flex items-center justify-center rounded-md">
                    <IndianRupee className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-medium tracking-tight">{selectedBranch?.office__name}</h2>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      {formattedDate} • {expenses.length} Records
                    </p>
                  </div>
                </div>
                <div className="border-none pl-6 text-right">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1 opacity-50">Branch Total</p>
                  <p className="text-sm font-semibold tracking-tight text-foreground">₹{Number(selectedBranch?.total_amount).toLocaleString()}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {isLoadingEntries ? (
                  <div className="h-full flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary/10" /></div>
                ) : (
                  <Table>
                    <TableHeader sticky>
                      <TableRow>
                        <TableHead className="w-[30%]">Category</TableHead>
                        <TableHead className="w-[45%]">Notes / Description</TableHead>
                        <TableHead className="w-[25%] text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((exp) => (
                        <TableRow key={exp.id} className="group">
                          <TableCell className="font-medium text-sm group-hover:text-primary transition-colors">{exp.category}</TableCell>
                          <TableCell className="text-sm text-muted-foreground leading-relaxed">{exp.notes || "-"}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-semibold text-sm text-foreground">₹{Number(exp.amount).toLocaleString()}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                      {expenses.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="h-64 text-center">
                            <div className="flex flex-col items-center gap-3 text-muted-foreground/30">
                              <Search className="h-10 w-10" />
                              <p className="text-sm font-medium">No records found for this selection</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/35 p-12 text-center">
              <div className="h-24 w-24 border-none bg-muted/10 rounded-md mb-6 flex items-center justify-center">
                <Filter className="h-10 w-10" />
              </div>
              <h3 className="text-sm font-medium tracking-tight text-muted-foreground">Select a Branch</h3>
              <p className="text-sm max-w-xs mx-auto mt-2">Pick a branch from the middle pane to view detailed expense ledger for {formattedDate}.</p>
            </div>
          )}
        </Surface>
      </div>

      <ExpenseEntryDialog 
        isOpen={isEntryDialogOpen}
        onOpenChange={setIsEntryDialogOpen}
        onSuccess={() => {
          void queryClient.invalidateQueries({ queryKey: expenseKeys.all });
        }}
      />
    </div>
  );
}
