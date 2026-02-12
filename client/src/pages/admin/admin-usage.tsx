import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { fetchAdminUsage, fetchAdminOptions } from "@/api/admin-data";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
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
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

const ROLE_ALL = "__all__";
const ROLE_OPTIONS = [
  { value: ROLE_ALL, label: "All roles" },
  { value: "admin", label: "Admin" },
  { value: "customer", label: "Customer" },
  { value: "collaborator", label: "Collaborator" },
];

export default function AdminUsage() {
  const [dateRange, setDateRange] = useState("7days");
  const [roleFilter, setRoleFilter] = useState(ROLE_ALL);
  const [nameFilter, setNameFilter] = useState("");
  const [folderSearch, setFolderSearch] = useState("");
  const [folderSort, setFolderSort] = useState<"a-z" | "z-a">("a-z");
  const { currentRole } = useAuth();
  const isSuperAdmin = (currentRole ?? "").toLowerCase() === "super_admin";
  const [, setLocation] = useLocation();
  const selectedAdminId = (() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    const id = p.get("adminId");
    return id != null && /^\d+$/.test(id) ? parseInt(id, 10) : null;
  })();

  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "usage", dateRange, selectedAdminId ?? "all", roleFilter, nameFilter],
    queryFn: () =>
      fetchAdminUsage({
        dateRange,
        adminId: selectedAdminId ?? undefined,
        role: roleFilter && roleFilter !== ROLE_ALL ? roleFilter : undefined,
        name: nameFilter || undefined,
      }),
  });
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });

  const adminList = data?.adminList ?? [];
  const filteredAdminList = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    let list = q ? adminList.filter((a) => a.name.toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q)) : [...adminList];
    list = [...list].sort((a, b) =>
      folderSort === "a-z" ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) : b.name.localeCompare(a.name, undefined, { sensitivity: "base" })
    );
    return list;
  }, [adminList, folderSearch, folderSort]);

  const dailyUsage = data?.dailyUsage ?? [];
  const featureUsage = data?.featureUsage ?? [];
  const topUsers = data?.topUsers ?? [];
  const hourlyPeaks = data?.hourlyPeaks ?? [];
  const usersInScope = data?.usersInScope ?? [];
  type SummaryCard = { label: string; value: string; trend: string; trendUp: boolean; icon?: string; iconColor?: string; bgColor?: string };
  const summaryCards: SummaryCard[] = (data as { summaryCards?: SummaryCard[] })?.summaryCards ?? [];
  const dateRangesUsage = (optionsData as { dateRangesUsage?: { value: string; label: string }[] })?.dateRangesUsage?.length
    ? (optionsData as { dateRangesUsage: { value: string; label: string }[] }).dateRangesUsage
    : DEFAULT_DATE_RANGES;
  const pageTitles = (optionsData as { pageTitles?: Record<string, string> })?.pageTitles ?? {};
  const usageTitle = pageTitles.usage ?? "Usage Analytics";
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleSelectAdmin = (adminId: number) => setLocation(`/admin/usage?adminId=${adminId}`);
  const handleBackToAdmins = () => setLocation("/admin/usage");
  const selectedAdmin = selectedAdminId != null ? adminList.find((a) => a.id === selectedAdminId) : null;

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  // Super admin: folder view only when no admin selected AND we have admins to show. Otherwise show usage data (same as admin).
  const showFolderView = isSuperAdmin && selectedAdminId == null && adminList.length > 0;
  if (showFolderView) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-usage-title">{usageTitle}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Select an admin to view their usage analytics and their customers & collaborators.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:gap-4">
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
        </div>
        <TooltipProvider>
          <div className="flex flex-wrap gap-6 sm:gap-8">
            {filteredAdminList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No admins match your search.</p>
            ) : (
              filteredAdminList.map((admin) => (
                <Tooltip key={admin.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleSelectAdmin(admin.id)}
                      className="flex flex-col items-center gap-2 w-24 sm:w-28 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg p-2 transition-colors hover:bg-muted/50"
                      data-testid={`folder-admin-${admin.id}`}
                    >
                      <img src="/icons8-folder-48.png" alt="" className="w-12 h-12 sm:w-14 sm:h-14 object-contain group-hover:scale-105 transition-transform" />
                      <span className="text-sm font-medium text-foreground text-center line-clamp-2 break-words w-full">{admin.name}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-medium">{admin.name}</p>
                    {admin.email && <p className="text-muted-foreground text-xs mt-0.5">{admin.email}</p>}
                    <p className="text-muted-foreground text-xs mt-0.5">Role: {admin.role}</p>
                  </TooltipContent>
                </Tooltip>
              ))
            )}
          </div>
        </TooltipProvider>
      </div>
    );
  }

  const maxDailyCredits = Math.max(...dailyUsage.map((d) => d.credits), 1);

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
                ? "Usage for this admin and their customers & collaborators. Filter by role and name."
                : "Monitor AI usage patterns and optimize resource allocation. Filter by role and name."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
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
            <div className="relative flex-1 min-w-[120px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Filter by name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-initial text-xs sm:text-sm"
              data-testid="button-export"
              onClick={() => {
                const usageData = { dateRange, roleFilter: roleFilter === ROLE_ALL ? "all" : roleFilter, nameFilter: nameFilter || "", dailyUsage, usersInScope, topUsers };
                const dataStr = JSON.stringify(usageData, null, 2);
                const dataBlob = new Blob([dataStr], { type: "application/json" });
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `usage_analytics_${new Date().toISOString().split("T")[0]}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast({ title: "Exported", description: "Usage analytics has been exported." });
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
                        style={{ width: `${Math.min(100, (data.credits / maxDailyCredits) * 100)}%` }}
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
                    className="w-full theme-gradient-fill rounded-t-lg transition-all min-h-[4px] opacity-90"
                    style={{ height: `${peak.usage}%` }}
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
