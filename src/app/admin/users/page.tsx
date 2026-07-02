"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { MasterTable, ColumnDef } from "@/components/master-table";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { adminKeys, authKeys } from "@/lib/query-keys";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { LayoutTemplate } from "lucide-react";
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
}

type Scope = "own" | "branch" | "region" | "company" | "all";
const METRO_ROLE = "METRO";

interface EffectiveRolePermission {
  code: string;
  scope: Scope;
}

export default function UsersPage() {
  const { activeMembership, can } = useAuth();
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

  const canManageRoles = can("roles:manage");

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
    enabled: canManageRoles,
    initialData: { catalog: [], roles: [] },
  });
  const catalog = adminData?.catalog ?? [];
  const roles = adminData?.roles ?? [];

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
    [adminDataError, permissionsError].forEach((error) => {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    });
  }, [adminDataError, permissionsError]);

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
