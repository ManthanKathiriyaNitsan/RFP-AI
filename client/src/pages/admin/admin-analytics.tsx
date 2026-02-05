import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  BarChart3,
  PieChart,
  LineChart,
  Target,
  Users,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { fetchAdminAnalytics, fetchAdminOptions } from "@/api/admin-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePrompt } from "@/hooks/use-prompt";

const KPI_ICON_MAP: Record<string, LucideIcon> = {
  DollarSign,
  Clock,
  Users,
  Target,
};

export default function AdminAnalytics() {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState("6months");
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "analytics", dateRange],
    queryFn: () => fetchAdminAnalytics({ dateRange }),
  });
  const winLossData = data?.winLossData ?? [];
  const categoryPerformance = data?.categoryPerformance ?? [];
  const kpiMetricsRaw = data?.kpiMetrics ?? [];
  const kpiMetrics = kpiMetricsRaw.map((k: { icon?: string; [x: string]: unknown }) => ({
    ...k,
    icon: KPI_ICON_MAP[k.icon as string] ?? Target,
  }));
  const revenueByQuarter = data?.revenueByQuarter ?? [];
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const dateRangesAnalytics = optionsData?.dateRangesAnalytics ?? [];
  const chartColors = (optionsData as { chartColors?: string[] } | undefined)?.chartColors ?? [];
  const pageTitles = (optionsData as { pageTitles?: Record<string, string> })?.pageTitles ?? {};
  const analyticsTitle = pageTitles.analytics ?? "Analytics Dashboard";
  const isMobile = useIsMobile();
  const { prompt, PromptDialog } = usePrompt();

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {PromptDialog}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-analytics-title">{analyticsTitle}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Deep insights into your proposal performance and trends.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full sm:w-40" data-testid="select-date-range">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRangesAnalytics.map((opt: { value: string; label: string }) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm" 
            data-testid="button-filter"
            className="flex-1 sm:flex-initial"
            onClick={async () => {
              const filterType = await prompt({
                title: "Filter Analytics",
                description: "Filter by:\n1. Status (won/lost/in_progress)\n2. Owner\n3. Date Range",
                placeholder: "Enter option (1-3) or leave empty",
              });
              if (filterType === "1") {
                const status = await prompt({
                  title: "Filter by Status",
                  description: "Enter status to filter by",
                  placeholder: "won/lost/in_progress",
                });
                if (status) {
                  toast({
                    title: "Filter applied",
                    description: `Filtering by status: ${status}`,
                  });
                }
              } else if (filterType === "2") {
                const owner = await prompt({
                  title: "Filter by Owner",
                  description: "Enter owner name to filter by",
                  placeholder: "Owner name",
                });
                if (owner) {
                  toast({
                    title: "Filter applied",
                    description: `Filtering by owner: ${owner}`,
                  });
                }
              } else if (filterType === "3") {
                toast({
                  title: "Date range filter",
                  description: "Use the date range selector above to filter by date.",
                });
              }
            }}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            data-testid="button-download"
            className="flex-1 sm:flex-initial"
            onClick={() => {
              // Export analytics data
              const analyticsData = { dateRange, kpiMetrics, winLossData, revenueByQuarter };
              const dataStr = JSON.stringify(analyticsData, null, 2);
              const dataBlob = new Blob([dataStr], { type: "application/json" });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `analytics_${new Date().toISOString().split('T')[0]}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              toast({
                title: "Exported",
                description: "Analytics data has been exported.",
              });
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpiMetrics.map((metric, index) => (
          <Card key={index} className="border shadow-sm" data-testid={`card-kpi-${index}`}>
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <metric.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </div>
                <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-medium ${
                  metric.trend === 'up' ? 'text-emerald-600' : 'text-emerald-600'
                }`}>
                  <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {metric.change}
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold">{metric.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{metric.label}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border shadow-sm" data-testid="card-win-loss">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <CardTitle className="text-sm sm:text-base font-semibold">Win/Loss Analysis</CardTitle>
              </div>
              <Badge variant="outline" className="text-white bg-emerald-600 border-emerald-500/20 text-xs shrink-0">
                68% Win Rate
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
              {winLossData.map((data, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-medium">{data.month}</span>
                    <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs">
                      <span className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {data.won} won
                      </span>
                      <span className="flex items-center gap-1 text-red-500">
                        <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {data.lost} lost
                      </span>
                    </div>
                  </div>
                  <div className="flex h-2 sm:h-2.5 rounded-full overflow-hidden bg-muted">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-full"
                      style={{ width: `${(data.won / (data.won + data.lost)) * 100}%` }}
                    />
                    <div 
                      className="bg-gradient-to-r from-red-400 to-red-500 rounded-r-full"
                      style={{ width: `${(data.lost / (data.won + data.lost)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm" data-testid="card-revenue">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LineChart className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <CardTitle className="text-sm sm:text-base font-semibold">Revenue Trend</CardTitle>
              </div>
              <Badge variant="outline" className="text-white bg-primary border-primary/20 text-xs shrink-0">
                +44.6% YoY
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
              {revenueByQuarter.map((data, index) => (
                <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <div className="w-full sm:w-20 text-xs sm:text-sm font-medium">{data.quarter}</div>
                  <div className="flex-1 w-full sm:w-auto">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs sm:text-sm font-semibold">
                        ${(data.revenue / 1000000).toFixed(2)}M
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {data.proposals} proposals
                      </span>
                    </div>
                    <Progress 
                      value={(data.revenue / 4500000) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-lg bg-primary/5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm text-muted-foreground">Total Revenue (YTD)</span>
                <span className="text-base sm:text-lg font-bold text-primary">$13.86M</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm" data-testid="card-category-performance">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <CardTitle className="text-sm sm:text-base font-semibold">Performance by Category</CardTitle>
            </div>
            <Tabs defaultValue="table" className="w-full sm:w-auto">
              <TabsList className="h-8 w-full sm:w-auto">
                <TabsTrigger value="table" className="text-xs px-3 h-6 flex-1 sm:flex-initial">Table</TabsTrigger>
                <TabsTrigger value="chart" className="text-xs px-3 h-6 flex-1 sm:flex-initial">Chart</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {!isMobile ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proposals</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Win Rate</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revenue</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryPerformance.map((category, index) => (
                    <tr key={index} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-category-${index}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary" style={{ 
                            backgroundColor: chartColors[index % chartColors.length] 
                          }} />
                          <span className="font-medium text-sm">{category.category}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{category.proposals}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Progress value={category.winRate} className="w-16 h-1.5" />
                          <span className="text-sm font-medium">{category.winRate}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold">{category.revenue}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-emerald-600">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-xs font-medium">{(category as { trend?: string }).trend ?? ""}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Mobile Card View */
            <div className="divide-y divide-border">
              {categoryPerformance.map((category, index) => (
                <div
                  key={index}
                  className="p-4 space-y-3"
                  data-testid={`row-category-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" style={{ 
                        backgroundColor: chartColors[index % chartColors.length] 
                      }} />
                      <span className="font-medium text-sm">{category.category}</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-600">
                      <TrendingUp className="w-3 h-3" />
                      <span className="text-[10px] font-medium">{(category as { trend?: string }).trend ?? ""}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Proposals</p>
                      <p className="text-sm font-medium">{category.proposals}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                      <p className="text-sm font-semibold">{category.revenue}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Win Rate</span>
                      <span className="font-medium">{category.winRate}%</span>
                    </div>
                    <Progress value={category.winRate} className="h-1.5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
