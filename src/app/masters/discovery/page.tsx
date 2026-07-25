"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable, DataTableColumn } from "@/components/data-table";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { masterKeys } from "@/lib/query-keys";

type GlobalOffice = {
  id: string;
  name: string;
  city_name: string;
  state_code: string;
  owner_company: number | string | null;
  owner_company_name: string | null;
  address: string | null;
  contact_name: string | null;
  phone: string | null;
  status: string;
  is_active: boolean;
};

type CompanyOffice = {
  id: string;
  global_office: string | null;
};

type DirectoryCompany = {
  id: number | string;
  name: string;
  is_active: boolean;
  created_at: string;
};

type DiscoveredCompany = {
  id: string;
  name: string;
  offices: GlobalOffice[];
  importedCount: number;
};

type ApiList<T> = T[] | { results?: T[]; next?: string | null };

function normalizeList<T>(payload: ApiList<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results || [];
}

async function fetchAllPages<T>(
  path: string,
  fallbackError: string,
  signal?: AbortSignal,
): Promise<T[] | null> {
  const records: T[] = [];
  let nextUrl: string | null = path;

  while (nextUrl) {
    const res = await fetchWithAuth(nextUrl, { signal });
    if (res.status === 401) return null;
    if (!res.ok) {
      throw new Error(await readApiError(res, fallbackError));
    }

    const payload = (await res.json()) as ApiList<T>;
    records.push(...normalizeList(payload));
    nextUrl = Array.isArray(payload) ? null : payload.next || null;
  }

  return records;
}

function officeLocation(office: GlobalOffice) {
  return [office.city_name, office.state_code].filter(Boolean).join(", ");
}

export default function DiscoveryPage() {
  const { activeMembership, can } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const canImport = can("*");
  const discoveryQueryKey = masterKeys.list(
    activeMembership?.id,
    "/api/v1/master/discovery/",
  );

  const discoveryQuery = useQuery({
    queryKey: discoveryQueryKey,
    queryFn: async ({ signal }) => {
      const [companyRecords, globalRecords, officeRecords] = await Promise.all([
        fetchAllPages<DirectoryCompany>(
          "/api/v1/master/companies/?include_inactive=false&ordering=name&page_size=1000",
          "Could not load company directory.",
          signal,
        ),
        fetchAllPages<GlobalOffice>(
          "/api/v1/master/global-offices/?include_inactive=false&ordering=name&page_size=1000",
          "Could not load discovery directory.",
          signal,
        ),
        fetchAllPages<CompanyOffice>(
          "/api/v1/master/offices/?include_inactive=true&page_size=1000",
          "Could not load current branches.",
          signal,
        ),
      ]);

      return {
        directoryCompanies: companyRecords || [],
        globalOffices: globalRecords || [],
        currentOffices: officeRecords || [],
      };
    },
    initialData: {
      directoryCompanies: [] as DirectoryCompany[],
      globalOffices: [] as GlobalOffice[],
      currentOffices: [] as CompanyOffice[],
    },
  });

  const directoryCompanies = discoveryQuery.data.directoryCompanies;
  const globalOffices = discoveryQuery.data.globalOffices;
  const currentOffices = discoveryQuery.data.currentOffices;

  const activeCompanyId = activeMembership?.company ? String(activeMembership.company) : null;

  const importedGlobalOfficeIds = useMemo(
    () => new Set(currentOffices.map((office) => office.global_office).filter(Boolean)),
    [currentOffices],
  );

  const companies = useMemo(() => {
    const grouped = new Map<string, DiscoveredCompany>();

    for (const company of directoryCompanies) {
      const companyId = String(company.id);
      if (activeCompanyId && companyId === activeCompanyId) continue;
      grouped.set(companyId, {
        id: companyId,
        name: company.name,
        offices: [],
        importedCount: 0,
      });
    }

    for (const office of globalOffices) {
      if (!office.owner_company || !office.owner_company_name) continue;
      const ownerCompanyId = String(office.owner_company);
      if (activeCompanyId && ownerCompanyId === activeCompanyId) continue;

      const existing = grouped.get(ownerCompanyId);
      if (existing) {
        existing.offices.push(office);
      } else {
        grouped.set(ownerCompanyId, {
          id: ownerCompanyId,
          name: office.owner_company_name,
          offices: [office],
          importedCount: 0,
        });
      }
    }

    return Array.from(grouped.values())
      .map((company) => {
        const offices = [...company.offices].sort((a, b) => {
          const locationCompare = officeLocation(a).localeCompare(officeLocation(b));
          return locationCompare || a.name.localeCompare(b.name);
        });
        return {
          ...company,
          offices,
          importedCount: offices.filter((office) => importedGlobalOfficeIds.has(office.id)).length,
        };
      })
      .filter((company) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (
          company.name.toLowerCase().includes(query) ||
          company.offices.some((office) =>
            [office.name, office.city_name, office.state_code, office.phone]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(query)),
          )
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCompanyId, directoryCompanies, globalOffices, importedGlobalOfficeIds, searchQuery]);

  const importCompanyMutation = useMutation({
    mutationFn: async (company: DiscoveredCompany) => {
      const res = await fetchWithAuth("/api/v1/master/offices/import-company-offices/", {
        method: "POST",
        body: JSON.stringify({ owner_company: company.id, office_type: "PARTNER" }),
      });

      if (res.status === 401) {
        throw new Error("Authentication session expired.");
      }
      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not import company offices."));
      }

      const created = normalizeList(await res.json().catch(() => []));
      return { company, count: created.length };
    },
    onSuccess: ({ company, count }) => {
      toast.success(`Imported ${count} office${count === 1 ? "" : "s"} from ${company.name}`);
      void queryClient.invalidateQueries({ queryKey: discoveryQueryKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not import company offices.");
    },
  });

  const importOfficeMutation = useMutation({
    mutationFn: async (office: GlobalOffice) => {
      const res = await fetchWithAuth("/api/v1/master/offices/import/", {
        method: "POST",
        body: JSON.stringify({ global_office: office.id, office_type: "PARTNER" }),
      });

      if (res.status === 401) {
        throw new Error("Authentication session expired.");
      }
      if (!res.ok) {
        throw new Error(await readApiError(res, "Could not import office."));
      }

      return office;
    },
    onSuccess: (office) => {
      toast.success(`${office.name} imported as a partner branch`);
      void queryClient.invalidateQueries({ queryKey: discoveryQueryKey });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not import office.");
    },
  });

  const columns: DataTableColumn<DiscoveredCompany>[] = [
    {
      header: "Company",
      accessorKey: "name",
      render: (_, company) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-muted">
            <Building2 className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="truncate">{company.name}</div>
            <div className="text-xs font-medium text-muted-foreground">
              {company.offices.length
                ? `${company.offices.length} office${company.offices.length === 1 ? "" : "s"} available`
                : "No offices listed yet"}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: "Coverage",
      render: (_, company) => {
        const locations = Array.from(new Set(company.offices.map(officeLocation).filter(Boolean))).slice(0, 3);
        return locations.length ? locations.join(" | ") : "Company listed";
      },
      width: "320px",
    },
    {
      header: "Imported",
      render: (_, company) => {
        if (company.offices.length === 0) {
          return <Badge variant="secondary">No offices</Badge>;
        }
        return (
          <Badge variant={company.importedCount === company.offices.length ? "success" : "secondary"}>
            {company.importedCount}/{company.offices.length}
          </Badge>
        );
      },
      width: "120px",
    },
  ];

  const expandedCompany = companies.find((company) => company.id === expandedCompanyId) || companies[0] || null;

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title="Discovery"
        actions={
          <SearchInput
            wrapperClassName="w-80"
            placeholder="Search companies, offices or cities..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <DataTable<DiscoveredCompany>
          data={companies}
          columns={columns}
          isLoading={discoveryQuery.isLoading}
          emptyMessage="No external companies found."
          onRowClick={(company) => setExpandedCompanyId(company.id)}
          rowClassName="cursor-pointer"
          actions={
            canImport
              ? (company) => {
                  const hasOffices = company.offices.length > 0;
                  const allImported = hasOffices && company.importedCount === company.offices.length;
                  const isImporting =
                    importCompanyMutation.isPending &&
                    importCompanyMutation.variables?.id === company.id;
                  return (
                    <Button
                      size="sm"
                      variant={!hasOffices || allImported ? "outline" : "default"}
                      disabled={!hasOffices || allImported || isImporting}
                      onClick={(event) => {
                        event.stopPropagation();
                        importCompanyMutation.mutate(company);
                      }}
                    >
                      {isImporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      {!hasOffices ? "No offices" : allImported ? "Imported" : "Import"}
                    </Button>
                  );
                }
              : undefined
          }
        />

        <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background shadow-sm">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <div className="text-sm font-bold text-foreground">
              {expandedCompany ? expandedCompany.name : "Company Offices"}
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              {expandedCompany
                ? expandedCompany.offices.length === 0
                  ? "This company has no offices listed yet."
                  : canImport
                    ? "Import selected offices into your current organization."
                    : "External offices available in the discovery directory."
                : "Select a company to view offices."}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            {!expandedCompany ? (
              <div className="py-16 text-center text-sm font-medium text-muted-foreground">
                No company selected.
              </div>
            ) : expandedCompany.offices.length === 0 ? (
              <div className="py-16 text-center text-sm font-medium text-muted-foreground">
                No offices listed yet.
              </div>
            ) : (
              <div className="space-y-2">
                {expandedCompany.offices.map((office) => {
                  const isImported = importedGlobalOfficeIds.has(office.id);
                  const isImporting =
                    importOfficeMutation.isPending &&
                    importOfficeMutation.variables?.id === office.id;
                  return (
                    <div key={office.id} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-foreground">{office.name}</div>
                          <div className="mt-1 text-xs font-medium text-muted-foreground">
                            {officeLocation(office) || "No location listed"}
                          </div>
                          {office.phone ? (
                            <div className="mt-1 text-xs font-medium text-muted-foreground">{office.phone}</div>
                          ) : null}
                        </div>
                        {canImport ? (
                          <Button
                            size="sm"
                            variant={isImported ? "outline" : "default"}
                            disabled={isImported || isImporting}
                            onClick={() => importOfficeMutation.mutate(office)}
                          >
                            {isImporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                            {isImported ? "Imported" : "Import"}
                          </Button>
                        ) : (
                          <Badge variant={isImported ? "success" : "secondary"}>
                            {isImported ? "Imported" : "Available"}
                          </Badge>
                        )}
                      </div>
                      {office.address ? (
                        <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">{office.address}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
