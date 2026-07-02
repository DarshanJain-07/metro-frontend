"use client";

import { TrendingUp, Users, Package, ArrowUpRight } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { ContentSkeleton } from "@/components/app-skeleton";
import { PageContainer } from "@/components/page-container";
import { cn } from "@/lib/utils";
import { Surface } from "@/components/ui/surface";
import { useAsyncResource } from "@/hooks/use-async-resource";

interface DashboardStats {
  total_dockets: number;
  pending_deliveries: number;
  total_revenue: number;
  total_receivables: number;
  recent_dockets: { docket_no: string; status: string; total_amount: string; date: string }[];
  docket_status_distribution: { status: string; count: number }[];
}

export function DashboardClient({ 
  cachedMetrics, 
  cachedOverview 
}: { 
  cachedMetrics?: React.ReactNode;
  cachedOverview?: React.ReactNode;
}) {
  const { data: stats, isLoading } = useAsyncResource<DashboardStats>(
    async ({ signal }) => {
      const res = await fetchWithAuth("/api/v1/dashboard/", { signal });
      if (!res.ok) {
        throw new Error("Could not load dashboard stats.");
      }
      return res.json();
    },
  );

  if (isLoading) return <ContentSkeleton />;

  return (
    <PageContainer className="h-full flex flex-col min-h-0" maxWidth="full">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-8 pr-1">
        <div className="pb-5">
          <h1 className="text-sm font-semibold tracking-tight text-foreground">Company Dashboard</h1>
          <p className="mt-1.5 text-sm font-medium text-muted-foreground uppercase tracking-widest opacity-80">Overview of your logistics network.</p>
        </div>

      {/* Render the Cache Component for Metrics if provided, otherwise fallback to local state */}
      {cachedMetrics || (
        <Surface className="grid md:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total Revenue" value={`₹${Number(stats?.total_revenue || 0).toLocaleString()}`} description="Total billed amount" icon={TrendingUp} />
          <Metric label="Total Dockets" value={String(stats?.total_dockets || 0)} description="Across all branches" icon={Package} />
          <Metric label="Pending Deliveries" value={String(stats?.pending_deliveries || 0)} description="In-transit dockets" icon={ArrowUpRight} />
          <Metric label="Total Receivables" value={`₹${Number(stats?.total_receivables || 0).toLocaleString()}`} description="Outstanding payments" icon={Users} />
        </Surface>
      )}

      {/* Render the Cache Component for Network Overview */}
      {cachedOverview}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Surface className="col-span-4">
          <div className="mb-6">
            <h2 className="text-sm font-semibold tracking-tight">Recent Dockets</h2>
          </div>
          <div>
            <div className="space-y-2">
              {stats?.recent_dockets?.map((docket, idx) => (
                <div key={docket.docket_no} className={cn("flex items-center justify-between p-4 rounded-md transition-colors", idx % 2 === 0 ? "bg-muted/50" : "bg-card")}>
                  <div>
                    <p className="font-medium">{docket.docket_no}</p>
                    <p className="text-sm text-muted-foreground">{docket.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₹{Number(docket.total_amount).toLocaleString()}</p>
                    <p className="text-sm text-primary">{docket.status}</p>
                  </div>
                </div>
              ))}
              {(!stats?.recent_dockets || stats.recent_dockets.length === 0) && <p className="text-muted-foreground text-center py-4">No recent activity</p>}
            </div>
          </div>
        </Surface>
      </div>
    </div>
  </PageContainer>
);
}

function Metric({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof TrendingUp;
}) {
  return (
    <Surface variant="elevated" className="flex h-32 flex-col justify-between p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4 text-foreground" />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{description}</p>
      </div>
    </Surface>
  );
}
