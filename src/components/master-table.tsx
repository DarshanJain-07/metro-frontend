"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Loader2, Search, Upload } from "lucide-react";
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

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  width?: string;
  sortable?: boolean;
  render?: (
    value: T[keyof T] | undefined,
    row: T,
    index: number,
  ) => React.ReactNode;
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
  extraActions?: React.ReactNode;
  onAddClick?: () => void;
  onRowClick?: (row: T) => void;
}

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

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<
    Record<string, string | number | boolean | null>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dynamicOptions, setDynamicOptions] = useState<
    Record<string, { label: string; value: string | number }[]>
  >({});

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

  const loadData = useCallback(async () => {
    try {
      const res = await fetchWithAuth(apiPath);
      if (res.status === 401) return;
      if (!res.ok) throw new Error(await readApiError(res, `Could not load ${title.toLowerCase()}.`));
      const json = await res.json();
      setData(json.results || json);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Could not load ${title.toLowerCase()}.`,
      );
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [apiPath, setData, title]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData, refreshKey]);

  const handleSearch = (query: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (query) params.set(searchParam, query);
    else params.delete(searchParam);
    params.set("page", "1");
    router.push("?" + params.toString());
  };

  useEffect(() => {
    formFields.forEach(async (field) => {
      if (
        field.type === "select" &&
        field.optionsPath &&
        !dynamicOptions[field.name]
      ) {
        try {
          const res = await fetchWithAuth(field.optionsPath);
          if (res.status === 401) return;
          if (res.ok) {
            const json = (await res.json()) as OptionResponse;
            const results = Array.isArray(json) ? json : json.results || [];
            const options = results.map((item) => ({
              label: String(item.name ||
                item.label ||
                item.title ||
                "Unknown"),
              value: item.id || item.value || "",
            }));
            setDynamicOptions((prev) => ({ ...prev, [field.name]: options }));
          }
        } catch (err) {
          console.error("Failed to fetch options for " + field.name, err);
        }
      }
    });
  }, [formFields, dynamicOptions]);

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


  const tableColumns: DataTableColumn<T>[] = columns.map((col) => ({
    header: col.header,
    accessorKey: col.accessorKey as keyof T,
    sortable: col.sortable,
    render: col.render,
    width: col.width || (col.header === "Sr No." ? "60px" : undefined),
    headerClassName: col.header === "Actions" ? "text-center" : "",
    className: col.header === "Sr No." ? "font-mono" : "",
  }));

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const isUpdate = !!editingItem;
      let url = baseApiPath;
      if (isUpdate) {
        const separator = baseApiPath.endsWith("/") ? "" : "/";
        url = baseApiPath + separator + editingItem.id + "/";
      }

      const res = await fetchWithAuth(url, {
        method: isUpdate ? "PATCH" : "POST",
        body: JSON.stringify(formData),
      });

      if (res.status === 401) return;

      if (!res.ok) {
        throw new Error(await readApiError(res, `Could not save ${title.toLowerCase()}.`));
      }

      toast.success(title + " saved successfully");
      setIsDialogOpen(false);
      setIsLoading(true);
      loadData();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : `Could not save ${title.toLowerCase()}.`;
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImport = async (importData: ImportRow[]) => {
    try {
      const res = await fetchWithAuth(`${baseApiPath}import-rows/`, {
        method: "POST",
        body: JSON.stringify({ rows: importData }),
      });

      if (res.status === 401) return;

      if (!res.ok) {
        toast.error(await readApiError(res, `Could not import ${title.toLowerCase()}.`), {
          duration: 5000,
        });
        return;
      }

      const created = await res.json().catch(() => []);
      const count = Array.isArray(created) ? created.length : importData.length;
      toast.success(`Successfully imported ${count} items`);
      setIsLoading(true);
      loadData();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Network error while importing. Please check your connection.",
      );
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <PageHeader
        title={title}
        actions={
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <CompactInput
                type="search"
                placeholder={searchPlaceholder || "Search..."}
                className="pl-9"
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
            </div>
            {canAdd && (
              <div className="flex items-center gap-2">
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
                {extraActions}
              </div>
            )}
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
          isLoading={isLoading}
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
