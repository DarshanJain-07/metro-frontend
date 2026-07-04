import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  ACTIVE_CONTEXT_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  getCookieSecurityOptions,
} from "@/lib/auth-cookies";
import type { AuthSession, Membership, User } from "@/lib/auth-types";

type BackendFetchResult = {
  response: Response;
  refreshedTokens?: AuthTokenPayload;
  shouldClearAuth?: boolean;
};

type AuthTokenPayload = {
  access: string;
  refresh?: string;
};

type BackendFetchOptions = {
  body?: BodyInit | null;
  headers?: HeadersInit;
  method?: string;
  search?: string;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function getBackendBaseUrl() {
  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("API_URL or NEXT_PUBLIC_API_URL is not defined");
  }

  return apiUrl;
}

export function getBackendUrl(path: string, search = "") {
  const baseUrl = new URL(getBackendBaseUrl());
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl);
  url.search = search;
  return url;
}

function createForwardHeaders(
  incomingHeaders: HeadersInit | undefined,
  token?: string,
) {
  const headers = new Headers(incomingHeaders);

  for (const headerName of HOP_BY_HOP_HEADERS) {
    headers.delete(headerName);
  }

  headers.delete("authorization");
  headers.delete("cookie");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function getAuthCookieSnapshot() {
  const cookieStore = await cookies();

  return {
    accessToken: cookieStore.get(AUTH_COOKIE_NAMES.accessToken)?.value || null,
    refreshToken: cookieStore.get(AUTH_COOKIE_NAMES.refreshToken)?.value || null,
    activeMembershipId:
      cookieStore.get(AUTH_COOKIE_NAMES.activeMembershipId)?.value || null,
    activeCompanyId:
      cookieStore.get(AUTH_COOKIE_NAMES.activeCompanyId)?.value || null,
    activeOfficeId:
      cookieStore.get(AUTH_COOKIE_NAMES.activeOfficeId)?.value || null,
  };
}

function attachActiveContextHeaders(
  headers: Headers,
  snapshot: Awaited<ReturnType<typeof getAuthCookieSnapshot>>,
) {
  if (snapshot.activeCompanyId && !headers.has("X-Company-ID")) {
    headers.set("X-Company-ID", snapshot.activeCompanyId);
  }

  if (snapshot.activeOfficeId && !headers.has("X-Office-ID")) {
    headers.set("X-Office-ID", snapshot.activeOfficeId);
  }
}

export async function backendFetch(
  path: string,
  options: BackendFetchOptions = {},
  token?: string | null,
) {
  const url = getBackendUrl(path, options.search);
  const headers = createForwardHeaders(options.headers, token || undefined);

  return fetch(url, {
    body: options.body,
    cache: "no-store",
    headers,
    method: options.method || "GET",
  });
}

async function refreshAccessToken(refreshToken: string) {
  const response = await backendFetch("/api/v1/auth/token/refresh/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!response.ok) return null;

  const payload = (await response.json().catch(() => null)) as
    | AuthTokenPayload
    | null;

  return payload?.access ? payload : null;
}

export async function fetchBackendWithCookieAuth(
  path: string,
  options: BackendFetchOptions = {},
): Promise<BackendFetchResult> {
  const snapshot = await getAuthCookieSnapshot();
  const headers = createForwardHeaders(
    options.headers,
    snapshot.accessToken || undefined,
  );
  attachActiveContextHeaders(headers, snapshot);

  let response = await fetch(getBackendUrl(path, options.search), {
    body: options.body,
    cache: "no-store",
    headers,
    method: options.method || "GET",
  });

  if (response.status !== 401 || !snapshot.refreshToken) {
    return {
      response,
      shouldClearAuth: response.status === 401,
    };
  }

  const refreshedTokens = await refreshAccessToken(snapshot.refreshToken);
  if (!refreshedTokens) {
    return { response, shouldClearAuth: true };
  }

  headers.set("Authorization", `Bearer ${refreshedTokens.access}`);
  response = await fetch(getBackendUrl(path, options.search), {
    body: options.body,
    cache: "no-store",
    headers,
    method: options.method || "GET",
  });

  return {
    response,
    refreshedTokens,
    shouldClearAuth: response.status === 401,
  };
}

export function filterResponseHeaders(source: Headers) {
  const headers = new Headers(source);

  for (const headerName of HOP_BY_HOP_HEADERS) {
    headers.delete(headerName);
  }

  return headers;
}

export function setAuthCookies(
  response: NextResponse,
  payload: AuthTokenPayload,
) {
  response.cookies.set(
    AUTH_COOKIE_NAMES.accessToken,
    payload.access,
    getCookieSecurityOptions(ACCESS_TOKEN_MAX_AGE_SECONDS),
  );

  if (payload.refresh) {
    response.cookies.set(
      AUTH_COOKIE_NAMES.refreshToken,
      payload.refresh,
      getCookieSecurityOptions(REFRESH_TOKEN_MAX_AGE_SECONDS),
    );
  }
}

export function clearAuthCookies(response: NextResponse) {
  Object.values(AUTH_COOKIE_NAMES).forEach((name) => {
    response.cookies.set(name, "", {
      ...getCookieSecurityOptions(),
      maxAge: 0,
    });
  });
}

export function selectActiveMembership(
  user: User | null | undefined,
  requestedMembershipId?: string | null,
) {
  if (!user?.memberships?.length) return null;

  return (
    user.memberships.find(
      (membership) => membership.id === requestedMembershipId,
    ) || user.memberships[0]
  );
}

export function setActiveMembershipCookies(
  response: NextResponse,
  membership: Membership | null,
) {
  if (!membership) {
    [
      AUTH_COOKIE_NAMES.activeMembershipId,
      AUTH_COOKIE_NAMES.activeCompanyId,
      AUTH_COOKIE_NAMES.activeOfficeId,
    ].forEach((name) => {
      response.cookies.set(name, "", {
        ...getCookieSecurityOptions(),
        maxAge: 0,
      });
    });
    return;
  }

  response.cookies.set(
    AUTH_COOKIE_NAMES.activeMembershipId,
    membership.id,
    getCookieSecurityOptions(ACTIVE_CONTEXT_MAX_AGE_SECONDS),
  );
  response.cookies.set(
    AUTH_COOKIE_NAMES.activeCompanyId,
    String(membership.company),
    getCookieSecurityOptions(ACTIVE_CONTEXT_MAX_AGE_SECONDS),
  );

  if (membership.branch) {
    response.cookies.set(
      AUTH_COOKIE_NAMES.activeOfficeId,
      String(membership.branch),
      getCookieSecurityOptions(ACTIVE_CONTEXT_MAX_AGE_SECONDS),
    );
  } else {
    response.cookies.set(AUTH_COOKIE_NAMES.activeOfficeId, "", {
      ...getCookieSecurityOptions(),
      maxAge: 0,
    });
  }
}

export async function getServerAuthSession(): Promise<AuthSession> {
  const result = await fetchBackendWithCookieAuth("/api/v1/auth/me/");

  if (!result.response.ok) {
    return { user: null, active_membership: null };
  }

  const user = (await result.response.json().catch(() => null)) as User | null;
  const snapshot = await getAuthCookieSnapshot();
  const activeMembership = selectActiveMembership(
    user,
    snapshot.activeMembershipId,
  );

  return {
    user,
    active_membership: activeMembership,
  };
}

export async function hasAuthCookies() {
  const snapshot = await getAuthCookieSnapshot();
  return Boolean(snapshot.accessToken || snapshot.refreshToken);
}
