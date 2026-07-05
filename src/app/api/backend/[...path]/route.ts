import { NextRequest, NextResponse } from "next/server";

import {
  clearAuthCookies,
  fetchBackendWithCookieAuth,
  filterResponseHeaders,
  setAuthCookies,
} from "@/lib/server-auth";

function appendTrailingSlash(path: string) {
  return path.endsWith("/") ? path : `${path}/`;
}

function isAllowedBackendPath(path: string) {
  if (!path.startsWith("/api/v1/") && path !== "/api/v1") {
    return false;
  }

  if (path.includes("\\") || path.startsWith("//")) {
    return false;
  }

  try {
    const decodedPath = decodeURIComponent(path);
    return (
      decodedPath === path &&
      !decodedPath.includes("\\") &&
      !decodedPath.startsWith("//") &&
      !/^\/https?:/i.test(decodedPath)
    );
  } catch {
    return false;
  }
}

async function proxyBackendRequest(request: NextRequest) {
  const backendPath = appendTrailingSlash(
    request.nextUrl.pathname.replace(/^\/api\/backend(?=\/|$)/, ""),
  );

  if (!isAllowedBackendPath(backendPath)) {
    return NextResponse.json(
      { detail: "Invalid backend proxy path." },
      { status: 400 },
    );
  }

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? null
      : await request.arrayBuffer();

  const result = await fetchBackendWithCookieAuth(backendPath, {
    body,
    headers: request.headers,
    method,
    search: request.nextUrl.search,
  });

  const response = new NextResponse(result.response.body, {
    headers: filterResponseHeaders(result.response.headers),
    status: result.response.status,
    statusText: result.response.statusText,
  });

  if (result.refreshedTokens) {
    setAuthCookies(response, result.refreshedTokens);
  }

  if (result.shouldClearAuth) {
    clearAuthCookies(response);
  }

  return response;
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export const GET = proxyBackendRequest;
export const POST = proxyBackendRequest;
export const PUT = proxyBackendRequest;
export const PATCH = proxyBackendRequest;
export const DELETE = proxyBackendRequest;
