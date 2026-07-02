import { NextRequest, NextResponse } from "next/server";

import {
  clearAuthCookies,
  fetchBackendWithCookieAuth,
  filterResponseHeaders,
  setAuthCookies,
} from "@/lib/server-auth";

async function proxyBackendRequest(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  const backendPath = `/${path.join("/")}`;
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
