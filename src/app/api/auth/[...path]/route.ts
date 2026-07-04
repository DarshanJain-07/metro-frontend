import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAMES } from "@/lib/auth-cookies";
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

type TokenResponsePayload = {
  access?: string;
  refresh?: string;
  user?: User;
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
    storesTokens?: boolean;
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
    storesTokens: true,
  },
  "login/otp/start": {
    backendPath: "/api/v1/auth/login/otp/start/",
    method: "POST",
  },
  "login/otp/verify": {
    backendPath: "/api/v1/auth/login/otp/verify/",
    method: "POST",
    storesTokens: true,
  },
  "login/google/start": {
    backendPath: "/api/v1/auth/login/google/start/",
    method: "GET",
  },
  "login/google/exchange": {
    backendPath: "/api/v1/auth/login/google/exchange/",
    method: "POST",
    storesTokens: true,
  },
  "login/mfa/challenge": {
    backendPath: "/api/v1/auth/login/mfa/challenge/",
    method: "POST",
  },
  "login/mfa/verify": {
    backendPath: "/api/v1/auth/login/mfa/verify/",
    method: "POST",
    storesTokens: true,
  },
  "login/organization/select": {
    backendPath: "/api/v1/auth/login/organization/select/",
    method: "POST",
    storesTokens: true,
  },
};

function jsonResponse(payload: unknown, init: ResponseInit) {
  return NextResponse.json(payload, init);
}

function isPendingAuthPayload(payload: unknown): payload is AuthPendingState {
  if (!payload || typeof payload !== "object") return false;
  return (payload as { status?: unknown }).status === "pending";
}

function sanitizeTokenPayload(payload: TokenResponsePayload): AuthSession & {
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

async function revokeRefreshToken(refreshToken: string) {
  try {
    const response = await backendFetch(
      "/api/v1/auth/logout/",
      {
        body: JSON.stringify({ refresh: refreshToken }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
      null,
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

  const refreshToken =
    request.cookies.get(AUTH_COOKIE_NAMES.refreshToken)?.value || null;
  const revokeResult = refreshToken
    ? await revokeRefreshToken(refreshToken)
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
    if (authResult.refreshedTokens) {
      setAuthCookies(response, authResult.refreshedTokens);
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

  if (authResult.refreshedTokens) {
    setAuthCookies(response, authResult.refreshedTokens);
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

  if (authResult.response.status === 202 && isPendingAuthPayload(payload)) {
    return jsonResponse(payload, { status: 202 });
  }

  if (!authResult.response.ok) {
    const response = jsonResponse(payload || { detail: "Request failed." }, {
      status: authResult.response.status,
    });
    if ("refreshedTokens" in authResult && authResult.refreshedTokens) {
      setAuthCookies(response, authResult.refreshedTokens);
    }
    if ("shouldClearAuth" in authResult && authResult.shouldClearAuth) {
      clearAuthCookies(response);
    }
    return response;
  }

  if (routeConfig.storesTokens) {
    const tokenPayload = payload as TokenResponsePayload;
    if (!tokenPayload.access || !tokenPayload.refresh || !tokenPayload.user) {
      return NextResponse.json(
        { detail: "Auth response did not include a complete token payload." },
        { status: 502 },
      );
    }

    const sanitizedPayload = sanitizeTokenPayload(tokenPayload);
    const response = NextResponse.json(sanitizedPayload, {
      status: authResult.response.status,
    });

    setAuthCookies(response, {
      access: tokenPayload.access,
      refresh: tokenPayload.refresh,
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

    if ("refreshedTokens" in authResult && authResult.refreshedTokens) {
      setAuthCookies(response, authResult.refreshedTokens);
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
}

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
