import { useState, useEffect } from "react";
import { Link } from "wouter";
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
  Network,
  ScrollText,
  LogIn
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
                {securitySettings
                  .filter(
                    (setting) =>
                      !/two-factor|2fa|sso|saml|single sign-on|ip whitelist/i.test(setting.name ?? "")
                  )
                  .map((setting) => (
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
                Allow IP listing
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Restrict access by IP allowlist and denylist.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium">Enable IP restriction</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Only allowlisted IPs can access (denylist takes precedence).</p>
                </div>
                <Switch checked={ipRestrictionEnabled} onCheckedChange={setIpRestrictionEnabled} className="shrink-0" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Allowlist (allowed IPs)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 192.168.1.1 or 10.0.0.0/24"
                      value={newAllowIp}
                      onChange={(e) => setNewAllowIp(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addAllowIp()}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addAllowIp} title="Add IP">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {ipAllowlist.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 mt-1.5">
                      {ipAllowlist.map((ip) => (
                        <li key={ip} className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-1 text-xs">
                          {ip}
                          <button type="button" onClick={() => setIpAllowlist((prev) => prev.filter((x) => x !== ip))} className="hover:text-destructive" aria-label={`Remove ${ip}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Denylist (blocked IPs)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. 192.168.1.100"
                      value={newDenyIp}
                      onChange={(e) => setNewDenyIp(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addDenyIp()}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addDenyIp} title="Add IP">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {ipDenylist.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 mt-1.5">
                      {ipDenylist.map((ip) => (
                        <li key={ip} className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-1 text-xs">
                          {ip}
                          <button type="button" onClick={() => setIpDenylist((prev) => prev.filter((x) => x !== ip))} className="hover:text-destructive" aria-label={`Remove ${ip}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
          <Card className="border border-border/80 shadow-sm overflow-hidden bg-card">
            <CardHeader className="p-4 sm:p-6 border-b border-border/60 bg-muted/30">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base sm:text-lg font-semibold text-foreground">Recent Activity</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    Monitor user actions and access logs across your organization.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link href="/admin/audit-logs">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 w-full sm:w-auto">
                      <ScrollText className="w-4 h-4 shrink-0" />
                      Full Audit Logs
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-border/80 hover:bg-muted/50 gap-2 w-full sm:w-auto"
                    onClick={() => {
                      const dataStr = JSON.stringify(recentActivity, null, 2);
                      const dataBlob = new Blob([dataStr], { type: "application/json" });
                      const url = URL.createObjectURL(dataBlob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `security_logs_${new Date().toISOString().split("T")[0]}.json`;
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
                    <Download className="w-4 h-4 shrink-0" />
                    Export Logs
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 text-center" data-testid="activity-empty">
                  <div className="w-12 h-12 rounded-full bg-muted/80 flex items-center justify-center mb-3">
                    <LogIn className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No recent activity</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Login and access events will appear here. Check Audit Logs for full history.
                  </p>
                  <Link href="/admin/audit-logs">
                    <Button variant="outline" size="sm" className="mt-4 gap-2">
                      <ScrollText className="w-4 h-4" />
                      View Audit Logs
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {recentActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className={`flex ${isMobile ? "flex-col" : "items-center"} gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted/30 transition-colors`}
                      data-testid={`row-activity-${activity.id}`}
                    >
                      <div className={`flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0 w-full`}>
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 sm:mt-0 ${
                            activity.status === "success" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                          }`}
                          aria-hidden
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`flex ${isMobile ? "flex-col" : "items-center"} gap-2 flex-wrap`}>
                            <span className="font-medium text-sm text-foreground capitalize">{activity.action}</span>
                            <Badge variant="secondary" className="text-[11px] font-normal px-2 py-0 border border-border/60 bg-muted/50 text-foreground/90 shrink-0">
                              {activity.user}
                            </Badge>
                          </div>
                          <div className={`flex ${isMobile ? "flex-col" : "items-center"} gap-1.5 sm:gap-3 mt-1.5 text-xs text-muted-foreground`}>
                            <span className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              {activity.location || "—"}
                            </span>
                            {!isMobile && <span className="text-border">·</span>}
                            <span>IP: {activity.ip && String(activity.ip).trim() ? activity.ip : "—"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 pl-5 sm:pl-0">
                        <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        {activity.time}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {recentActivity.length > 0 && (
                <div className="px-4 sm:px-6 py-3 border-t border-border/60 bg-muted/20">
                  <Link href="/admin/audit-logs">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-2 -ml-2">
                      <ScrollText className="w-4 h-4" />
                      View full Audit Logs for more history
                    </Button>
                  </Link>
                </div>
              )}
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
