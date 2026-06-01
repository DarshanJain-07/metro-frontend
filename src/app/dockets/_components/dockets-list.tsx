"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Pencil } from "lucide-react";
import { getDockets, type DocketsResponse } from "../_lib/actions";
import { Pagination } from "./pagination";
import { cn } from "@/lib/utils";

import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";

export function DocketsList() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DocketsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem("access_token");
      if (!token) {
        setError("You must be logged in to view dockets.");
        setIsLoading(false);
        return;
      }

      const filters = {
        page: Number(searchParams.get("page")) || 1,
        page_size: 10,
        from_date: searchParams.get("from_date") || undefined,
        to_date: searchParams.get("to_date") || undefined,
        consignor_name: searchParams.get("consignor_name") || undefined,
      };

      const result = await getDockets(filters, token);
      
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to load dockets");
        toast.error(result.error || "Failed to load dockets");
      }
      setIsLoading(false);
    };

    fetchData();
  }, [searchParams]);

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 w-full uber-loader animate-pulse rounded-[var(--radius)]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={itemVariants}
        className="bg-background border border-border rounded-[var(--radius)] p-12 flex flex-col items-center justify-center gap-4 text-center"
      >
        <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <FileText className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Error Loading Dockets</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">{error}</p>
        </div>
      </motion.div>
    );
  }

  if (!data || data.results.length === 0) {
    return (
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={itemVariants}
        className="bg-background border border-border rounded-[var(--radius)] p-12 flex flex-col items-center justify-center gap-4 text-center"
      >
        <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <FileText className="h-6 w-6 text-zinc-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">No Dockets Found</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1">
            Try adjusting your filters or create a new docket.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={itemVariants}
      className="flex flex-col h-full lg:overflow-hidden border-t border-border pt-4"
    >
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
        <Table>
          <TableHeader className="bg-muted/30 sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-b-2">
              <TableHead className="w-[120px] h-9 text-xs font-bold uppercase tracking-wider">Docket No</TableHead>
              <TableHead className="w-[100px] h-9 text-xs font-bold uppercase tracking-wider">Date</TableHead>
              <TableHead className="h-9 text-xs font-bold uppercase tracking-wider">Consignor</TableHead>
              <TableHead className="h-9 text-xs font-bold uppercase tracking-wider">Consignee</TableHead>
              <TableHead className="h-9 text-xs font-bold uppercase tracking-wider">Destination</TableHead>
              <TableHead className="w-[120px] h-9 text-xs font-bold uppercase tracking-wider">Amount</TableHead>
              <TableHead className="w-[100px] h-9 text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
              <TableHead className="w-[40px] h-9"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {data.results.map((docket) => (
                <TableRow 
                  key={docket.id} 
                  className="group hover:bg-muted/30 transition-colors border-b border-border/50"
                >
                  <TableCell className="py-2 font-mono text-xs font-bold">
                    {docket.docket_no || "N/A"}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {new Date(docket.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="py-2 text-xs font-medium max-w-[150px] truncate">
                    {docket.consignor_name}
                  </TableCell>
                  <TableCell className="py-2 text-xs font-medium max-w-[150px] truncate">
                    {docket.consignee_name}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground truncate">
                    {docket.to_city_name}
                  </TableCell>
                  <TableCell className="py-2 text-xs font-mono font-medium">
                    ₹{Number(docket.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4 font-bold uppercase rounded-none",
                        docket.status === "DELIVERED" && "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
                        docket.status === "IN_TRANSIT" && "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
                        docket.status === "CANCELLED" && "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
                        docket.status === "DRAFT" && "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                      )}
                    >
                      {docket.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2">
                    <Link 
                      href={`/dockets/${docket.id}`}
                      className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
                      title="Update Docket"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>
      
      <div className="pt-2 border-t border-border mt-auto">
        <Pagination 
          totalCount={data.count} 
          pageSize={10} 
          currentPage={Number(searchParams.get("page")) || 1} 
        />
      </div>
    </motion.div>
  );
}
