/**
 * Centralized CSRF Token Management
 * Provides a single source of truth for fetching CSRF tokens
 */

let cachedToken: string | null = null;
let tokenExpiry: number = 0;
const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches a CSRF token from the server
 * Includes caching to reduce server requests
 * @returns Promise<string> - The CSRF token
 * @throws Error if token fetch fails
 */
export async function fetchCsrfToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  try {
    const response = await fetch("/api/csrf-token", {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.csrfToken) {
      throw new Error("CSRF token missing in response");
    }

    // Cache the token
    cachedToken = data.csrfToken;
    tokenExpiry = Date.now() + TOKEN_CACHE_DURATION;

    return data.csrfToken;
  } catch (error) {
    console.error("[CSRF] Token fetch failed:", error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : "Failed to fetch CSRF token. Please refresh the page and try again."
    );
  }
}

/**
 * Invalidates the cached CSRF token
 * Use this when you receive a 403 CSRF error
 */
export function invalidateCsrfToken(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

/**
 * Makes an authenticated request with automatic CSRF token handling
 * @param url - The request URL
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function fetchWithCsrf(url: string, options: RequestInit = {}): Promise<Response> {
  const csrfToken = await fetchCsrfToken();
  
  const headers = new Headers(options.headers);
  // Only set Content-Type if there's a body (avoid 415 errors on DELETE)
  if (options.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("x-csrf-token", csrfToken);

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  // If we get a 403 CSRF error, invalidate cache and retry once
  if (response.status === 403) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.message?.toLowerCase().includes("csrf")) {
      invalidateCsrfToken();
      // Retry once with fresh token
      const freshToken = await fetchCsrfToken();
      headers.set("x-csrf-token", freshToken);
      return fetch(url, {
        ...options,
        credentials: "include",
        headers,
      });
    }
  }

  return response;
}

/**
 * Makes a FormData request with automatic CSRF token handling
 * Use this for file uploads
 * @param url - The request URL
 * @param formData - The FormData to send
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export async function fetchWithCsrfFormData(url: string, formData: FormData, options: RequestInit = {}): Promise<Response> {
  const csrfToken = await fetchCsrfToken();
  
  const headers = new Headers(options.headers);
  headers.set("X-Requested-With", "XMLHttpRequest");
  headers.set("x-csrf-token", csrfToken);

  const response = await fetch(url, {
    ...options,
    method: options.method || "POST",
    credentials: "include",
    headers,
    body: formData,
  });

  // If we get a 403 CSRF error, invalidate cache and retry once
  if (response.status === 403) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.message?.toLowerCase().includes("csrf")) {
      invalidateCsrfToken();
      // Retry once with fresh token
      const freshToken = await fetchCsrfToken();
      headers.set("x-csrf-token", freshToken);
      return fetch(url, {
        ...options,
        method: options.method || "POST",
        credentials: "include",
        headers,
        body: formData,
      });
    }
  }

  return response;
}
