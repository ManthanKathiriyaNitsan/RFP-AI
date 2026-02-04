import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  fetchAdminSettings,
  fetchAdminOptions,
  updateAdminSettings,
  fetchAdminOrganizations,
  fetchAdminOrganization,
  updateAdminOrganization,
  uploadOrgBrandingAsset,
  type OrganizationItem,
} from "@/api/admin-data";
import { useBranding, hexToHsl } from "@/contexts/BrandingContext";
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";
import { 
  Settings, 
  Building,
  Palette,
  Bell,
  Globe,
  Mail,
  Save,
  Upload,
  Image,
  Check,
  Server,
  HardDrive,
  Key,
  Archive,
  Plus,
  Trash2,
  Copy,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: fetchAdminSettings,
  });
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const colorPresets = data?.colorPresets ?? [];
  const organization = data?.organization ?? { companyName: "", industry: "", description: "", website: "", supportEmail: "" };
  const billing = data?.billing ?? { planName: "", planPrice: "", billingInterval: "" };
  const localization = data?.localization ?? { locale: "en", timezone: "UTC", dateFormat: "", currency: "USD" };
  const defaultTheme = (data as { defaultTheme?: string })?.defaultTheme ?? colorPresets[0]?.name ?? "";
  const settingsIndustries = optionsData?.settingsIndustries ?? [];
  const locales = optionsData?.locales ?? [];
  const timezones = optionsData?.timezones ?? [];
  const dateFormats = optionsData?.dateFormats ?? [];
  const currencies = optionsData?.currencies ?? [];
  const [selectedColor, setSelectedColor] = useState("");
  const effectiveColor = selectedColor || defaultTheme;
  const selectedPreset = colorPresets.find((p) => p.name === effectiveColor) ?? colorPresets[0];
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { refetch: refetchBranding } = useBranding();

  const { data: orgsList = [] } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: fetchAdminOrganizations,
  });
  const organizations = (Array.isArray(orgsList) ? orgsList : []) as OrganizationItem[];
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const effectiveOrgId = selectedOrgId ?? organizations[0]?.id ?? null;
  const { data: selectedOrg } = useQuery({
    queryKey: ["admin", "organization", effectiveOrgId],
    queryFn: () => fetchAdminOrganization(effectiveOrgId!),
    enabled: effectiveOrgId != null,
  });
  const orgSettings = (selectedOrg?.settings ?? {}) as Record<string, string | undefined>;
  const orgPrimaryLogoUrl = orgSettings.primaryLogoUrl ?? "";
  const orgFaviconUrl = orgSettings.faviconUrl ?? "";
  const orgColorTheme = orgSettings.colorTheme ?? defaultTheme;

  useEffect(() => {
    if (orgColorTheme) setSelectedColor(orgColorTheme);
  }, [selectedOrg?.id, orgColorTheme]);

  // Live preview: apply selected theme to the whole site while on Settings (sidebar, nav, buttons, etc.)
  useEffect(() => {
    if (!selectedPreset?.primary || !selectedPreset?.secondary) return;
    const root = document.documentElement;
    const primaryHsl = hexToHsl(selectedPreset.primary);
    const secondaryHsl = hexToHsl(selectedPreset.secondary);
    const setVar = (name: string, value: string) => root.style.setProperty(name, value, "important");
    setVar("--primary", `hsl(${primaryHsl})`);
    setVar("--primary-shade", `hsl(${secondaryHsl})`);
    setVar("--ring", `hsl(${primaryHsl})`);
    setVar("--sidebar-accent", `hsl(${primaryHsl})`);
    setVar("--theme-gradient", `linear-gradient(135deg, hsl(${primaryHsl}) 0%, hsl(${secondaryHsl}) 100%)`);
    setVar("--theme-gradient-r", `linear-gradient(90deg, hsl(${primaryHsl}) 0%, hsl(${secondaryHsl}) 100%)`);
  }, [selectedPreset?.primary, selectedPreset?.secondary, selectedPreset?.name]);

  // When leaving Settings or switching org, restore saved theme from server
  useEffect(() => {
    return () => {
      void refetchBranding(effectiveOrgId ?? undefined);
    };
  }, [effectiveOrgId, refetchBranding]);

  const [emailHost, setEmailHost] = useState(data?.emailServer?.host ?? "");
  const [emailPort, setEmailPort] = useState(data?.emailServer?.port ?? 587);
  const [emailUser, setEmailUser] = useState(data?.emailServer?.user ?? "");
  const [emailFrom, setEmailFrom] = useState(data?.emailServer?.from ?? "");
  const [emailSecure, setEmailSecure] = useState(data?.emailServer?.secure ?? true);
  const [storageProvider, setStorageProvider] = useState(data?.storage?.provider ?? "local");
  const [storageBucket, setStorageBucket] = useState(data?.storage?.bucket ?? "");
  const [storageRegion, setStorageRegion] = useState(data?.storage?.region ?? "");
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingStorage, setSavingStorage] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);

  useEffect(() => {
    if (data?.emailServer) {
      setEmailHost(data.emailServer.host ?? "");
      setEmailPort(data.emailServer.port ?? 587);
      setEmailUser(data.emailServer.user ?? "");
      setEmailFrom(data.emailServer.from ?? "");
      setEmailSecure(data.emailServer.secure ?? true);
    }
    if (data?.storage) {
      setStorageProvider(data.storage.provider ?? "local");
      setStorageBucket(data.storage.bucket ?? "");
      setStorageRegion(data.storage.region ?? "");
    }
  }, [data?.emailServer, data?.storage]);

  const apiKeys = data?.apiKeys ?? [];
  const backups = data?.backups ?? [];

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  // Organization Details (Settings → Organization tab) – controlled form for Save
  const [orgCompanyName, setOrgCompanyName] = useState(organization.companyName ?? "");
  const [orgIndustry, setOrgIndustry] = useState(organization.industry ?? settingsIndustries[0]?.value ?? "");
  const [orgDescription, setOrgDescription] = useState(organization.description ?? "");
  const [orgWebsite, setOrgWebsite] = useState(organization.website ?? "");
  const [orgSupportEmail, setOrgSupportEmail] = useState(organization.supportEmail ?? "");
  const [savingOrg, setSavingOrg] = useState(false);

  // Notification preferences (Settings → Notifications tab)
  type NotificationPref = { id: number; name: string; description: string; email: boolean; push: boolean };
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPref[]>([]);
  const [savingNotifications, setSavingNotifications] = useState(false);
  useEffect(() => {
    const list = data?.notificationSettings ?? [];
    setNotificationPrefs(Array.isArray(list) ? list.map((s: NotificationPref) => ({ ...s })) : []);
  }, [data?.notificationSettings]);

  const handleNotificationChange = (id: number, field: "email" | "push", value: boolean) => {
    setNotificationPrefs((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    const updated = await updateAdminSettings({ notificationSettings: notificationPrefs });
    setSavingNotifications(false);
    if (updated) {
      qc.setQueryData(["admin", "settings"], updated);
      toast({ title: "Notification preferences saved", description: "Your preferences have been updated." });
    } else {
      toast({ title: "Failed to save notification preferences", variant: "destructive" });
    }
  };

  useEffect(() => {
    const o = data?.organization;
    if (o) {
      setOrgCompanyName(o.companyName ?? "");
      setOrgIndustry(o.industry ?? settingsIndustries[0]?.value ?? "");
      setOrgDescription(o.description ?? "");
      setOrgWebsite(o.website ?? "");
      setOrgSupportEmail(o.supportEmail ?? "");
    }
  }, [data?.organization, settingsIndustries]);

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || effectiveOrgId == null) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "File size must be less than 2MB.", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const url = await uploadOrgBrandingAsset(effectiveOrgId, "logo", dataUrl);
      if (url) {
        qc.invalidateQueries({ queryKey: ["admin", "organization", effectiveOrgId] });
        await refetchBranding(effectiveOrgId);
        toast({ title: "Logo uploaded", description: "Primary logo updated for this organization." });
      } else {
        toast({ title: "Upload failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleUploadFavicon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || effectiveOrgId == null) return;
    setUploadingFavicon(true);
    try {
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const url = await uploadOrgBrandingAsset(effectiveOrgId, "favicon", dataUrl);
      if (url) {
        qc.invalidateQueries({ queryKey: ["admin", "organization", effectiveOrgId] });
        await refetchBranding(effectiveOrgId);
        toast({ title: "Favicon uploaded", description: "Favicon updated for this organization." });
      } else {
        toast({ title: "Upload failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingFavicon(false);
      e.target.value = "";
    }
  };

  const handleSaveTheme = async () => {
    if (effectiveOrgId == null || !selectedOrg) return;
    setSavingTheme(true);
    const updated = await updateAdminOrganization(effectiveOrgId, {
      settings: { ...(selectedOrg.settings ?? {}), colorTheme: selectedColor || effectiveColor },
    });
    setSavingTheme(false);
    if (updated) {
      qc.invalidateQueries({ queryKey: ["admin", "organization", effectiveOrgId] });
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      await refetchBranding(effectiveOrgId);
      toast({ title: "Color theme saved", description: "Theme applied across the whole website." });
    } else {
      toast({ title: "Failed to save theme", variant: "destructive" });
    }
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    const updated = await updateAdminSettings({ emailServer: { host: emailHost, port: emailPort, user: emailUser, from: emailFrom, secure: emailSecure } });
    setSavingEmail(false);
    if (updated) {
      qc.setQueryData(["admin", "settings"], updated);
      toast({ title: "Email server saved", description: "SMTP settings updated." });
    } else {
      toast({ title: "Failed to save email settings", variant: "destructive" });
    }
  };

  const handleSaveStorage = async () => {
    setSavingStorage(true);
    const updated = await updateAdminSettings({ storage: { provider: storageProvider, bucket: storageBucket, region: storageRegion } });
    setSavingStorage(false);
    if (updated) {
      qc.setQueryData(["admin", "settings"], updated);
      toast({ title: "Storage settings saved", description: "Storage provider config updated." });
    } else {
      toast({ title: "Failed to save storage settings", variant: "destructive" });
    }
  };

  const handleCreateApiKey = async () => {
    const name = newApiKeyName.trim();
    if (!name) {
      toast({ title: "Enter a name for the key", variant: "destructive" });
      return;
    }
    setCreatingKey(true);
    const updated = await updateAdminSettings({}, { create: { name } });
    setCreatingKey(false);
    if (updated) {
      qc.setQueryData(["admin", "settings"], updated);
      setNewApiKeyName("");
      toast({ title: "API key created", description: "Store the key securely; it won't be shown again." });
    } else {
      toast({ title: "Failed to create API key", variant: "destructive" });
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    const updated = await updateAdminSettings({}, { revoke: [id] });
    if (updated) {
      qc.setQueryData(["admin", "settings"], updated);
      toast({ title: "API key revoked", variant: "destructive" });
    } else {
      toast({ title: "Failed to revoke key", variant: "destructive" });
    }
  };

  const handleTriggerBackup = async () => {
    setBackupRunning(true);
    try {
      const token = authStorage.getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(getApiUrl("/api/v1/admin/settings/backup"), { method: "POST", headers, credentials: "include" });
      if (res.ok) {
        const backup = await res.json();
        qc.setQueryData(["admin", "settings"], (prev: typeof data) => (prev ? { ...prev, backups: [backup, ...(prev.backups ?? [])] } : prev));
        toast({ title: "Backup started", description: "Backup completed successfully." });
      } else {
        toast({ title: "Backup failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Backup failed", variant: "destructive" });
    } finally {
      setBackupRunning(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-settings-title">Settings</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Configure your organization and platform settings.</p>
        </div>
        <Button 
          className="theme-gradient-bg text-white w-full sm:w-auto" 
          data-testid="button-save-settings"
          disabled={savingOrg}
          onClick={async () => {
            setSavingOrg(true);
            const updated = await updateAdminSettings({
              organization: {
                companyName: orgCompanyName,
                industry: orgIndustry,
                description: orgDescription,
                website: orgWebsite,
                supportEmail: orgSupportEmail,
              },
            });
            setSavingOrg(false);
            if (updated) {
              qc.setQueryData(["admin", "settings"], updated);
              toast({ title: "Settings saved", description: "Your settings have been saved successfully." });
            } else {
              toast({ title: "Failed to save settings", variant: "destructive" });
            }
          }}
        >
          {savingOrg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {savingOrg ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="organization" className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 flex justify-start">
          <TabsList className="bg-muted/50 overflow-y-hidden inline-flex w-max min-w-full sm:w-auto justify-start">
            <TabsTrigger value="organization" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap">
              <Building className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" /> <span className="hidden sm:inline">Organization</span><span className="sm:hidden">Org</span>
            </TabsTrigger>
            <TabsTrigger value="branding" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap">
              <Palette className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" /> Branding
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap">
              <Bell className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" /> <span className="hidden sm:inline">Notifications</span><span className="sm:hidden">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="localization" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap">
              <Globe className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" /> <span className="hidden sm:inline">Localization</span><span className="sm:hidden">Locale</span>
            </TabsTrigger>
              <TabsTrigger value="system" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap">
              <Server className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" /> System
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="organization" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Organization Details</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Basic information about your company</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm">Company Name</Label>
                  <Input className="mt-1.5 text-sm sm:text-base" value={orgCompanyName} onChange={(e) => setOrgCompanyName(e.target.value)} data-testid="input-company-name" />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Industry</Label>
                  <Select value={orgIndustry} onValueChange={setOrgIndustry}>
                    <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {settingsIndustries.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Company Description</Label>
                <Textarea 
                  className="mt-1.5 text-sm sm:text-base" 
                  rows={3}
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  data-testid="textarea-company-description"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm">Website</Label>
                  <Input className="mt-1.5 text-sm sm:text-base" value={orgWebsite} onChange={(e) => setOrgWebsite(e.target.value)} data-testid="input-website" />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Support Email</Label>
                  <Input className="mt-1.5 text-sm sm:text-base" value={orgSupportEmail} onChange={(e) => setOrgSupportEmail(e.target.value)} data-testid="input-support-email" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Billing Information</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Your current plan and billing details</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-4 p-3 sm:p-4 rounded-xl bg-primary/10`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-base sm:text-lg">{billing.planName ?? "Professional Plan"}</h3>
                    <Badge className="bg-primary text-white text-[10px] sm:text-xs">Current</Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{billing.planPrice ?? "$199/month"} • {billing.billingInterval ?? "Billed annually"}</p>
                </div>
                <Button 
                  variant="outline"
                  className="w-full sm:w-auto text-xs sm:text-sm"
                  onClick={() => {
                    toast({
                      title: "Manage subscription",
                      description: "Opening subscription management...",
                    });
                  }}
                >
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Organization</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Select the organization whose branding you want to edit. Changes apply site-wide for that org.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Organization</Label>
                <Select
                  value={effectiveOrgId != null ? String(effectiveOrgId) : ""}
                  onValueChange={(v) => setSelectedOrgId(v ? parseInt(v, 10) : null)}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name}
                      </SelectItem>
                    ))}
                    {organizations.length === 0 && (
                      <SelectItem value="" disabled>No organizations. Create one under Admin → Organizations.</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {effectiveOrgId != null && (
            <>
              <Card className="border shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base">Logo & Assets</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Upload your company branding assets for the selected organization.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <Label className="text-xs sm:text-sm mb-2 sm:mb-3 block">Primary Logo</Label>
                      <div className="border-2 border-dashed border-border rounded-xl p-4 sm:p-8 text-center hover:border-primary/50 transition-colors">
                        {orgPrimaryLogoUrl ? (
                          <img src={orgPrimaryLogoUrl} alt="Logo" className="w-24 h-24 mx-auto rounded-xl object-contain bg-muted mb-3" />
                        ) : (
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-muted mx-auto mb-2 sm:mb-3 flex items-center justify-center">
                            <Image className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-xs sm:text-sm font-medium">Drop your logo here</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">PNG, SVG up to 2MB</p>
                        <Input
                          type="file"
                          accept="image/png,image/svg+xml,image/jpeg"
                          className="mt-3 hidden"
                          onChange={handleUploadLogo}
                          disabled={uploadingLogo}
                          id="logo-upload"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 text-xs sm:text-sm"
                          onClick={() => document.getElementById("logo-upload")?.click()}
                          disabled={uploadingLogo}
                        >
                          {uploadingLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                          Upload
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs sm:text-sm mb-2 sm:mb-3 block">Favicon</Label>
                      <div className="border-2 border-dashed border-border rounded-xl p-4 sm:p-8 text-center hover:border-primary/50 transition-colors">
                        {orgFaviconUrl ? (
                          <img src={orgFaviconUrl} alt="Favicon" className="w-12 h-12 mx-auto rounded-lg object-contain bg-muted mb-3" />
                        ) : (
                          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-muted mx-auto mb-2 sm:mb-3 flex items-center justify-center">
                            <Image className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-xs sm:text-sm font-medium">Drop your favicon here</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">ICO, PNG 32x32</p>
                        <Input
                          type="file"
                          accept="image/x-icon,image/png"
                          className="mt-3 hidden"
                          onChange={handleUploadFavicon}
                          disabled={uploadingFavicon}
                          id="favicon-upload"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 text-xs sm:text-sm"
                          onClick={() => document.getElementById("favicon-upload")?.click()}
                          disabled={uploadingFavicon}
                        >
                          {uploadingFavicon ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                          Upload
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base">Color Theme</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Customize your platform&apos;s color scheme for this organization. Saves and applies site-wide.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                    {colorPresets.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setSelectedColor(color.name)}
                        className={`p-2 sm:p-3 rounded-xl border-2 transition-all ${
                          effectiveColor === color.name
                            ? "shadow-lg"
                            : "border-transparent hover:border-border"
                        }`}
                        style={
                          effectiveColor === color.name && color.primary
                            ? { borderColor: color.primary }
                            : undefined
                        }
                        data-testid={`color-${color.name.toLowerCase()}`}
                      >
                        <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 justify-center">
                          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full" style={{ backgroundColor: color.primary }} />
                          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full" style={{ backgroundColor: color.secondary }} />
                        </div>
                        <p className="text-[10px] sm:text-xs font-medium">{color.name}</p>
                        {effectiveColor === color.name && (
                          <Badge
                            className="mt-1 sm:mt-2 text-[10px] w-full justify-center text-white border-0"
                            style={
                              selectedPreset?.primary && selectedPreset?.secondary
                                ? { background: `linear-gradient(135deg, ${selectedPreset.primary} 0%, ${selectedPreset.secondary} 100%)` }
                                : undefined
                            }
                          >
                            <Check className="w-3 h-3 mr-1" /> Active
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className={`mt-4 text-white hover:opacity-95 border-0 ${!selectedPreset?.primary ? "theme-gradient-bg" : ""}`}
                    style={
                      selectedPreset?.primary && selectedPreset?.secondary
                        ? { background: `linear-gradient(135deg, ${selectedPreset.primary} 0%, ${selectedPreset.secondary} 100%)` }
                        : undefined
                    }
                    onClick={handleSaveTheme}
                    disabled={savingTheme}
                  >
                    {savingTheme ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save theme
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 sm:mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Notification Preferences</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Choose how you want to receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {!isMobile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 pb-3 border-b border-border">
                    <span className="text-xs sm:text-sm font-medium">Notification Type</span>
                    <span className="text-xs sm:text-sm font-medium text-center">Email</span>
                    <span className="text-xs sm:text-sm font-medium text-center">Push</span>
                  </div>
                  {notificationPrefs.map((setting) => (
                    <div key={setting.id} className="grid grid-cols-3 gap-4 items-center py-2" data-testid={`notification-${setting.id}`}>
                      <div>
                        <p className="text-xs sm:text-sm font-medium">{setting.name}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{setting.description}</p>
                      </div>
                      <div className="flex justify-center">
                        <Switch checked={setting.email} onCheckedChange={(v) => handleNotificationChange(setting.id, "email", v)} />
                      </div>
                      <div className="flex justify-center">
                        <Switch checked={setting.push} onCheckedChange={(v) => handleNotificationChange(setting.id, "push", v)} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {notificationPrefs.map((setting) => (
                    <div key={setting.id} className="p-3 rounded-lg border border-border" data-testid={`notification-${setting.id}`}>
                      <div className="mb-3">
                        <p className="text-xs font-medium">{setting.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{setting.description}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Email</span>
                        <Switch checked={setting.email} onCheckedChange={(v) => handleNotificationChange(setting.id, "email", v)} />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">Push</span>
                        <Switch checked={setting.push} onCheckedChange={(v) => handleNotificationChange(setting.id, "push", v)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" className="mt-4 theme-gradient-bg text-white" onClick={handleSaveNotifications} disabled={savingNotifications}>
                {savingNotifications ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save notification preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email server (SMTP)
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Configure SMTP for transactional and notification emails</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm">Host</Label>
                  <Input className="mt-1.5" value={emailHost} onChange={(e) => setEmailHost(e.target.value)} placeholder="smtp.example.com" />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Port</Label>
                  <Input type="number" className="mt-1.5" value={emailPort} onChange={(e) => setEmailPort(Number(e.target.value) || 587)} placeholder="587" />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Username</Label>
                  <Input className="mt-1.5" value={emailUser} onChange={(e) => setEmailUser(e.target.value)} placeholder="SMTP user" type="text" autoComplete="off" />
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">From address</Label>
                  <Input className="mt-1.5" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="noreply@example.com" type="email" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="email-secure" checked={emailSecure} onChange={(e) => setEmailSecure(e.target.checked)} className="rounded" />
                <Label htmlFor="email-secure" className="text-xs sm:text-sm">Use TLS/SSL</Label>
              </div>
              <Button size="sm" onClick={handleSaveEmail} disabled={savingEmail}>
                {savingEmail ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save email settings
              </Button>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                Storage provider
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Where files and uploads are stored</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Provider</Label>
                <Select value={storageProvider} onValueChange={setStorageProvider}>
                  <SelectTrigger className="max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="s3">Amazon S3</SelectItem>
                    <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                    <SelectItem value="azure">Azure Blob</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(storageProvider === "s3" || storageProvider === "gcs" || storageProvider === "azure") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-xs sm:text-sm">Bucket / container</Label>
                    <Input className="mt-1.5" value={storageBucket} onChange={(e) => setStorageBucket(e.target.value)} placeholder="bucket-name" />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">Region</Label>
                    <Input className="mt-1.5" value={storageRegion} onChange={(e) => setStorageRegion(e.target.value)} placeholder="us-east-1" />
                  </div>
                </div>
              )}
              <Button size="sm" onClick={handleSaveStorage} disabled={savingStorage}>
                {savingStorage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save storage settings
              </Button>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Key className="w-4 h-4" />
                API keys
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Create and revoke API keys for programmatic access</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Input className="max-w-[200px]" value={newApiKeyName} onChange={(e) => setNewApiKeyName(e.target.value)} placeholder="Key name" />
                <Button size="sm" onClick={handleCreateApiKey} disabled={creatingKey || !newApiKeyName.trim()}>
                  {creatingKey ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create key
                </Button>
              </div>
              {apiKeys.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No API keys yet. Create one to get started.</p>
              ) : (
                <ul className="space-y-2">
                  {apiKeys.map((k) => (
                    <li key={k.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 text-sm">
                      <span className="font-medium">{k.name}</span>
                      <span className="text-xs text-muted-foreground mr-2">{k.lastUsedAt ? `Used ${k.lastUsedAt}` : `Created ${k.createdAt}`}</span>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRevokeApiKey(k.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Archive className="w-4 h-4" />
                Backup
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Trigger a full backup and view recent backups</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <Button size="sm" onClick={handleTriggerBackup} disabled={backupRunning}>
                {backupRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                {backupRunning ? "Creating backup…" : "Create backup now"}
              </Button>
              {backups.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No backups yet.</p>
              ) : (
                <ul className="space-y-2">
                  {backups.slice(0, 10).map((b) => (
                    <li key={b.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 text-sm">
                      <span>{new Date(b.createdAt).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">{b.size ?? "—"} • {b.status}</span>
                      <Button variant="outline" size="sm" onClick={() => toast({ title: "Download", description: "Backend would provide download URL." })}>
                        Download
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="localization" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Language & Region</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Configure language and regional preferences</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm">Language</Label>
                  <Select defaultValue={localization.locale ?? locales[0]?.value ?? ""}>
                    <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {locales.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Timezone</Label>
                  <Select defaultValue={localization.timezone ?? timezones[0]?.value ?? ""}>
                    <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Date Format</Label>
                  <Select defaultValue={localization.dateFormat ?? dateFormats[0]?.value ?? ""}>
                    <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dateFormats.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Currency</Label>
                  <Select defaultValue={localization.currency ?? currencies[0]?.value ?? ""}>
                    <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
