"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CompactSelect } from "@/components/ui/form-elements";
import { MatrixPermissionsEditor, Permission, PermissionState } from "./matrix-permissions-editor";
import { toast } from "sonner";
import { fetchWithAuth } from "@/lib/api";
import { Trash2, CheckCircle2, Loader2 } from "lucide-react";
import { CompactInput } from "@/components/ui/form-elements";
import { useAuth } from "@/lib/auth-context";
import { adminKeys, authKeys } from "@/lib/query-keys";

interface Preset {
  id: string;
  name: string;
  permissions: Record<string, PermissionState>;
}

interface RoleTemplatesManagerProps {
  catalog: Permission[];
  canManage: boolean;
}

interface RoleDefinition {
  code: string;
  name: string;
}

const METRO_ROLE = "METRO";

export function RoleTemplatesManager({ catalog, canManage }: RoleTemplatesManagerProps) {
  const { activeMembership } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [rolePermissionOverrides, setRolePermissionOverrides] = useState<{
    role: string;
    permissions: Record<string, PermissionState>;
  } | null>(null);
  const [presets, setPresets] = useState<Preset[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("permission_presets");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse presets", e);
        }
      }
    }
    return [];
  });
  const [newPresetName, setNewPresetName] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const {
    data: loadedRoles,
    error: rolesError,
  } = useQuery({
    queryKey: adminKeys.roles(activeMembership?.id),
    queryFn: async ({ signal }) => {
      const response = await fetchWithAuth("/api/v1/auth/roles/", { signal });
      if (!response.ok) {
        throw new Error("Could not load roles.");
      }
      const payload = await response.json();
      return (payload.results || payload) as RoleDefinition[];
    },
    enabled: canManage,
    initialData: [] as RoleDefinition[],
  });
  const roles = loadedRoles ?? [];
  const effectiveSelectedRole = selectedRole || roles[0]?.code || "";

  // Save presets to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("permission_presets", JSON.stringify(presets));
  }, [presets]);

  const {
    data: loadedRolePermissions,
    error: rolePermissionsError,
    isLoading,
  } = useQuery({
    queryKey: [
      ...adminKeys.rolePermissions(activeMembership?.id, effectiveSelectedRole),
      catalog.map((permission) => permission.code),
    ],
    queryFn: async ({ signal }) => {
      const response = await fetchWithAuth(
        `/api/v1/auth/company-role-permissions/?role=${effectiveSelectedRole}`,
        { signal },
      );
      if (response.ok) {
        const payload = await response.json();
        const perms = (payload[0]?.permissions || []) as { code: string; scope: string }[];
        const nextState: Record<string, PermissionState> = {};
        if (effectiveSelectedRole === METRO_ROLE && perms.some((p) => p.code === "*")) {
          catalog.forEach((permission) => {
            nextState[permission.code] = { enabled: true, scope: "all" };
          });
        } else {
          perms.forEach(p => {
            nextState[p.code] = { enabled: true, scope: p.scope };
          });
        }
        return nextState;
      }
      throw new Error("Could not load role permissions.");
    },
    enabled: canManage && !!effectiveSelectedRole,
    initialData: {} as Record<string, PermissionState>,
  });
  const rolePermissions =
    rolePermissionOverrides?.role === effectiveSelectedRole
      ? rolePermissionOverrides.permissions
      : loadedRolePermissions ?? {};

  useEffect(() => {
    [rolesError, rolePermissionsError].forEach((error) => {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    });
  }, [rolesError, rolePermissionsError]);
const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

// ... (existing useEffects)

// Clear delete confirmation after 3 seconds
useEffect(() => {
  if (confirmDeleteId) {
    const timer = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(timer);
  }
}, [confirmDeleteId]);

const handleToggle = (code: string, enabled: boolean) => {
  if (effectiveSelectedRole === METRO_ROLE) return;
  setRolePermissionOverrides(prevOverrides => {
    const prev =
      prevOverrides?.role === effectiveSelectedRole
        ? prevOverrides.permissions
        : rolePermissions;
    const next = { ...prev };
    if (enabled) {
      next[code] = { enabled: true, scope: "branch" };
    } else {
      delete next[code];
    }
    return { role: effectiveSelectedRole, permissions: next };
  });
};

const saveAsPreset = () => {
  if (!newPresetName.trim()) {
    toast.error("Please enter a preset name.");
    return;
  }
  const newPreset: Preset = {
    id: crypto.randomUUID(),
    name: newPresetName.trim(),
    permissions: { ...rolePermissions },
  };
  setPresets(prev => [...prev, newPreset]);
  setNewPresetName("");
  toast.success(`Preset "${newPreset.name}" saved.`);
};

const deletePreset = (id: string) => {
  if (confirmDeleteId !== id) {
    setConfirmDeleteId(id);
    return;
  }
  setPresets(prev => prev.filter(p => p.id !== id));
  setConfirmDeleteId(null);
  toast.success("Preset deleted.");
};

const applyPreset = (preset: Preset) => {
  setRolePermissionOverrides({
    role: effectiveSelectedRole,
    permissions: { ...preset.permissions },
  });
  toast.success(`Loaded preset "${preset.name}" into the matrix.`);
};
  const applyToRole = async () => {
    if (!effectiveSelectedRole || isApplying || effectiveSelectedRole === METRO_ROLE) return;

    setIsApplying(true);
    toast.loading("Applying template to all users of this role...", { id: "apply-role" });

    try {
      // We need to clear existing overrides and apply new ones
      // Since our API currently works per-permission, we'll iterate
      // A batch API would be better, but we work with what we have
      
      // For simplicity in this demo/MVP, we apply all enabled ones
      // and we might want to disable others that are not in the template
      // but the backend logic for overrides is incremental.
      
      const results = await Promise.all(
        catalog.map(p => {
          const state = rolePermissions[p.code];
          return fetchWithAuth("/api/v1/auth/company-role-overrides/", {
            method: "POST",
            body: JSON.stringify({
              role: effectiveSelectedRole,
              permission_code: p.code,
              enabled: !!state?.enabled,
              scope: state?.scope || "branch",
            }),
          });
        })
      );

      if (results.every(r => r.ok)) {
        void queryClient.invalidateQueries({
          queryKey: adminKeys.rolePermissions(
            activeMembership?.id,
            effectiveSelectedRole,
          ),
        });
        void queryClient.invalidateQueries({ queryKey: authKeys.session() });
        toast.success(`Template applied to all ${effectiveSelectedRole} users.`, { id: "apply-role" });
      } else {
        toast.error("Some permissions failed to apply.", { id: "apply-role" });
      }
    } catch {
      toast.error("An error occurred while applying the template.", { id: "apply-role" });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <CompactSelect
            value={effectiveSelectedRole}
            onValueChange={setSelectedRole}
            options={roles.map((item) => ({ label: item.name, value: item.code }))}
            className="flex-1"
          />
          <Button 
            onClick={applyToRole} 
            disabled={isApplying || isLoading || effectiveSelectedRole === METRO_ROLE}
            className="shrink-0"
          >
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Apply to All
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          <CompactInput 
            placeholder="Preset name"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            className="flex-1 h-9 text-xs"
          />
          <Button variant="outline" size="sm" onClick={saveAsPreset} className="h-9">
            Save
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {presets.length === 0 && (
            <p className="text-xs text-muted-foreground">No presets</p>
          )}
          {presets.map(preset => (
            <div 
              key={preset.id} 
              className={cn(
                "group flex items-center gap-1 pl-3 pr-1 py-1 bg-card border border-border rounded-full text-xs font-medium transition-all cursor-pointer",
                confirmDeleteId === preset.id ? "border-destructive bg-destructive/5" : "hover:border-primary"
              )}
              onClick={() => applyPreset(preset)}
            >
              <span className={cn(confirmDeleteId === preset.id && "text-destructive")}>
                {preset.name}
                {confirmDeleteId === preset.id && <span className="ml-1 text-[10px] font-medium">(Tap again to delete)</span>}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); deletePreset(preset.id); }}
                className={cn(
                  "p-1 rounded-full transition-all",
                  confirmDeleteId === preset.id 
                    ? "bg-destructive text-destructive-foreground opacity-100" 
                    : "hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100"
                )}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        {effectiveSelectedRole === METRO_ROLE && (
          <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Metro is built in with every permission. Templates and overrides cannot change it.
          </p>
        )}
        <MatrixPermissionsEditor
          catalog={catalog}
          permissions={rolePermissions}
          onToggle={handleToggle}
          onCopy={() => {
            const str = JSON.stringify(rolePermissions);
            navigator.clipboard.writeText(str);
            toast.success("Matrix copied to clipboard.");
          }}
          onPaste={async () => {
            try {
              const str = await navigator.clipboard.readText();
              const parsed = JSON.parse(str);
              setRolePermissionOverrides({
                role: effectiveSelectedRole,
                permissions: parsed,
              });
              toast.success("Matrix pasted from clipboard.");
            } catch {
              toast.error("Invalid matrix data in clipboard.");
            }
          }}
          isSaving={isLoading || isApplying}
          readOnly={effectiveSelectedRole === METRO_ROLE}
        />
      </div>
    </div>
  );
}
