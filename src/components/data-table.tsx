"use client";

import { ReactNode, useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSortButton,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  header: ReactNode;
  accessorKey?: keyof T;
  className?: string;
  headerClassName?: string;
  width?: string;
  sortable?: boolean;
  render?: (value: T[keyof T] | undefined, row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  actions?: (row: T) => ReactNode;
  rowClassName?: string;
  density?: "default" | "compact";
  stickyHeader?: boolean;
  borderStyle?: "default" | "minimal";
  onSort?: (key: keyof T, order: "asc" | "desc") => void;
  sortConfig?: { key: keyof T; order: "asc" | "desc" } | null;
}

const getColumnWidthStyle = (width?: string) => ({
  width,
  minWidth: width || "140px",
});

const actionColumnStyle = { width: "96px", minWidth: "96px" };

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  isLoading,
  onRowClick,
  emptyMessage = "No results found.",
  actions,
  rowClassName,
  density = "compact",
  stickyHeader = true,
  borderStyle = "default",
  onSort,
  sortConfig: controlledSortConfig,
}: DataTableProps<T>) {
  const compact = density === "compact";
  const [internalSort, setInternalSort] = useState<{
    key: keyof T;
    order: "asc" | "desc";
  } | null>(null);

  const activeSort = controlledSortConfig !== undefined ? controlledSortConfig : internalSort;

  const handleSort = (key: keyof T, order: "asc" | "desc") => {
    if (onSort) {
      onSort(key, order);
    } else {
      setInternalSort({ key, order });
    }
  };

  const sortedData = useMemo(() => {
    if (!activeSort || onSort) return data;

    return [...data].sort((a, b) => {
      const aVal = a[activeSort.key];
      const bVal = b[activeSort.key];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const modifier = activeSort.order === "asc" ? 1 : -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return aVal.localeCompare(bVal) * modifier;
      }

      return aVal > bVal ? modifier : -modifier;
    });
  }, [data, activeSort, onSort]);

  return (
    <div
      className={cn(
        "overflow-hidden flex flex-col h-full rounded-md bg-background",
        borderStyle === "default"
          ? "border border-border shadow-sm"
          : "border border-transparent shadow-none",
      )}
    >
      <Table
        containerClassName="flex-1"
        className="min-w-full table-fixed"
        style={{ width: "max-content" }}
      >
        <TableHeader sticky={stickyHeader} className={stickyHeader ? "z-20" : undefined}>
          <TableRow className="hover:bg-transparent bg-background">
            {columns.map((col, i) => (
              <TableHead
                key={i}
                className={cn(
                  compact && "h-8 px-3 text-sm",
                  col.headerClassName,
                )}
                style={getColumnWidthStyle(col.width)}
              >
                <div className="flex items-center">
                  {col.header}
                  {col.accessorKey && col.sortable !== false && (
                    <TableSortButton
                      activeOrder={
                        activeSort?.key === col.accessorKey ? activeSort.order : null
                      }
                      onSortAsc={() => handleSort(col.accessorKey!, "asc")}
                      onSortDesc={() => handleSort(col.accessorKey!, "desc")}
                    />
                  )}
                </div>
              </TableHead>
            ))}
            {actions && (
              <TableHead
                className={cn(
                  "text-center",
                  compact && "h-8 px-3 text-sm",
                )}
                style={actionColumnStyle}
              >
                Actions
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            [...Array(5)].map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {columns.map((col, j) => (
                  <TableCell
                    key={j}
                    className={cn(compact && "px-3 py-2")}
                    style={getColumnWidthStyle(col.width)}
                  >
                    <Skeleton className="h-4 w-full bg-muted rounded-md" />
                  </TableCell>
                ))}
                {actions && (
                  <TableCell className={cn("text-center", compact && "px-3 py-2")} style={actionColumnStyle}>
                    <Skeleton className="h-4 w-12 mx-auto bg-muted rounded-md" />
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : sortedData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length + (actions ? 1 : 0)}
                className="h-48 text-center text-muted-foreground font-medium uppercase tracking-wider"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, i) => (
              <TableRow
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "group",
                  onRowClick && "cursor-pointer",
                  rowClassName
                )}
              >
                {columns.map((col, j) => {
                  const value = col.accessorKey ? row[col.accessorKey] : undefined;
                  return (
                    <TableCell
                      key={j}
                      className={cn(
                        "truncate text-sm font-medium tracking-tight text-foreground",
                        compact && "px-3 py-2 text-sm",
                        col.className
                      )}
                      style={getColumnWidthStyle(col.width)}
                    >
                      {col.render ? col.render(value, row, i) : String(value ?? "")}
                    </TableCell>
                  );
                })}
                {actions && (
                  <TableCell
                    className={cn("text-center", compact && "px-3 py-2")}
                    style={actionColumnStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actions(row)}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
