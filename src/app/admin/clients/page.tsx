"use client";

import { useState } from "react";
import { Building2, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FormGroup } from "@/components/ui/form-elements";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Surface } from "@/components/ui/surface";
import { fetchWithAuth, readApiError } from "@/lib/api";

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

const emptyForm: ClientAdminForm = {
  company_name: "",
  full_name: "",
  username: "",
  email: "",
  password: "",
};

export default function ClientsPage() {
  const [form, setForm] = useState<ClientAdminForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdClient, setCreatedClient] = useState<ClientCreationResult | null>(null);

  function setField(field: keyof ClientAdminForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    const response = await fetchWithAuth("/api/v1/auth/users/client-super-admin/", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setIsSubmitting(false);

    if (!response.ok) {
      toast.error(await readApiError(response, "Could not create client company."));
      return;
    }

    const payload = await response.json() as ClientCreationResult;
    setCreatedClient(payload);
    setForm(emptyForm);
    toast.success("Client company created.");
  }

  async function copyOrganizationId() {
    const organizationId = createdClient?.company.organization_id;
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
        description="Create a client company and its first Super Admin."
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                  <Button type="button" size="icon-sm" variant="outline" onClick={copyOrganizationId}>
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy Organization ID</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">No client created in this session.</div>
          )}
        </Surface>
      </div>
    </PageContainer>
  );
}
