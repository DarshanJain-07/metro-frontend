export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem("access_token") : null;
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && options.method !== 'GET' && options.method !== 'DELETE') {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Optionally handle token refresh or redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }

  return response;
}
