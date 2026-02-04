import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchAdminUsage, fetchAdminOptions } from "@/api/admin-data";
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
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const USAGE_ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  Activity,
  Target,
  Clock,
};
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminUsage() {
  const [dateRange, setDateRange] = useState("7days");
  const { data } = useQuery({
    queryKey: ["admin", "usage", dateRange],
    queryFn: () => fetchAdminUsage({ dateRange }),
  });
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const dailyUsage = data?.dailyUsage ?? [];
  const featureUsage = data?.featureUsage ?? [];
  const topUsers = data?.topUsers ?? [];
  const hourlyPeaks = data?.hourlyPeaks ?? [];
  type SummaryCard = { label: string; value: string; trend: string; trendUp: boolean; icon?: string; iconColor?: string; bgColor?: string };
  const summaryCards: SummaryCard[] = (data as { summaryCards?: SummaryCard[] })?.summaryCards ?? [];
  const dateRangesUsage = optionsData?.dateRangesUsage ?? [];
  const pageTitles = (optionsData as { pageTitles?: Record<string, string> })?.pageTitles ?? {};
  const usageTitle = pageTitles.usage ?? "Usage Analytics";
  const { toast } = useToast();
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-usage-title">{usageTitle}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Monitor AI usage patterns and optimize resource allocation.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
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
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 sm:flex-initial text-xs sm:text-sm"
            data-testid="button-export"
            onClick={() => {
              const usageData = { dateRange, dailyUsage };
              const dataStr = JSON.stringify(usageData, null, 2);
              const dataBlob = new Blob([dataStr], { type: "application/json" });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `usage_analytics_${new Date().toISOString().split('T')[0]}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              toast({
                title: "Exported",
                description: "Usage analytics has been exported.",
              });
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
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
                <div key={index} className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2 sm:gap-4`}>
                  <span className="w-10 text-xs sm:text-sm font-medium text-muted-foreground shrink-0">{data.day}</span>
                  <div className="flex-1 min-w-0">
                    <div className="h-5 sm:h-6 bg-muted rounded-lg overflow-hidden relative">
                      <div 
                        className="h-full theme-gradient-fill rounded-lg transition-all opacity-90"
                        style={{ width: `${(data.credits / 2000) * 100}%` }}
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
                  <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-2`}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              <CardTitle className="text-sm sm:text-base">Top Users by Efficiency</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">Credits used per proposal won</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-2 sm:space-y-3 mt-2">
              {topUsers.map((user, index) => (
                <div key={index} className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2 sm:gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors`} data-testid={`row-user-${index}`}>
                  <div className={`flex items-center gap-2 sm:gap-3 ${isMobile ? '' : 'flex-1 min-w-0'}`}>
                    <div className="relative shrink-0">
                      <Avatar className="w-8 h-8 sm:w-9 sm:h-9">
                        <AvatarFallback className="theme-gradient-bg text-white text-[10px] sm:text-xs font-semibold">
                          {user.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-background flex items-center justify-center">
                        <span className="text-[8px] font-bold text-primary">#{index + 1}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium truncate">{user.name}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{user.proposals} proposals • {user.credits} credits</p>
                    </div>
                  </div>
                  <div className={`text-right ${isMobile ? 'self-end' : ''}`}>
                    <p className={`text-xs sm:text-sm font-bold ${user.efficiency > 100 ? 'text-emerald dark:text-emerald' : 'text-amber dark:text-amber'}`}>
                      {user.efficiency}
                    </p>
                    <p className="text-[10px] text-muted-foreground">efficiency score</p>
                  </div>
                </div>
              ))}
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
            <div className="mt-3 sm:mt-4 p-2 sm:p-3 rounded-lg bg-primary/5">
              <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-2`}>
                <span className="text-xs sm:text-sm">Peak Usage Time</span>
                <Badge className="bg-primary text-white text-[10px] sm:text-xs">3:00 PM - 4:00 PM</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
