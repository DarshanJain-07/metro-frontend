"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type Query,
} from "@tanstack/react-query";
import { ApiError, getApiErrorMessage, readApiError } from "@/lib/api";
import {
  buildAuthUrl,
  buildCurrentPathRedirect,
  LAST_AUTH_REDIRECT_STORAGE_KEY,
} from "@/lib/auth-redirect";
import { authKeys } from "@/lib/query-keys";
import type {
  AuthPendingState,
  AuthResult,
  Membership,
  Permission,
  User,
  AuthSession,
} from "@/lib/auth-types";

export type {
  AuthFactor,
  AuthOrganizationOption,
  AuthPendingState,
  AuthResult,
  Membership,
  Permission,
  Role,
  ScopedPermission,
  User,
} from "@/lib/auth-types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  isAuthActionLoading: boolean;
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

const EMPTY_SESSION: AuthSession = {
  user: null,
  active_membership: null,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SessionContext = createContext<
  | Pick<
      AuthContextType,
      | "user"
      | "isLoading"
      | "isInitializing"
      | "isAuthActionLoading"
      | "authError"
      | "refreshUser"
      | "refreshUserWithError"
    >
  | undefined
>(undefined);
const ActiveMembershipContext = createContext<
  Pick<AuthContextType, "activeMembership" | "setActiveMembership"> | undefined
>(undefined);
const AuthActionsContext = createContext<
  | Pick<
      AuthContextType,
      | "login"
      | "loginWithPassword"
      | "requestOtp"
      | "verifyOtp"
      | "startGoogleLogin"
      | "exchangeGoogleLogin"
      | "exchangeGoogleCode"
      | "challengeMfa"
      | "verifyMfa"
      | "selectOrganization"
      | "syncAuthProfile"
      | "logout"
    >
  | undefined
>(undefined);
const PermissionsContext = createContext<
  Pick<AuthContextType, "can"> | undefined
>(undefined);

function isPendingAuthPayload(payload: unknown): payload is AuthPendingState {
  if (!payload || typeof payload !== "object") return false;
  return (payload as { status?: unknown }).status === "pending";
}

function authQueryPredicate(query: Query) {
  return query.queryKey[0] === authKeys.all[0];
}

function getFallbackActiveMembership(session: AuthSession | undefined) {
  return (
    session?.active_membership ||
    session?.user?.memberships?.[0] ||
    null
  );
}

async function fetchAuthSession({ signal }: { signal?: AbortSignal }) {
  const response = await fetch("/api/auth/me", {
    credentials: "same-origin",
    signal,
  });
  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    return EMPTY_SESSION;
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      payload,
      message: getApiErrorMessage(payload, {
        status: response.status,
        fallback: "Could not load your app account.",
      }),
    });
  }

  return (payload || EMPTY_SESSION) as AuthSession;
}

async function postJson(
  path: string,
  body?: Record<string, unknown>,
  options: { fallback?: string } = {},
) {
  const response = await fetch(path, {
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    method: "POST",
  });

  if (!response.ok && response.status !== 202) {
    const payload = await response.json().catch(() => null);
    throw new ApiError({
      status: response.status,
      payload,
      message: getApiErrorMessage(payload, {
        status: response.status,
        fallback: options.fallback,
      }),
    });
  }

  return response;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isAuthActionLoading, setIsAuthActionLoading] = useState(false);
  const [localAuthError, setLocalAuthError] = useState<string | null>(null);
  const authErrorRef = useRef<string | null>(null);
  const isSigningOutRef = useRef(false);

  const sessionQuery = useQuery({
    queryKey: authKeys.session(),
    queryFn: fetchAuthSession,
  });

  const session = sessionQuery.data || EMPTY_SESSION;
  const user = session.user;
  const activeMembership = getFallbackActiveMembership(session);
  const queryAuthError =
    sessionQuery.error instanceof Error ? sessionQuery.error.message : null;
  const authError = localAuthError || queryAuthError;
  const isInitializing = sessionQuery.isPending;
  const isLoading = isInitializing || isAuthActionLoading;

  const setAuthError = useCallback((message: string | null) => {
    setLocalAuthError(message);
    authErrorRef.current = message;
  }, []);

  const clearScopedQueries = useCallback(() => {
    queryClient.removeQueries({
      predicate: (query) => !authQueryPredicate(query),
    });
  }, [queryClient]);

  const setSession = useCallback(
    (nextSession: AuthSession) => {
      isSigningOutRef.current = false;
      setAuthError(null);
      queryClient.setQueryData(authKeys.session(), nextSession);
    },
    [queryClient, setAuthError],
  );

  const clearAuthState = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("last_activity");
      localStorage.removeItem(LAST_AUTH_REDIRECT_STORAGE_KEY);
    }

    setAuthError(null);
    queryClient.setQueryData(authKeys.session(), EMPTY_SESSION);
    clearScopedQueries();
  }, [clearScopedQueries, queryClient, setAuthError]);

  const expireAuthSession = useCallback(() => {
    if (isSigningOutRef.current || typeof window === "undefined") return;

    const signInUrl = buildAuthUrl(
      "/sign-in",
      buildCurrentPathRedirect(
        window.location.pathname,
        new URLSearchParams(window.location.search),
      ),
    );

    isSigningOutRef.current = true;
    void fetch("/api/auth/logout", {
      credentials: "same-origin",
      method: "POST",
    });
    clearAuthState();
    router.replace(signInUrl);
  }, [clearAuthState, router]);

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
        return { user: null, error: message, pending: null };
      }

      const payload = (await response.json()) as AuthSession & {
        redirect_url?: string | null;
      };

      await queryClient.cancelQueries({ queryKey: authKeys.session() });
      clearScopedQueries();
      setSession({
        user: payload.user,
        active_membership: payload.active_membership,
      });

      return {
        user: payload.user,
        error: null,
        pending: null,
        redirectUrl: payload.redirect_url || null,
      };
    },
    [clearScopedQueries, queryClient, setAuthError, setSession],
  );

  const postAuthRequest = useCallback(
    async (
      path: string,
      body: Record<string, unknown>,
      fallback?: string,
    ): Promise<AuthResult> => {
      setIsAuthActionLoading(true);
      setAuthError(null);

      try {
        const response = await fetch(`/api/auth${path}`, {
          body: JSON.stringify(body),
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        return readAuthResult(response, fallback);
      } catch {
        const message = "Could not reach the app backend.";
        setAuthError(message);
        return {
          user: null,
          error: message,
          pending: null,
        };
      } finally {
        setIsAuthActionLoading(false);
      }
    },
    [readAuthResult, setAuthError],
  );

  const loginWithPassword = useCallback(
    (identifier: string, password: string) => {
      return postAuthRequest(
        "/login/password",
        { identifier, password },
        "Could not sign in. Please check your details.",
      );
    },
    [postAuthRequest],
  );

  const login = loginWithPassword;

  const requestOtp = useCallback(
    async (identifier: string) => {
      setIsAuthActionLoading(true);
      setAuthError(null);

      try {
        const response = await fetch("/api/auth/login/otp/start", {
          body: JSON.stringify({ identifier }),
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          const message = await readApiError(
            response,
            "Could not send a sign-in code.",
          );
          setAuthError(message);
          return { ok: false, error: message };
        }

        return { ok: true, error: null };
      } catch {
        const message = "Could not reach the app backend.";
        setAuthError(message);
        return { ok: false, error: message };
      } finally {
        setIsAuthActionLoading(false);
      }
    },
    [setAuthError],
  );

  const verifyOtp = useCallback(
    (identifier: string, code: string) => {
      return postAuthRequest(
        "/login/otp/verify",
        { identifier, code },
        "Could not verify the sign-in code.",
      );
    },
    [postAuthRequest],
  );

  const startGoogleLogin = useCallback(
    async (redirectUrl: string) => {
      setIsAuthActionLoading(true);
      setAuthError(null);

      try {
        const params = new URLSearchParams({ redirect_url: redirectUrl });
        const response = await fetch(
          `/api/auth/login/google/start?${params.toString()}`,
          {
            credentials: "same-origin",
          },
        );
        if (!response.ok) {
          const message = await readApiError(
            response,
            "Could not start Google sign-in.",
          );
          setAuthError(message);
          return { error: message };
        }

        const payload = (await response.json()) as {
          authorization_url?: string;
        };
        if (!payload.authorization_url) {
          const message = "Could not start Google sign-in.";
          setAuthError(message);
          return { error: message };
        }

        window.location.assign(payload.authorization_url);
        return { error: null };
      } catch {
        const message = "Could not reach the app backend.";
        setAuthError(message);
        return { error: message };
      } finally {
        setIsAuthActionLoading(false);
      }
    },
    [setAuthError],
  );

  const exchangeGoogleLogin = useCallback(
    (exchangeCode: string) => {
      return postAuthRequest(
        "/login/google/exchange",
        { exchange_code: exchangeCode },
        "Could not complete Google sign-in.",
      );
    },
    [postAuthRequest],
  );

  const exchangeGoogleCode = useCallback(
    (code: string, state: string) => {
      return postAuthRequest(
        "/login/google/exchange",
        { code, state },
        "Could not complete Google sign-in.",
      );
    },
    [postAuthRequest],
  );

  const challengeMfa = useCallback(
    async (authenticationFactorId: string) => {
      setIsAuthActionLoading(true);
      setAuthError(null);

      try {
        const response = await fetch("/api/auth/login/mfa/challenge", {
          body: JSON.stringify({
            authentication_factor_id: authenticationFactorId,
          }),
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });

        if (!response.ok) {
          const message = await readApiError(
            response,
            "Could not start MFA verification.",
          );
          setAuthError(message);
          return { authenticationChallengeId: null, error: message };
        }

        const payload = (await response.json()) as {
          authentication_challenge_id?: string;
        };
        return {
          authenticationChallengeId:
            payload.authentication_challenge_id || null,
          error: null,
        };
      } catch {
        const message = "Could not reach the app backend.";
        setAuthError(message);
        return {
          authenticationChallengeId: null,
          error: message,
        };
      } finally {
        setIsAuthActionLoading(false);
      }
    },
    [setAuthError],
  );

  const verifyMfa = useCallback(
    (
      pendingAuthenticationToken: string,
      authenticationChallengeId: string,
      code: string,
    ) => {
      return postAuthRequest(
        "/login/mfa/verify",
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
        "/login/organization/select",
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
    setIsAuthActionLoading(true);
    setAuthError(null);

    try {
      const response = await fetch("/api/auth/sync", {
        credentials: "same-origin",
        method: "POST",
      });

      if (!response.ok) {
        const message = await readApiError(response);
        if (response.status === 401 || response.status === 403) {
          clearAuthState();
        }
        setAuthError(message);
        return null;
      }

      const payload = (await response.json()) as AuthSession;
      setSession(payload);
      return payload.user;
    } catch {
      const message = "Could not reach the app backend.";
      setAuthError(message);
      return null;
    } finally {
      setIsAuthActionLoading(false);
    }
  }, [clearAuthState, setAuthError, setSession]);

  const refreshUser = useCallback(async () => {
    const nextSession = await queryClient.fetchQuery({
      queryKey: authKeys.session(),
      queryFn: fetchAuthSession,
    });

    if (!nextSession.user) {
      return null;
    }

    setSession(nextSession);
    return nextSession.user;
  }, [queryClient, setSession]);

  const refreshUserWithError = useCallback(async () => {
    const nextUser = await refreshUser();
    return { user: nextUser, error: nextUser ? null : authErrorRef.current };
  }, [refreshUser]);

  const logout = useCallback(async () => {
    if (isSigningOutRef.current) return;
    isSigningOutRef.current = true;

    await fetch("/api/auth/logout", {
      credentials: "same-origin",
      method: "POST",
    }).catch(() => undefined);

    clearAuthState();
    router.push("/sign-in");
  }, [clearAuthState, router]);

  const activeMembershipMutation = useMutation({
    mutationFn: async (membership: Membership) => {
      const response = await postJson(
        "/api/auth/active-membership",
        { membershipId: membership.id },
        { fallback: "Could not switch active membership." },
      );
      return (await response.json()) as AuthSession;
    },
    onMutate: (membership) => {
      queryClient.setQueryData<AuthSession>(
        authKeys.session(),
        (current = EMPTY_SESSION) => ({
          ...current,
          active_membership: membership,
        }),
      );
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Could not switch active membership.";
      setAuthError(message);
      void queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
    onSuccess: (nextSession) => {
      setSession(nextSession);
      clearScopedQueries();
      router.refresh();
    },
  });
  const { mutate: mutateActiveMembership } = activeMembershipMutation;

  useEffect(() => {
    window.addEventListener("metro:auth-expired", expireAuthSession);
    return () => {
      window.removeEventListener("metro:auth-expired", expireAuthSession);
    };
  }, [expireAuthSession]);

  const setActiveMembership = useCallback(
    (membership: Membership) => {
      mutateActiveMembership(membership);
    },
    [mutateActiveMembership],
  );

  const can = useCallback(
    (permission: Permission) => {
      if (!user) return false;
      const permissions =
        activeMembership?.permissions !== undefined
          ? activeMembership.permissions
          : user.permissions || [];
      return permissions.includes("*") || permissions.includes(permission);
    },
    [activeMembership, user],
  );

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isInitializing,
      isAuthActionLoading,
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
    }),
    [
      user,
      isLoading,
      isInitializing,
      isAuthActionLoading,
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
    ],
  );
  const sessionValue = useMemo(
    () => ({
      user,
      isLoading,
      isInitializing,
      isAuthActionLoading,
      authError,
      refreshUser,
      refreshUserWithError,
    }),
    [
      user,
      isLoading,
      isInitializing,
      isAuthActionLoading,
      authError,
      refreshUser,
      refreshUserWithError,
    ],
  );
  const activeMembershipValue = useMemo(
    () => ({
      activeMembership,
      setActiveMembership,
    }),
    [activeMembership, setActiveMembership],
  );
  const authActionsValue = useMemo(
    () => ({
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
      logout,
    }),
    [
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
      logout,
    ],
  );
  const permissionsValue = useMemo(() => ({ can }), [can]);

  return (
    <AuthContext.Provider value={value}>
      <SessionContext.Provider value={sessionValue}>
        <ActiveMembershipContext.Provider value={activeMembershipValue}>
          <AuthActionsContext.Provider value={authActionsValue}>
            <PermissionsContext.Provider value={permissionsValue}>
              {children}
            </PermissionsContext.Provider>
          </AuthActionsContext.Provider>
        </ActiveMembershipContext.Provider>
      </SessionContext.Provider>
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

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within an AuthProvider");
  }
  return context;
}

export function useActiveMembership() {
  const context = useContext(ActiveMembershipContext);
  if (context === undefined) {
    throw new Error("useActiveMembership must be used within an AuthProvider");
  }
  return context;
}

export function useAuthActions() {
  const context = useContext(AuthActionsContext);
  if (context === undefined) {
    throw new Error("useAuthActions must be used within an AuthProvider");
  }
  return context;
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within an AuthProvider");
  }
  return context;
}
