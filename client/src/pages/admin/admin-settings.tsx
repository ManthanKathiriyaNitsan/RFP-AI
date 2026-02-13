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
  DEFAULT_COLOR_PRESETS,
  type OrganizationItem,
} from "@/api/admin-data";
import { useBranding, hexToHsl } from "@/contexts/BrandingContext";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { 
  Building,
  Palette,
  Bell,
  Save,
  Upload,
  Image,
  Check,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { softBadgeClasses } from "@/lib/badge-classes";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminSettings() {
  const qc = useQueryClient();
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: fetchAdminSettings,
  });
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const colorPresets = DEFAULT_COLOR_PRESETS as { name: string; primary: string; secondary: string }[];
  const organization = data?.organization ?? { companyName: "", industry: "", description: "", website: "", supportEmail: "" };
  const billing = data?.billing ?? { planName: "", planPrice: "", billingInterval: "" };
  const defaultTheme = (data as { defaultTheme?: string })?.defaultTheme ?? colorPresets[0]?.name ?? "Teal";
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
  const [selectedOrgId, setSelectedOrgId] = useState<number | string | null>(() => {
    try {
      const s = localStorage.getItem("admin_selected_org_id");
      if (!s) return null;
      const n = parseInt(s, 10);
      return String(n) === s ? n : s;
    } catch {
      return null;
    }
  });
  const effectiveOrgId: number | string | null = selectedOrgId ?? organizations[0]?.id ?? null;

  useEffect(() => {
    if (effectiveOrgId != null) {
      try {
        localStorage.setItem("admin_selected_org_id", String(effectiveOrgId));
        window.dispatchEvent(new CustomEvent("admin_selected_org_changed", { detail: { orgId: effectiveOrgId } }));
      } catch {
        /* ignore */
      }
    }
  }, [effectiveOrgId]);
  const { data: selectedOrg } = useQuery({
    queryKey: ["admin", "organization", effectiveOrgId],
    queryFn: () => fetchAdminOrganization(effectiveOrgId!),
    enabled: effectiveOrgId != null,
  });
  const orgSettings = (selectedOrg?.settings ?? {}) as Record<string, string | undefined>;
  const orgPrimaryLogoUrl = orgSettings.primaryLogoUrl ?? "";
  const orgColorTheme = orgSettings.colorTheme ?? defaultTheme;
  const selectedOrgName = selectedOrg?.name ?? organizations.find((o) => o.id === effectiveOrgId)?.name ?? "";

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

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  // Organization Details (Settings → Organization tab) – controlled form for Save
  const [orgCompanyName, setOrgCompanyName] = useState(organization.companyName ?? "");
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
      setOrgDescription(o.description ?? "");
      setOrgWebsite(o.website ?? "");
      setOrgSupportEmail(o.supportEmail ?? "");
    }
  }, [data?.organization]);

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

  const handleSaveTheme = async () => {
    if (effectiveOrgId == null || !selectedOrg) {
      toast({ title: "Cannot save theme", description: "Select an organization first or wait for it to load.", variant: "destructive" });
      return;
    }
    setSavingTheme(true);
    try {
      const updated = await updateAdminOrganization(effectiveOrgId, {
        settings: { ...(selectedOrg.settings ?? {}), colorTheme: selectedColor || effectiveColor },
      });
      if (updated) {
        qc.invalidateQueries({ queryKey: ["admin", "organization", effectiveOrgId] });
        qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
        await refetchBranding(effectiveOrgId);
        toast({ title: "Color theme saved", description: "Theme applied across the whole website." });
      } else {
        toast({
          title: "Failed to save theme",
          description: "The server may have returned an error (e.g. 404). Check the Network tab and try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Failed to save theme",
        description: "Network or other error. Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSavingTheme(false);
    }
  };

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

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
            try {
              // Save organization-level settings (company info, etc.)
              const updatedSettings = await updateAdminSettings({
                organization: {
                  companyName: orgCompanyName,
                  industry: organization.industry ?? "",
                  description: orgDescription,
                  website: orgWebsite,
                  supportEmail: orgSupportEmail,
                },
              });

              // Also persist the currently selected color theme for this organization,
              // so that after saving and navigating away the theme stays as the new default.
              let themeSaveOk = true;
              if (effectiveOrgId != null && selectedOrg) {
                const updatedOrg = await updateAdminOrganization(effectiveOrgId, {
                  settings: { ...(selectedOrg.settings ?? {}), colorTheme: selectedColor || effectiveColor },
                });
                themeSaveOk = !!updatedOrg;
                if (updatedOrg) {
                  qc.invalidateQueries({ queryKey: ["admin", "organization", effectiveOrgId] });
                  qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
                  await refetchBranding(effectiveOrgId);
                }
              }

              setSavingOrg(false);

              if (updatedSettings) {
                qc.setQueryData(["admin", "settings"], updatedSettings);
              }

              if (updatedSettings && themeSaveOk) {
                toast({ title: "Settings saved", description: "Your settings and theme have been saved successfully." });
              } else if (updatedSettings) {
                toast({ title: "Settings saved, but theme could not be updated", variant: "destructive" });
              } else {
                toast({ title: "Failed to save settings", variant: "destructive" });
              }
            } catch {
              setSavingOrg(false);
              toast({ title: "Failed to save settings", variant: "destructive" });
            }
          }}
        >
          {savingOrg ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {savingOrg ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      {/* Organization selector: visible on all tabs so you can select an org and switch anytime */}
      <Card className="border shadow-sm bg-muted/30">
        <CardContent className="p-4 sm:p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Building className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Working on organization</span>
          </div>
          <Select
            value={effectiveOrgId != null ? String(effectiveOrgId) : ""}
            onValueChange={(v) => {
              if (!v) setSelectedOrgId(null);
              else {
                const n = parseInt(v, 10);
                setSelectedOrgId(String(n) === v ? n : v);
              }
            }}
          >
            <SelectTrigger className="w-full sm:max-w-xs bg-background">
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={String(org.id)}>
                  {org.name}
                </SelectItem>
              ))}
              {organizations.length === 0 && (
                <SelectItem value="__no_orgs__" disabled>No organizations. Create one under Admin → Organizations.</SelectItem>
              )}
            </SelectContent>
          </Select>
          {selectedOrgName && (
            <span className="text-xs text-muted-foreground">All changes below apply to this organization where applicable.</span>
          )}
        </CardContent>
      </Card>

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
          </TabsList>
        </div>

        <TabsContent value="organization" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Organization Details</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Basic information about your company</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              <div>
                <Label className="text-xs sm:text-sm">Company Name</Label>
                <Input className="mt-1.5 text-sm sm:text-base" value={orgCompanyName} onChange={(e) => setOrgCompanyName(e.target.value)} data-testid="input-company-name" />
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
                    <Badge variant="outline" className={`${softBadgeClasses.primary} text-[10px] sm:text-xs`}>Current</Badge>
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
          {effectiveOrgId != null ? (
            <>
              <Card className="border shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-sm sm:text-base">Logo & Assets</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Upload your company branding assets for the selected organization.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2 mb-2 sm:mb-3">
                        <Label className="text-xs sm:text-sm block">Primary Logo</Label>
                        {selectedOrgName && (
                          <span className="text-xs text-muted-foreground font-normal">({selectedOrgName})</span>
                        )}
                      </div>
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
          ) : (
            <Card className="border shadow-sm">
              <CardContent className="p-6 text-center text-muted-foreground">
                <Building className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No organization selected</p>
                <p className="text-xs mt-1">Use the &quot;Working on organization&quot; dropdown above to select an organization, then you can edit its logo and color theme here.</p>
              </CardContent>
            </Card>
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
      </Tabs>
    </div>
  );
}
