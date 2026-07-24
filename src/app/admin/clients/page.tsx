"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormGroup } from "@/components/ui/form-elements";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Surface } from "@/components/ui/surface";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { adminKeys, masterKeys } from "@/lib/query-keys";

interface ClientAdminForm {
  company_name: string;
  full_name: string;
  username: string;
  email: string;
  password: string;
}

interface ClientCreationResult {
  company: {
    id: number;
    name: string;
    organization_id: string;
    workos_organization_id: string;
  };
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

interface ClientCompany {
  id: number;
  name: string;
  organization_id: string;
  workos_organization_id: string | null;
  is_active: boolean;
  created_at: string;
  super_admins: Array<{
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    membership_id: string;
  }>;
}

const emptyForm: ClientAdminForm = {
  company_name: "",
  full_name: "",
  username: "",
  email: "",
  password: "",
};

async function fetchClientCompanies(signal?: AbortSignal) {
  const response = await fetchWithAuth("/api/v1/auth/users/clients/", { signal });
  if (!response.ok) {
    throw new Error(await readApiError(response, "Could not load client companies."));
  }
  return (await response.json()) as ClientCompany[];
}

async function createClientCompany(form: ClientAdminForm) {
  const response = await fetchWithAuth("/api/v1/auth/users/client-super-admin/", {
    method: "POST",
    body: JSON.stringify(form),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Could not create client company."));
  }

  return (await response.json()) as ClientCreationResult;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ClientsPage() {
  const { activeMembership } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClientAdminForm>(emptyForm);
  const [createdClient, setCreatedClient] = useState<ClientCreationResult | null>(null);

  const clientsQuery = useQuery({
    queryKey: adminKeys.clients(activeMembership?.id),
    queryFn: ({ signal }) => fetchClientCompanies(signal),
  });

  const createClientMutation = useMutation({
    mutationFn: createClientCompany,
    onSuccess: (payload) => {
      setCreatedClient(payload);
      setForm(emptyForm);
      toast.success("Client company created.");
      void queryClient.invalidateQueries({ queryKey: adminKeys.clients(activeMembership?.id) });
      void queryClient.invalidateQueries({ queryKey: masterKeys.all });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not create client company.");
    },
  });

  const clients = clientsQuery.data || [];

  function setField(field: keyof ClientAdminForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createClientMutation.mutate(form);
  }

  async function copyOrganizationId(organizationId: string) {
    if (!organizationId) return;
    try {
      await navigator.clipboard.writeText(organizationId);
      toast.success("Organization ID copied.");
    } catch {
      toast.error("Could not copy Organization ID.");
    }
  }

  return (
    <PageContainer maxWidth="5xl">
      <PageHeader
        title="Clients"
        description="Create client companies, manage their first Super Admin handoff, and copy organization IDs."
      />

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Surface padding="lg">
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Client Setup</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormGroup label="Company name">
                <Input
                  autoComplete="organization"
                  value={form.company_name}
                  onChange={(event) => setField("company_name", event.target.value)}
                  required
                />
              </FormGroup>
              <FormGroup label="Admin full name">
                <Input
                  autoComplete="name"
                  value={form.full_name}
                  onChange={(event) => setField("full_name", event.target.value)}
                  required
                />
              </FormGroup>
              <FormGroup label="Admin username">
                <Input
                  autoComplete="username"
                  value={form.username}
                  onChange={(event) => setField("username", event.target.value)}
                  required
                />
              </FormGroup>
              <FormGroup label="Admin email">
                <Input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setField("email", event.target.value)}
                  required
                />
              </FormGroup>
              <FormGroup label="Temporary password">
                <PasswordInput
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setField("password", event.target.value)}
                  minLength={10}
                  required
                />
              </FormGroup>
            </div>

            <div className="flex justify-end border-t border-border pt-3">
              <Button type="submit" disabled={createClientMutation.isPending}>
                {createClientMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Client
              </Button>
            </div>
          </form>
        </Surface>

        <Surface padding="lg" className="self-start">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">Latest Client</h2>
            <p className="mt-1 text-xs text-muted-foreground">Share the Organization ID with the client admin.</p>
          </div>

          {createdClient ? (
            <div className="mt-4 grid gap-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Company</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{createdClient.company.name}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Super Admin</div>
                <div className="mt-1 text-sm text-foreground">{createdClient.user.email}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground">Organization ID</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 rounded-md border border-border bg-muted px-2 py-1.5 text-xs font-semibold text-foreground">
                    {createdClient.company.organization_id}
                  </code>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    onClick={() => copyOrganizationId(createdClient.company.organization_id)}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy Organization ID</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">
              Create a client to see the handoff details here.
            </div>
          )}
        </Surface>
      </div>

      <Surface padding="lg" className="mt-4 min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Active Clients</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {clients.length} active client{clients.length === 1 ? "" : "s"} available for Discovery.
            </p>
          </div>
          {clientsQuery.isFetching ? (
            <Badge variant="secondary">
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Loading
            </Badge>
          ) : (
            <Badge variant="success">Synced</Badge>
          )}
        </div>

        {clientsQuery.isError ? (
          <div className="py-8 text-sm font-medium text-destructive">
            {clientsQuery.error instanceof Error
              ? clientsQuery.error.message
              : "Could not load client companies."}
          </div>
        ) : clients.length === 0 ? (
          <div className="py-8 text-sm text-muted-foreground">
            No active client companies found.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {clients.map((client) => {
              const primaryAdmin = client.super_admins[0];
              return (
                <div key={client.id} className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_220px_220px] md:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{client.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Created {formatDate(client.created_at)}
                    </div>
                  </div>
                  <div className="min-w-0 text-xs">
                    <div className="font-medium text-muted-foreground">Super Admin</div>
                    <div className="mt-1 truncate text-foreground">
                      {primaryAdmin?.email || "No active Super Admin"}
                    </div>
                  </div>
                  <div className="min-w-0 text-xs">
                    <div className="font-medium text-muted-foreground">Organization ID</div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-2 py-1.5 font-semibold text-foreground">
                        {client.organization_id}
                      </code>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => copyOrganizationId(client.organization_id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="sr-only">Copy Organization ID</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Surface>
    </PageContainer>
  );
}
