/**
 * Current user context from backend. Used so customers and collaborators
 * get branding for their organization (the one the admin assigned them to).
 * Backend should implement GET /api/v1/me to return { organizationId: number | null }.
 */
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";

export interface MeResponse {
  organizationId?: number | null;
}

/** Fetch the current user's organization id (for branding). Returns null if not available, API not implemented, or network error. */
export async function fetchMyOrganizationId(): Promise<number | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl("/api/v1/me"), { credentials: "include", headers });
    if (!res.ok) return null;
    const data = (await res.json()) as MeResponse;
    const id = data?.organizationId;
    return typeof id === "number" && !Number.isNaN(id) ? id : null;
  } catch {
    // Network error or backend unreachable: return null so app continues with default branding.
    return null;
  }
}
