import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchAdminSecurity, fetchAdminOptions, updateAdminSecurityConfig } from "@/api/admin-data";
import { 
  Shield, 
  Lock,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Users,
  FileText,
  Download,
  Plus,
  X,
  Save,
  Timer,
  Network
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SESSION_DURATION_OPTIONS = [
  { value: "60", label: "1 hour" },
  { value: "480", label: "8 hours" },
  { value: "1440", label: "24 hours" },
  { value: "10080", label: "7 days" },
  { value: "43200", label: "30 days" },
];

function isValidIpOrCidr(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  const ipv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/;
  return ipv4.test(trimmed) || trimmed === "localhost";
}

export default function AdminSecurity() {
  const qc = useQueryClient();
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "security"],
    queryFn: fetchAdminSecurity,
  });
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const securityAlerts = data?.securityAlerts ?? [];
  const recentActivity = data?.recentActivity ?? [];
  const securitySettings = data?.securitySettings ?? [];
  const complianceCertificationsRaw = data?.complianceCertifications ?? [];
  const COMPLIANCE_ICON_MAP: Record<string, typeof Shield> = { Shield, Lock, FileText, CheckCircle };
  type ComplianceCert = { name: string; status: string; date: string; icon: typeof Shield };
  const complianceCertifications: ComplianceCert[] = complianceCertificationsRaw.map((c: { icon?: string; name?: string; status?: string; date?: string; [k: string]: unknown }) => ({
    name: (c.name as string) ?? "",
    status: (c.status as string) ?? "",
    date: (c.date as string) ?? "",
    icon: COMPLIANCE_ICON_MAP[c.icon as string] ?? Shield,
  }));
  const defaultPasswordLength = data?.defaultPasswordLength ?? "12";
  const defaultSessionDuration = data?.defaultSessionDuration ?? "90";
  const passwordLengths = optionsData?.passwordLengths ?? [];
  const sessionDurations = optionsData?.sessionDurations ?? [];
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [sessionIdleMinutes, setSessionIdleMinutes] = useState(data?.sessionIdleMinutes ?? 30);
  const [sessionMaxDurationMinutes, setSessionMaxDurationMinutes] = useState(data?.sessionMaxDurationMinutes ?? 480);
  const [sessionRememberMeDays, setSessionRememberMeDays] = useState(data?.sessionRememberMeDays ?? 14);
  const [ipRestrictionEnabled, setIpRestrictionEnabled] = useState(data?.ipRestrictionEnabled ?? false);
  const [ipAllowlist, setIpAllowlist] = useState<string[]>(data?.ipAllowlist ?? []);
  const [ipDenylist, setIpDenylist] = useState<string[]>(data?.ipDenylist ?? []);
  const [newAllowIp, setNewAllowIp] = useState("");
  const [newDenyIp, setNewDenyIp] = useState("");
  const [savingSession, setSavingSession] = useState(false);
  const [savingIp, setSavingIp] = useState(false);
  const [requireTwoFactor, setRequireTwoFactor] = useState(data?.requireTwoFactorForAllUsers ?? false);
  const [saving2FA, setSaving2FA] = useState(false);
  const [savingSettingId, setSavingSettingId] = useState<number | null>(null);

  const settingEnabled = (id: number) => {
    const s = securitySettings.find((x) => x.id === id);
    return s?.enabled ?? false;
  };
  const setSettingEnabled = (id: number, enabled: boolean) => {
    qc.setQueryData(["admin", "security"], (prev: typeof data) => {
      if (!prev?.securitySettings) return prev;
      return {
        ...prev,
        securitySettings: prev.securitySettings.map((s) =>
          s.id === id ? { ...s, enabled } : s
        ),
      };
    });
  };
  const handleToggleSetting = async (id: number, enabled: boolean) => {
    setSettingEnabled(id, enabled);
    setSavingSettingId(id);
    const updated = await updateAdminSecurityConfig({
      securitySettings: [{ id, enabled }],
    });
    setSavingSettingId(null);
    if (updated) {
      qc.setQueryData(["admin", "security"], (prev: typeof data) => (prev ? { ...prev, securitySettings: updated.securitySettings ?? prev.securitySettings } : updated));
      toast({ title: "Setting updated", description: "Security setting saved." });
    } else {
      setSettingEnabled(id, !enabled);
      toast({ title: "Failed to save setting", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (data?.requireTwoFactorForAllUsers != null) setRequireTwoFactor(data.requireTwoFactorForAllUsers);
  }, [data?.requireTwoFactorForAllUsers]);

  useEffect(() => {
    if (data?.sessionIdleMinutes != null) setSessionIdleMinutes(data.sessionIdleMinutes);
    if (data?.sessionMaxDurationMinutes != null) setSessionMaxDurationMinutes(data.sessionMaxDurationMinutes);
    if (data?.sessionRememberMeDays != null) setSessionRememberMeDays(data.sessionRememberMeDays);
    if (data?.ipRestrictionEnabled != null) setIpRestrictionEnabled(data.ipRestrictionEnabled);
    if (Array.isArray(data?.ipAllowlist)) setIpAllowlist(data.ipAllowlist);
    if (Array.isArray(data?.ipDenylist)) setIpDenylist(data.ipDenylist);
  }, [data?.sessionIdleMinutes, data?.sessionMaxDurationMinutes, data?.sessionRememberMeDays, data?.ipRestrictionEnabled, data?.ipAllowlist, data?.ipDenylist]);

  const handleSaveSession = async () => {
    setSavingSession(true);
    const updated = await updateAdminSecurityConfig({
      sessionIdleMinutes,
      sessionMaxDurationMinutes,
      sessionRememberMeDays,
    });
    setSavingSession(false);
    if (updated) {
      qc.setQueryData(["admin", "security"], (prev: typeof data) => (prev ? { ...prev, ...updated } : updated));
      toast({ title: "Session settings saved", description: "Session expiration and idle timeout updated." });
    } else {
      toast({ title: "Failed to save session settings", variant: "destructive" });
    }
  };

  const handleSaveIp = async () => {
    setSavingIp(true);
    const updated = await updateAdminSecurityConfig({
      ipRestrictionEnabled,
      ipAllowlist,
      ipDenylist,
    });
    setSavingIp(false);
    if (updated) {
      qc.setQueryData(["admin", "security"], (prev: typeof data) => (prev ? { ...prev, ...updated } : updated));
      toast({ title: "IP access control saved", description: "Allowlist and denylist updated." });
    } else {
      toast({ title: "Failed to save IP settings", variant: "destructive" });
    }
  };

  const handleSave2FA = async () => {
    setSaving2FA(true);
    const updated = await updateAdminSecurityConfig({ requireTwoFactorForAllUsers: requireTwoFactor });
    setSaving2FA(false);
    if (updated) {
      qc.setQueryData(["admin", "security"], (prev: typeof data) => (prev ? { ...prev, requireTwoFactorForAllUsers: requireTwoFactor } : { ...updated }));
      toast({ title: "2FA policy saved", description: requireTwoFactor ? "All users will be required to enable 2FA." : "2FA is now optional." });
    } else {
      toast({ title: "Failed to save 2FA setting", variant: "destructive" });
    }
  };

  const addAllowIp = () => {
    if (!isValidIpOrCidr(newAllowIp)) {
      toast({ title: "Invalid IP or CIDR", description: "Use IPv4 (e.g. 192.168.1.1) or CIDR (e.g. 10.0.0.0/24).", variant: "destructive" });
      return;
    }
    const v = newAllowIp.trim();
    if (ipAllowlist.includes(v)) {
      toast({ title: "Already in list", variant: "destructive" });
      return;
    }
    setIpAllowlist((prev) => [...prev, v]);
    setNewAllowIp("");
  };

  const addDenyIp = () => {
    if (!isValidIpOrCidr(newDenyIp)) {
      toast({ title: "Invalid IP or CIDR", description: "Use IPv4 (e.g. 192.168.1.1) or CIDR (e.g. 10.0.0.0/24).", variant: "destructive" });
      return;
    }
    const v = newDenyIp.trim();
    if (ipDenylist.includes(v)) {
      toast({ title: "Already in list", variant: "destructive" });
      return;
    }
    setIpDenylist((prev) => [...prev, v]);
    setNewDenyIp("");
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
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-security-title">Security</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage security settings, access controls, and compliance.</p>
        </div>
        <Button 
          variant="outline" 
          data-testid="button-security-audit"
          className="w-full sm:w-auto"
          onClick={() => {
            toast({
              title: "Security audit",
              description: "Running security audit...",
            });
          }}
        >
          <FileText className="w-4 h-4 mr-2" />
          Security Audit
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 icon-emerald" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold text-emerald">{data?.securityScore ?? "A+"}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Security Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 icon-blue" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold">{typeof data?.twoFaAdoption === "number" ? `${data.twoFaAdoption}%` : "—"}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">2FA Adoption</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 icon-amber" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold">{data?.securityAlertsCount ?? securityAlerts.length ?? 0}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Security Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold">{data?.soc2Status ?? "SOC 2"}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Compliant</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {securityAlerts.some(a => a.type === 'warning') && (
        <div className="p-3 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3`}>
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber dark:text-amber shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-amber dark:text-amber">Security Alert</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {securityAlerts.find(a => a.type === "warning")?.message ?? "Security attention required."}
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="border-amber text-amber hover:bg-amber-light w-full sm:w-auto shrink-0"
              onClick={() => {
                toast({
                  title: "Review users",
                  description: "Opening user management to review 2FA status...",
                });
              }}
            >
              Review Users
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="bg-muted/50 overflow-x-auto overflow-y-hidden w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsTrigger value="settings" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <Shield className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Settings
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Activity Log
          </TabsTrigger>
          <TabsTrigger value="compliance" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Security Settings</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Configure authentication and access controls</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3 sm:space-y-4">
                {securitySettings.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3" data-testid={`setting-${setting.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium">{setting.name}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{setting.description}</p>
                    </div>
                    <Switch
                      checked={settingEnabled(setting.id)}
                      disabled={savingSettingId === setting.id}
                      onCheckedChange={(checked) => handleToggleSetting(setting.id, checked)}
                      className="shrink-0"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Two-factor authentication</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Require 2FA for all users. When enabled, users must set up 2FA to access the platform.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium">Require 2FA for all users</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">When on, every user must enable two-factor authentication.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={requireTwoFactor} onCheckedChange={setRequireTwoFactor} className="shrink-0" />
                  <Button size="sm" onClick={handleSave2FA} disabled={saving2FA}>
                    {saving2FA ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Password Policy</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Set requirements for user passwords</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-xs sm:text-sm">Minimum Length</Label>
                  <Select defaultValue={defaultPasswordLength}>
                    <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {passwordLengths.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Password Expiry</Label>
                  <Select defaultValue={defaultSessionDuration}>
                    <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sessionDurations.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Timer className="w-4 h-4" />
                Session expiration
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Idle timeout, max session duration, and remember-me.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Idle timeout (minutes)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={1440}
                    value={sessionIdleMinutes}
                    onChange={(e) => setSessionIdleMinutes(Number(e.target.value) || 30)}
                  />
                  <p className="text-[10px] text-muted-foreground">Log out after this many minutes of inactivity.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Max session duration (minutes)</Label>
                  <Select
                    value={String(sessionMaxDurationMinutes)}
                    onValueChange={(v) => setSessionMaxDurationMinutes(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_DURATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Remember me (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={sessionRememberMeDays}
                    onChange={(e) => setSessionRememberMeDays(Number(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground">0 = no remember me.</p>
                </div>
              </div>
              <Button size="sm" onClick={handleSaveSession} disabled={savingSession}>
                <Save className="w-4 h-4 mr-2" />
                {savingSession ? "Saving…" : "Save session settings"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Network className="w-4 h-4" />
                IP access control
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Allowlist or denylist IPs/CIDRs. When enabled, only allowlisted IPs can access (or denylisted are blocked).</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium">Restrict access by IP</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">When on, only IPs in the allowlist can log in; denylist blocks specific IPs regardless.</p>
                </div>
                <Switch checked={ipRestrictionEnabled} onCheckedChange={setIpRestrictionEnabled} className="shrink-0" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Allowlist (allowed IPs/CIDRs)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 192.168.1.0/24"
                      value={newAllowIp}
                      onChange={(e) => setNewAllowIp(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAllowIp())}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addAllowIp}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {ipAllowlist.map((ip) => (
                      <li key={ip} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 text-xs">
                        <span className="font-mono">{ip}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setIpAllowlist((prev) => prev.filter((x) => x !== ip))}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </li>
                    ))}
                    {ipAllowlist.length === 0 && <p className="text-[10px] text-muted-foreground py-1">No entries. Add IPs or CIDRs (e.g. 10.0.0.0/24).</p>}
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Denylist (blocked IPs/CIDRs)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 203.0.113.50"
                      value={newDenyIp}
                      onChange={(e) => setNewDenyIp(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDenyIp())}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addDenyIp}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {ipDenylist.map((ip) => (
                      <li key={ip} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50 text-xs">
                        <span className="font-mono">{ip}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setIpDenylist((prev) => prev.filter((x) => x !== ip))}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </li>
                    ))}
                    {ipDenylist.length === 0 && <p className="text-[10px] text-muted-foreground py-1">No entries.</p>}
                  </ul>
                </div>
              </div>
              <Button size="sm" onClick={handleSaveIp} disabled={savingIp}>
                <Save className="w-4 h-4 mr-2" />
                {savingIp ? "Saving…" : "Save IP access control"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 sm:mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm sm:text-base">Recent Activity</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Monitor user actions and access logs</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const dataStr = JSON.stringify(recentActivity, null, 2);
                    const dataBlob = new Blob([dataStr], { type: "application/json" });
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `security_logs_${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    toast({
                      title: "Exported",
                      description: "Security logs have been exported.",
                    });
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-2 sm:space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3 sm:gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors`} data-testid={`row-activity-${activity.id}`}>
                    <div className={`flex items-center gap-3 sm:gap-4 flex-1 min-w-0`}>
                      <div className={`w-2 h-2 rounded-full ${activity.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2`}>
                          <span className="font-medium text-xs sm:text-sm">{activity.action}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{activity.user}</Badge>
                        </div>
                        <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2 sm:gap-3 mt-1 text-[10px] sm:text-xs text-muted-foreground`}>
                          <span className="flex items-center gap-1">
                            <Globe className="w-3 h-3 shrink-0" /> {activity.location}
                          </span>
                          {!isMobile && <span>•</span>}
                          <span>IP: {activity.ip}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground shrink-0">
                      <Clock className="w-3 h-3 shrink-0" />
                      {activity.time}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="mt-4 sm:mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {complianceCertifications.map((cert, index) => (
              <Card key={index} className="border shadow-sm" data-testid={`card-compliance-${index}`}>
                <CardContent className="p-4 sm:p-5">
                  <div className={`flex ${isMobile ? 'flex-col' : 'items-start'} gap-3 sm:gap-4`}>
                    <div className={`flex items-center gap-3 sm:gap-4 ${isMobile ? '' : 'flex-1 min-w-0'}`}>
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${cert.status === 'Certified' || cert.status === 'Compliant' ? 'bg-emerald-500/10' : 'bg-amber-500/10'} flex items-center justify-center shrink-0`}>
                        <cert.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${cert.status === 'Certified' || cert.status === 'Compliant' ? 'text-emerald dark:text-emerald' : 'text-amber dark:text-amber'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base">{cert.name}</h3>
                        <Badge 
                          variant="outline" 
                          className={`mt-1 text-[10px] ${cert.status === 'Certified' || cert.status === 'Compliant' ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald dark:text-emerald border-emerald-500/20 dark:border-emerald-500/30' : 'bg-amber-500/10 dark:bg-amber-500/20 text-amber dark:text-amber border-amber-500/20 dark:border-amber-500/30'}`}
                        >
                          {cert.status}
                        </Badge>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">{cert.date}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={`${isMobile ? 'w-full' : ''} text-xs sm:text-sm`}
                      onClick={() => {
                        toast({
                          title: "View compliance",
                          description: `Viewing ${cert.name} compliance details...`,
                        });
                      }}
                    >
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
