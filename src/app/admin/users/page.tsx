"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { MasterTable, ColumnDef } from "@/components/master-table";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { adminKeys, authKeys } from "@/lib/query-keys";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { Copy, LayoutTemplate } from "lucide-react";
import { MatrixPermissionsEditor, Permission, PermissionState } from "./_components/matrix-permissions-editor";
import { RoleTemplatesManager } from "./_components/role-templates-manager";

interface UserMembership {
  id: string;
  role: Role;
  company_name: string;
  office_name?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  branch_name: string | null;
  role: Role | null;
  memberships: UserMembership[];
}

type Role = string;

interface RoleDefinition {
  code: string;
  name: string;
  requires_office: boolean;
}

type Scope = "own" | "branch" | "region" | "company" | "all";
const METRO_ROLE = "METRO";
const DEFAULT_APPROVAL_ROLE = "SUPER_ADMIN";

interface EffectiveRolePermission {
  code: string;
  scope: Scope;
}

interface Branch {
  id: string;
  name: string;
}

interface SignupRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  organization_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
}

interface ApprovalInput {
  role: Role;
  branch: string;
}

export default function UsersPage() {
  const { activeMembership, can, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [permissionOverrides, setPermissionOverrides] = useState<{
    role: Role;
    permissions: Record<string, PermissionState>;
  } | null>(null);
  const [isMutatingPermissions, setIsMutatingPermissions] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<Record<string, PermissionState> | null>(null);
  const [approvalInputs, setApprovalInputs] = useState<Record<string, ApprovalInput>>({});
  const [mutatingSignupId, setMutatingSignupId] = useState<string | null>(null);

  const canManageRoles = can("roles:manage");
  const canApproveSignups = can("users:create") || !!user?.is_owner || !!user?.is_superuser;

  const {
    data: adminData,
    error: adminDataError,
  } = useQuery<{ catalog: Permission[]; roles: RoleDefinition[] }>({
    queryKey: [...adminKeys.all, "bootstrap", activeMembership?.id],
    queryFn: async ({ signal }) => {
      const [catalogResponse, rolesResponse] = await Promise.all([
        fetchWithAuth("/api/v1/auth/permission-catalog/", { signal }),
        fetchWithAuth("/api/v1/auth/roles/", { signal }),
      ]);
      if (!catalogResponse.ok) {
        throw new Error("Could not load permissions catalog.");
      }
      if (!rolesResponse.ok) {
        throw new Error("Could not load roles.");
      }

      const catalogPayload = await catalogResponse.json();
      const rolesPayload = await rolesResponse.json();
      return {
        catalog: catalogPayload.results || catalogPayload,
        roles: rolesPayload.results || rolesPayload,
      };
    },
    enabled: canManageRoles || canApproveSignups,
    initialData: { catalog: [], roles: [] },
  });
  const catalog = adminData?.catalog ?? [];
  const roles = adminData?.roles ?? [];

  const {
    data: signupRequests = [],
    error: signupRequestsError,
  } = useQuery<SignupRequest[]>({
    queryKey: [...adminKeys.all, "signup-requests", activeMembership?.id],
    queryFn: async ({ signal }) => {
      const response = await fetchWithAuth("/api/v1/auth/signup-requests/?status=PENDING", { signal });
      if (!response.ok) {
        throw new Error("Could not load signup requests.");
      }
      const payload = await response.json();
      return payload.results || payload;
    },
    enabled: canApproveSignups,
    initialData: [],
  });

  const {
    data: branches = [],
  } = useQuery<Branch[]>({
    queryKey: [...adminKeys.all, "assignable-branches", activeMembership?.id],
    queryFn: async ({ signal }) => {
      const response = await fetchWithAuth("/api/v1/auth/users/assignable-branches/", { signal });
      if (!response.ok) {
        return [];
      }
      const payload = await response.json();
      return payload.results || payload;
    },
    enabled: canApproveSignups,
    initialData: [],
  });

  const rolePermissionsQuery = useQuery<Record<string, PermissionState>>({
    queryKey: [
      ...adminKeys.rolePermissions(activeMembership?.id, role),
      catalog.map((permission) => permission.code),
    ],
    queryFn: async ({ signal }) => {
      const response = await fetchWithAuth(`/api/v1/auth/company-role-permissions/?role=${role}`, {
        signal,
      });
      if (!response.ok) {
        throw new Error("Could not load role permissions.");
      }
      const payload = await response.json();
      const perms = (payload[0]?.permissions || []) as EffectiveRolePermission[];
      
      const nextState: Record<string, PermissionState> = {};
      if (role === METRO_ROLE && perms.some((p) => p.code === "*")) {
        catalog.forEach((permission) => {
          nextState[permission.code] = { enabled: true, scope: "all" };
        });
      } else {
        perms.forEach(p => {
          nextState[p.code] = { enabled: true, scope: p.scope };
        });
      }
      return nextState;
    },
    enabled: canManageRoles && !!role,
    initialData: {} as Record<string, PermissionState>,
  });
  const loadedPermissions = rolePermissionsQuery.data;
  const permissionsError = rolePermissionsQuery.error;
  const isLoading = rolePermissionsQuery.isLoading;
  const refetchRolePermissions = rolePermissionsQuery.refetch;

  const permissions =
    permissionOverrides?.role === role
      ? permissionOverrides.permissions
      : loadedPermissions ?? {};

  useEffect(() => {
    [adminDataError, permissionsError, signupRequestsError].forEach((error) => {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    });
  }, [adminDataError, permissionsError, signupRequestsError]);

  function approvalStateFor(request: SignupRequest) {
    return approvalInputs[request.id] || {
      role: roles.some((item) => item.code === DEFAULT_APPROVAL_ROLE)
        ? DEFAULT_APPROVAL_ROLE
        : roles[0]?.code || "",
      branch: "",
    };
  }

  function setApprovalState(requestId: string, next: Partial<ApprovalInput>) {
    setApprovalInputs(prev => ({
      ...prev,
      [requestId]: {
        role: next.role ?? prev[requestId]?.role ?? DEFAULT_APPROVAL_ROLE,
        branch: next.branch ?? prev[requestId]?.branch ?? "",
      },
    }));
  }

  async function handleApproveSignup(request: SignupRequest) {
    const approval = approvalStateFor(request);
    if (!approval.role) {
      toast.error("Select a role before approving.");
      return;
    }

    setMutatingSignupId(request.id);
    const selectedRole = roles.find((item) => item.code === approval.role);
    const response = await fetchWithAuth(`/api/v1/auth/signup-requests/${request.id}/approve/`, {
      method: "POST",
      body: JSON.stringify({
        role: approval.role,
        branch: selectedRole?.requires_office ? approval.branch || null : null,
      }),
    });
    setMutatingSignupId(null);

    if (!response.ok) {
      toast.error(await readApiError(response, "Could not approve signup."));
      return;
    }

    toast.success("Signup approved.");
    void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "signup-requests"] });
    void queryClient.invalidateQueries({ queryKey: authKeys.session() });
  }

  async function handleRejectSignup(request: SignupRequest) {
    setMutatingSignupId(request.id);
    const response = await fetchWithAuth(`/api/v1/auth/signup-requests/${request.id}/reject/`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setMutatingSignupId(null);

    if (!response.ok) {
      toast.error(await readApiError(response, "Could not reject signup."));
      return;
    }

    toast.success("Signup rejected.");
    void queryClient.invalidateQueries({ queryKey: [...adminKeys.all, "signup-requests"] });
  }

  async function handleCopySignupCode() {
    const code = activeMembership?.company_signup_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Organization ID copied.");
    } catch {
      toast.error("Could not copy organization ID.");
    }
  }

  async function handleToggle(code: string, enabled: boolean) {
    if (!role || role === METRO_ROLE) return;
    
    setSavingCode(code);
    const scope = permissions[code]?.scope || "branch";
    
    const response = await fetchWithAuth("/api/v1/auth/company-role-overrides/", {
      method: "POST",
      body: JSON.stringify({
        role,
        permission_code: code,
        enabled,
        scope,
      }),
    });
    
    setSavingCode(null);
    if (!response.ok) {
      toast.error(await readApiError(response, "Could not save permission."));
      return;
    }

    setPermissionOverrides(prevOverrides => {
      const prev =
        prevOverrides?.role === role ? prevOverrides.permissions : permissions;
      const next = { ...prev };
      if (enabled) {
        next[code] = { enabled: true, scope };
      } else {
        delete next[code];
      }
      return { role, permissions: next };
    });
    void queryClient.invalidateQueries({
      queryKey: adminKeys.rolePermissions(activeMembership?.id, role),
    });
    void queryClient.invalidateQueries({ queryKey: authKeys.session() });
    toast.success(`${enabled ? 'Enabled' : 'Disabled'} permission.`);
  }

  const handleCopy = () => {
    setClipboard({ ...permissions });
    toast.success("Permissions copied to clipboard.");
  };

  const handlePaste = async () => {
    if (!clipboard || !role || role === METRO_ROLE) return;
    
    setIsMutatingPermissions(true);

    try {
      const results = await Promise.all(
        catalog.map((permission) => {
          const state = clipboard[permission.code];
          return fetchWithAuth("/api/v1/auth/company-role-overrides/", {
            method: "POST",
            body: JSON.stringify({
              role,
              permission_code: permission.code,
              enabled: !!state?.enabled,
              scope: state?.scope || "branch",
            }),
          });
        }),
      );

      if (results.every(r => r.ok)) {
        setPermissionOverrides({ role, permissions: { ...clipboard } });
        void queryClient.invalidateQueries({
          queryKey: adminKeys.rolePermissions(activeMembership?.id, role),
        });
        void queryClient.invalidateQueries({ queryKey: authKeys.session() });
        toast.success("Permissions pasted successfully.");
      } else {
        setPermissionOverrides(null);
        refetchRolePermissions();
        toast.error("Some permissions could not be pasted.");
      }
    } catch {
      setPermissionOverrides(null);
      refetchRolePermissions();
      toast.error("Could not paste permissions.");
    } finally {
      setIsMutatingPermissions(false);
    }
  };

  const columns: ColumnDef<User>[] = [
    { header: "Username", accessorKey: "username" },
    { header: "Name", render: (_, user) => `${user.first_name} ${user.last_name}` },
    { header: "Email", accessorKey: "email" },
    { header: "Role", render: (_, user) => user.role || "No Role" },
    { header: "Branch", render: (_, user) => user.branch_name || "None" },
  ];

  return (
    <PageContainer maxWidth="full">
      <div className="flex-1 h-full flex flex-col overflow-hidden">
        {canApproveSignups && activeMembership?.company_signup_code && (
          <Surface className="mb-4 shrink-0" padding="md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Organization ID</h2>
                <p className="mt-1 font-mono text-sm text-foreground">{activeMembership.company_signup_code}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleCopySignupCode}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          </Surface>
        )}

        {canApproveSignups && signupRequests.length > 0 && (
          <Surface className="mb-4 shrink-0" padding="md">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Pending signups</h2>
                <p className="text-xs text-muted-foreground">Approve users into a role before they can sign in.</p>
              </div>
              <Badge variant="warning">{signupRequests.length} pending</Badge>
            </div>
            <div className="grid gap-3">
              {signupRequests.map((request) => {
                const approval = approvalStateFor(request);
                const selectedRole = roles.find((item) => item.code === approval.role);
                const needsBranch = !!selectedRole?.requires_office;
                const isMutating = mutatingSignupId === request.id;
                return (
                  <div
                    key={request.id}
                    className="grid gap-3 rounded-md border border-border bg-background p-3 lg:grid-cols-[minmax(0,1fr)_160px_180px_auto] lg:items-end"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-foreground">{request.full_name}</div>
                      <div className="mt-1 grid gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                        <span className="truncate">{request.email}</span>
                        <span className="truncate">{request.company_name}</span>
                        {request.phone && <span className="truncate">{request.phone}</span>}
                      </div>
                    </div>

                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      Role
                      <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        value={approval.role}
                        onChange={(event) => setApprovalState(request.id, { role: event.target.value, branch: "" })}
                      >
                        {roles.map((item) => (
                          <option key={item.code} value={item.code}>{item.name}</option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                      Branch
                      <select
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-60"
                        value={approval.branch}
                        disabled={!needsBranch}
                        onChange={(event) => setApprovalState(request.id, { branch: event.target.value })}
                      >
                        <option value="">{needsBranch ? "Select branch" : "Not required"}</option>
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                    </label>

                    <div className="flex gap-2 lg:justify-end">
                      <Button
                        size="sm"
                        disabled={isMutating || (needsBranch && !approval.branch)}
                        onClick={() => handleApproveSignup(request)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isMutating}
                        onClick={() => handleRejectSignup(request)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>
        )}
        <MasterTable<User>
          title="Users & Roles"
          apiPath="/api/v1/auth/users/"
          columns={columns}
          onRowClick={(user) => {
            setSelectedUser(user);
            const userRole = user.role || user.memberships?.[0]?.role;
            if (userRole) setRole(userRole as Role);
          }}
          extraActions={
            <Button 
              variant="outline" 
              size="sm" 
              className="font-medium"
              onClick={() => setIsTemplatesOpen(true)}
            >
              <LayoutTemplate className="h-4 w-4 mr-2" />
              Templates
            </Button>
          }
          formFields={[
            { name: "username", label: "Username", type: "text", required: true },
            { name: "email", label: "Email", type: "text", required: true },
            { name: "first_name", label: "First Name", type: "text", required: true },
            { name: "last_name", label: "Last Name", type: "text", required: true },
            { name: "password", label: "Password", type: "password", required: false },
            {
              name: "role",
              label: "Role",
              type: "select",
              required: true,
              options: roles.map((item) => ({ label: item.name, value: item.code })),
            },
            {
              name: "branch",
              label: "Default Branch",
              type: "select",
              optionsPath: "/api/v1/auth/users/assignable-branches/",
              required: false,
            },
          ]}
        />

        <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
          <SheetContent className="sm:max-w-[600px] overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle>User Permissions</SheetTitle>
              <SheetDescription>
                Assigning permissions for <strong>{selectedUser?.first_name || selectedUser?.username} {selectedUser?.last_name}</strong>
                <span className="block text-xs mt-1">Role: {role}</span>
              </SheetDescription>
            </SheetHeader>

            {canManageRoles ? (
              <>
                {role === METRO_ROLE && (
                  <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Metro is the creator role. It always has every permission and cannot be edited.
                  </p>
                )}
                <MatrixPermissionsEditor
                  catalog={catalog}
                  permissions={permissions}
                  onToggle={handleToggle}
                  onCopy={handleCopy}
                  onPaste={handlePaste}
                  isSaving={!!savingCode || isLoading || isMutatingPermissions}
                  readOnly={role === METRO_ROLE}
                />
              </>
            ) : (
              <p className="text-sm text-destructive">You do not have permission to manage roles.</p>
            )}
          </SheetContent>
        </Sheet>

        <Sheet open={isTemplatesOpen} onOpenChange={setIsTemplatesOpen}>
          <SheetContent className="sm:max-w-[700px] overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle>Role Templates</SheetTitle>
              <SheetDescription>
                Save and apply role permission presets.
              </SheetDescription>
            </SheetHeader>

            <RoleTemplatesManager 
              catalog={catalog}
              canManage={canManageRoles}
            />
          </SheetContent>
        </Sheet>
      </div>
    </PageContainer>
  );
}
