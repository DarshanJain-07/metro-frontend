import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ACTIVE_CONTEXT_MAX_AGE_SECONDS,
  AUTH_HEADER_NAMES,
  AUTH_COOKIE_NAMES,
  WORKOS_SESSION_MAX_AGE_SECONDS,
  getCookieSecurityOptions,
} from "@/lib/auth-cookies";
import type { AuthSession, Membership, User } from "@/lib/auth-types";

type BackendFetchResult = {
  response: Response;
  refreshedSession?: string;
  shouldClearAuth?: boolean;
};

type AuthSessionCookiePayload = {
  session: string;
  maxAge?: number;
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
  const apiUrl = process.env.BACKEND_URL;

  if (!apiUrl) {
    throw new Error("BACKEND_URL is not defined");
  }

  return apiUrl;
}

function isAbsoluteUrl(path: string) {
  return /^https?:\/\//i.test(path);
}

export function getBackendUrl(path: string, search = "") {
  const baseUrl = new URL(getBackendBaseUrl());
  if (path.startsWith("//") || path.includes("\\")) {
    throw new Error("Backend path must be relative to the configured backend.");
  }

  const url = isAbsoluteUrl(path)
    ? new URL(path)
    : new URL(path.startsWith("/") ? path : `/${path}`, baseUrl);

  if (url.origin !== baseUrl.origin) {
    throw new Error("Only the configured backend origin can be fetched.");
  }

  url.search = search;
  return url;
}

function createForwardHeaders(
  incomingHeaders: HeadersInit | undefined,
  session?: string,
) {
  const headers = new Headers(incomingHeaders);

  for (const headerName of HOP_BY_HOP_HEADERS) {
    headers.delete(headerName);
  }

  headers.delete("authorization");
  headers.delete("cookie");
  headers.delete(AUTH_HEADER_NAMES.workosSession);
  headers.delete(AUTH_HEADER_NAMES.refreshedWorkosSession);

  if (session) {
    headers.set(AUTH_HEADER_NAMES.workosSession, session);
  }

  return headers;
}

async function getAuthCookieSnapshot() {
  const cookieStore = await cookies();

  return {
    workosSession: cookieStore.get(AUTH_COOKIE_NAMES.workosSession)?.value || null,
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
  session?: string | null,
) {
  const url = getBackendUrl(path, options.search);
  const headers = createForwardHeaders(options.headers, session || undefined);

  return fetch(url, {
    body: options.body,
    cache: "no-store",
    headers,
    method: options.method || "GET",
  });
}

export async function fetchBackendWithCookieAuth(
  path: string,
  options: BackendFetchOptions = {},
): Promise<BackendFetchResult> {
  const snapshot = await getAuthCookieSnapshot();
  const headers = createForwardHeaders(
    options.headers,
    snapshot.workosSession || undefined,
  );
  attachActiveContextHeaders(headers, snapshot);

  const response = await fetch(getBackendUrl(path, options.search), {
    body: options.body,
    cache: "no-store",
    headers,
    method: options.method || "GET",
  });

  return {
    response,
    refreshedSession: response.headers.get(AUTH_HEADER_NAMES.refreshedWorkosSession) || undefined,
    shouldClearAuth: response.status === 401,
  };
}

export function filterResponseHeaders(source: Headers) {
  const headers = new Headers(source);

  for (const headerName of HOP_BY_HOP_HEADERS) {
    headers.delete(headerName);
  }
  headers.delete(AUTH_HEADER_NAMES.refreshedWorkosSession);
  headers.delete(AUTH_HEADER_NAMES.workosSession);

  return headers;
}

export function setAuthCookies(
  response: NextResponse,
  payload: AuthSessionCookiePayload,
) {
  response.cookies.set(
    AUTH_COOKIE_NAMES.workosSession,
    payload.session,
    getCookieSecurityOptions(payload.maxAge || WORKOS_SESSION_MAX_AGE_SECONDS),
  );
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
  return Boolean(snapshot.workosSession);
}
