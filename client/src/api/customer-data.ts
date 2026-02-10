/**
 * Customer data layer: fetch from backend API only.
 * GET /api/v1/customer/notifications and GET /api/v1/customer/sidebar require auth.
 */
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { credentials: "include", ...options, headers });
}

// --- Response types (match backend /api/v1/customer/*) ---

export type CustomerNotification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "mention" | "deadline_reminder" | "status_change";
  time: string;
  read: boolean;
  link?: string | null;
};
export type CustomerNotificationsData = CustomerNotification[];

export interface CustomerSidebarNavItem {
  href: string;
  label: string;
  icon: string;
}
export interface CustomerSidebarNavGroup {
  title: string;
  items: CustomerSidebarNavItem[];
}
export interface CustomerSidebarData {
  navGroups: CustomerSidebarNavGroup[];
  sidebarWidget?: {
    title: string;
    usedLabel: string;
    usedValue: string;
    percentage: number;
    percentageLabel: string;
  };
  newProposalLabel?: string;
  portalSubtitle?: string;
}

export async function fetchCustomerSidebar(): Promise<CustomerSidebarData> {
  const url = getApiUrl("/api/v1/customer/sidebar");
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Customer sidebar: ${res.status}`);
  return res.json() as Promise<CustomerSidebarData>;
}

// --- Customer dashboard (GET /api/v1/customer/dashboard) ---
export interface CustomerDashboardData {
  credits: number;
  usedThisMonth: number;
  allocation: number;
  allocationPercentage: number;
  stats: {
    activeProposals: number;
    completedProposals: number;
    collaborators: number;
  };
  upcomingDeadlines: Array<{
    id: number;
    title: string;
    date: string;
    proposalId: number;
  }>;
  recentProposals: Array<{
    id: number;
    title: string;
    status: string;
    dueDate: string;
    updatedAt: string | null;
    createdAt: string | null;
  }>;
  averageCompletion: number;
}

export async function fetchCustomerDashboard(): Promise<CustomerDashboardData> {
  const url = getApiUrl("/api/v1/customer/dashboard");
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Customer dashboard: ${res.status}`);
  return res.json() as Promise<CustomerDashboardData>;
}

export async function fetchCustomerNotifications(): Promise<CustomerNotificationsData> {
  const url = getApiUrl("/api/v1/customer/notifications");
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Customer notifications: ${res.status}`);
  return res.json() as Promise<CustomerNotificationsData>;
}

export async function markNotificationRead(notificationId: string): Promise<{ ok: boolean }> {
  const url = getApiUrl(`/api/v1/customer/notifications/${encodeURIComponent(notificationId)}/read`);
  const res = await fetchWithAuth(url, { method: "PATCH" });
  if (!res.ok) throw new Error(`markNotificationRead: ${res.status}`);
  return res.json() as Promise<{ ok: boolean }>;
}

export async function dismissNotification(notificationId: string): Promise<{ ok: boolean }> {
  const url = getApiUrl(`/api/v1/customer/notifications/${encodeURIComponent(notificationId)}`);
  const res = await fetchWithAuth(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`dismissNotification: ${res.status}`);
  return res.json() as Promise<{ ok: boolean }>;
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const url = getApiUrl("/api/v1/customer/notifications/read-all");
  const res = await fetchWithAuth(url, { method: "PATCH" });
  if (!res.ok) throw new Error(`markAllNotificationsRead: ${res.status}`);
  return res.json() as Promise<{ ok: boolean }>;
}

export async function dismissAllNotifications(): Promise<{ ok: boolean }> {
  const url = getApiUrl("/api/v1/customer/notifications/dismiss-all");
  const res = await fetchWithAuth(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`dismissAllNotifications: ${res.status}`);
  return res.json() as Promise<{ ok: boolean }>;
}

// --- Collaborator role options (for customer inviting collaborators) ---
export interface CollaboratorPermissions {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  canReview: boolean;
  canGenerateAi: boolean;
}

export interface CollaboratorRoleOptionsData {
  roleOptions?: { value: string; label: string }[];
  rolePermissions?: Record<string, CollaboratorPermissions>;
}

export async function fetchCollaboratorRoleOptions(): Promise<CollaboratorRoleOptionsData> {
  const url = getApiUrl("/api/v1/customer/collaborator-role-options");
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Collaborator role options: ${res.status}`);
  return res.json() as Promise<CollaboratorRoleOptionsData>;
}

// --- Credit Purchase API ---

export interface CreditPlan {
  id: string;
  name: string;
  price: number;
  credits: number;
  popular?: boolean;
  features: string[];
}

export async function fetchCreditPlans(): Promise<CreditPlan[]> {
  const url = getApiUrl("/api/v1/customer/credits/plans");
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Credit plans: ${res.status}`);
  return res.json() as Promise<CreditPlan[]>;
}

export async function validateCoupon(code: string): Promise<{ valid: boolean; discountPercent: number }> {
  const url = getApiUrl("/api/v1/customer/credits/validate-coupon");
  const res = await fetchWithAuth(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Invalid coupon code");
    throw new Error(`Validate coupon: ${res.status}`);
  }
  return res.json();
}

export async function purchaseCredits(plan: string, amount: number, couponCode?: string): Promise<{ credits: number }> {
  const url = getApiUrl("/api/v1/customer/credits/purchase");
  const res = await fetchWithAuth(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, amount, couponCode }),
  });
  if (!res.ok) throw new Error(`Purchase credits: ${res.status}`);
  return res.json();
}
