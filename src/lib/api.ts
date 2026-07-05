type ApiErrorPayload = {
  [key: string]: ApiErrorValue | undefined;
};

type ApiErrorValue =
  | string
  | number
  | boolean
  | null
  | ApiErrorPayload
  | ApiErrorValue[];

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

const NON_RETRYABLE_STATUSES = new Set([
  400, 401, 403, 404, 409, 422,
]);

const STATUS_ERROR_MESSAGES: Record<number, string> = {
  400: "The request was invalid. Please check the entered details.",
  401: "Your session has expired. Please log in again.",
  403: "You do not have permission to perform this action.",
  404: "The requested record could not be found.",
  409: "This record conflicts with existing data. Please refresh and try again.",
  422: "Some fields need attention before this can be saved.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "The server hit an error. Please try again later.",
  502: "The server is temporarily unavailable. Please try again later.",
  503: "The service is temporarily unavailable. Please try again later.",
  504: "The request timed out. Please try again.",
};

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor({
    message,
    payload,
    status,
  }: {
    message: string;
    payload?: unknown;
    status: number;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function getStatusErrorMessage(
  status: number,
  fallback = "Request failed.",
) {
  return STATUS_ERROR_MESSAGES[status] || fallback;
}

function formatApiErrorValue(value: ApiErrorValue | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map(formatApiErrorValue)
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    return formatApiErrorPayload(value as ApiErrorPayload);
  }
  return String(value);
}

function isRowMetadataKey(key: string) {
  return ["row", "row_number", "line", "index"].includes(key);
}

export function formatApiErrorPayload(
  payload: ApiErrorValue | object | undefined,
  fallback = "Request failed.",
): string {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    return (
      payload
        .map(formatApiErrorValue)
        .filter(Boolean)
        .join(", ") || fallback
    );
  }
  if (typeof payload !== "object") return String(payload);

  const error = payload as ApiErrorPayload;
  const detail = formatApiErrorValue(error.detail);
  if (detail) return detail;

  const nonFieldErrors = formatApiErrorValue(error.non_field_errors);
  if (nonFieldErrors) return nonFieldErrors;

  const rowContext = Object.entries(error).find(
    ([key, value]) => isRowMetadataKey(key) && value !== undefined && value !== null,
  );
  const firstEntry = Object.entries(error).find(
    ([key, value]) => !isRowMetadataKey(key) && Boolean(value),
  );
  if (!firstEntry) {
    return rowContext ? `row ${rowContext[1]}` : fallback;
  }

  const [field, value] = firstEntry;
  const message = formatApiErrorValue(value);
  if (!message) return fallback;

  const fieldMessage = field === "errors" ? message : `${field}: ${message}`;
  return rowContext ? `row ${rowContext[1]}: ${fieldMessage}` : fieldMessage;
}

export function getApiErrorMessage(
  payload: ApiErrorValue | object | undefined,
  options: { status?: number; fallback?: string } = {},
) {
  const fallback = options.status
    ? getStatusErrorMessage(options.status, options.fallback)
    : options.fallback || "Request failed.";

  return formatApiErrorPayload(payload, fallback);
}

export async function readApiError(
  response: Response,
  fallback = "Request failed.",
) {
  const statusFallback = getStatusErrorMessage(response.status, fallback);
  const payload = await response.json().catch(() => null);
  return getApiErrorMessage(payload, {
    status: response.status,
    fallback: statusFallback,
  });
}

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError) {
    if (NON_RETRYABLE_STATUSES.has(error.status)) return false;
    return error.status >= 500 || error.status === 429;
  }
  return true;
}

function isAbsoluteUrl(path: string) {
  return /^https?:\/\//i.test(path);
}

function removeTrailingSlash(pathname: string) {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

export function resolveBackendProxyPath(path: string) {
  if (path.startsWith("/api/backend/")) {
    const url = new URL(path, "http://metro.local");
    return `${removeTrailingSlash(url.pathname)}${url.search}`;
  }

  if (isAbsoluteUrl(path)) {
    const url = new URL(path);
    return `/api/backend${removeTrailingSlash(url.pathname)}${url.search}`;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, "http://metro.local");
  return `/api/backend${removeTrailingSlash(url.pathname)}${url.search}`;
}

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);

  if (
    !headers.has("Content-Type") &&
    options.method &&
    !["GET", "HEAD", "DELETE"].includes(options.method.toUpperCase()) &&
    options.body
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(resolveBackendProxyPath(path), {
    ...options,
    credentials: "same-origin",
    headers,
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("metro:auth-expired"));
  }

  return response;
}

export async function apiFetchJson<T>(
  path: string,
  options: RequestInit & { fallback?: string } = {},
) {
  const { fallback, ...requestOptions } = options;
  const response = await fetchWithAuth(path, requestOptions);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      payload,
      message: getApiErrorMessage(payload, {
        status: response.status,
        fallback,
      }),
    });
  }

  return payload as T;
}

export async function serverApiFetchJson<T>(
  path: string,
  options: RequestInit & { fallback?: string } = {},
) {
  const { fallback, ...requestOptions } = options;
  const response = await fetchWithAuth(path, requestOptions);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      payload,
      message: getApiErrorMessage(payload, {
        status: response.status,
        fallback,
      }),
    });
  }

  return payload as T;
}
