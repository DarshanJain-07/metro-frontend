export type Role = string;

export type Permission = string;

export interface ScopedPermission {
  code: Permission;
  scope: "own" | "branch" | "region" | "company" | "all";
}

export interface Membership {
  id: string;
  company: number;
  company_name: string;
  branch: string | null;
  branch_name: string | null;
  role: Role;
  permissions?: Permission[];
  scoped_permissions?: ScopedPermission[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  branch_name: string | null;
  is_superuser: boolean;
  is_owner: boolean;
  memberships: Membership[];
  permissions?: Permission[];
  scoped_permissions?: ScopedPermission[];
}

export interface AuthFactor {
  id: string;
  type?: string;
  totp?: {
    issuer?: string;
    user?: string;
  };
}

export interface AuthOrganizationOption {
  id: string;
  name: string;
}

export interface AuthPendingState {
  status: "pending";
  type?: string;
  detail?: string;
  pending_authentication_token?: string;
  authentication_factors?: AuthFactor[];
  organizations?: AuthOrganizationOption[];
  email?: string;
  email_verification_id?: string;
  company_name?: string;
  signup_request_id?: string;
}

export interface AuthSession {
  user: User | null;
  active_membership: Membership | null;
}

export interface AuthResult {
  user: User | null;
  error: string | null;
  pending?: AuthPendingState | null;
  redirectUrl?: string | null;
}
