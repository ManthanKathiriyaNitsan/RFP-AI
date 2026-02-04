/**
 * Customer data layer: fetch from backend API only.
 * GET /api/v1/customer/notifications and GET /api/v1/customer/sidebar require auth.
 */
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";

async function fetchWithAuth(url: string): Promise<Response> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { credentials: "include", headers });
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

export async function fetchCustomerNotifications(): Promise<CustomerNotificationsData> {
  const url = getApiUrl("/api/v1/customer/notifications");
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Customer notifications: ${res.status}`);
  return res.json() as Promise<CustomerNotificationsData>;
}
