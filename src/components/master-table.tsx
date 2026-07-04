"use client";

import {
  isValidElement,
  useCallback,
  useState,
  useEffect,
  useMemo,
  type FormEvent,
  type ReactNode,
} from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Loader2, Upload, Download, FileSpreadsheet } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CompactInput,
  CompactSelect,
  CompactTextarea,
  FormGroup,
} from "@/components/ui/form-elements";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { DataTable, DataTableColumn } from "@/components/data-table";
import { ImportDialog } from "./import-dialog";
import { useAuth } from "@/lib/auth-context";
import { docketKeys, masterKeys } from "@/lib/query-keys";

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  width?: string;
  sortable?: boolean;
  render?: (
    value: T[keyof T] | undefined,
    row: T,
    index: number,
  ) => ReactNode;
}

export interface FormFieldDef {
  name: string;
  label: string;
  type: "text" | "password" | "number" | "boolean" | "select" | "textarea" | "date";
  options?: { label: string; value: string | number }[];
  optionsPath?: string;
  required?: boolean;
}

type ImportRow = Record<string, string | number | boolean | null>;
type OptionSource = Partial<
  Record<"id" | "value" | "name" | "label" | "title", string | number | null>
>;
type OptionResponse = { results?: OptionSource[] } | OptionSource[];

interface MasterTableProps<T> {
  title: string;
  apiPath: string;
  queryParams?: Record<string, string | number | boolean | null | undefined>;
  columns: ColumnDef<T>[];
  formFields: FormFieldDef[];
  canAdd?: boolean;
  canEdit?: boolean;
  searchPlaceholder?: string;
  refreshKey?: number;
  extraActions?: ReactNode;
  onAddClick?: () => void;
  onRowClick?: (row: T) => void;
}

type ExportFormat = "csv" | "xls";

const DUPLICATE_IMPORT_ERROR_PATTERN =
  /\b(duplicate|already exists|already exist|unique|must be unique|conflicts with existing)\b/i;

const formatImportErrorMessage = (message: string, title: string) => {
  if (!DUPLICATE_IMPORT_ERROR_PATTERN.test(message)) return message;
  return `Duplicate entry found in ${title.toLowerCase()}: ${message}`;
};

const formatExportValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const reactNodeToText = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(reactNodeToText).join(" ").trim();
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return reactNodeToText(node.props.children);
  }
  return "";
};

const escapeCsvCell = (value: string) => {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
};

const escapeHtmlCell = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const makeExportFileName = (title: string, extension: ExportFormat) => {
  const baseName = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `${baseName || "export"}-${date}.${extension}`;
};

export function MasterTable<T extends { id: string; updated_at?: string | null }>({
  title,
  apiPath: baseApiPath,
  queryParams,
  columns,
  formFields,
  canAdd = true,
  canEdit = true,
  searchPlaceholder,
  refreshKey = 0,
  extraActions,
  onAddClick,
  onRowClick,
}: MasterTableProps<T>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeMembership } = useAuth();
  const searchParams = useSearchParams();
  const searchParam = "search";
  const searchParamsString = searchParams.toString();
  const urlSearchQuery = searchParams.get(searchParam) || "";
  const [searchDraft, setSearchDraft] = useState({
    value: urlSearchQuery,
    source: searchParamsString,
  });
  const searchQuery =
    searchDraft.source === searchParamsString
      ? searchDraft.value
      : urlSearchQuery;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<
    Record<string, string | number | boolean | null>
  >({});
  const optionFields = useMemo(
    () =>
      formFields.filter(
        (field) => field.type === "select" && field.optionsPath,
      ),
    [formFields],
  );
  const optionsKey = useMemo(
    () =>
      optionFields
        .map((field) => `${field.name}:${field.optionsPath}`)
        .join("|"),
    [optionFields],
  );

  const extraQuery = new URLSearchParams();
  Object.entries(queryParams || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== false && value !== "") {
      extraQuery.set(key, String(value));
    }
  });
  if (searchQuery) {
    extraQuery.set(searchParam, searchQuery);
  }
  const queryString = extraQuery.toString();
  const apiPath = baseApiPath + (queryString ? `${baseApiPath.includes("?") ? "&" : "?"}${queryString}` : "");

  const listQuery = useQuery({
    queryKey: masterKeys.list(activeMembership?.id, apiPath, {
      refreshKey,
      title,
    }),
    queryFn: async ({ signal }) => {
      const res = await fetchWithAuth(apiPath, { signal });
      if (res.status === 401) {
        throw new Error("Authentication session expired.");
      }
      if (!res.ok) {
        throw new Error(await readApiError(res, `Could not load ${title.toLowerCase()}.`));
      }
      const json = await res.json();
      return json.results || json;
    },
    placeholderData: keepPreviousData,
  });
  const data = useMemo<T[]>(() => listQuery.data ?? [], [listQuery.data]);

  const dynamicOptionsQuery = useQuery({
    queryKey: [
      ...masterKeys.options(activeMembership?.id, optionsKey),
      optionFields,
    ],
    queryFn: async ({ signal }) => {
      const loadedOptions: Record<string, { label: string; value: string | number }[]> = {};

      await Promise.all(
        optionFields.map(async (field) => {
          if (!field.optionsPath) return;
          const res = await fetchWithAuth(field.optionsPath, { signal });
          if (res.status === 401) return;
          if (!res.ok) return;
          const json = (await res.json()) as OptionResponse;
          const results = Array.isArray(json) ? json : json.results || [];
          loadedOptions[field.name] = results.map((item) => ({
            label: String(item.name || item.label || item.title || "Unknown"),
            value: item.id || item.value || "",
          }));
        }),
      );

      return loadedOptions;
    },
    enabled: optionFields.length > 0,
  });
  const dynamicOptions = dynamicOptionsQuery.data ?? {};

  const invalidateMasterData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: masterKeys.all });
    void queryClient.invalidateQueries({
      queryKey: docketKeys.metadata(activeMembership?.id),
    });
  }, [activeMembership?.id, queryClient]);

  useEffect(() => {
    if (!(listQuery.error instanceof Error)) return;
    if (listQuery.error.message !== "Authentication session expired.") {
      toast.error(listQuery.error.message);
    }
  }, [listQuery.error]);

  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set(searchParam, query);
    else params.delete(searchParam);
    params.set("page", "1");
    router.push("?" + params.toString());
  };

  const handleOpenDialog = (item?: T) => {
    if (item) {
      setEditingItem(item);
      const initialData: Record<string, string | number | boolean | null> = {};
      formFields.forEach((f) => {
        initialData[f.name] =
          (item[f.name as keyof T] as string | number | boolean | null) ?? null;
      });
      
      // Preserve updated_at for concurrency check
      if (item.updated_at !== undefined) {
        initialData.updated_at = item.updated_at;
      }
      
      setFormData(initialData);
    } else {
      setEditingItem(null);
      const initialData: Record<string, string | number | boolean | null> = {};
      formFields.forEach((f) => {
        if (f.type === "boolean") {
          initialData[f.name] = true;
        } else if (f.type === "date") {
          initialData[f.name] = new Date().toISOString().split("T")[0];
        } else {
          initialData[f.name] = "";
        }
      });
      setFormData(initialData);
    }
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      body,
      isUpdate,
      url,
    }: {
      body: Record<string, string | number | boolean | null>;
      isUpdate: boolean;
      url: string;
    }) => {
      const res = await fetchWithAuth(url, {
        method: isUpdate ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        throw new Error("Authentication session expired.");
      }

      if (!res.ok) {
        throw new Error(await readApiError(res, `Could not save ${title.toLowerCase()}.`));
      }
    },
    onSuccess: () => {
      toast.success(title + " saved successfully");
      setIsDialogOpen(false);
      invalidateMasterData();
    },
    onError: (err) => {
      const errorMessage =
        err instanceof Error
          ? err.message
          : `Could not save ${title.toLowerCase()}.`;
      if (errorMessage !== "Authentication session expired.") {
        toast.error(errorMessage);
      }
    },
  });

  const importMutation = useMutation({
    mutationFn: async (importData: ImportRow[]) => {
      const res = await fetchWithAuth(`${baseApiPath}import-rows/`, {
        method: "POST",
        body: JSON.stringify({ rows: importData }),
      });

      if (res.status === 401) {
        throw new Error("Authentication session expired.");
      }

      if (!res.ok) {
        const message = await readApiError(res, `Could not import ${title.toLowerCase()}.`);
        throw new Error(formatImportErrorMessage(message, title));
      }

      return {
        created: await res.json().catch(() => []),
        importData,
      };
    },
    onSuccess: ({ created, importData }) => {
      const count = Array.isArray(created) ? created.length : importData.length;
      toast.success(`Successfully imported ${count} items`);
      invalidateMasterData();
    },
    onError: (err) => {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Network error while importing. Please check your connection.";
      if (errorMessage !== "Authentication session expired.") {
        toast.error(errorMessage, { duration: 5000 });
      }
    },
  });

  const isSubmitting = saveMutation.isPending || importMutation.isPending;


  const tableColumns: DataTableColumn<T>[] = columns.map((col) => ({
    header: col.header,
    accessorKey: col.accessorKey as keyof T,
    sortable: col.sortable,
    render: col.render,
    width: col.width || (col.header === "Sr No." ? "60px" : undefined),
    headerClassName: col.header === "Actions" ? "text-center" : "",
    className: col.header === "Sr No." ? "font-mono" : "",
  }));

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const isUpdate = !!editingItem;
    let url = baseApiPath;
    if (isUpdate && editingItem) {
      const separator = baseApiPath.endsWith("/") ? "" : "/";
      url = baseApiPath + separator + editingItem.id + "/";
    }

    saveMutation.mutate({
      body: formData,
      isUpdate,
      url,
    });
  };

  const handleImport = async (importData: ImportRow[]) => {
    await importMutation.mutateAsync(importData).catch(() => undefined);
  };

  const getExportRows = useCallback(() => {
    return data.map((row: T, rowIndex: number) =>
      columns.map((column) => {
        const value = column.accessorKey ? row[column.accessorKey] : undefined;
        if (column.render) {
          const rendered = column.render(value, row, rowIndex);
          const text = reactNodeToText(rendered);
          if (text) return text;
        }
        return formatExportValue(value);
      }),
    );
  }, [columns, data]);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      const headers = columns.map((column) => column.header);
      const rows = getExportRows();

      if (rows.length === 0) {
        toast.error(`No ${title.toLowerCase()} data to export.`);
        return;
      }

      const content =
        format === "csv"
          ? "\uFEFF" +
            [headers, ...rows]
              .map((row) => row.map((cell) => escapeCsvCell(cell)).join(","))
              .join("\r\n")
          : `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${headers
              .map((header) => `<th>${escapeHtmlCell(header)}</th>`)
              .join("")}</tr></thead><tbody>${rows
              .map(
                (row) =>
                  `<tr>${row
                    .map((cell) => `<td>${escapeHtmlCell(cell)}</td>`)
                    .join("")}</tr>`,
              )
              .join("")}</tbody></table></body></html>`;

      const blob = new Blob([content], {
        type:
          format === "csv"
            ? "text/csv;charset=utf-8"
            : "application/vnd.ms-excel;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = makeExportFileName(title, format);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} ${title.toLowerCase()} row${rows.length === 1 ? "" : "s"}.`);
    },
    [columns, getExportRows, title],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PageHeader
        title={title}
        actions={
          <div className="flex items-center gap-3">
            <SearchInput
              wrapperClassName="w-80"
              placeholder={searchPlaceholder || "Search..."}
              value={searchQuery}
              onChange={(e) => {
                const nextSearchQuery = e.target.value;
                setSearchDraft({
                  value: nextSearchQuery,
                  source: searchParamsString,
                });
                handleSearch(nextSearchQuery);
              }}
            />
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-semibold shrink-0"
                    disabled={listQuery.isLoading || data.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => handleExport("csv")}>
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleExport("xls")}>
                    <FileSpreadsheet className="h-4 w-4" />
                    XLS
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canAdd && (
                <>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-semibold shrink-0"
                  onClick={() => setIsImportOpen(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
                <Button
                  onClick={() =>
                    onAddClick ? onAddClick() : handleOpenDialog()
                  }
                  size="sm"
                  className="font-semibold shrink-0"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add {title}
                </Button>
                </>
              )}
              {extraActions}
            </div>
          </div>
        }
      />

      <ImportDialog
        isOpen={isImportOpen}
        onOpenChange={setIsImportOpen}
        title={title}
        formFields={formFields}
        dynamicOptions={dynamicOptions}
        onImport={handleImport}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit" : "Add"} {title}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the details of the"
                : "Fill in the details to add a new"}{" "}
              {title.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="grid gap-4 py-4">
            {formFields.map((field) => (
              <FormGroup key={field.name} label={field.label}>
                {field.type === "select" ? (
                  <CompactSelect
                    id={field.name}
                    value={String(formData[field.name] || "")}
                    options={field.options || dynamicOptions[field.name] || []}
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, [field.name]: val }))
                    }
                    placeholder={`Select ${field.label}`}
                  />
                ) : field.type === "boolean" ? (
                  <CompactSelect
                    id={field.name}
                    value={String(formData[field.name])}
                    options={[
                      { label: "Active", value: "true" },
                      { label: "Inactive", value: "false" },
                    ]}
                    onValueChange={(val) =>
                      setFormData((prev) => ({
                        ...prev,
                        [field.name]: val === "true",
                      }))
                    }
                  />
                ) : field.type === "textarea" ? (
                  <CompactTextarea
                    id={field.name}
                    value={String(formData[field.name] || "")}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                    required={field.required}
                  />
                ) : field.type === "password" ? (
                  <PasswordInput
                    id={field.name}
                    value={String(formData[field.name] || "")}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [field.name]: e.target.value,
                      }))
                    }
                    required={field.required}
                  />
                ) : (
                  <CompactInput
                    id={field.name}
                    type={field.type}
                    value={String(formData[field.name] || "")}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [field.name]:
                          field.type === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      }))
                    }
                    required={field.required}
                  />
                )}
              </FormGroup>
            ))}
            <div className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex-1 min-h-0 overflow-hidden">
        <DataTable<T>
          data={data}
          columns={tableColumns}
          isLoading={listQuery.isLoading}
          onRowClick={onRowClick}
          emptyMessage={`No ${title.toLowerCase()} found.`}
          actions={
            canEdit
              ? (item) => (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleOpenDialog(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )
              : undefined
          }
        />
      </div>
    </div>
  );
}
