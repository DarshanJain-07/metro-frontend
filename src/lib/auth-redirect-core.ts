export const DEFAULT_AUTH_REDIRECT = "/dockets/new";
export const LAST_AUTH_REDIRECT_STORAGE_KEY = "metro:last-auth-redirect";

const AUTH_REDIRECT_PARAMS = ["redirect_url"] as const;

const AUTH_PATHS = new Set(["/", "/sign-in", "/signup", "/auth/callback"]);

type SearchParamsLike = Pick<URLSearchParams, "get" | "has">;
type StringifiableSearchParams = Pick<URLSearchParams, "toString">;

export type NextSearchParamsObject = Record<
  string,
  string | string[] | undefined
>;

export type Next15SearchParams = Promise<NextSearchParamsObject>;

function getBaseOrigin(origin?: string): string {
  const candidate =
    origin ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000");

  try {
    return new URL(candidate).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function parseUrl(value: string, base: string): URL | null {
  if (typeof URL.canParse === "function" && !URL.canParse(value, base)) {
    return null;
  }

  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

export function isAuthRoute(pathname: string): boolean {
  const path = pathname.split(/[?#]/)[0] || "/";

  if (AUTH_PATHS.has(path)) return true;

  return (
    path.startsWith("/sign-in/") ||
    path.startsWith("/signup/") ||
    path.startsWith("/auth/callback/")
  );
}

function isSafeInternalTarget(target: string, pathname: string): boolean {
  return (
    target.startsWith("/") &&
    !target.startsWith("//") &&
    pathname !== "/" &&
    !isAuthRoute(pathname)
  );
}

function normalizeFallback(fallback: string, baseOrigin: string): string {
  if (fallback === DEFAULT_AUTH_REDIRECT) {
    return DEFAULT_AUTH_REDIRECT;
  }

  const url = parseUrl(fallback, baseOrigin);

  if (!url || url.origin !== baseOrigin) {
    return DEFAULT_AUTH_REDIRECT;
  }

  const target = `${url.pathname}${url.search}${url.hash}`;

  return isSafeInternalTarget(target, url.pathname)
    ? target
    : DEFAULT_AUTH_REDIRECT;
}

export function normalizeAuthRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
  origin?: string,
): string {
  const baseOrigin = getBaseOrigin(origin);
  const safeFallback = normalizeFallback(fallback, baseOrigin);

  if (!value) return safeFallback;

  const url = parseUrl(value, baseOrigin);

  if (!url || url.origin !== baseOrigin) {
    return safeFallback;
  }

  const target = `${url.pathname}${url.search}${url.hash}`;

  if (!isSafeInternalTarget(target, url.pathname)) {
    return safeFallback;
  }

  return target;
}

export function getAuthRedirectFromSearchParams(
  searchParams: SearchParamsLike,
  fallback = DEFAULT_AUTH_REDIRECT,
  origin?: string,
): string {
  for (const param of AUTH_REDIRECT_PARAMS) {
    if (!searchParams.has(param)) continue;

    return normalizeAuthRedirect(searchParams.get(param), fallback, origin);
  }

  return fallback;
}

export async function getAuthRedirectFromServerParams(
  paramsPromise: Next15SearchParams,
  fallback = DEFAULT_AUTH_REDIRECT,
  origin?: string,
): Promise<string> {
  const params = await paramsPromise;
  const searchParams = searchParamsObjectToURLSearchParams(params);

  return getAuthRedirectFromSearchParams(searchParams, fallback, origin);
}

export function buildAuthUrl(
  pathname: string,
  redirectTarget: string,
  origin?: string,
): string {
  const baseOrigin = getBaseOrigin(origin);

  const target = normalizeAuthRedirect(
    redirectTarget,
    DEFAULT_AUTH_REDIRECT,
    baseOrigin,
  );

  if (target === DEFAULT_AUTH_REDIRECT) {
    return pathname;
  }

  const url = parseUrl(pathname, baseOrigin);

  if (!url || url.origin !== baseOrigin) {
    return pathname;
  }

  url.searchParams.set("redirect_url", target);

  return `${url.pathname}${url.search}${url.hash}`;
}

export function buildCurrentPathRedirect(
  pathname: string,
  searchParams: StringifiableSearchParams | null | undefined,
  origin?: string,
): string {
  const query = searchParams?.toString() ?? "";

  return normalizeAuthRedirect(
    `${pathname}${query ? `?${query}` : ""}`,
    DEFAULT_AUTH_REDIRECT,
    origin,
  );
}

export function searchParamsObjectToURLSearchParams(
  searchParams: NextSearchParamsObject,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    }
  }

  return params;
}
