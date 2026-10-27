const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
).trim().replace(/\/+$/, "");

// The public website and the API run on different HTTPS domains. Browsers can
// block a cross-site session cookie, so the local API session is also retained
// as a Bearer token for authenticated requests.
const ACCESS_TOKEN_KEY = "medinexus_access_token";

export function getAccessToken() {
  try { return localStorage.getItem(ACCESS_TOKEN_KEY) || ""; } catch { return ""; }
}

export function setAccessToken(token) {
  try {
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Private browsing or restrictive browser settings can disable storage.
  }
}

export function clearAccessToken() {
  setAccessToken("");
}

export async function apiRequest(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error(
      "Backend URL is not configured. Set VITE_API_BASE_URL in your .env file."
    );
  }

  const token = getAccessToken();
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token && !options.headers?.Authorization ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(
    `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
    {
      ...options,
      credentials: "include",
      headers,
    }
  );

  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof result === "object" && result !== null
        ? result.message || result.error || result.detail
        : result;
    const error = new Error(message || `Request failed with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }

  return result;
}