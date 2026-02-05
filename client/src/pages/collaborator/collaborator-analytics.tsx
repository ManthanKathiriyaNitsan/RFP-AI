import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  MessageSquare,
  Edit,
  CheckCircle,
  BarChart3,
  Download,
  Calendar,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { fetchCollaboratorAnalytics } from "@/api/collaborator-data";

const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  MessageSquare,
  Edit,
  CheckCircle,
};

type KpiItem = { label: string; value: number; change: string; icon: string };
type KpiItemWithIcon = Omit<KpiItem, "icon"> & { icon: LucideIcon };
type WeekItem = { week: string; comments: number; edits: number; reviews: number };
type StatusItem = { status: string; count: number };

export default function CollaboratorAnalytics() {
  const [dateRange, setDateRange] = useState("30days");
  const { toast } = useToast();

  const { data, isError, error, refetch } = useQuery({
    queryKey: ["collaborator", "analytics", dateRange],
    queryFn: () => fetchCollaboratorAnalytics(dateRange),
  });

  const pageTitle = data?.pageTitle ?? "";
  const pageDescription = data?.pageDescription ?? "";
  const dateRanges = data?.dateRanges ?? [];
  const kpiMetrics = (data?.kpiMetrics ?? []).map((k: KpiItem) => ({
    ...k,
    icon: ICON_MAP[k.icon] ?? FileText,
  }));
  const activityByWeek = data?.activityByWeek ?? [];
  const proposalsByStatus = data?.proposalsByStatus ?? [];

  const maxActivity = Math.max(...activityByWeek.map((w: WeekItem) => w.comments + w.edits + w.reviews), 1);

  useEffect(() => {
    if (dateRanges.length > 0 && !dateRanges.some((o: { value: string }) => o.value === dateRange)) {
      setDateRange(dateRanges[0].value);
    }
  }, [dateRanges, dateRange]);

  if (isError) {
    return (
      <div className="p-4">
        <p className="text-destructive">{error instanceof Error ? error.message : "Failed to load analytics."}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">{pageDescription}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full sm:w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map((opt: { value: string; label: string }) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const payload = { dateRange, kpiMetrics: data?.kpiMetrics, activityByWeek, proposalsByStatus };
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `collaborator-analytics-${new Date().toISOString().split("T")[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast({ title: "Exported", description: "Analytics data exported." });
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpiMetrics.map((metric: KpiItemWithIcon, index: number) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <metric.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs font-medium text-green-600 flex items-center gap-0.5">
                  <ArrowUpRight className="w-3 h-3" /> {metric.change}
                </span>
              </div>
              <p className="text-xl font-bold">{metric.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Activity by week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityByWeek.map((week: WeekItem, i: number) => {
                const total = week.comments + week.edits + week.reviews;
                const pct = maxActivity ? (total / maxActivity) * 100 : 0;
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="font-medium">{week.week}</span>
                      <span className="text-muted-foreground">{week.comments} comments · {week.edits} edits · {week.reviews} reviews</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Proposals by status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {proposalsByStatus.map((item: StatusItem, i: number) => {
                const total = proposalsByStatus.reduce((s: number, x: StatusItem) => s + x.count, 0);
                const pct = total ? (item.count / total) * 100 : 0;
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{item.status}</span>
                    <div className="flex items-center gap-2 flex-1 max-w-[180px]">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className="text-sm font-semibold w-6">{item.count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
