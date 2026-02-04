/**
 * Admin data layer: fetch from backend API only. All admin data is dynamic.
 * Set VITE_API_BASE_URL in .env to point at the RFP backend (e.g. http://localhost:8000).
 */
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";

// --- Response types (match backend /api/v1/admin/* response shapes) ---

export interface OptionItem {
  value: string;
  label: string;
}

export interface AdminOptionsData {
  proposalCategories?: OptionItem[];
  industries?: OptionItem[];
  roles?: OptionItem[];
  contentCategories?: OptionItem[];
  contentStatuses?: OptionItem[];
  termTypes?: OptionItem[];
  proposalStatuses?: OptionItem[];
  collaboratorRoles?: OptionItem[];
  collaboratorPermissions?: { key: string; label: string }[];
  dateRangesUsage?: OptionItem[];
  dateRangesAnalytics?: OptionItem[];
  settingsIndustries?: OptionItem[];
  locales?: OptionItem[];
  timezones?: OptionItem[];
  dateFormats?: OptionItem[];
  currencies?: OptionItem[];
  passwordLengths?: OptionItem[];
  sessionDurations?: OptionItem[];
  aiToneOptions?: OptionItem[];
  aiDetailLevels?: OptionItem[];
  chartColors?: string[];
  roleDisplay?: Record<string, { label: string; icon: string; className: string }>;
  statusDisplay?: Record<string, { label: string; className: string }>;
  pageTitles?: Record<string, string>;
}

export interface DashboardData {
  proposalTrendData?: { month: string; won: number; lost: number; pending: number }[];
  revenueData?: { month: string; revenue: number }[];
  categoryData?: { name: string; value: number; color: string }[];
  statsData?: { title: string; value: string; change: string; trend: string; icon: string; color: string; bgColor: string }[];
  recentProposals?: { id: number; title: string; client: string; status: string; value: string; dueDate: string; progress: number }[];
  topContributors?: { name: string; role: string; proposals: number; winRate: number; avatar: string }[];
}

export interface UsageData {
  summaryCards?: { label: string; value: string; trend: string; trendUp: boolean; icon: string; iconColor: string; bgColor: string }[];
  dailyUsage?: { day: string; credits: number; proposals: number }[];
  featureUsage?: { feature: string; usage: number; credits: number }[];
  topUsers?: { name: string; avatar: string; credits: number; proposals: number; efficiency: number }[];
  hourlyPeaks?: { hour: string; usage: number }[];
}

export interface CreditsData {
  totalCredits?: number;
  usedCredits?: number;
  remainingCredits?: number;
  creditPackages?: { id: number; name: string; credits: number; price: number; popular: boolean; perCredit: number }[];
  transactions?: { id: number; type: string; description: string; amount: number; date: string; user: string; status: string }[];
  userAllocations?: { id: number; name: string; avatar: string; allocated: number; used: number; remaining: number }[];
}

/** Subscription plan for plan builder */
export interface BillingPlanItem {
  id: string;
  name: string;
  price: number;
  interval: "month" | "year";
  creditsIncluded?: number;
  apiQuotaPerMonth?: number;
  features?: string[];
}

export interface BillingPlansData {
  plans: BillingPlanItem[];
}

/** Invoice for list/download */
export interface InvoiceItem {
  id: string;
  customerId?: number;
  customerEmail?: string;
  planName: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "overdue";
  dueDate: string;
  paidAt?: string;
}

export interface InvoicesData {
  invoices: InvoiceItem[];
}

/** API quota (global or per-plan) */
export interface ApiQuotaData {
  limitPerMonth?: number;
  usedThisMonth?: number;
  windowStart?: string;
}

export interface AnalyticsData {
  winLossData?: { month: string; won: number; lost: number }[];
  categoryPerformance?: { category: string; proposals: number; winRate: number; revenue: string; trend: string }[];
  kpiMetrics?: { label: string; value: string; change: string; trend: string; icon: string; description: string }[];
  revenueByQuarter?: { quarter: string; revenue: number; proposals: number }[];
}

export interface IntegrationsData {
  connectedIntegrations?: { id: number; name: string; category: string; status: string; lastSync: string; description: string; logo: string }[];
  availableIntegrations?: { id: number; name: string; category: string; description: string; logo: string }[];
}

export interface ContentData {
  contentCategories?: { id: number; name: string; icon: string; count: number; color: string }[];
  contentItems?: { id: number; title: string; category: string; status: string; usageCount: number; lastUsed: string; lastUpdated: string; author: string; tags: string[]; starred: boolean }[];
}

/** Knowledge base document with embedding status */
export interface KnowledgeBaseDocument {
  id: string;
  title: string;
  embeddingStatus: "indexed" | "pending" | "failed";
  chunkCount?: number;
  lastIndexedAt?: string;
}

/** Index version for version control */
export interface KnowledgeBaseVersion {
  id: string;
  createdAt: string;
  documentCount?: number;
  size?: string;
}

export interface KnowledgeBaseData {
  documents: KnowledgeBaseDocument[];
  lastRebuildAt?: string;
  indexVersion?: string;
}

export interface KnowledgeBaseVersionsData {
  versions: KnowledgeBaseVersion[];
}

/** RFP template – global template with default question set and mandatory sections */
export interface RfpTemplateQuestion {
  question: string;
  order: number;
}

export interface RfpTemplateItem {
  id: string;
  name: string;
  description?: string;
  mandatorySections: string[];
  questionSet: RfpTemplateQuestion[];
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RfpTemplatesData {
  templates: RfpTemplateItem[];
}

export interface AIConfigData {
  defaultModel?: string;
  creditsUsed?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  systemPromptDefault?: string;
  aiModels?: { id: string; name: string; provider: string; speed: string; quality: string; cost: string }[];
  qualityMetrics?: { label: string; value: number; target: number }[];
}

export interface SettingsData {
  defaultTheme?: string;
  organization?: { companyName: string; industry: string; description: string; website: string; supportEmail: string };
  billing?: { planName: string; planPrice: string; billingInterval: string };
  localization?: { locale: string; timezone: string; dateFormat: string; currency: string };
  colorPresets?: { name: string; primary: string; secondary: string }[];
  notificationSettings?: { id: number; name: string; description: string; email: boolean; push: boolean }[];
  /** Email server (SMTP) */
  emailServer?: { host: string; port: number; user: string; from: string; secure: boolean };
  /** Storage provider */
  storage?: { provider: string; bucket?: string; region?: string; endpoint?: string };
  /** API keys (masked) */
  apiKeys?: { id: string; name: string; lastUsedAt?: string; createdAt: string }[];
  /** Backups */
  backups?: { id: string; createdAt: string; size?: string; status: string }[];
}

export interface SecurityData {
  defaultPasswordLength?: string;
  defaultSessionDuration?: string;
  complianceCertifications?: { name: string; status: string; date: string; icon: string }[];
  securityAlerts?: { id: number; type: string; message: string; action: string; time: string }[];
  recentActivity?: { id: number; action: string; user: string; ip: string; location: string; time: string; status: string }[];
  securitySettings?: { id: number; name: string; description: string; enabled: boolean }[];
  /** Session expiration */
  sessionIdleMinutes?: number;
  sessionMaxDurationMinutes?: number;
  sessionRememberMeDays?: number;
  /** IP access control */
  ipRestrictionEnabled?: boolean;
  ipAllowlist?: string[];
  ipDenylist?: string[];
}

export interface ProposalsNewSupportData {
  steps?: { id: number; title: string; description: string; icon: string }[];
  teamMembers?: { id: number; name: string; role: string; avatar: string }[];
  aiSuggestions?: string[];
}

export type TermsData = {
  id: number;
  title: string;
  content: string;
  version: string;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  requiresAcceptance: boolean;
}[];

export interface PermissionsData {
  permissions?: string[];
  defaultRolePermissions?: { Admin: string[]; User: string[]; Collaborator: string[] };
}

/** Granular permission definition with optional scopes */
export interface PermissionDefinition {
  key: string;
  label: string;
  description?: string;
  scopes?: ("read" | "write" | "delete")[];
}

/** Role (built-in or custom) with permission keys and scopes */
export interface RoleItem {
  id: string;
  name: string;
  isBuiltIn: boolean;
  permissions: Record<string, string[]>; // permission key -> list of scopes, e.g. { can_create_rfp: ["read", "write"] }
}

export interface RolesData {
  roles: RoleItem[];
  permissionDefinitions: PermissionDefinition[];
}

export interface AdminSidebarData {
  navGroups?: { title: string; items: { href: string; label: string; icon: string; badge?: string | number; badgeVariant?: string }[] }[];
  sidebarWidget?: { title: string; usedLabel: string; usedValue: string; percentage: number; percentageLabel: string };
}

export interface IntegrationsSetupData {
  defaultIntegrationConfig?: { name: string; description: string; fields: { key: string; label: string; type: string; required: boolean }[] };
  integrationTypeMap?: Record<string, string>;
  integrationConfigs?: Record<string, { name: string; description: string; fields: { key: string; label: string; type: string; required: boolean }[] }>;
}

export interface OrganizationItem {
  id: number;
  name: string;
  customerIds: number[];
  archived: boolean;
  settings?: Record<string, unknown>;
}

export type OrganizationsData = OrganizationItem[];

/** Branding – org-level logo, favicon, color theme; used app-wide */
export interface BrandingColorPreset {
  name: string;
  primary: string;
  secondary: string;
}

export interface BrandingData {
  primaryLogoUrl: string | null;
  faviconUrl: string | null;
  colorTheme: string;
  colorPresets: BrandingColorPreset[];
}

/** Fetch branding for app-wide use. Optional organizationId; otherwise first org. No auth required so auth page can use it. */
export async function fetchBranding(organizationId?: number): Promise<BrandingData> {
  const params: Record<string, string> = {};
  if (organizationId != null && !Number.isNaN(organizationId)) params.organizationId = String(organizationId);
  const url = getApiUrl("/api/v1/branding");
  const fullUrl = Object.keys(params).length ? `${url}?${new URLSearchParams(params).toString()}` : url;
  const res = await fetch(fullUrl, { credentials: "include" });
  if (!res.ok) return { primaryLogoUrl: null, faviconUrl: null, colorTheme: "Default", colorPresets: [] };
  const data = (await res.json()) as BrandingData;
  return {
    primaryLogoUrl: data.primaryLogoUrl ?? null,
    faviconUrl: data.faviconUrl ?? null,
    colorTheme: data.colorTheme ?? "Default",
    colorPresets: Array.isArray(data.colorPresets) ? data.colorPresets : [],
  };
}

/** Upload logo or favicon for an org; returns the stored URL (data URL in stub). */
export async function uploadOrgBrandingAsset(
  organizationId: number,
  type: "logo" | "favicon",
  dataUrl: string
): Promise<string | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl(`/api/v1/admin/organizations/${organizationId}/branding/upload`), {
      method: "POST",
      headers,
      body: JSON.stringify({ type, data: dataUrl }),
      credentials: "include",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string };
    return json.url ?? null;
  } catch {
    return null;
  }
}

/** Audit log entry – used for login, data access, file activity, AI usage */
export interface AuditLogEntry {
  id: string;
  type: "login" | "data_access" | "file" | "ai_usage";
  action: string;
  user: string;
  userId?: number;
  ip?: string;
  location?: string;
  resource?: string;
  resourceId?: string;
  details?: string;
  timestamp: string;
  status: "success" | "failure" | "warning";
  metadata?: Record<string, unknown>;
}

export interface AuditLogsData {
  entries: AuditLogEntry[];
  total?: number;
}

// --- Fetch helper (API only; throws on non-OK so React Query can show error/retry) ---

async function fetchWithAuth(url: string): Promise<Response> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { credentials: "include", headers });
}

async function getAdminJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = getApiUrl(path);
  const fullUrl = params && Object.keys(params).length
    ? `${url}?${new URLSearchParams(params).toString()}`
    : url;
  const res = await fetchWithAuth(fullUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(res.status === 401 ? "Unauthorized" : text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// --- API-only fetchers ---

export function fetchAdminDashboard(): Promise<DashboardData> {
  return getAdminJson<DashboardData>("/api/v1/admin/dashboard");
}

export function fetchAdminUsage(params?: { dateRange?: string }): Promise<UsageData> {
  return getAdminJson<UsageData>("/api/v1/admin/usage", params ? { dateRange: params.dateRange } : undefined);
}

export function fetchAdminCredits(): Promise<CreditsData> {
  return getAdminJson<CreditsData>("/api/v1/admin/credits");
}

/** Allocate or deduct credits for a user (admin/super_admin). Returns { userId, previousCredits, newCredits, amount }. */
export async function allocateAdminCredits(
  userId: number,
  amount: number,
  description?: string
): Promise<{ userId: number; previousCredits: number; newCredits: number; amount: number }> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(getApiUrl("/api/v1/admin/credits/allocate"), {
    method: "POST",
    headers,
    body: JSON.stringify({ userId, amount, description }),
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ userId: number; previousCredits: number; newCredits: number; amount: number }>;
}

/** List all users (for admin allocate-credits modal). */
export async function fetchAdminUsersList(): Promise<{ id: number; email?: string; first_name?: string; last_name?: string; role?: string }[]> {
  return getAdminJson("/api/v1/users");
}

export async function fetchAdminBillingPlans(): Promise<BillingPlansData> {
  try {
    return await getAdminJson<BillingPlansData>("/api/v1/admin/billing/plans");
  } catch {
    return { plans: [] };
  }
}

export async function createAdminBillingPlan(body: Partial<BillingPlanItem>): Promise<BillingPlanItem | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl("/api/v1/admin/billing/plans"), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as BillingPlanItem;
  } catch {
    return null;
  }
}

export async function updateAdminBillingPlan(id: string, body: Partial<BillingPlanItem>): Promise<BillingPlanItem | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl(`/api/v1/admin/billing/plans/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as BillingPlanItem;
  } catch {
    return null;
  }
}

export async function deleteAdminBillingPlan(id: string): Promise<boolean> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl(`/api/v1/admin/billing/plans/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers,
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function assignPlanToCustomer(userId: number, planId: string): Promise<boolean> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl("/api/v1/admin/billing/assign"), {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, planId }),
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAdminInvoices(): Promise<InvoicesData> {
  try {
    return await getAdminJson<InvoicesData>("/api/v1/admin/billing/invoices");
  } catch {
    return { invoices: [] };
  }
}

export async function fetchAdminApiQuota(): Promise<ApiQuotaData> {
  try {
    return await getAdminJson<ApiQuotaData>("/api/v1/admin/billing/api-quota");
  } catch {
    return {};
  }
}

export async function updateAdminApiQuota(body: { limitPerMonth?: number }): Promise<ApiQuotaData | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl("/api/v1/admin/billing/api-quota"), {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as ApiQuotaData;
  } catch {
    return null;
  }
}

export function fetchAdminAnalytics(params?: { dateRange?: string }): Promise<AnalyticsData> {
  return getAdminJson<AnalyticsData>("/api/v1/admin/analytics", params ? { dateRange: params.dateRange } : undefined);
}

export function fetchAdminOptions(): Promise<AdminOptionsData> {
  return getAdminJson<AdminOptionsData>("/api/v1/admin/options");
}

export function fetchAdminSidebar(): Promise<AdminSidebarData> {
  return getAdminJson<AdminSidebarData>("/api/v1/admin/sidebar");
}

export function fetchAdminContent(): Promise<ContentData> {
  return getAdminJson<ContentData>("/api/v1/admin/content");
}

export async function fetchAdminKnowledgeBase(): Promise<KnowledgeBaseData> {
  try {
    return await getAdminJson<KnowledgeBaseData>("/api/v1/admin/knowledge-base");
  } catch {
    return { documents: [] };
  }
}

export async function rebuildAdminKnowledgeBase(): Promise<{ success: boolean }> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl("/api/v1/admin/knowledge-base/rebuild"), {
      method: "POST",
      headers,
      credentials: "include",
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

export async function fetchAdminKnowledgeBaseVersions(): Promise<KnowledgeBaseVersionsData> {
  try {
    return await getAdminJson<KnowledgeBaseVersionsData>("/api/v1/admin/knowledge-base/versions");
  } catch {
    return { versions: [] };
  }
}

export async function restoreAdminKnowledgeBaseVersion(versionId: string): Promise<boolean> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl(`/api/v1/admin/knowledge-base/versions/${encodeURIComponent(versionId)}/restore`), {
      method: "POST",
      headers,
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function fetchAdminAIConfig(): Promise<AIConfigData> {
  return getAdminJson<AIConfigData>("/api/v1/admin/ai-config");
}

export async function updateAdminAIConfig(payload: Partial<AIConfigData>): Promise<AIConfigData> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(getApiUrl("/api/v1/admin/ai-config"), {
    method: "PATCH",
    headers,
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<AIConfigData>;
}

export async function fetchAdminSettings(): Promise<SettingsData> {
  try {
    return await getAdminJson<SettingsData>("/api/v1/admin/settings");
  } catch {
    return {
      organization: { companyName: "", industry: "", description: "", website: "", supportEmail: "" },
      billing: { planName: "", planPrice: "", billingInterval: "" },
      localization: { locale: "en", timezone: "UTC", dateFormat: "", currency: "USD" },
      colorPresets: [],
      notificationSettings: [],
      emailServer: { host: "", port: 587, user: "", from: "", secure: true },
      storage: { provider: "local", bucket: "", region: "" },
      apiKeys: [],
      backups: [],
    };
  }
}

export async function updateAdminSettings(
  body: Partial<Pick<SettingsData, "organization" | "notificationSettings" | "emailServer" | "storage" | "billing" | "localization" | "defaultTheme">>,
  apiKeys?: { create?: { name: string }; revoke?: string[] }
): Promise<SettingsData | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl("/api/v1/admin/settings"), {
      method: "PATCH",
      headers,
      body: JSON.stringify({ ...body, apiKeys }),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as SettingsData;
  } catch {
    return null;
  }
}

export function fetchAdminSecurity(): Promise<SecurityData> {
  return getAdminJson<SecurityData>("/api/v1/admin/security");
}

export async function updateAdminSecurityConfig(body: Partial<{
  sessionIdleMinutes: number;
  sessionMaxDurationMinutes: number;
  sessionRememberMeDays: number;
  ipRestrictionEnabled: boolean;
  ipAllowlist: string[];
  ipDenylist: string[];
}>): Promise<SecurityData | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl("/api/v1/admin/security"), {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as SecurityData;
  } catch {
    return null;
  }
}

export function fetchAdminTerms(): Promise<TermsData> {
  return getAdminJson<TermsData>("/api/v1/admin/terms");
}

export function fetchAdminProposalsNewSupport(): Promise<ProposalsNewSupportData> {
  return getAdminJson<ProposalsNewSupportData>("/api/v1/admin/proposals-new-support");
}

export function fetchAdminIntegrationSetup(): Promise<IntegrationsSetupData> {
  return getAdminJson<IntegrationsSetupData>("/api/v1/admin/integrations-setup");
}

export function fetchAdminIntegrations(): Promise<IntegrationsData> {
  return getAdminJson<IntegrationsData>("/api/v1/admin/integrations");
}

export function fetchAdminPermissions(): Promise<PermissionsData> {
  return getAdminJson<PermissionsData>("/api/v1/admin/permissions");
}

export async function fetchAdminRoles(): Promise<RolesData> {
  try {
    return await getAdminJson<RolesData>("/api/v1/admin/roles");
  } catch {
    return { roles: [], permissionDefinitions: [] };
  }
}

export async function createAdminRole(body: { name: string; permissions: Record<string, string[]> }): Promise<RoleItem | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl("/api/v1/admin/roles"), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as RoleItem;
  } catch {
    return null;
  }
}

export async function updateAdminRole(id: string, body: { name?: string; permissions?: Record<string, string[]> }): Promise<RoleItem | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl(`/api/v1/admin/roles/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as RoleItem;
  } catch {
    return null;
  }
}

export async function deleteAdminRole(id: string): Promise<boolean> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl(`/api/v1/admin/roles/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers,
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAdminRfpTemplates(): Promise<RfpTemplatesData> {
  try {
    return await getAdminJson<RfpTemplatesData>("/api/v1/admin/rfp-templates");
  } catch {
    return { templates: [] };
  }
}

export async function createAdminRfpTemplate(body: {
  name: string;
  description?: string;
  mandatorySections?: string[];
  questionSet?: RfpTemplateQuestion[];
}): Promise<RfpTemplateItem | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl("/api/v1/admin/rfp-templates"), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as RfpTemplateItem;
  } catch {
    return null;
  }
}

export async function updateAdminRfpTemplate(
  id: string,
  body: { name?: string; description?: string; mandatorySections?: string[]; questionSet?: RfpTemplateQuestion[]; locked?: boolean }
): Promise<RfpTemplateItem | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl(`/api/v1/admin/rfp-templates/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as RfpTemplateItem;
  } catch {
    return null;
  }
}

export async function deleteAdminRfpTemplate(id: string): Promise<boolean> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl(`/api/v1/admin/rfp-templates/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers,
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAdminOrganizations(): Promise<OrganizationsData> {
  try {
    return await getAdminJson<OrganizationsData>("/api/v1/admin/organizations");
  } catch {
    return [];
  }
}

export async function fetchAdminOrganization(id: number): Promise<OrganizationItem | null> {
  try {
    return await getAdminJson<OrganizationItem>(`/api/v1/admin/organizations/${id}`);
  } catch {
    return null;
  }
}

export async function updateAdminOrganization(
  id: number,
  body: { name?: string; customerIds?: number[]; archived?: boolean; settings?: Record<string, unknown> }
): Promise<OrganizationItem | null> {
  try {
    const token = authStorage.getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(getApiUrl(`/api/v1/admin/organizations/${id}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as OrganizationItem;
  } catch {
    return null;
  }
}

export type AuditLogType = AuditLogEntry["type"];

export async function fetchAdminAuditLogs(params?: {
  type?: AuditLogType;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditLogsData> {
  try {
    const searchParams: Record<string, string> = {};
    if (params?.type) searchParams.type = params.type;
    if (params?.dateFrom) searchParams.dateFrom = params.dateFrom;
    if (params?.dateTo) searchParams.dateTo = params.dateTo;
    if (params?.limit != null) searchParams.limit = String(params.limit);
    if (params?.offset != null) searchParams.offset = String(params.offset);
    return await getAdminJson<AuditLogsData>(
      "/api/v1/admin/audit-logs",
      Object.keys(searchParams).length ? searchParams : undefined
    );
  } catch {
    return { entries: [] };
  }
}
