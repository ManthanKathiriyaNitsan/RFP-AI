import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { fetchAdminAuditLogs, fetchAdminOptions, type AuditLogEntry } from "@/api/admin-data";
import {
  Download,
  LogIn,
  Clock,
  Globe,
  Search,
  ArrowRight,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const LOGIN_LABEL = "Login";

const STATUS_CLASS: Record<string, string> = {
  success: "bg-emerald-500",
  failure: "bg-red-500",
  warning: "bg-amber-500",
};

const AUDIT_LOG_PAGE_SIZE = 10;

function formatDateRangeKey(dateRange: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  let from = to;
  if (dateRange === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    from = d.toISOString().split("T")[0];
  } else if (dateRange === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    from = d.toISOString().split("T")[0];
  } else if (dateRange === "90d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    from = d.toISOString().split("T")[0];
  }
  return { dateFrom: from, dateTo: to };
}

export default function AdminAuditLogs() {
  const [dateRange, setDateRange] = useState("7d");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { currentRole } = useAuth();
  const isSuperAdmin = (currentRole ?? "").toLowerCase() === "super_admin";

  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const pageTitle = optionsData?.pageTitles?.auditLogs ?? "Audit Logs";

  const { dateFrom, dateTo } = useMemo(() => formatDateRangeKey(dateRange), [dateRange]);

  const { data: loginData, isError, error, refetch } = useQuery({
    queryKey: ["admin", "audit-logs", "login", dateFrom, dateTo],
    queryFn: () => fetchAdminAuditLogs({ type: "login", dateFrom, dateTo, limit: 100 }),
  });

  const loginEntries = useMemo(() => loginData?.entries ?? [], [loginData]);

  const filterEntries = useMemo(
    () => (entries: AuditLogEntry[]) => {
      let out = entries;
      if (!isSuperAdmin) {
        out = out.filter((e) => {
          const u = (e.user ?? "").toLowerCase();
          return u !== "super admin" && !u.includes("super admin");
        });
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        out = out.filter(
          (e) =>
            e.user?.toLowerCase().includes(q) ||
            e.action?.toLowerCase().includes(q) ||
            e.resource?.toLowerCase().includes(q) ||
            e.details?.toLowerCase().includes(q)
        );
      }
      return out;
    },
    [isSuperAdmin, searchQuery]
  );

  const filteredEntries = useMemo(
    () => filterEntries(loginEntries),
    [loginEntries, filterEntries]
  );
  const total = filteredEntries.length;

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredEntries, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit_logs_login_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Login logs exported." });
  };

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="page-section-title text-xl sm:text-2xl font-bold" data-testid="text-audit-logs-title">
          {pageTitle}
        </h1>
        <p className="page-section-description">
          Login history across the platform.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search action, resource, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl h-10 border-border/80 bg-background"
          />
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[140px] rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border shadow-sm overflow-hidden mt-4 sm:mt-6">
        <CardHeader className="p-4 sm:p-6 pb-4 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <LogIn className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {LOGIN_LABEL}
                </CardTitle>
                <CardDescription className="mt-1 text-sm text-muted-foreground max-w-xl">
                  Sign-in and sign-out events, failed attempts, IP and location.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto shrink-0 rounded-lg"
              onClick={handleExport}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {filteredEntries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm rounded-xl border border-dashed border-border bg-muted/30">
              No login events in the selected period.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {filteredEntries
                  .slice(
                    (page - 1) * AUDIT_LOG_PAGE_SIZE,
                    page * AUDIT_LOG_PAGE_SIZE
                  )
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
                      data-testid={`row-audit-${entry.id}`}
                    >
                      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-3 h-3 rounded-full shrink-0 mt-0.5 sm:mt-0 ${STATUS_CLASS[entry.status] ?? "bg-muted-foreground"}`}
                          title={entry.status}
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground">{entry.action}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 hidden sm:inline" />
                            <span className="inline-flex items-center gap-1.5 text-sm">
                              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-foreground">{entry.user}</span>
                            </span>
                          </div>
                          {(entry.resource || entry.details) && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {entry.resource}
                              {entry.resource && entry.details ? " — " : ""}
                              {entry.details}
                            </p>
                          )}
                          {(entry.ip || entry.location) && (
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              {entry.ip && (
                                <span className="inline-flex items-center gap-1">
                                  <span className="font-medium text-muted-foreground/80">IP</span>
                                  {entry.ip}
                                </span>
                              )}
                              {entry.location && (
                                <span className="inline-flex items-center gap-1">
                                  <Globe className="w-3 h-3 shrink-0" />
                                  {entry.location}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 pl-6 sm:pl-0 border-t border-border pt-3 sm:pt-0 sm:border-t-0">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>{entry.timestamp}</span>
                      </div>
                    </div>
                  ))}
              </div>
              {total > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-4 border-t border-border/60">
                  <p className="text-sm text-muted-foreground">
                    Showing{" "}
                    {total === 0 ? 0 : (page - 1) * AUDIT_LOG_PAGE_SIZE + 1}–
                    {Math.min(page * AUDIT_LOG_PAGE_SIZE, total)} of{" "}
                    {total.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={page >= Math.max(1, Math.ceil(total / AUDIT_LOG_PAGE_SIZE))}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
