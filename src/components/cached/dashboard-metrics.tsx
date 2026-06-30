import { TrendingUp, Users, Package, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getCachedDashboardStats } from "@/lib/cached-api";
import { Surface } from "@/components/ui/surface";

interface DashboardStats {
  total_dockets?: number;
  pending_deliveries?: number;
  total_revenue?: number | string;
  total_receivables?: number | string;
}

export default async function DashboardMetrics({ companyId }: { companyId: string }) {
  'use cache';
  
  const stats: DashboardStats | null = await getCachedDashboardStats(companyId);

  if (!stats) return null;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Metric 
        label="Total Revenue" 
        value={`₹${Number(stats.total_revenue || 0).toLocaleString()}`} 
        description="Total billed amount" 
        icon={TrendingUp} 
      />
      <Metric 
        label="Total Dockets" 
        value={String(stats.total_dockets || 0)} 
        description="Across all branches" 
        icon={Package} 
      />
      <Metric 
        label="Pending Deliveries" 
        value={String(stats.pending_deliveries || 0)} 
        description="In-transit dockets" 
        icon={ArrowUpRight} 
      />
      <Metric 
        label="Total Receivables" 
        value={`₹${Number(stats.total_receivables || 0).toLocaleString()}`} 
        description="Outstanding payments" 
        icon={Users} 
      />
    </div>
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
  icon: LucideIcon;
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
