/**
 * Users API – search for invite flow (customer finds collaborators by email).
 * Backend: GET /api/v1/users/search?email=...&role=...&limit=...
 */

import { apiRequest } from "@/lib/queryClient";

const USERS_SEARCH = "/api/v1/users/search";

export interface UserSearchResult {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  company?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  credits: number;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function searchUsers(params: {
  email?: string | null;
  role?: string | null;
  limit?: number;
}): Promise<UserSearchResult[]> {
  const sp = new URLSearchParams();
  if (params.email != null && params.email !== "") sp.set("email", params.email);
  if (params.role != null && params.role !== "") sp.set("role", params.role);
  if (params.limit != null) sp.set("limit", String(params.limit));
  const qs = sp.toString();
  const path = qs ? `${USERS_SEARCH}?${qs}` : USERS_SEARCH;
  try {
    const res = await apiRequest("GET", path);
    return res.json();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("404") || msg.includes("404")) return [];
    throw e;
  }
}
