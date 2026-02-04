import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users,
  FileText,
  TrendingUp,
  DollarSign,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  TooltipProps,
} from "recharts";
import { fetchAdminDashboard, fetchAdminOptions } from "@/api/admin-data";

const STATS_ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  Users,
  TrendingUp,
  DollarSign,
};

// Custom Tooltip for Proposal Trends
const ProposalTrendsTooltip = ({ active, payload, label }: TooltipProps<any, any>) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card dark:bg-card shadow-xl px-3 py-2.5 text-xs">
      <p className="font-semibold text-foreground mb-2.5 text-sm">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry: any, index: number) => {
          const colors: Record<string, { text: string; dot: string }> = {
            won: { 
              text: "text-emerald-600 dark:text-emerald-400", 
              dot: "bg-emerald-500 dark:bg-emerald-400" 
            },
            lost: { 
              text: "text-red-500 dark:text-red-400", 
              dot: "bg-red-500 dark:bg-red-400" 
            },
            pending: { 
              text: "text-primary", 
              dot: "bg-primary" 
            },
          };
          const colorConfig = colors[entry.dataKey as string] || { 
            text: "text-foreground", 
            dot: "bg-foreground" 
          };
          return (
            <div key={index} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${colorConfig.dot} shrink-0`} />
              <p className={colorConfig.text}>
                <span className="font-medium capitalize">{entry.dataKey}:</span>{" "}
                <span className="font-semibold ml-1">{entry.value}</span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Custom Tooltip for Revenue Chart
const RevenueTooltip = ({ active, payload, label }: TooltipProps<any, any>) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const value = payload[0]?.value as number;
  if (value === undefined) return null;

  return (
    <div className="rounded-lg border border-border bg-card dark:bg-card shadow-xl px-3 py-2.5 text-xs">
      <p className="font-semibold text-foreground mb-1.5 text-sm">{label}</p>
      <p className="text-foreground">
        <span className="font-medium text-muted-foreground">Revenue:</span>{" "}
        <span className="font-semibold text-foreground ml-1">${value.toLocaleString()}</span>
      </p>
    </div>
  );
};

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: fetchAdminDashboard,
  });
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const pageTitles = (optionsData as { pageTitles?: Record<string, string> })?.pageTitles ?? {};
  const dashboardTitle = pageTitles.dashboard ?? "Dashboard";
  const recentProposalsTitle = pageTitles.recentProposals ?? "Recent Proposals";

  const proposalTrendData = data?.proposalTrendData ?? [];
  const revenueData = data?.revenueData ?? [];
  const categoryData = data?.categoryData ?? [];
  const statsDataRaw = data?.statsData ?? [];
  const statsData = statsDataRaw.map((s: { icon?: string; [k: string]: unknown }) => ({
    ...s,
    icon: STATS_ICON_MAP[s.icon as string] ?? FileText,
  }));
  const recentProposals = data?.recentProposals ?? [];
  const topContributors = data?.topContributors ?? [];
  const categoryTotal = categoryData.length ? categoryData.reduce((s, c) => s + c.value, 0) : 0;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "won":
        return { label: "Won", icon: CheckCircle, className: "badge-status-won" };
      case "lost":
        return { label: "Lost", icon: XCircle, className: "badge-status-lost" };
      case "in_progress":
        return { label: "In Progress", icon: Clock, className: "badge-status-in-progress" };
      case "review":
        return { label: "Review", icon: AlertCircle, className: "badge-status-review" };
      default:
        return { label: "Draft", icon: FileText, className: "badge-status-draft" };
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-dashboard-title">{dashboardTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome back! Here's what's happening with your RFP platform.</p>
        </div>
        <Button variant="outline" size="sm" data-testid="button-export-report" className="w-full sm:w-auto">
          Export Report
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat, index) => (
          <div key={index} className="metric-card group" data-testid={`card-stat-${index}`}>
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${stat.trend === 'up' ? 'text-emerald' : 'text-red'}`}>
                {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {stat.change}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{stat.title}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="chart-container" data-testid="chart-proposal-trends">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4">
            <h3 className="font-semibold text-foreground text-sm sm:text-base">Proposal Trends</h3>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Won</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Lost</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary"></span> Pending</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={proposalTrendData}>
              <defs>
                <linearGradient id="wonGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="lostGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, opacity: 0.7 }} 
                className="[&_text]:dark:opacity-90"
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, opacity: 0.7 }} 
                className="[&_text]:dark:opacity-90"
              />
              <Tooltip content={<ProposalTrendsTooltip />} />
              <Area type="monotone" dataKey="won" stroke="#10b981" fill="url(#wonGradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="lost" stroke="#f87171" fill="url(#lostGradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="pending" stroke="var(--primary)" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container" data-testid="chart-revenue">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4">
            <h3 className="font-semibold text-foreground text-sm sm:text-base">Monthly Revenue</h3>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, opacity: 0.7 }} 
                className="[&_text]:dark:opacity-90"
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, opacity: 0.7 }}
                tickFormatter={(value) => `$${value/1000}k`}
                className="[&_text]:dark:opacity-90"
              />
              <Tooltip content={<RevenueTooltip />} />
              <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2 border shadow-sm" data-testid="card-recent-proposals">
          <CardHeader className="pb-3 border-b bg-muted/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <CardTitle className="text-sm sm:text-base font-semibold text-foreground">{recentProposalsTitle}</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary text-sm hover:opacity-90 w-full sm:w-auto">View All</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentProposals.map((proposal) => {
                const statusConfig = getStatusConfig(proposal.status);
                const StatusIcon = statusConfig.icon;
                return (
                  <div 
                    key={proposal.id} 
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 hover:bg-muted/50 transition-colors group cursor-pointer"
                    data-testid={`row-proposal-${proposal.id}`}
                  >
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-medium text-sm text-foreground truncate">{proposal.title}</h4>
                        <Badge variant="outline" className={`${statusConfig.className} text-[10px] font-medium shrink-0`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                        <span className="text-xs text-muted-foreground">{proposal.client}</span>
                        <span className="text-xs text-muted-foreground/50 hidden sm:inline">•</span>
                        <span className="text-xs font-medium text-primary">{proposal.value}</span>
                        <span className="text-xs text-muted-foreground/50 hidden sm:inline">•</span>
                        <span className="text-xs text-muted-foreground">Due: {proposal.dueDate}</span>
                      </div>
                      <div className="w-full sm:w-24 sm:hidden mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium text-foreground">{proposal.progress}%</span>
                        </div>
                        <Progress value={proposal.progress} className="h-1.5" />
                      </div>
                    </div>
                    <div className="w-full sm:w-24 hidden sm:block">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium text-foreground">{proposal.progress}%</span>
                      </div>
                      <Progress value={proposal.progress} className="h-1.5" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 self-end sm:self-auto">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Eye className="w-4 h-4 mr-2" /> View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Proposal</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 sm:space-y-6">
          <div className="chart-container" data-testid="chart-categories">
            <h3 className="font-semibold text-foreground mb-4 text-sm sm:text-base">By Category</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 w-full sm:w-auto space-y-2">
                {categoryData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: item.color }}></span>
                      <span className="text-muted-foreground">{item.name}</span>
                    </span>
                    <span className="font-medium text-foreground">
                      {item.value}
                      {categoryTotal ? ` (${((item.value / categoryTotal) * 100).toFixed(0)}%)` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Card className="border shadow-sm" data-testid="card-top-contributors">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-semibold text-foreground">Top Contributors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topContributors.map((contributor, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="theme-gradient-bg text-white text-xs font-semibold">
                      {contributor.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{contributor.name}</p>
                    <p className="text-xs text-muted-foreground">{contributor.proposals} proposals</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald">{contributor.winRate}%</p>
                    <p className="text-[10px] text-muted-foreground">win rate</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="rounded-xl p-4 theme-gradient-bg text-white" data-testid="card-ai-summary">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-white/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm">AI Assistant</span>
            </div>
            <p className="text-sm text-primary/90 mb-3">12,847 questions answered this month with 94.2% accuracy</p>
            <Button size="sm" variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white border-0">
              View AI Insights
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
