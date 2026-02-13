import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { fetchAdminUsage, fetchAdminOptions, type UsageData } from "@/api/admin-data";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { folderIconUrl } from "@/assets/folder-icon-url";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Users,
  Sparkles,
  Clock,
  Target,
  Activity,
  Search,
  ArrowLeft,
  ChevronRight,
  Grid3X3,
  List,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const USAGE_ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  Activity,
  Target,
  Clock,
};

const DEFAULT_DATE_RANGES = [
  { value: "day", label: "Today" },
  { value: "7days", label: "Last 7 days" },
  { value: "30days", label: "Last 30 days" },
  { value: "3months", label: "Last 3 months" },
  { value: "6months", label: "Last 6 months" },
  { value: "year", label: "Last 1 year" },
];

const ROLE_ALL = "__all__";
const ROLE_OPTIONS = [
  { value: ROLE_ALL, label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "customer", label: "Customer" },
  { value: "collaborator", label: "Collaborator" },
];

type SummaryCard = { label: string; value: string; trend: string; trendUp: boolean; icon?: string; iconColor?: string; bgColor?: string };

const DEFAULT_SUMMARY_CARDS: SummaryCard[] = [
  { label: "Credits Used (7d)", value: "0", trend: "Last 7 days", trendUp: true, icon: "Sparkles", iconColor: "text-primary", bgColor: "bg-primary/10" },
  { label: "Proposals Generated", value: "0", trend: "in range", trendUp: true, icon: "Activity", iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
  { label: "Avg Credits/Proposal", value: "0", trend: "efficiency", trendUp: true, icon: "Target", iconColor: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  { label: "AI Messages", value: "0", trend: "usage events", trendUp: true, icon: "Clock", iconColor: "text-amber-500", bgColor: "bg-amber-500/10" },
];

const DEFAULT_DAILY_USAGE = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({ day, credits: 0, proposals: 0 }));

const DEFAULT_FEATURE_USAGE = [
  { feature: "Response Generation", usage: 0, credits: 0 },
  { feature: "Content Suggestions", usage: 0, credits: 0 },
  { feature: "Proposal Analysis", usage: 0, credits: 0 },
  { feature: "Document Parsing", usage: 0, credits: 0 },
  { feature: "Translation", usage: 0, credits: 0 },
];

const DEFAULT_HOURLY_PEAKS = Array.from({ length: 24 }, (_, h) => ({
  hour: h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`,
  usage: 0,
}));

export default function AdminUsage() {
  const [dateRange, setDateRange] = useState("7days");
  const [roleFilter, setRoleFilter] = useState(ROLE_ALL);
  const [folderSearch, setFolderSearch] = useState("");
  const [folderSort, setFolderSort] = useState<"a-z" | "z-a">("a-z");
  const [folderViewMode, setFolderViewMode] = useState<"grid" | "list">("grid");
  const { currentRole } = useAuth();
  const isSuperAdmin = (currentRole ?? "").toLowerCase() === "super_admin";
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = useMemo(() => {
    const q = search && search.startsWith("?") ? search.slice(1) : search || "";
    return new URLSearchParams(q);
  }, [search]);
  const selectedAdminId = useMemo(() => {
    const id = searchParams.get("adminId");
    return id != null && /^\d+$/.test(id) ? parseInt(id, 10) : null;
  }, [searchParams]);
  const viewAdmins = searchParams.get("view") === "admins";

  const { data, isError, error, refetch, isLoading } = useQuery({
    queryKey: ["admin", "usage", dateRange, selectedAdminId ?? "all", roleFilter],
    queryFn: () =>
      fetchAdminUsage({
        dateRange,
        adminId: selectedAdminId ?? undefined,
        role: roleFilter && roleFilter !== ROLE_ALL ? roleFilter : undefined,
      }),
  });
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });

  const adminList = data?.adminList ?? [];
  // Folder view: only show "Admin" role (exclude Super Admin, Customer, Collaborator)
  const adminOnlyList = useMemo(
    () => adminList.filter((a) => /^admin$/i.test((a.role ?? "").trim())),
    [adminList]
  );
  const filteredAdminList = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    let list = q ? adminOnlyList.filter((a) => a.name.toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q)) : [...adminOnlyList];
    list = [...list].sort((a, b) =>
      folderSort === "a-z" ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) : b.name.localeCompare(a.name, undefined, { sensitivity: "base" })
    );
    return list;
  }, [adminOnlyList, folderSearch, folderSort]);

  const dailyUsage = (data?.dailyUsage?.length ? data.dailyUsage : DEFAULT_DAILY_USAGE) as { day: string; credits: number; proposals: number }[];
  const featureUsage = (data?.featureUsage?.length ? data.featureUsage : DEFAULT_FEATURE_USAGE) as { feature: string; usage: number; credits: number }[];
  const topUsers = data?.topUsers ?? [];
  const hourlyPeaks = (data?.hourlyPeaks?.length ? data.hourlyPeaks : DEFAULT_HOURLY_PEAKS) as { hour: string; usage: number }[];
  const usersInScope = data?.usersInScope ?? [];
  const summaryCards: SummaryCard[] = (data as { summaryCards?: SummaryCard[] })?.summaryCards?.length ? ((data as { summaryCards: SummaryCard[] }).summaryCards) : DEFAULT_SUMMARY_CARDS;
  const dateRangesUsage = (data as UsageData)?.dateRanges?.length ? (data as UsageData).dateRanges! : DEFAULT_DATE_RANGES;
  const usageTitle = (data as UsageData)?.pageTitle ?? (optionsData as { pageTitles?: Record<string, string> })?.pageTitles?.usage ?? "Usage Analytics";
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleSelectAdmin = (adminId: number) => setLocation(`/admin/usage?adminId=${adminId}`);
  const handleBackToOverview = () => setLocation("/admin/usage");
  const handleOpenAdminPicker = () => setLocation("/admin/usage?view=admins");
  const handleBackToAdmins = () => setLocation("/admin/usage?view=admins");
  const selectedAdmin = selectedAdminId != null ? adminList.find((a) => a.id === selectedAdminId) : null;

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6 p-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="h-10 w-10 bg-muted rounded-xl animate-pulse mb-3" />
                <div className="h-6 w-16 bg-muted rounded animate-pulse mb-2" />
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Loading usage analytics…</p>
      </div>
    );
  }

  // Super admin: folder (admin picker) view only when ?view=admins and no admin selected. Default = full analytics dashboard.
  const showFolderView = isSuperAdmin && selectedAdminId == null && adminOnlyList.length > 0 && viewAdmins;
  if (showFolderView) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground hover:text-foreground w-fit" onClick={handleBackToOverview}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to overview
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-usage-title">{usageTitle}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Select an admin to view their usage analytics and their customers & collaborators.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-full">
          <Card className="border shadow-sm overflow-hidden rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold tabular-nums">{adminOnlyList.length}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm overflow-hidden rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <BarChart3 className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold">Select below</p>
              <p className="text-xs text-muted-foreground">View usage by admin</p>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input placeholder="Search admins..." value={folderSearch} onChange={(e) => setFolderSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={folderSort} onValueChange={(v) => setFolderSort(v as "a-z" | "z-a")}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a-z">A → Z</SelectItem>
              <SelectItem value="z-a">Z → A</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center border rounded-lg overflow-hidden shrink-0 sm:ml-auto">
            <Button variant={folderViewMode === "grid" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setFolderViewMode("grid")} title="Grid view">
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button variant={folderViewMode === "list" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setFolderViewMode("list")} title="List view">
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {filteredAdminList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No admins match your search.</p>
        ) : folderViewMode === "list" ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <ul className="divide-y divide-border">
              {filteredAdminList.map((admin) => (
                <li key={admin.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectAdmin(admin.id)}
                    className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    data-testid={`folder-admin-${admin.id}`}
                  >
                    <img src={folderIconUrl} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">{admin.name}</p>
                      {admin.email && <p className="text-xs text-muted-foreground truncate">{admin.email}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{admin.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <TooltipProvider>
            <div className="flex flex-wrap gap-2">
              {filteredAdminList.map((admin) => (
                <Tooltip key={admin.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelectAdmin(admin.id)}
                      className="flex flex-col items-center gap-2 w-24 sm:w-28 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg p-2 transition-colors hover:bg-muted/50"
                      data-testid={`folder-admin-${admin.id}`}
                    >
                      <img src={folderIconUrl} alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-contain group-hover:scale-105 transition-transform" />
                      <span className="text-sm font-medium text-foreground text-center line-clamp-2 break-words w-full">{admin.name}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">{admin.name}</p>
                    {admin.email && <p className="text-muted-foreground text-xs mt-0.5">{admin.email}</p>}
                    <p className="text-muted-foreground text-xs mt-0.5">Role: {admin.role}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}
      </div>
    );
  }

  const maxDailyCredits = Math.max(...dailyUsage.map((d) => d.credits), 1);
  const minBarWidthPercent = 4; // show a sliver when value is 0 so the row is visible

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4">
        {isSuperAdmin && selectedAdminId != null && (
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground hover:text-foreground w-fit" onClick={handleBackToAdmins}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            All admins
          </Button>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-usage-title">
              {isSuperAdmin && selectedAdmin ? `${usageTitle} · ${selectedAdmin.name}` : usageTitle}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              {isSuperAdmin && selectedAdminId != null
                ? "Usage for this admin and their customers & collaborators. Filter by role."
                : "Monitor AI usage patterns and optimize resource allocation. Filter by role."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {isSuperAdmin && selectedAdminId == null && adminOnlyList.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-xs sm:text-sm"
                onClick={handleOpenAdminPicker}
              >
                <Users className="w-4 h-4" />
                View by admin
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            )}
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-full sm:w-40 text-sm sm:text-base" data-testid="select-date-range">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRangesUsage.map((opt: { value: string; label: string }) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-36 text-sm">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial text-xs sm:text-sm"
              data-testid="button-export"
              onClick={() => {
                const escapeCsv = (v: string | number) => {
                  const s = String(v);
                  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
                };
                const rows: string[] = [];
                rows.push("Usage Analytics Export");
                rows.push(`Exported,${new Date().toISOString().split("T")[0]}`);
                rows.push(`Date Range,${dateRange}`);
                rows.push(`Role Filter,${roleFilter === ROLE_ALL ? "all" : roleFilter}`);
                rows.push("");
                rows.push("Daily Usage");
                rows.push("Day,Credits,Proposals");
                dailyUsage.forEach((d) => rows.push([d.day, d.credits, d.proposals].map(escapeCsv).join(",")));
                rows.push("");
                rows.push("Feature Usage");
                rows.push("Feature,Credits,Usage %");
                featureUsage.forEach((f) => rows.push([f.feature, f.credits, f.usage].map(escapeCsv).join(",")));
                rows.push("");
                rows.push("Top Users by Efficiency");
                rows.push("Name,Credits,Proposals,Efficiency");
                topUsers.forEach((u) => rows.push([u.name, u.credits, u.proposals, u.efficiency].map(escapeCsv).join(",")));
                rows.push("");
                rows.push("Users in Scope");
                rows.push("Name,Email,Role,Credits,Proposals,Efficiency");
                usersInScope.forEach((u) => rows.push([u.name, u.email ?? "", u.roleLabel, u.credits, u.proposals, u.efficiency].map(escapeCsv).join(",")));
                const csvStr = "\uFEFF" + rows.join("\r\n");
                const dataBlob = new Blob([csvStr], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `usage_analytics_${new Date().toISOString().split("T")[0]}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast({ title: "Exported", description: "Usage analytics exported as CSV." });
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {summaryCards.map((card, index) => {
          const Icon = USAGE_ICON_MAP[card.icon ?? "Sparkles"] ?? Sparkles;
          const trendClass = card.trendUp ? "text-emerald dark:text-emerald" : "text-red dark:text-red";
          const TrendIcon = card.trendUp ? TrendingUp : TrendingDown;
          return (
            <Card key={index} className="border shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${card.bgColor ?? "bg-primary/10"} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.iconColor ?? "text-primary"}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-medium ${trendClass}`}>
                    <TrendIcon className="w-3 h-3" />
                    {card.trend}
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-bold">{card.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{card.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <CardTitle className="text-sm sm:text-base">Daily Usage</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-2 sm:space-y-3 mt-2 sm:mt-4">
              {dailyUsage.map((data, index) => (
                <div key={index} className={`flex ${isMobile ? "flex-col" : "items-center"} gap-2 sm:gap-4`}>
                  <span className="w-10 text-xs sm:text-sm font-medium text-muted-foreground shrink-0">{data.day}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-5 sm:h-6 bg-muted rounded-lg overflow-hidden relative">
                      <div
                        className="h-full theme-gradient-fill rounded-lg transition-all opacity-90"
                        style={{ width: `${Math.max(minBarWidthPercent, Math.min(100, (data.credits / maxDailyCredits) * 100))}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-medium">
                        {data.credits.toLocaleString()} credits
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs text-muted-foreground w-20 text-right shrink-0">{data.proposals} proposals</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <CardTitle className="text-sm sm:text-base">Feature Usage</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-3 sm:space-y-4 mt-2 sm:mt-4">
              {featureUsage.map((feature, index) => (
                <div key={index} className="space-y-2">
                  <div className={`flex ${isMobile ? "flex-col" : "items-center justify-between"} gap-2`}>
                    <span className="text-xs sm:text-sm font-medium truncate">{feature.feature}</span>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{feature.credits.toLocaleString()} credits</span>
                      <Badge variant="secondary" className="text-[10px]">{feature.usage}%</Badge>
                    </div>
                  </div>
                  <Progress value={feature.usage} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users in scope: role clearly shown (Admin / Customer / Collaborator) */}
      {usersInScope.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <CardTitle className="text-sm sm:text-base">Users in scope (by role)</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              {isSuperAdmin && selectedAdminId != null ? "This admin plus their customers and collaborators." : "You plus your customers and collaborators. Role is shown for each user."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 overflow-x-auto">
            <div className="space-y-2">
              {usersInScope.map((u) => (
                <div
                  key={u.userId}
                  className={`flex ${isMobile ? "flex-col" : "items-center"} gap-2 sm:gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors`}
                >
                  <div className={`flex items-center gap-3 flex-1 min-w-0 ${isMobile ? "" : "flex-1"}`}>
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarFallback className="theme-gradient-bg text-white text-xs font-semibold">
                        {u.name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                    </div>
                    <Badge variant={u.role === "admin" || u.role === "super_admin" ? "default" : "secondary"} className="shrink-0 text-[10px]">
                      {u.roleLabel}
                    </Badge>
                  </div>
                  <div className={`flex items-center gap-4 shrink-0 ${isMobile ? "justify-between" : ""}`}>
                    <span className="text-xs text-muted-foreground">{u.credits.toLocaleString()} credits</span>
                    <span className="text-xs text-muted-foreground">{u.proposals} proposals</span>
                    <span className="text-xs font-medium text-primary">Efficiency: {u.efficiency}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <CardTitle className="text-sm sm:text-base">Top Users by Efficiency</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">Credits used per proposal (filtered by role & name)</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-2 sm:space-y-3 mt-2">
              {topUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No users match the current filters.</p>
              ) : (
                topUsers.map((user, index) => (
                  <div
                    key={index}
                    className={`flex ${isMobile ? "flex-col" : "items-center"} gap-2 sm:gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors`}
                    data-testid={`row-user-${index}`}
                  >
                    <div className={`flex items-center gap-2 sm:gap-3 ${isMobile ? "" : "flex-1 min-w-0"}`}>
                      <div className="relative shrink-0">
                        <Avatar className="w-8 h-8 sm:w-9 sm:h-9">
                          <AvatarFallback className="theme-gradient-bg text-white text-[10px] sm:text-xs font-semibold">{user.avatar}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-background flex items-center justify-center">
                          <span className="text-[8px] font-bold text-primary">#{index + 1}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">{user.name}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {user.proposals} proposals • {user.credits} credits
                        </p>
                      </div>
                    </div>
                    <div className={`text-right ${isMobile ? "self-end" : ""}`}>
                      <p className={`text-xs sm:text-sm font-bold ${user.efficiency > 100 ? "text-emerald dark:text-emerald" : "text-amber dark:text-amber"}`}>{user.efficiency}</p>
                      <p className="text-[10px] text-muted-foreground">efficiency score</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <CardTitle className="text-sm sm:text-base">Peak Usage Hours</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">When your team uses AI the most</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="flex items-end justify-between h-24 sm:h-32 mt-2 sm:mt-4 gap-1 sm:gap-2">
              {hourlyPeaks.map((peak, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full theme-gradient-fill rounded-t-lg transition-all min-h-[6px] opacity-90"
                    style={{ height: `${Math.max(6, peak.usage)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{peak.hour}</span>
                </div>
              ))}
            </div>
            {hourlyPeaks.length > 0 && (() => {
              const maxIdx = hourlyPeaks.reduce((best, p, i) => (p.usage > (hourlyPeaks[best]?.usage ?? 0) ? i : best), 0);
              const peak = hourlyPeaks[maxIdx];
              const nextHour = maxIdx + 1 < hourlyPeaks.length ? hourlyPeaks[maxIdx + 1] : null;
              const peakLabel = peak ? (nextHour ? `${peak.hour} - ${nextHour.hour}` : peak.hour) : "—";
              return (
                <div className="mt-3 sm:mt-4 p-2 sm:p-3 rounded-lg bg-primary/5">
                  <div className={`flex ${isMobile ? "flex-col" : "items-center justify-between"} gap-2`}>
                    <span className="text-xs sm:text-sm">Peak Usage Time</span>
                    <Badge className="bg-primary text-white text-[10px] sm:text-xs">{peakLabel}</Badge>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
