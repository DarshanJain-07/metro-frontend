"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";

import { ImportDialog } from "@/components/import-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetchWithAuth, readApiError } from "@/lib/api";

type ExportFormat = "csv" | "xlsx";

interface ImportExportActionsProps {
  title: string;
  apiPath: string;
  queryParams?: Record<string, string | number | boolean | null | undefined>;
  canImport?: boolean;
  onImported?: () => void;
}

const appendResourceAction = (apiPath: string, action: string) =>
  `${apiPath.endsWith("/") ? apiPath : `${apiPath}/`}${action}/`;

const makeExportFileName = (title: string, extension: ExportFormat) => {
  const baseName = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${baseName || "export"}-${date}.${extension}`;
};

function makeQueryString(format: ExportFormat, queryParams?: ImportExportActionsProps["queryParams"]) {
  const params = new URLSearchParams();
  params.set("format", format);
  Object.entries(queryParams || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== false && value !== "") {
      params.set(key, String(value));
    }
  });
  return params.toString();
}

export function ImportExportActions({
  title,
  apiPath,
  queryParams,
  canImport = true,
  onImported,
}: ImportExportActionsProps) {
  const [isImportOpen, setIsImportOpen] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    const res = await fetchWithAuth(
      `${appendResourceAction(apiPath, "export")}?${makeQueryString(format, queryParams)}`,
    );

    if (res.status === 401) {
      toast.error("Authentication session expired.");
      return;
    }

    if (!res.ok) {
      toast.error(await readApiError(res, `Could not export ${title.toLowerCase()}.`));
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeExportFileName(title, format);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${title.toLowerCase()}.`);
  };

  const handleImport = async (file: File, format: ExportFormat) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", format);

    const res = await fetchWithAuth(appendResourceAction(apiPath, "import-file"), {
      method: "POST",
      body: formData,
    });

    if (res.status === 401) {
      throw new Error("Authentication session expired.");
    }

    if (!res.ok) {
      throw new Error(await readApiError(res, `Could not import ${title.toLowerCase()}.`));
    }

    const result = (await res.json().catch(() => null)) as {
      total_rows?: number;
      totals?: Record<string, number>;
    } | null;
    const count =
      (result?.totals?.new || 0) +
      (result?.totals?.update || 0) +
      (result?.totals?.skip || 0) ||
      result?.total_rows ||
      0;

    toast.success(`Successfully imported ${count} items`);
    onImported?.();
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="font-semibold shrink-0">
            <Download className="mr-2 size-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void handleExport("csv")}>
            <FileSpreadsheet className="size-4" />
            CSV
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleExport("xlsx")}>
            <FileSpreadsheet className="size-4" />
            XLSX
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canImport ? (
        <Button variant="outline" size="sm" className="font-semibold shrink-0" onClick={() => setIsImportOpen(true)}>
          <Upload className="mr-2 size-4" />
          Import
        </Button>
      ) : null}

      <ImportDialog isOpen={isImportOpen} onOpenChange={setIsImportOpen} title={title} onImport={handleImport} />
    </div>
  );
}
