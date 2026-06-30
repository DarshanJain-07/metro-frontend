const envApiUrl = process.env.NEXT_PUBLIC_API_URL;

if (!envApiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is not defined");
}

const API_URL: string = envApiUrl;

export { API_URL };

type AuthTokenGetter = () => Promise<string | null>;
type AuthTokenRefresher = () => Promise<string | null>;

let authTokenGetter: AuthTokenGetter | null = null;
let authTokenRefresher: AuthTokenRefresher | null = null;

export function setAuthTokenGetter(getter: AuthTokenGetter | null) {
  authTokenGetter = getter;
}

export function setAuthTokenRefresher(refresher: AuthTokenRefresher | null) {
  authTokenRefresher = refresher;
}

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

export function getStatusErrorMessage(status: number, fallback = "Request failed.") {
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

  const firstEntry = Object.entries(error).find(([, value]) => Boolean(value));
  if (!firstEntry) return fallback;

  const [field, value] = firstEntry;
  const message = formatApiErrorValue(value);
  return message ? `${field}: ${message}` : fallback;
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

export async function readApiError(response: Response, fallback = "Request failed.") {
  const statusFallback = getStatusErrorMessage(response.status, fallback);
  const payload = await response.json().catch(() => null);
  return getApiErrorMessage(payload, {
    status: response.status,
    fallback: statusFallback,
  });
}

export function getActiveContextHeaders() {
  const headers = new Headers();

  if (typeof window === "undefined") {
    return headers;
  }

  const storedUser = localStorage.getItem("user");
  const activeMembershipId = localStorage.getItem("active_membership_id");

  if (!storedUser) {
    return headers;
  }

  try {
    const user = JSON.parse(storedUser) as {
      memberships?: Array<{
        id: string;
        company: number | string;
        branch: string | null;
      }>;
    };
    const memberships = user.memberships || [];
    const membership =
      memberships.find((item) => item.id === activeMembershipId) ||
      memberships[0];

    if (membership?.company) {
      headers.set("X-Company-ID", String(membership.company));
    }
    if (membership?.branch) {
      headers.set("X-Office-ID", String(membership.branch));
    }
  } catch {
    return headers;
  }

  return headers;
}

export async function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = authTokenGetter ? await authTokenGetter().catch(() => null) : null;
  if (token || !authTokenRefresher) {
    return token;
  }

  return authTokenRefresher().catch(() => null);
}

function resolveApiUrl(path: string) {
  const apiUrl = new URL(API_URL);
  const url = new URL(path, apiUrl);

  if (url.origin !== apiUrl.origin) {
    throw new Error("fetchWithAuth only supports requests to the configured API origin.");
  }

  return url.toString();
}

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const url = resolveApiUrl(path);
  const token = await getAuthToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  getActiveContextHeaders().forEach((value, key) => {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  });

  if (
    !headers.has("Content-Type") &&
    options.method &&
    !["GET", "DELETE"].includes(options.method)
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401 && token && authTokenRefresher) {
    const refreshedToken = await authTokenRefresher().catch(() => null);
    if (refreshedToken) {
      headers.set("Authorization", `Bearer ${refreshedToken}`);
      response = await fetch(url, {
        ...options,
        headers,
      });
    }
  }

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
      localStorage.removeItem("active_membership_id");
      window.dispatchEvent(new Event("metro:auth-expired"));
    }
  }

  return response;
}
