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
