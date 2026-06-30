"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  API_URL,
  fetchWithAuth,
  getActiveContextHeaders,
  readApiError,
  setAuthTokenGetter,
  setAuthTokenRefresher,
} from "@/lib/api";
import {
  buildAuthUrl,
  buildCurrentPathRedirect,
  LAST_AUTH_REDIRECT_STORAGE_KEY,
} from "@/lib/auth-redirect";

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
}

export interface AuthResult {
  user: User | null;
  error: string | null;
  pending?: AuthPendingState | null;
  redirectUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  authError: string | null;
  login: (identifier: string, password: string) => Promise<AuthResult>;
  loginWithPassword: (
    identifier: string,
    password: string,
  ) => Promise<AuthResult>;
  requestOtp: (
    identifier: string,
  ) => Promise<{ ok: boolean; error: string | null }>;
  verifyOtp: (identifier: string, code: string) => Promise<AuthResult>;
  startGoogleLogin: (redirectUrl: string) => Promise<{ error: string | null }>;
  exchangeGoogleLogin: (exchangeCode: string) => Promise<AuthResult>;
  exchangeGoogleCode: (code: string, state: string) => Promise<AuthResult>;
  challengeMfa: (authenticationFactorId: string) => Promise<{
    authenticationChallengeId: string | null;
    error: string | null;
  }>;
  verifyMfa: (
    pendingAuthenticationToken: string,
    authenticationChallengeId: string,
    code: string,
  ) => Promise<AuthResult>;
  selectOrganization: (
    pendingAuthenticationToken: string,
    organizationId: string,
  ) => Promise<AuthResult>;
  syncAuthProfile: () => Promise<User | null>;
  refreshUser: () => Promise<User | null>;
  refreshUserWithError: () => Promise<{
    user: User | null;
    error: string | null;
  }>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
  activeMembership: Membership | null;
  setActiveMembership: (membership: Membership) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BACKEND_UNREACHABLE_MESSAGE = `Could not reach the backend at ${API_URL}. Make sure the API server is running and CORS allows this frontend.`;
const ACCESS_TOKEN_STORAGE_KEY = "metro:access-token";
const REFRESH_TOKEN_STORAGE_KEY = "metro:refresh-token";

async function readAuthError(response: Response) {
  const fallback =
    response.status === 401 || response.status === 403
      ? "Your session was not accepted by the app backend."
      : "Could not load your app account. Please check your user membership.";

  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
  }

  return fallback;
}

function isPendingAuthPayload(payload: unknown): payload is AuthPendingState {
  if (!payload || typeof payload !== "object") return false;
  return (payload as { status?: unknown }).status === "pending";
}

function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function getStoredRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
}

async function refreshStoredAccessToken() {
  const refresh = getStoredRefreshToken();
  if (!refresh) return null;

  const response = await fetch(`${API_URL}/api/v1/auth/token/refresh/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    access: string;
    refresh?: string;
  };
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, payload.access);
  if (payload.refresh) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, payload.refresh);
  }
  return payload.access;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const authErrorRef = useRef<string | null>(null);
  const [activeMembership, setActiveMembershipState] =
    useState<Membership | null>(null);
  const router = useRouter();
  const isSigningOutRef = useRef(false);

  useEffect(() => {
    setAuthTokenGetter(async () => getStoredAccessToken());
    setAuthTokenRefresher(refreshStoredAccessToken);

    return () => {
      setAuthTokenGetter(null);
      setAuthTokenRefresher(null);
    };
  }, []);

  const applyUser = useCallback((nextUser: User) => {
    const storedId = localStorage.getItem("active_membership_id");
    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
    setAuthError(null);
    authErrorRef.current = null;

    if (nextUser.memberships.length > 0) {
      const defaultMembership =
        nextUser.memberships.find((membership) => membership.id === storedId) ||
        nextUser.memberships[0];
      setActiveMembershipState(defaultMembership);
      localStorage.setItem("active_membership_id", defaultMembership.id);
    } else {
      setActiveMembershipState(null);
      localStorage.removeItem("active_membership_id");
    }
  }, []);

  const clearAuthState = useCallback(() => {
    localStorage.removeItem("user");
    localStorage.removeItem("active_membership_id");
    localStorage.removeItem("last_activity");
    localStorage.removeItem(LAST_AUTH_REDIRECT_STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    setUser(null);
    setActiveMembershipState(null);
    setAuthError(null);
    authErrorRef.current = null;
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getStoredAccessToken() || (await refreshStoredAccessToken());
    if (!token) {
      clearAuthState();
      window.dispatchEvent(new Event("metro:auth-expired"));
      return null;
    }

    const headers = getActiveContextHeaders();
    headers.set("Authorization", `Bearer ${token}`);

    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/v1/auth/me/`, {
        headers,
      });

      if (response.status === 401) {
        const refreshedToken = await refreshStoredAccessToken();
        if (refreshedToken) {
          headers.set("Authorization", `Bearer ${refreshedToken}`);
          response = await fetch(`${API_URL}/api/v1/auth/me/`, {
            headers,
          });
        }
      }
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("active_membership_id");
      setUser(null);
      setActiveMembershipState(null);
      setAuthError(BACKEND_UNREACHABLE_MESSAGE);
      authErrorRef.current = BACKEND_UNREACHABLE_MESSAGE;
      return null;
    }

    if (!response.ok) {
      const message = await readAuthError(response);
      clearAuthState();
      setAuthError(message);
      authErrorRef.current = message;
      if (response.status === 401) {
        window.dispatchEvent(new Event("metro:auth-expired"));
      }
      return null;
    }

    const nextUser = (await response.json()) as User;
    applyUser(nextUser);
    return nextUser;
  }, [applyUser, clearAuthState]);

  const refreshUserWithError = useCallback(async () => {
    const nextUser = await refreshUser();
    return { user: nextUser, error: nextUser ? null : authErrorRef.current };
  }, [refreshUser]);

  const applyTokenPayload = useCallback(
    (payload: {
      access: string;
      refresh: string;
      user: User;
      redirect_url?: string;
    }) => {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, payload.access);
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, payload.refresh);
      applyUser(payload.user);
      return {
        user: payload.user,
        error: null,
        pending: null,
        redirectUrl: payload.redirect_url || null,
      };
    },
    [applyUser],
  );

  const readAuthResult = useCallback(
    async (
      response: Response,
      fallback = "Could not sign in. Please check your details.",
    ): Promise<AuthResult> => {
      if (response.status === 202) {
        const payload = await response.json().catch(() => null);
        if (isPendingAuthPayload(payload)) {
          return { user: null, error: null, pending: payload };
        }
      }

      if (!response.ok) {
        const message = await readApiError(response, fallback);
        setAuthError(message);
        authErrorRef.current = message;
        return { user: null, error: message, pending: null };
      }

      const payload = (await response.json()) as {
        access: string;
        refresh: string;
        user: User;
        redirect_url?: string;
      };

      return applyTokenPayload(payload);
    },
    [applyTokenPayload],
  );

  const postAuthRequest = useCallback(
    async (
      path: string,
      body: Record<string, unknown>,
      fallback?: string,
    ): Promise<AuthResult> => {
      setIsLoading(true);
      setAuthError(null);
      authErrorRef.current = null;

      try {
        const response = await fetch(`${API_URL}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        return readAuthResult(response, fallback);
      } catch {
        setAuthError(BACKEND_UNREACHABLE_MESSAGE);
        authErrorRef.current = BACKEND_UNREACHABLE_MESSAGE;
        return {
          user: null,
          error: BACKEND_UNREACHABLE_MESSAGE,
          pending: null,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [readAuthResult],
  );

  const loginWithPassword = useCallback(
    (identifier: string, password: string) => {
      return postAuthRequest(
        "/api/v1/auth/login/password/",
        { identifier, password },
        "Could not sign in. Please check your details.",
      );
    },
    [postAuthRequest],
  );

  const login = loginWithPassword;

  const requestOtp = useCallback(async (identifier: string) => {
    setIsLoading(true);
    setAuthError(null);
    authErrorRef.current = null;

    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login/otp/start/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier }),
      });

      if (!response.ok) {
        const message = await readApiError(
          response,
          "Could not send a sign-in code.",
        );
        setAuthError(message);
        authErrorRef.current = message;
        return { ok: false, error: message };
      }

      return { ok: true, error: null };
    } catch {
      setAuthError(BACKEND_UNREACHABLE_MESSAGE);
      authErrorRef.current = BACKEND_UNREACHABLE_MESSAGE;
      return { ok: false, error: BACKEND_UNREACHABLE_MESSAGE };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(
    (identifier: string, code: string) => {
      return postAuthRequest(
        "/api/v1/auth/login/otp/verify/",
        { identifier, code },
        "Could not verify the sign-in code.",
      );
    },
    [postAuthRequest],
  );

  const startGoogleLogin = useCallback(async (redirectUrl: string) => {
    setIsLoading(true);
    setAuthError(null);
    authErrorRef.current = null;

    try {
      const params = new URLSearchParams({ redirect_url: redirectUrl });
      const response = await fetch(
        `${API_URL}/api/v1/auth/login/google/start/?${params.toString()}`,
      );
      if (!response.ok) {
        const message = await readApiError(
          response,
          "Could not start Google sign-in.",
        );
        setAuthError(message);
        authErrorRef.current = message;
        return { error: message };
      }

      const payload = (await response.json()) as { authorization_url?: string };
      if (!payload.authorization_url) {
        const message = "Could not start Google sign-in.";
        setAuthError(message);
        authErrorRef.current = message;
        return { error: message };
      }

      window.location.assign(payload.authorization_url);
      return { error: null };
    } catch {
      setAuthError(BACKEND_UNREACHABLE_MESSAGE);
      authErrorRef.current = BACKEND_UNREACHABLE_MESSAGE;
      return { error: BACKEND_UNREACHABLE_MESSAGE };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const exchangeGoogleLogin = useCallback(
    (exchangeCode: string) => {
      return postAuthRequest(
        "/api/v1/auth/login/google/exchange/",
        { exchange_code: exchangeCode },
        "Could not complete Google sign-in.",
      );
    },
    [postAuthRequest],
  );

  const exchangeGoogleCode = useCallback(
    (code: string, state: string) => {
      return postAuthRequest(
        "/api/v1/auth/login/google/exchange/",
        { code, state },
        "Could not complete Google sign-in.",
      );
    },
    [postAuthRequest],
  );

  const challengeMfa = useCallback(async (authenticationFactorId: string) => {
    setIsLoading(true);
    setAuthError(null);
    authErrorRef.current = null;

    try {
      const response = await fetch(
        `${API_URL}/api/v1/auth/login/mfa/challenge/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            authentication_factor_id: authenticationFactorId,
          }),
        },
      );

      if (!response.ok) {
        const message = await readApiError(
          response,
          "Could not start MFA verification.",
        );
        setAuthError(message);
        authErrorRef.current = message;
        return { authenticationChallengeId: null, error: message };
      }

      const payload = (await response.json()) as {
        authentication_challenge_id?: string;
      };
      return {
        authenticationChallengeId: payload.authentication_challenge_id || null,
        error: null,
      };
    } catch {
      setAuthError(BACKEND_UNREACHABLE_MESSAGE);
      authErrorRef.current = BACKEND_UNREACHABLE_MESSAGE;
      return {
        authenticationChallengeId: null,
        error: BACKEND_UNREACHABLE_MESSAGE,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyMfa = useCallback(
    (
      pendingAuthenticationToken: string,
      authenticationChallengeId: string,
      code: string,
    ) => {
      return postAuthRequest(
        "/api/v1/auth/login/mfa/verify/",
        {
          pending_authentication_token: pendingAuthenticationToken,
          authentication_challenge_id: authenticationChallengeId,
          code,
        },
        "Could not verify the MFA code.",
      );
    },
    [postAuthRequest],
  );

  const selectOrganization = useCallback(
    (pendingAuthenticationToken: string, organizationId: string) => {
      return postAuthRequest(
        "/api/v1/auth/login/organization/select/",
        {
          pending_authentication_token: pendingAuthenticationToken,
          organization_id: organizationId,
        },
        "Could not select that organization.",
      );
    },
    [postAuthRequest],
  );

  const syncAuthProfile = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    authErrorRef.current = null;

    try {
      const response = await fetchWithAuth("/api/v1/auth/sync/", {
        method: "POST",
      });

      if (!response.ok) {
        const message = await readAuthError(response);
        clearAuthState();
        setAuthError(message);
        authErrorRef.current = message;
        return null;
      }

      const nextUser = (await response.json()) as User;
      applyUser(nextUser);
      return nextUser;
    } catch {
      setAuthError(BACKEND_UNREACHABLE_MESSAGE);
      authErrorRef.current = BACKEND_UNREACHABLE_MESSAGE;
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [applyUser, clearAuthState]);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      setIsLoading(true);
      const storedUser = localStorage.getItem("user");
      const storedId = localStorage.getItem("active_membership_id");

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser) as User;
          if (isMounted) {
            setUser(parsedUser);
            if (parsedUser.memberships.length > 0) {
              setActiveMembershipState(
                parsedUser.memberships.find(
                  (membership) => membership.id === storedId,
                ) || parsedUser.memberships[0],
              );
            }
          }
        } catch {
          localStorage.removeItem("user");
        }
      }

      if (getStoredRefreshToken()) {
        await refreshUser();
      } else {
        clearAuthState();
      }
      if (isMounted) setIsLoading(false);
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, [clearAuthState, refreshUser]);

  const logout = useCallback(async () => {
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;
    clearAuthState();
    try {
      router.push("/sign-in");
    } finally {
      isSigningOutRef.current = false;
    }
  }, [clearAuthState, router]);

  useEffect(() => {
    const handleAuthExpired = () => {
      if (isSigningOutRef.current) return;

      const signInUrl = buildAuthUrl(
        "/sign-in",
        buildCurrentPathRedirect(
          window.location.pathname,
          new URLSearchParams(window.location.search),
        ),
      );

      isSigningOutRef.current = true;
      clearAuthState();
      router.replace(signInUrl);
      isSigningOutRef.current = false;
    };

    window.addEventListener("metro:auth-expired", handleAuthExpired);
    return () => {
      window.removeEventListener("metro:auth-expired", handleAuthExpired);
    };
  }, [clearAuthState, router]);

  const setActiveMembership = (membership: Membership) => {
    setActiveMembershipState(membership);
    localStorage.setItem("active_membership_id", membership.id);
  };

  const can = (permission: Permission) => {
    if (!user) return false;
    const permissions = user.permissions || [];
    return permissions.includes("*") || permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        authError,
        login,
        loginWithPassword,
        requestOtp,
        verifyOtp,
        startGoogleLogin,
        exchangeGoogleLogin,
        exchangeGoogleCode,
        challengeMfa,
        verifyMfa,
        selectOrganization,
        syncAuthProfile,
        refreshUser,
        refreshUserWithError,
        logout,
        can,
        activeMembership,
        setActiveMembership,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
