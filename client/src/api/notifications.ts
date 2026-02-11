/**
 * Unified notifications API for all roles (customer, admin, collaborator, super_admin).
 * Uses GET /api/v1/notifications from the backend.
 */
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = authStorage.getAccessToken();
  const auth = authStorage.getAuth();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (auth?.user?.id != null) headers["x-user-id"] = String(auth.user.id);
  return fetch(url, { credentials: "include", ...options, headers });
}

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "mention"
  | "comment"
  | "chat"
  | "deadline_reminder"
  | "status_change"
  | "proposal_assigned"
  | "credit_added"
  | "credit_alert"
  | "credit_assigned"
  | "credit_allocated"
  | "credit_removed"
  | "credit_deducted"
  | "credit_purchase"
  | "credit_plan_assigned"
  | "organization_created"
  | "collaboration_invite";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  time: string;
  read: boolean;
  link?: string | null;
  body?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
};

export type NotificationsData = AppNotification[];

export async function fetchNotifications(): Promise<NotificationsData> {
  const url = getApiUrl("/api/v1/notifications");
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`Notifications: ${res.status}`);
  return res.json() as Promise<NotificationsData>;
}

export async function markNotificationRead(notificationId: string): Promise<{ ok: boolean }> {
  const url = getApiUrl(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`);
  const res = await fetchWithAuth(url, { method: "PATCH" });
  if (!res.ok) throw new Error(`markNotificationRead: ${res.status}`);
  return res.json() as Promise<{ ok: boolean }>;
}

export async function dismissNotification(notificationId: string): Promise<{ ok: boolean }> {
  const url = getApiUrl(`/api/v1/notifications/${encodeURIComponent(notificationId)}`);
  const res = await fetchWithAuth(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`dismissNotification: ${res.status}`);
  return res.json() as Promise<{ ok: boolean }>;
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const url = getApiUrl("/api/v1/notifications/read-all");
  const res = await fetchWithAuth(url, { method: "PATCH" });
  if (!res.ok) throw new Error(`markAllNotificationsRead: ${res.status}`);
  return res.json() as Promise<{ ok: boolean }>;
}

export async function dismissAllNotifications(): Promise<{ ok: boolean }> {
  const url = getApiUrl("/api/v1/notifications");
  const res = await fetchWithAuth(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`dismissAllNotifications: ${res.status}`);
  return res.json() as Promise<{ ok: boolean }>;
}
