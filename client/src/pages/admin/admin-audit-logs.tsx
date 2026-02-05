import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchAdminAuditLogs, fetchAdminOptions, type AuditLogEntry, type AuditLogType } from "@/api/admin-data";
import {
  Download,
  LogIn,
  Database,
  FileStack,
  Sparkles,
  Clock,
  Globe,
  Search,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TYPE_LABELS: Record<AuditLogType, string> = {
  login: "Login",
  data_access: "Data access",
  file: "File activity",
  ai_usage: "AI usage",
};

const TYPE_ICONS: Record<AuditLogType, typeof LogIn> = {
  login: LogIn,
  data_access: Database,
  file: FileStack,
  ai_usage: Sparkles,
};

const STATUS_CLASS: Record<string, string> = {
  success: "bg-emerald-500",
  failure: "bg-red-500",
  warning: "bg-amber-500",
};

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
  const [userFilter, setUserFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const isMobile = useIsMobile();

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
  const { data: dataAccessData } = useQuery({
    queryKey: ["admin", "audit-logs", "data_access", dateFrom, dateTo],
    queryFn: () => fetchAdminAuditLogs({ type: "data_access", dateFrom, dateTo, limit: 100 }),
  });
  const { data: fileData } = useQuery({
    queryKey: ["admin", "audit-logs", "file", dateFrom, dateTo],
    queryFn: () => fetchAdminAuditLogs({ type: "file", dateFrom, dateTo, limit: 100 }),
  });
  const { data: aiUsageData } = useQuery({
    queryKey: ["admin", "audit-logs", "ai_usage", dateFrom, dateTo],
    queryFn: () => fetchAdminAuditLogs({ type: "ai_usage", dateFrom, dateTo, limit: 100 }),
  });

  const dataByTab: Record<AuditLogType, AuditLogEntry[]> = useMemo(
    () => ({
      login: loginData?.entries ?? [],
      data_access: dataAccessData?.entries ?? [],
      file: fileData?.entries ?? [],
      ai_usage: aiUsageData?.entries ?? [],
    }),
    [loginData, dataAccessData, fileData, aiUsageData]
  );

  const filterEntries = (entries: AuditLogEntry[]) => {
    let out = entries;
    if (userFilter.trim()) {
      const u = userFilter.trim().toLowerCase();
      out = out.filter((e) => e.user?.toLowerCase().includes(u));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      out = out.filter(
        (e) =>
          e.action?.toLowerCase().includes(q) ||
          e.resource?.toLowerCase().includes(q) ||
          e.details?.toLowerCase().includes(q)
      );
    }
    return out;
  };

  const handleExport = (type: AuditLogType) => {
    const entries = filterEntries(dataByTab[type]);
    const dataStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit_logs_${type}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${TYPE_LABELS[type]} logs exported.` });
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-audit-logs-title">
            {pageTitle}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Login history, data access, file activity, and AI usage across the platform.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search action, resource..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Filter by user"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="max-w-[180px]"
        />
      </div>

      <Tabs defaultValue="login" className="w-full">
        <TabsList className="bg-muted/50 overflow-x-auto overflow-y-hidden w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsTrigger value="login" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <LogIn className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Login
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {dataByTab.login.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="data_access" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <Database className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Data access
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {dataByTab.data_access.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="file" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <FileStack className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            File activity
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {dataByTab.file.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ai_usage" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            AI usage
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {dataByTab.ai_usage.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {(["login", "data_access", "file", "ai_usage"] as const).map((tabType) => {
          const entries = filterEntries(dataByTab[tabType]);
          const Icon = TYPE_ICONS[tabType];
          return (
            <TabsContent key={tabType} value={tabType} className="mt-4 sm:mt-6">
              <Card className="border shadow-sm">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {TYPE_LABELS[tabType]}
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        {tabType === "login" && "Sign-in and sign-out events, failed attempts, IP and location."}
                        {tabType === "data_access" && "Proposal views, exports, and sensitive data access."}
                        {tabType === "file" && "Uploads, downloads, and document changes."}
                        {tabType === "ai_usage" && "AI generations, model calls, and token usage."}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={() => handleExport(tabType)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  {entries.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      No {TYPE_LABELS[tabType].toLowerCase()} events in the selected period.
                    </div>
                  ) : (
                    <div className="space-y-2 sm:space-y-3">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className={`flex ${isMobile ? "flex-col" : "items-center"} gap-3 sm:gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors`}
                          data-testid={`row-audit-${entry.id}`}
                        >
                          <div className={`flex items-center gap-3 sm:gap-4 flex-1 min-w-0`}>
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${STATUS_CLASS[entry.status] ?? "bg-muted-foreground"}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className={`flex ${isMobile ? "flex-col" : "items-center"} gap-2 flex-wrap`}>
                                <span className="font-medium text-xs sm:text-sm">{entry.action}</span>
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {entry.user}
                                </Badge>
                              </div>
                              {(entry.resource || entry.details) && (
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 truncate">
                                  {entry.resource}
                                  {entry.resource && entry.details ? " — " : ""}
                                  {entry.details}
                                </p>
                              )}
                              {(entry.ip || entry.location) && (
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                                  {entry.ip && <span className="flex items-center gap-1">IP: {entry.ip}</span>}
                                  {entry.location && (
                                    <span className="flex items-center gap-1">
                                      <Globe className="w-3 h-3 shrink-0" /> {entry.location}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground shrink-0">
                            <Clock className="w-3 h-3 shrink-0" />
                            {entry.timestamp}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
