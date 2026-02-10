/**
 * Global API configuration – all requests go to the RFP-AI Python backend.
 * Set VITE_API_BASE_URL in .env to your RFP-AI backend (e.g. http://localhost:8000 or http://192.168.0.119:8000).
 * Defaults to http://192.168.0.119:8000 so the app always uses the backend.
 */
const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined)?.trim() || "http://192.168.0.119:8000";

/** Remove trailing slash from base so path can start with / */
const BASE = API_BASE_URL.replace(/\/+$/, "");

/**
 * Normalize path to backend convention: /api/... -> /api/v1/... (RFP-AI uses /api/v1).
 */
function normalizePath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (p.startsWith("/api/") && !p.startsWith("/api/v1/")) {
    return `/api/v1${p.slice(4)}`;
  }
  return p;
}

/**
 * Build full API URL for a path. All requests go to the RFP-AI backend (VITE_API_BASE_URL).
 */
export function getApiUrl(path: string): string {
  const p = normalizePath(path);
  return `${BASE}${p}`;
}

/**
 * Resolve user avatar URL. Backend may return a path like /uploads/avatars/... (same origin as API) or a full URL.
 */
export function getAvatarUrl(avatar: string | null | undefined): string | undefined {
  if (!avatar || !avatar.trim()) return undefined;
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) return avatar;
  const path = avatar.startsWith("/") ? avatar : `/${avatar}`;
  return `${BASE}${path}`;
}

export { API_BASE_URL };
