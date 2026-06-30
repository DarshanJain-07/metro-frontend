"use client";

import { useMemo, MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Copy, ClipboardPaste } from "lucide-react";

export type Verb = "view" | "create" | "edit" | "delete";

export interface Permission {
  code: string;
  name: string;
  description: string;
  group: string;
}

export interface PermissionState {
  enabled: boolean;
  scope: string;
}

interface MatrixPermissionsEditorProps {
  catalog: Permission[];
  permissions: Record<string, PermissionState>;
  onToggle: (code: string, enabled: boolean) => void;
  onCopy: () => void;
  onPaste: () => void;
  isSaving?: boolean;
  readOnly?: boolean;
}

const ROWS = [
  { id: "shipment", label: "Shipments" },
  { id: "logistics", label: "Logistics" },
  { id: "invoice", label: "Invoices" },
  { id: "billing", label: "Billing" },
  { id: "payment", label: "Payments" },
  { id: "verification", label: "Verification" },
  { id: "expense", label: "Expenses" },
  { id: "master", label: "Master Data" },
  { id: "import", label: "Master Import" },
  { id: "users", label: "Users" },
  { id: "passwords", label: "Passwords" },
  { id: "roles", label: "Roles" },
  { id: "reports", label: "Reports" },
];

const COLUMNS: { id: Verb; label: string }[] = [
  { id: "view", label: "View" },
  { id: "create", label: "Add" },
  { id: "edit", label: "Edit" },
  { id: "delete", label: "Delete" },
];

const MATRIX_MAP: Record<string, { row: string; verb: Verb }> = {
  "shipment:view": { row: "shipment", verb: "view" },
  "shipment:create": { row: "shipment", verb: "create" },
  "shipment:edit": { row: "shipment", verb: "edit" },
  "shipment:dispatch": { row: "logistics", verb: "edit" },
  "shipment:receive": { row: "logistics", verb: "create" },
  "invoice:view": { row: "invoice", verb: "view" },
  "invoice:create": { row: "invoice", verb: "create" },
  "invoice:edit": { row: "invoice", verb: "edit" },
  "invoice:delete": { row: "invoice", verb: "delete" },
  "invoice:generate": { row: "billing", verb: "create" },
  "payment:view": { row: "payment", verb: "view" },
  "payment:create": { row: "payment", verb: "create" },
  "payment:edit": { row: "payment", verb: "edit" },
  "payment:delete": { row: "payment", verb: "delete" },
  "payment:verify": { row: "verification", verb: "edit" },
  "expense:view": { row: "expense", verb: "view" },
  "expense:create": { row: "expense", verb: "create" },
  "expense:edit": { row: "expense", verb: "edit" },
  "expense:delete": { row: "expense", verb: "delete" },
  "master:view": { row: "master", verb: "view" },
  "master:create": { row: "master", verb: "create" },
  "master:edit": { row: "master", verb: "edit" },
  "master:delete": { row: "master", verb: "delete" },
  "master:import": { row: "import", verb: "create" },
  "users:view": { row: "users", verb: "view" },
  "users:create": { row: "users", verb: "create" },
  "users:edit": { row: "users", verb: "edit" },
  "users:delete": { row: "users", verb: "delete" },
  "users:reset_password": { row: "passwords", verb: "edit" },
  "roles:manage": { row: "roles", verb: "edit" },
  "reports:view": { row: "reports", verb: "view" },
};

export function MatrixPermissionsEditor({
  catalog,
  permissions,
  onToggle,
  onCopy,
  onPaste,
  isSaving,
  readOnly,
}: MatrixPermissionsEditorProps) {
  const matrix = useMemo(() => {
    const grid: Record<string, Record<Verb, Permission | null>> = {};
    ROWS.forEach((row) => {
      grid[row.id] = { view: null, create: null, edit: null, delete: null };
    });

    catalog.forEach((p) => {
      const mapping = MATRIX_MAP[p.code];
      if (mapping && grid[mapping.row]) {
        grid[mapping.row][mapping.verb] = p;
      }
    });

    return grid;
  }, [catalog]);

  const handleMatrixClick = (e: MouseEvent<HTMLTableSectionElement>) => {
    if (isSaving || readOnly) return;
    const target = e.target as HTMLElement;
    const button = target.closest('button[data-code]');
    if (!button) return;
    const code = button.getAttribute('data-code');
    if (!code) return;
    const isCurrentlyEnabled = button.getAttribute('data-enabled') === 'true';
    onToggle(code, !isCurrentlyEnabled);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-label">
          Access Matrix
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onCopy} disabled={readOnly}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onPaste} disabled={readOnly}>
            <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
            Paste
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-2 px-3">
                Resource
              </TableHead>
              {COLUMNS.map((col) => (
                <TableHead key={col.id} className="py-2 px-1 text-center">
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody onClick={handleMatrixClick}>
            {ROWS.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="py-2 px-3">
                  <span className="text-xs font-normal text-foreground">{row.label}</span>
                </TableCell>
                {COLUMNS.map((col) => {
                  const permission = matrix[row.id][col.id];
                  if (!permission) {
                    return (
                      <TableCell key={col.id} className="p-1">
                        <div className="w-8 h-8 mx-auto rounded bg-muted/10 border border-dashed border-border/40" />
                      </TableCell>
                    );
                  }

                  const state = permissions[permission.code];
                  const isEnabled = !!state?.enabled;

                  return (
                    <TableCell key={col.id} className="p-1">
                      <button
                        type="button"
                        data-code={permission.code}
                        data-enabled={isEnabled}
                        title={`${permission.name}: ${permission.description}`}
                        className={cn(
                          "w-8 h-8 mx-auto rounded border transition-all duration-150 flex items-center justify-center",
                          isEnabled
                            ? "bg-primary border-primary text-primary-foreground"
                            : "bg-transparent border-border/60 hover:bg-muted hover:border-border text-muted-foreground/40",
                          (isSaving || readOnly) && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={readOnly || isSaving}
                      >
                        <span className="text-xs font-medium uppercase">
                          {col.id.slice(0, 1)}
                        </span>
                      </button>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
