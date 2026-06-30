"use client";

import { useEffect, useState } from "react";

import { MasterTable, ColumnDef } from "@/components/master-table";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { fetchWithAuth, readApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
  const { can } = useAuth();
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Record<string, PermissionState>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<Record<string, PermissionState> | null>(null);

  const canManageRoles = can("roles:manage");

  useEffect(() => {
    if (!canManageRoles) return;

    async function loadAdminData() {
      const [catalogResponse, rolesResponse] = await Promise.all([
        fetchWithAuth("/api/v1/auth/permission-catalog/"),
        fetchWithAuth("/api/v1/auth/roles/"),
      ]);
      if (!catalogResponse.ok) {
        toast.error("Could not load permissions catalog.");
      } else {
        const payload = await catalogResponse.json();
        setCatalog(payload.results || payload);
      }
      if (!rolesResponse.ok) {
        toast.error("Could not load roles.");
      } else {
        const payload = await rolesResponse.json();
        setRoles(payload.results || payload);
      }
    }

    loadAdminData();
  }, [canManageRoles]);

  useEffect(() => {
    if (!canManageRoles || !role) return;

    async function loadEffectivePermissions() {
      setIsLoading(true);
      const response = await fetchWithAuth(`/api/v1/auth/company-role-permissions/?role=${role}`);
      setIsLoading(false);
      if (!response.ok) {
        toast.error("Could not load role permissions.");
        return;
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
      setPermissions(nextState);
    }

    loadEffectivePermissions();
  }, [canManageRoles, role, catalog]);

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

    setPermissions(prev => {
      const next = { ...prev };
      if (enabled) {
        next[code] = { enabled: true, scope };
      } else {
        delete next[code];
      }
      return next;
    });
    toast.success(`${enabled ? 'Enabled' : 'Disabled'} permission.`);
  }

  const handleCopy = () => {
    setClipboard({ ...permissions });
    toast.success("Permissions copied to clipboard.");
  };

  const handlePaste = async () => {
    if (!clipboard || !role || role === METRO_ROLE) return;
    
    setIsLoading(true);
    const codes = Object.keys(clipboard);
    const results = await Promise.all(codes.map(code => 
      fetchWithAuth("/api/v1/auth/company-role-overrides/", {
        method: "POST",
        body: JSON.stringify({
          role,
          permission_code: code,
          enabled: clipboard[code].enabled,
          scope: clipboard[code].scope,
        }),
      })
    ));

    setIsLoading(false);
    if (results.every(r => r.ok)) {
      setPermissions({ ...clipboard });
      toast.success("Permissions pasted successfully.");
    } else {
      toast.error("Some permissions could not be pasted.");
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
                  isSaving={!!savingCode || isLoading}
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
