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
    draft: { label: "Draft", className: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber border-amber-500/20 dark:border-amber-500/30" },
    in_progress: { label: "In progress", className: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/30" },
    completed: { label: "Completed", className: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald border-emerald-500/20 dark:border-emerald-500/30" },
    default: { label: "Draft", className: "bg-gray-500/10 dark:bg-gray-500/20 text-gray-600 dark:text-muted-foreground border-gray-500/20 dark:border-gray-500/30" },
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
  sidebarWidget: { title: "AI Credits", credits: 0, creditsLabel: "available", usedThisMonth: 0, usageDetailHref: "/collaborator/credits-usage" },
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

export interface CollaboratorAnalyticsResponse {
  pageTitle?: string;
  pageDescription?: string;
  dateRanges?: { value: string; label: string }[];
  kpiMetrics?: { label: string; value: number; change: string; icon: string }[];
  activityByWeek?: { week: string; comments: number; edits: number; reviews: number }[];
  proposalsByStatus?: { status: string; count: number }[];
}

export async function fetchCollaboratorAnalytics(
  dateRange: string
): Promise<CollaboratorAnalyticsResponse> {
  const url = getApiUrl(
    `/api/v1/collaborator/analytics?dateRange=${encodeURIComponent(dateRange)}`
  );
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Collaborator analytics: ${res.status}`);
  return res.json();
}

// --- Credit usage (GET /api/v1/collaborator/credits/usage) – where credits came from and where they were spent ---
export type CollaboratorCreditReceivedItem = {
  id: number;
  date: string;
  amount: number;
  source: "purchase" | "allocation" | "refund";
  sourceDetail: string | null;
  description: string | null;
};
export type CollaboratorCreditUsedItem = {
  id: number;
  date: string;
  amount: number;
  description: string | null;
  proposalId: number | null;
  proposalTitle: string | null;
};
export type CollaboratorCreditReducedItem = {
  id: number;
  date: string;
  amount: number;
  takenBy: string | null;
  roleLabel: string | null;
  description: string | null;
};
export interface CollaboratorCreditUsageData {
  creditsReceived: CollaboratorCreditReceivedItem[];
  creditsUsed: CollaboratorCreditUsedItem[];
  creditsReduced: CollaboratorCreditReducedItem[];
}

export async function fetchCollaboratorCreditUsage(): Promise<CollaboratorCreditUsageData> {
  const url = getApiUrl("/api/v1/collaborator/credits/usage");
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Credit usage: ${res.status}`);
  return res.json() as Promise<CollaboratorCreditUsageData>;
}
