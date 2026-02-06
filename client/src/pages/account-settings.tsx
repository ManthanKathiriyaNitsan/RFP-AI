import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Lock,
  Bell,
  CreditCard,
  Upload,
  X,
  Save,
  Home,
  Bot,
  FileText,
  ChevronRight,
  Brain,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { softBadgeClasses } from "@/lib/badge-classes";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { usePrompt } from "@/hooks/use-prompt";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { getApiUrl, getAvatarUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";
import type { AccountSettingsConfig, FormField, NotificationToggle } from "@/config/account-settings.types";

/** Minimal default when backend does not return config; all data should come from backend. */
const defaultAccountSettingsConfig: AccountSettingsConfig = {
  page: { title: "Account Settings", subtitle: "Manage your profile and preferences" },
  headerActions: [
    { id: "home", label: "Home", icon: "home", href: "" },
    { id: "aiChat", label: "AI Chat", icon: "bot", href: "/ai-chat" },
    { id: "newProposal", label: "New Proposal", icon: "fileText", href: "/proposals/new" },
  ],
  sidebar: {
    settingsLabel: "Settings",
    nav: [
      { id: "profile", label: "Profile", icon: "user" },
      { id: "security", label: "Security", icon: "lock" },
      { id: "notifications", label: "Notifications", icon: "bell" },
      { id: "billing", label: "Billing", icon: "creditCard" },
    ],
    userCard: { creditsLabel: "Credits", creditsSuffix: "credits available", showCreditsBar: true },
  },
  sections: {
    profile: {
      title: "Profile Information",
      avatar: {
        sectionLabel: "Profile Picture",
        uploadLabel: "Upload New",
        removeLabel: "Remove",
        removeConfirmTitle: "Remove Profile Picture",
        removeConfirmDescription: "Are you sure you want to remove your profile picture?",
        removeConfirmButton: "Remove",
        removeCancelButton: "Cancel",
      },
      fields: [
        { id: "firstName", label: "First Name", type: "text", gridCol: "half" },
        { id: "lastName", label: "Last Name", type: "text", gridCol: "half" },
        { id: "email", label: "Email", type: "email", gridCol: "full" },
        { id: "company", label: "Company", type: "text", gridCol: "full" },
        { id: "jobTitle", label: "Job Title", type: "text", gridCol: "full" },
        { id: "bio", label: "Bio", type: "textarea", placeholder: "Tell us about yourself...", rows: 3, gridCol: "full" },
      ],
      saveLabel: "Save Changes",
      savingLabel: "Saving...",
    },
    security: {
      title: "Security Settings",
      fields: [
        { id: "currentPassword", label: "Current Password", type: "password", placeholder: "Enter current password" },
        { id: "newPassword", label: "New Password", type: "password", placeholder: "Enter new password" },
        { id: "confirmPassword", label: "Confirm New Password", type: "password", placeholder: "Confirm new password" },
      ],
      twoFactor: {
        title: "Two-Factor Authentication",
        description: "Add an extra layer of security to your account",
        buttonLabel: "Enable 2FA",
        confirmTitle: "Enable Two-Factor Authentication",
        confirmDescription: "2FA Setup Code: {setupCode}\n\nPlease save this code. Continue to enable 2FA?",
        confirmButton: "Enable 2FA",
        cancelButton: "Cancel",
        successTitle: "2FA Enabled",
        successDescription: "Two-factor authentication has been enabled. Please scan the QR code with your authenticator app.",
      },
      activeSessions: {
        title: "Active Sessions",
        sessionLabel: "Current Session",
        sessionDescription: "Chrome on macOS • Last active now",
        currentBadge: "Current",
      },
      updatePasswordLabel: "Update Password",
      updatingLabel: "Updating...",
    },
    notifications: {
      title: "Notification Preferences",
      toggles: [],
      saveLabel: "Save Preferences",
      successTitle: "Preferences saved",
      successDescription: "Your notification preferences have been saved.",
    },
    billing: {
      title: "Billing & Subscription",
      plan: {
        title: "Current Plan",
        planName: "Professional Plan",
        statusBadge: "Active",
        creditsLabel: "Credits Remaining:",
        nextBillingLabel: "Next Billing Date:",
      },
      paymentMethod: {
        title: "Payment Method",
        maskLabel: "•••• •••• •••• 4242",
        expiresLabel: "Expires 12/24",
        updateButtonLabel: "Update",
        updatePromptTitle: "Update Card Number",
        updatePromptDescription: "Enter new card number (16 digits)",
        updatePromptPlaceholder: "•••• •••• •••• ••••",
        successTitle: "Payment method updated",
        successDescription: "Your payment method has been updated successfully.",
        invalidTitle: "Invalid card number",
        invalidDescription: "Please enter a valid 16-digit card number.",
      },
      transactionsTitle: "Recent Transactions",
      transactions: [],
      downloadInvoiceLabel: "Download Invoice",
      cancelSubscriptionLabel: "Cancel Subscription",
      cancelConfirmTitle: "Cancel Subscription",
      cancelConfirmDescription: "Are you sure you want to cancel your subscription? This action cannot be undone.",
      cancelConfirmButton: "Cancel Subscription",
      cancelKeepButton: "Keep Subscription",
      cancelSuccessTitle: "Subscription cancelled",
      cancelSuccessDescription: "Your subscription has been cancelled. Access will continue until the end of the billing period.",
      invoiceDownloadedTitle: "Invoice downloaded",
      invoiceDownloadedDescription: "Your invoice has been downloaded.",
    },
  },
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  lock: Lock,
  bell: Bell,
  creditCard: CreditCard,
  home: Home,
  bot: Bot,
  fileText: FileText,
  upload: Upload,
  x: X,
  save: Save,
  chevronRight: ChevronRight,
};

interface AccountSettingsProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

async function fetchAccountSettingsConfig(): Promise<AccountSettingsConfig> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(getApiUrl("/api/v1/customer/account-settings"), {
    credentials: "include",
    headers,
  });
  if (res.ok) return res.json() as Promise<AccountSettingsConfig>;
  return defaultAccountSettingsConfig;
}

export default function AccountSettings({ sidebarOpen = false, setSidebarOpen }: AccountSettingsProps = {}) {
  const { user, updateUser, currentRole } = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { prompt, PromptDialog } = usePrompt();
  const queryClient = useQueryClient();
  const { data: configData } = useQuery({
    queryKey: ["account-settings"],
    queryFn: fetchAccountSettingsConfig,
  });
  const config = configData ?? defaultAccountSettingsConfig;
  const [activeTab, setActiveTab] = useState(config.sidebar.nav[0]?.id ?? "profile");
  const isMobile = useIsMobile();

  const getHomeRoute = () => {
    if (currentRole === "admin") return "/admin";
    if (currentRole === "collaborator") return "/collaborator";
    return "/dashboard";
  };

  const profileFieldIds = useMemo(
    () => config.sections.profile.fields.map((f) => f.id),
    [config]
  );
  const initialProfileData = useMemo(() => {
    const data: Record<string, string> = {};
    profileFieldIds.forEach((id) => {
      const key = id as keyof typeof user;
      const raw = user && key in user ? (user as Record<string, unknown>)[key] : "";
      data[id] = typeof raw === "string" ? raw : raw != null ? String(raw) : "";
    });
    return data;
  }, [user, profileFieldIds]);

  const securityFieldIds = useMemo(
    () => config.sections.security.fields.map((f) => f.id),
    [config]
  );
  const initialSecurityData = useMemo(() => {
    const data: Record<string, string> = {};
    securityFieldIds.forEach((id) => {
      data[id] = "";
    });
    return data;
  }, [securityFieldIds]);

  const initialNotificationData = useMemo(() => {
    const data: Record<string, boolean> = {};
    config.sections.notifications.toggles.forEach((t) => {
      data[t.id] = t.defaultValue;
    });
    return data;
  }, [config]);

  const [profileData, setProfileData] = useState<Record<string, string>>(initialProfileData);
  const [securityData, setSecurityData] = useState<Record<string, string>>(initialSecurityData);
  const [notificationSettings, setNotificationSettings] =
    useState<Record<string, boolean>>(initialNotificationData);

  useEffect(() => {
    if (user) {
      const next: Record<string, string> = {};
      profileFieldIds.forEach((id) => {
        const key = id as keyof typeof user;
        const raw = key in user ? (user as Record<string, unknown>)[key] : "";
        next[id] = typeof raw === "string" ? raw : raw != null ? String(raw) : "";
      });
      setProfileData((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }
  }, [user?.id, profileFieldIds]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const response = await apiRequest("PATCH", `/api/users/${user?.id}`, data);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const response = await apiRequest("PATCH", `/api/users/${user?.id}`, {
        password: data.newPassword,
      });
      return response.json();
    },
    onSuccess: () => {
      setSecurityData(initialSecurityData);
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive",
      });
    },
  });

  /** Normalize API user (camelCase, date strings) for updateUser merge. Ensures avatar is passed through. */
  const normalizeApiUser = (u: Record<string, unknown>) => ({
    ...u,
    avatar: u.avatar != null ? u.avatar : undefined,
    createdAt: u.createdAt ? new Date(u.createdAt as string) : undefined,
    updatedAt: u.updatedAt ? new Date(u.updatedAt as string) : undefined,
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/users/${user?.id}`, { avatar: null });
      return response.json() as Promise<Record<string, unknown>>;
    },
    onSuccess: (updatedUser) => {
      updateUser(normalizeApiUser(updatedUser) as Parameters<typeof updateUser>[0]);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Profile picture removed",
        description: "Your profile picture has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove profile picture. Please try again.",
        variant: "destructive",
      });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = authStorage.getAccessToken();
      const url = getApiUrl("/api/v1/users/me/avatar");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(url, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
      return res.json() as Promise<Record<string, unknown>>;
    },
    onSuccess: (updatedUser) => {
      updateUser(normalizeApiUser(updatedUser) as Parameters<typeof updateUser>[0]);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Profile picture uploaded",
        description: "Your profile picture has been updated.",
      });
    },
    onError: (e) => {
      toast({
        title: "Upload failed",
        description: e instanceof Error ? e.message : "Failed to upload. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProfileSave = () => {
    updateProfileMutation.mutate(profileData);
  };

  const handlePasswordUpdate = () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    if ((securityData.newPassword || "").length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }
    updatePasswordMutation.mutate(securityData);
  };

  const updateProfileData = (field: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const updateSecurityData = (field: string, value: string) => {
    setSecurityData((prev) => ({ ...prev, [field]: value }));
  };

  const updateNotificationSetting = (setting: string, value: boolean) => {
    setNotificationSettings((prev) => ({ ...prev, [setting]: value }));
  };

  const renderNavItem = (item: (typeof config.sidebar.nav)[0]) => {
    const active = activeTab === item.id;
    const Icon = ICON_MAP[item.icon] ?? User;
    return (
      <button
        key={item.id}
        onClick={() => {
          setActiveTab(item.id);
          if (setSidebarOpen) setSidebarOpen(false);
        }}
        className={cn(
          "group w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
          active ? "sidebar-nav-active" : "sidebar-nav-inactive"
        )}
      >
        <span className="flex items-center gap-3">
          <Icon
            className={cn(
              "w-4 h-4 transition-colors",
              active ? "sidebar-icon-active" : "sidebar-icon-inactive"
            )}
          />
          {item.label}
        </span>
        {active && <ChevronRight className="w-4 h-4 sidebar-icon-active" />}
      </button>
    );
  };

  const renderProfileField = (field: FormField) => {
    const value = profileData[field.id] ?? "";
    const isTextarea = field.type === "textarea";
    const gridClass = field.gridCol === "half" ? "sm:col-span-1" : "sm:col-span-2";
    return (
      <div key={field.id} className={cn("space-y-2", gridClass)}>
        <Label htmlFor={field.id} className="text-xs sm:text-sm">
          {field.label}
        </Label>
        {isTextarea ? (
          <Textarea
            id={field.id}
            rows={field.rows ?? 3}
            placeholder={field.placeholder}
            value={value}
            onChange={(e) => updateProfileData(field.id, e.target.value)}
            className="text-sm sm:text-base"
          />
        ) : (
          <Input
            id={field.id}
            type={field.type}
            value={value}
            onChange={(e) => updateProfileData(field.id, e.target.value)}
            className="text-sm sm:text-base"
          />
        )}
      </div>
    );
  };

  const renderNotificationToggle = (toggle: NotificationToggle) => (
    <div key={toggle.id} className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h4 className="font-medium text-xs sm:text-sm">{toggle.label}</h4>
        <p className="text-[10px] sm:text-sm text-muted-foreground">{toggle.description}</p>
      </div>
      <Switch
        checked={notificationSettings[toggle.id] ?? toggle.defaultValue}
        onCheckedChange={(checked) => updateNotificationSetting(toggle.id, checked)}
        className="shrink-0"
      />
    </div>
  );

  if (!user) return null;

  const { page, sidebar, sections } = config;
  const profileSection = sections.profile;
  const securitySection = sections.security;
  const notificationsSection = sections.notifications;
  const billingSection = sections.billing;
  const credits = user?.credits ?? 0;

  return (
    <div className="space-y-4 sm:space-y-8">
      <ConfirmDialog />
      <PromptDialog />

      {/* Mobile Sidebar */}
      {isMobile && setSidebarOpen && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-[280px] p-0">
            <div
              className="flex flex-col h-full border-r border-border"
              style={{ backgroundColor: "var(--sidebar-bg)" }}
            >
              <div className="p-4 border-b border-border">
                <Link
                  href={getHomeRoute()}
                  onClick={() => setSidebarOpen?.(false)}
                  className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
                >
                  <div className="w-9 h-9 theme-gradient-bg rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold theme-gradient-text">
                      RFP AI
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium -mt-1">
                      Admin Console
                    </span>
                  </div>
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="px-3 space-y-6 pb-4 pt-4">
                  <div>
                    <h3
                      className="px-3 text-[10px] font-semibold uppercase tracking-wider mb-2"
                      style={{ color: "var(--sidebar-muted)" }}
                    >
                      {sidebar.settingsLabel}
                    </h3>
                    <nav className="space-y-0.5">
                      {sidebar.nav.map(renderNavItem)}
                    </nav>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-border">
                <div className="rounded-xl p-4 sidebar-widget-bg">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-8 h-8">
                      {getAvatarUrl(user?.avatar ?? null) && (
                        <AvatarImage src={getAvatarUrl(user?.avatar ?? null)!} alt="" className="object-cover" />
                      )}
                      <AvatarFallback className="text-xs sidebar-avatar-bg">
                        {user?.firstName?.[0]}
                        {user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{sidebar.userCard.creditsLabel}</span>
                      <span className="font-medium text-foreground">{credits}</span>
                    </div>
                    {sidebar.userCard.showCreditsBar && (
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full theme-gradient-fill rounded-full"
                          style={{ width: `${Math.min((credits / 1000) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {credits} {sidebar.userCard.creditsSuffix}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{page.title}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{page.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div className="lg:col-span-1">
            <aside
              className="w-full flex flex-col border rounded-lg overflow-hidden border-border"
              style={{ backgroundColor: "var(--sidebar-bg)" }}
            >
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <div className="px-3 space-y-6 pb-4 pt-4">
                  <div>
                    <h3
                      className="px-3 text-[10px] font-semibold uppercase tracking-wider mb-2"
                      style={{ color: "var(--sidebar-muted)" }}
                    >
                      {sidebar.settingsLabel}
                    </h3>
                    <nav className="space-y-0.5">
                      {sidebar.nav.map((item) => {
                        const active = activeTab === item.id;
                        const Icon = ICON_MAP[item.icon] ?? User;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                              "group w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                              active ? "sidebar-nav-active" : "sidebar-nav-inactive"
                            )}
                          >
                            <span className="flex items-center gap-3">
                              <Icon
                                className={cn(
                                  "w-4 h-4 transition-colors",
                                  active ? "sidebar-icon-active" : "sidebar-icon-inactive"
                                )}
                              />
                              {item.label}
                            </span>
                            {active && (
                              <ChevronRight className="w-4 h-4 sidebar-icon-active" />
                            )}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-border">
                <div className="rounded-xl p-4 sidebar-widget-bg">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-8 h-8">
                      {getAvatarUrl(user?.avatar ?? null) && (
                        <AvatarImage src={getAvatarUrl(user?.avatar ?? null)!} alt="" className="object-cover" />
                      )}
                      <AvatarFallback className="text-xs sidebar-avatar-bg">
                        {user?.firstName?.[0]}
                        {user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {sidebar.userCard.creditsLabel}
                      </span>
                      <span className="font-medium text-foreground">{credits}</span>
                    </div>
                    {sidebar.userCard.showCreditsBar && (
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full theme-gradient-fill rounded-full"
                          style={{ width: `${Math.min((credits / 1000) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {credits} {sidebar.userCard.creditsSuffix}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Profile */}
            <TabsContent value="profile">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base">{profileSection.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
                  <div
                    className={cn(
                      "flex",
                      isMobile ? "flex-col" : "items-center",
                      "gap-4 sm:gap-6"
                    )}
                  >
                    <Avatar className="w-16 h-16 sm:w-20 sm:h-20 shrink-0">
                      {getAvatarUrl(user?.avatar ?? null) && (
                        <AvatarImage src={getAvatarUrl(user?.avatar ?? null)!} alt="" className="object-cover" />
                      )}
                      <AvatarFallback className="text-base sm:text-lg">
                        {user?.firstName?.[0]}
                        {user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-sm sm:text-base mb-2 sm:mb-3">
                        {profileSection.avatar.sectionLabel}
                      </h3>
                      <div
                        className={cn(
                          "flex",
                          isMobile ? "flex-col" : "",
                          "gap-2 sm:gap-3"
                        )}
                      >
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                toast({
                                  title: "File too large",
                                  description: "File size must be less than 5MB.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              uploadAvatarMutation.mutate(file);
                            }
                            e.target.value = "";
                          }}
                          style={{ display: "none" }}
                          id="profile-upload"
                        />
                        <Button
                          size="sm"
                          className="text-xs sm:text-sm"
                          disabled={uploadAvatarMutation.isPending}
                          onClick={() =>
                            document.getElementById("profile-upload")?.click()
                          }
                        >
                          {uploadAvatarMutation.isPending ? (
                            <>Saving...</>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              {profileSection.avatar.uploadLabel}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs sm:text-sm"
                          disabled={removeAvatarMutation.isPending}
                          onClick={async () => {
                            const confirmed = await confirm({
                              title: profileSection.avatar.removeConfirmTitle,
                              description: profileSection.avatar.removeConfirmDescription,
                              confirmText: profileSection.avatar.removeConfirmButton,
                              cancelText: profileSection.avatar.removeCancelButton,
                              variant: "destructive",
                            });
                            if (confirmed) {
                              removeAvatarMutation.mutate();
                            }
                          }}
                        >
                          {removeAvatarMutation.isPending ? (
                            <>Removing...</>
                          ) : (
                            <>
                              <X className="w-4 h-4 mr-2" />
                              {profileSection.avatar.removeLabel}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {profileSection.fields.map(renderProfileField)}
                  </div>

                  <div className="flex justify-end pt-4 sm:pt-6 border-t">
                    <Button
                      onClick={handleProfileSave}
                      disabled={updateProfileMutation.isPending}
                      className="w-full sm:w-auto text-xs sm:text-sm"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateProfileMutation.isPending
                        ? profileSection.savingLabel
                        : profileSection.saveLabel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security */}
            <TabsContent value="security">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base">{securitySection.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
                  <div className="space-y-3 sm:space-y-4">
                    {securitySection.fields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label
                          htmlFor={field.id}
                          className="text-xs sm:text-sm"
                        >
                          {field.label}
                        </Label>
                        <Input
                          id={field.id}
                          type="password"
                          placeholder={field.placeholder}
                          value={securityData[field.id] ?? ""}
                          onChange={(e) =>
                            updateSecurityData(field.id, e.target.value)
                          }
                          className="text-sm sm:text-base"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="bg-muted rounded-lg p-3 sm:p-4">
                    <h4 className="font-medium text-sm sm:text-base mb-2 sm:mb-3">
                      {securitySection.twoFactor.title}
                    </h4>
                    <div
                      className={cn(
                        "flex",
                        isMobile ? "flex-col" : "items-center justify-between",
                        "gap-3"
                      )}
                    >
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {securitySection.twoFactor.description}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto text-xs sm:text-sm"
                        onClick={async () => {
                          const setupCode = "ABCD-1234-EFGH-5678";
                          const description =
                            securitySection.twoFactor.confirmDescription.replace(
                              "{setupCode}",
                              setupCode
                            );
                          const confirmed = await confirm({
                            title: securitySection.twoFactor.confirmTitle,
                            description,
                            confirmText: securitySection.twoFactor.confirmButton,
                            cancelText: securitySection.twoFactor.cancelButton,
                          });
                          if (confirmed) {
                            toast({
                              title: securitySection.twoFactor.successTitle,
                              description: securitySection.twoFactor.successDescription,
                            });
                          }
                        }}
                      >
                        {securitySection.twoFactor.buttonLabel}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <h4 className="font-medium text-sm sm:text-base">
                      {securitySection.activeSessions.title}
                    </h4>
                    <div className="space-y-2">
                      <div
                        className={cn(
                          "flex",
                          isMobile ? "flex-col" : "items-center justify-between",
                          "gap-3 p-3 border rounded-lg"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-xs sm:text-sm">
                            {securitySection.activeSessions.sessionLabel}
                          </p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {securitySection.activeSessions.sessionDescription}
                          </p>
                        </div>
                        <Badge variant="outline" className={`${softBadgeClasses.success} text-[10px] sm:text-xs shrink-0`}>
                          {securitySection.activeSessions.currentBadge}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 sm:pt-6 border-t">
                    <Button
                      onClick={handlePasswordUpdate}
                      disabled={updatePasswordMutation.isPending}
                      className="w-full sm:w-auto text-xs sm:text-sm"
                    >
                      {updatePasswordMutation.isPending
                        ? securitySection.updatingLabel
                        : securitySection.updatePasswordLabel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications */}
            <TabsContent value="notifications">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base">
                    {notificationsSection.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
                  <div className="space-y-3 sm:space-y-4">
                    {notificationsSection.toggles.map(renderNotificationToggle)}
                  </div>
                  <div className="flex justify-end pt-4 sm:pt-6 border-t">
                    <Button
                      onClick={() => {
                        toast({
                          title: notificationsSection.successTitle,
                          description: notificationsSection.successDescription,
                        });
                      }}
                      className="w-full sm:w-auto text-xs sm:text-sm"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {notificationsSection.saveLabel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Billing */}
            <TabsContent value="billing">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base">
                    {billingSection.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
                  <div className="border rounded-lg p-3 sm:p-4">
                    <div
                      className={cn(
                        "flex",
                        isMobile ? "flex-col" : "items-center justify-between",
                        "gap-3 mb-3 sm:mb-4"
                      )}
                    >
                      <div>
                        <h4 className="font-medium text-sm sm:text-base">
                          {billingSection.plan.title}
                        </h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          {billingSection.plan.planName}
                        </p>
                      </div>
                      <Badge variant="outline" className={`${softBadgeClasses.primary} text-[10px] sm:text-xs shrink-0`}>
                        {billingSection.plan.statusBadge}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                      <div>
                        <span className="text-muted-foreground">
                          {billingSection.plan.creditsLabel}
                        </span>
                        <span className="font-medium ml-2">{credits}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {billingSection.plan.nextBillingLabel}
                        </span>
                        <span className="font-medium ml-2">Jan 15, 2024</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <h4 className="font-medium text-sm sm:text-base">
                      {billingSection.paymentMethod.title}
                    </h4>
                    <div className="border rounded-lg p-3 sm:p-4">
                      <div
                        className={cn(
                          "flex",
                          isMobile ? "flex-col" : "items-center justify-between",
                          "gap-3"
                        )}
                      >
                        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center shrink-0">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs sm:text-sm">
                              {billingSection.paymentMethod.maskLabel}
                            </p>
                            <p className="text-[10px] sm:text-sm text-muted-foreground">
                              {billingSection.paymentMethod.expiresLabel}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto text-xs sm:text-sm"
                          onClick={async () => {
                            const cardNumber = await prompt({
                              title: billingSection.paymentMethod.updatePromptTitle,
                              description: billingSection.paymentMethod.updatePromptDescription,
                              placeholder: billingSection.paymentMethod.updatePromptPlaceholder,
                              type: "text",
                            });
                            if (
                              cardNumber &&
                              cardNumber.replace(/\s+/g, "").length === 16
                            ) {
                              toast({
                                title: billingSection.paymentMethod.successTitle,
                                description:
                                  billingSection.paymentMethod.successDescription,
                              });
                            } else if (cardNumber) {
                              toast({
                                title: billingSection.paymentMethod.invalidTitle,
                                description:
                                  billingSection.paymentMethod.invalidDescription,
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          {billingSection.paymentMethod.updateButtonLabel}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <h4 className="font-medium text-sm sm:text-base">
                      {billingSection.transactionsTitle}
                    </h4>
                    <div className="space-y-2">
                      {billingSection.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className={cn(
                            "flex",
                            isMobile ? "flex-col" : "items-center justify-between",
                            "gap-2 p-3 border rounded-lg"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs sm:text-sm">
                              {tx.description}
                            </p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              {tx.date}
                            </p>
                          </div>
                          <span className="font-medium text-xs sm:text-sm shrink-0">
                            {tx.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex",
                      isMobile ? "flex-col-reverse" : "justify-between",
                      "gap-2 sm:gap-0 pt-4 sm:pt-6 border-t"
                    )}
                  >
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto text-xs sm:text-sm"
                      onClick={() => {
                        const invoiceData = {
                          invoiceNumber: `INV-${Date.now()}`,
                          date: new Date().toLocaleDateString(),
                          amount: "$99.00",
                          plan: billingSection.plan.planName,
                          status: "Paid",
                        };
                        const dataStr = JSON.stringify(invoiceData, null, 2);
                        const dataBlob = new Blob([dataStr], {
                          type: "application/json",
                        });
                        const url = URL.createObjectURL(dataBlob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `invoice_${invoiceData.invoiceNumber}.json`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        toast({
                          title: billingSection.invoiceDownloadedTitle,
                          description: billingSection.invoiceDownloadedDescription,
                        });
                      }}
                    >
                      {billingSection.downloadInvoiceLabel}
                    </Button>
                    <Button
                      variant="destructive"
                      className="w-full sm:w-auto text-xs sm:text-sm"
                      onClick={async () => {
                        const confirmed = await confirm({
                          title: billingSection.cancelConfirmTitle,
                          description: billingSection.cancelConfirmDescription,
                          confirmText: billingSection.cancelConfirmButton,
                          cancelText: billingSection.cancelKeepButton,
                          variant: "destructive",
                        });
                        if (confirmed) {
                          toast({
                            title: billingSection.cancelSuccessTitle,
                            description: billingSection.cancelSuccessDescription,
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      {billingSection.cancelSubscriptionLabel}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
