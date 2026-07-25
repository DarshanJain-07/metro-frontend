import { NextRequest, NextResponse } from "next/server";

import {
  AUTH_COOKIE_NAMES,
  AUTH_HEADER_NAMES,
  WORKOS_SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth-cookies";
import type { AuthPendingState, AuthSession, User } from "@/lib/auth-types";
import {
  backendFetch,
  clearAuthCookies,
  fetchBackendWithCookieAuth,
  filterResponseHeaders,
  hasAuthCookies,
  selectActiveMembership,
  setActiveMembershipCookies,
  setAuthCookies,
} from "@/lib/server-auth";

type AuthRouteContext = {
  params: Promise<{ path?: string[] }>;
};

type SessionResponsePayload = {
  user?: User;
  session_max_age_seconds?: number;
  redirect_url?: string;
};

const EMPTY_SESSION: AuthSession = {
  user: null,
  active_membership: null,
};

const AUTH_ROUTE_MAP: Record<
  string,
  {
    backendPath: string;
    method: "GET" | "POST";
    requiresAuth?: boolean;
    storesSession?: boolean;
  }
> = {
  me: {
    backendPath: "/api/v1/auth/me/",
    method: "GET",
    requiresAuth: true,
  },
  sync: {
    backendPath: "/api/v1/auth/sync/",
    method: "POST",
    requiresAuth: true,
  },
  "login/password": {
    backendPath: "/api/v1/auth/login/password/",
    method: "POST",
    storesSession: true,
  },
  "login/otp/start": {
    backendPath: "/api/v1/auth/login/otp/start/",
    method: "POST",
  },
  "login/otp/verify": {
    backendPath: "/api/v1/auth/login/otp/verify/",
    method: "POST",
    storesSession: true,
  },
  "login/email/verify": {
    backendPath: "/api/v1/auth/login/email/verify/",
    method: "POST",
    storesSession: true,
  },
  "login/mfa/challenge": {
    backendPath: "/api/v1/auth/login/mfa/challenge/",
    method: "POST",
  },
  "login/mfa/verify": {
    backendPath: "/api/v1/auth/login/mfa/verify/",
    method: "POST",
    storesSession: true,
  },
  "login/organization/select": {
    backendPath: "/api/v1/auth/login/organization/select/",
    method: "POST",
    storesSession: true,
  },
};

function jsonResponse(payload: unknown, init: ResponseInit) {
  return NextResponse.json(payload, init);
}

function isPendingAuthPayload(payload: unknown): payload is AuthPendingState {
  if (!payload || typeof payload !== "object") return false;
  return (payload as { status?: unknown }).status === "pending";
}

function sanitizeSessionPayload(payload: SessionResponsePayload): AuthSession & {
  redirect_url?: string | null;
} {
  const user = payload.user || null;
  const activeMembership = selectActiveMembership(user);

  return {
    user,
    active_membership: activeMembership,
    redirect_url: payload.redirect_url || null,
  };
}

async function readJsonPayload(response: Response) {
  return response.json().catch(() => null);
}

function payloadKeys(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  return Object.keys(payload).sort();
}

function logAuthProxyBackendResult({
  payload,
  request,
  response,
  routeKey,
}: {
  payload: unknown;
  request: NextRequest;
  response: Response;
  routeKey: string;
}) {
  if (response.ok && response.status < 500) return;

  console.error("Auth proxy backend response", {
    contentType: response.headers.get("content-type"),
    hasRefreshedSessionHeader: Boolean(
      response.headers.get(AUTH_HEADER_NAMES.refreshedWorkosSession),
    ),
    payloadKeys: payloadKeys(payload),
    requestId:
      request.headers.get("x-request-id") ||
      response.headers.get("x-request-id") ||
      null,
    routeKey,
    status: response.status,
    statusText: response.statusText,
  });
}

async function revokeWorkosSession(session: string) {
  try {
    const response = await backendFetch(
      "/api/v1/auth/logout/",
      {
        method: "POST",
      },
      session,
    );

    const payload = (await readJsonPayload(response)) as {
      revoked?: boolean;
    } | null;

    return {
      ok: response.ok,
      revoked: response.ok && payload?.revoked === true,
    };
  } catch {
    return {
      ok: false,
      revoked: false,
    };
  }
}

async function handleLogout(request: NextRequest) {
  if (request.method.toUpperCase() !== "POST") {
    return NextResponse.json({ detail: "Method not allowed." }, { status: 405 });
  }

  const workosSession =
    request.cookies.get(AUTH_COOKIE_NAMES.workosSession)?.value || null;
  const revokeResult = workosSession
    ? await revokeWorkosSession(workosSession)
    : { ok: true, revoked: false };

  const response = NextResponse.json(
    { ok: true, revoked: revokeResult.revoked },
    { status: revokeResult.ok ? 200 : 502 },
  );
  clearAuthCookies(response);
  return response;
}

async function handleActiveMembership(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    membershipId?: string;
  } | null;

  const membershipId = body?.membershipId;
  if (!membershipId) {
    return NextResponse.json(
      { detail: "Membership id is required." },
      { status: 400 },
    );
  }

  const authResult = await fetchBackendWithCookieAuth("/api/v1/auth/me/");
  const user = (await readJsonPayload(authResult.response)) as User | null;

  if (!authResult.response.ok || !user) {
    const response = NextResponse.json(user || { detail: "Unauthorized." }, {
      status: authResult.response.status,
    });
    if (authResult.refreshedSession) {
      setAuthCookies(response, { session: authResult.refreshedSession });
    }
    if (authResult.shouldClearAuth) {
      clearAuthCookies(response);
    }
    return response;
  }

  const membership =
    user.memberships.find((item) => item.id === membershipId) || null;

  if (!membership) {
    return NextResponse.json(
      { detail: "Membership does not belong to this session." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({
    user,
    active_membership: membership,
  } satisfies AuthSession);

  if (authResult.refreshedSession) {
    setAuthCookies(response, { session: authResult.refreshedSession });
  }
  setActiveMembershipCookies(response, membership);

  return response;
}

async function handleMappedAuthRoute(
  request: NextRequest,
  routeKey: string,
  routeConfig: (typeof AUTH_ROUTE_MAP)[string],
) {
  if (request.method.toUpperCase() !== routeConfig.method) {
    return NextResponse.json({ detail: "Method not allowed." }, { status: 405 });
  }

  const body =
    routeConfig.method === "GET" ? null : await request.arrayBuffer();
  const fetchOptions = {
    body,
    headers: request.headers,
    method: routeConfig.method,
    search: request.nextUrl.search,
  };

  if (routeKey === "me" && !(await hasAuthCookies())) {
    return jsonResponse(EMPTY_SESSION, { status: 200 });
  }

  const authResult = routeConfig.requiresAuth
    ? await fetchBackendWithCookieAuth(routeConfig.backendPath, fetchOptions)
    : {
        response: await backendFetch(
          routeConfig.backendPath,
          fetchOptions,
          null,
        ),
      };

  const payload = await readJsonPayload(authResult.response);
  logAuthProxyBackendResult({
    payload,
    request,
    response: authResult.response,
    routeKey,
  });

  if (authResult.response.status === 202 && isPendingAuthPayload(payload)) {
    return jsonResponse(payload, { status: 202 });
  }

  if (!authResult.response.ok) {
    const response = jsonResponse(payload || { detail: "Request failed." }, {
      status: authResult.response.status,
    });
    if ("refreshedSession" in authResult && authResult.refreshedSession) {
      setAuthCookies(response, { session: authResult.refreshedSession });
    }
    if ("shouldClearAuth" in authResult && authResult.shouldClearAuth) {
      clearAuthCookies(response);
    }
    return response;
  }

  if (routeConfig.storesSession) {
    const sessionPayload = payload as SessionResponsePayload;
    const sealedSession = authResult.response.headers.get(
      AUTH_HEADER_NAMES.refreshedWorkosSession,
    );
    if (!sealedSession || !sessionPayload.user) {
      console.error("Auth proxy incomplete session response", {
        hasRefreshedSessionHeader: Boolean(sealedSession),
        hasUser: Boolean(sessionPayload.user),
        payloadKeys: payloadKeys(payload),
        requestId:
          request.headers.get("x-request-id") ||
          authResult.response.headers.get("x-request-id") ||
          null,
        routeKey,
        status: authResult.response.status,
      });
      return NextResponse.json(
        { detail: "Auth response did not include a complete session payload." },
        { status: 502 },
      );
    }

    const sanitizedPayload = sanitizeSessionPayload(sessionPayload);
    const response = NextResponse.json(sanitizedPayload, {
      status: authResult.response.status,
    });

    setAuthCookies(response, {
      session: sealedSession,
      maxAge:
        sessionPayload.session_max_age_seconds || WORKOS_SESSION_MAX_AGE_SECONDS,
    });
    setActiveMembershipCookies(response, sanitizedPayload.active_membership);

    return response;
  }

  if (routeKey === "me" || routeKey === "sync") {
    const user = payload as User | null;
    const activeMembershipId =
      request.cookies.get(AUTH_COOKIE_NAMES.activeMembershipId)?.value || null;
    const activeMembership = selectActiveMembership(user, activeMembershipId);
    const response = NextResponse.json({
      user,
      active_membership: activeMembership,
    } satisfies AuthSession);

    if ("refreshedSession" in authResult && authResult.refreshedSession) {
      setAuthCookies(response, { session: authResult.refreshedSession });
    }
    setActiveMembershipCookies(response, activeMembership);
    return response;
  }

  return new NextResponse(JSON.stringify(payload), {
    headers: filterResponseHeaders(authResult.response.headers),
    status: authResult.response.status,
  });
}

async function handleAuthRequest(
  request: NextRequest,
  context: AuthRouteContext,
) {
  try {
    const { path = [] } = await context.params;
    const routeKey = path.join("/");

    if (routeKey === "logout") {
      return handleLogout(request);
    }

    if (routeKey === "active-membership") {
      return handleActiveMembership(request);
    }

    const routeConfig = AUTH_ROUTE_MAP[routeKey];
    if (!routeConfig) {
      return NextResponse.json({ detail: "Not found." }, { status: 404 });
    }

    return handleMappedAuthRoute(request, routeKey, routeConfig);
  } catch (error) {
    console.error("Auth proxy request failed", error);

    const message =
      error instanceof Error &&
      error.message === "BACKEND_URL is not defined"
        ? "Backend API URL is not configured for this deployment."
        : "Could not reach the backend service.";

    return NextResponse.json(
      { detail: message },
      { status: message.includes("not configured") ? 500 : 502 },
    );
  }
}

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
