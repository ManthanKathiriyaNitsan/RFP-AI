/**
 * Collaborator data layer: fetch from backend API. Uses in-code defaults only when API fails.
 */
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";

const DEFAULT_OPTIONS = {
  pageTitle: "Assigned RFPs",
  pageDescription: "Proposals shared with you – view, edit, and collaborate based on your permissions",
  defaultStatusFilter: "all",
  statusFilterOptions: [
    { value: "all", label: "All Status" },
    { value: "in_progress", label: "Active" },
    { value: "draft", label: "Draft" },
    { value: "completed", label: "Completed" },
  ],
  statusDisplay: {
    draft: { label: "Draft", className: "badge-status-warning" },
    in_progress: { label: "In progress", className: "badge-status-info" },
    completed: { label: "Completed", className: "badge-status-success" },
    default: { label: "Draft", className: "badge-status-neutral" },
  },
  roleDisplay: { viewer: "Viewer", editor: "Editor", reviewer: "Reviewer" },
  permissionLabels: {
    canView: "View",
    canEdit: "Edit",
    canComment: "Comment",
    canReview: "Review",
    canGenerateAi: "Generate AI",
  },
} as const;

const DEFAULT_SIDEBAR = {
  navItems: [{ href: "/collaborator", label: "Assigned RFPs", icon: "FolderOpen" }],
  sectionTitle: "Work",
  portalSubtitle: "Collaborator Portal",
} as const;

export type CollaboratorOptionsData = typeof DEFAULT_OPTIONS & Record<string, unknown>;
export type CollaboratorSidebarData = typeof DEFAULT_SIDEBAR & Record<string, unknown>;

/** Fallbacks for when API is unavailable (e.g. offline). */
export const collaboratorOptionsFallback = DEFAULT_OPTIONS as CollaboratorOptionsData;
export const collaboratorSidebarFallback = DEFAULT_SIDEBAR as CollaboratorSidebarData;

async function fetchWithAuth(url: string): Promise<Response> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { credentials: "include", headers });
}

export function fetchCollaboratorOptions(): Promise<CollaboratorOptionsData> {
  return fetchWithAuth(getApiUrl("/api/v1/collaborator/options"))
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Not ok"))))
    .catch(() => collaboratorOptionsFallback);
}

export function fetchCollaboratorSidebar(): Promise<CollaboratorSidebarData> {
  return fetchWithAuth(getApiUrl("/api/v1/collaborator/sidebar"))
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Not ok"))))
    .catch(() => collaboratorSidebarFallback);
}
