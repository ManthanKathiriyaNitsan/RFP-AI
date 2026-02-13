import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchAdminSecurity, updateAdminSecurityConfig } from "@/api/admin-data";
import { ArrowLeft, Network, Plus, Save, X, ShieldCheck, ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 10;

function isValidIpOrCidr(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return false;
  const ipv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/;
  return ipv4.test(trimmed) || trimmed === "localhost";
}

export default function AdminIpAccess() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "security"],
    queryFn: fetchAdminSecurity,
  });

  const [ipRestrictionEnabled, setIpRestrictionEnabled] = useState(data?.ipRestrictionEnabled ?? false);
  const [ipAllowlist, setIpAllowlist] = useState<string[]>(data?.ipAllowlist ?? []);
  const [ipDenylist, setIpDenylist] = useState<string[]>(data?.ipDenylist ?? []);
  const [newAllowIp, setNewAllowIp] = useState("");
  const [newDenyIp, setNewDenyIp] = useState("");
  const [savingIp, setSavingIp] = useState(false);

  const [allowPage, setAllowPage] = useState(1);
  const [allowPageSize, setAllowPageSize] = useState(PAGE_SIZE);
  const [denyPage, setDenyPage] = useState(1);
  const [denyPageSize, setDenyPageSize] = useState(PAGE_SIZE);

  useEffect(() => {
    if (Array.isArray(data?.ipAllowlist)) setIpAllowlist(data.ipAllowlist);
    if (Array.isArray(data?.ipDenylist)) setIpDenylist(data.ipDenylist);
    if (data?.ipRestrictionEnabled != null) setIpRestrictionEnabled(data.ipRestrictionEnabled);
  }, [data?.ipAllowlist, data?.ipDenylist, data?.ipRestrictionEnabled]);

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

  const removeAllowIp = (ip: string) => {
    setIpAllowlist((prev) => prev.filter((x) => x !== ip));
  };

  const removeDenyIp = (ip: string) => {
    setIpDenylist((prev) => prev.filter((x) => x !== ip));
  };

  const paginatedAllowlist = ipAllowlist.slice(
    (allowPage - 1) * allowPageSize,
    allowPage * allowPageSize
  );
  const paginatedDenylist = ipDenylist.slice(
    (denyPage - 1) * denyPageSize,
    denyPage * denyPageSize
  );

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/security">
          <Button variant="ghost" size="sm" className="w-fit -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Security
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Network className="w-6 h-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">IP access control</h1>
        </div>
        <p className="text-muted-foreground text-sm">Manage allowlist and denylist. Only allowlisted IPs can access when restriction is enabled (denylist takes precedence).</p>
      </div>

      <Card className="border shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base">Enable IP restriction</CardTitle>
              <CardDescription>When enabled, only IPs in the allowlist can access the app. Denylist entries always block access.</CardDescription>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Label htmlFor="ip-restrict" className="text-sm font-medium whitespace-nowrap">Restrict access by IP</Label>
                <Switch id="ip-restrict" checked={ipRestrictionEnabled} onCheckedChange={setIpRestrictionEnabled} />
              </div>
              <Button size="sm" onClick={handleSaveIp} disabled={savingIp}>
                <Save className="w-4 h-4 mr-2" />
                {savingIp ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="allowlist" className="w-full space-y-4">
        <TabsList className="w-full sm:w-auto h-auto flex flex-wrap gap-1 p-1.5 justify-start">
          <TabsTrigger value="allowlist" className="flex items-center gap-2 px-4 py-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Allowlist</span>
            <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1 justify-center rounded-full text-xs tabular-nums font-normal">
              {ipAllowlist.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="denylist" className="flex items-center gap-2 px-4 py-2.5">
            <ShieldX className="w-4 h-4 shrink-0" />
            <span>Denylist</span>
            <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1 justify-center rounded-full text-xs tabular-nums font-normal">
              {ipDenylist.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="allowlist" className="mt-4">
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-4">
              <CardTitle className="text-base">Allowed IPs</CardTitle>
              <CardDescription>IPs or CIDR ranges that are allowed to access. Add entries below.</CardDescription>
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="e.g. 192.168.1.1 or 10.0.0.0/24"
                  value={newAllowIp}
                  onChange={(e) => setNewAllowIp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addAllowIp()}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addAllowIp} title="Add IP">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ipAllowlist.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground border-t">No allowed IPs yet. Add one above.</div>
              ) : (
                <>
                  <div className="overflow-x-auto border-t">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP / CIDR</th>
                          <th className="text-right py-3 px-4 w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedAllowlist.map((ip) => (
                          <tr key={ip} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 px-4 font-mono text-sm">{ip}</td>
                            <td className="py-3 px-4 text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeAllowIp(ip)} aria-label={`Remove ${ip}`}>
                                <X className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <DataTablePagination
                    totalItems={ipAllowlist.length}
                    page={allowPage}
                    pageSize={allowPageSize}
                    onPageChange={setAllowPage}
                    onPageSizeChange={setAllowPageSize}
                    itemLabel="IPs"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="denylist" className="mt-4">
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-4">
              <CardTitle className="text-base">Blocked IPs</CardTitle>
              <CardDescription>IPs or CIDR ranges that are always blocked. Add entries below.</CardDescription>
              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="e.g. 192.168.1.100"
                  value={newDenyIp}
                  onChange={(e) => setNewDenyIp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addDenyIp()}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addDenyIp} title="Add IP">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ipDenylist.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground border-t">No blocked IPs yet. Add one above.</div>
              ) : (
                <>
                  <div className="overflow-x-auto border-t">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">IP / CIDR</th>
                          <th className="text-right py-3 px-4 w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedDenylist.map((ip) => (
                          <tr key={ip} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-3 px-4 font-mono text-sm">{ip}</td>
                            <td className="py-3 px-4 text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeDenyIp(ip)} aria-label={`Remove ${ip}`}>
                                <X className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <DataTablePagination
                    totalItems={ipDenylist.length}
                    page={denyPage}
                    pageSize={denyPageSize}
                    onPageChange={setDenyPage}
                    onPageSizeChange={setDenyPageSize}
                    itemLabel="IPs"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
