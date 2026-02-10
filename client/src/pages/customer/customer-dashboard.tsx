import { Plus, Coins, FileText, CheckCircle, Users, ArrowRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { fetchCustomerDashboard } from "@/api/customer-data";
import { Link, useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { getProposalStatusBadgeClass } from "@/lib/badge-classes";

function completionFromStatus(status: string): number {
  if (status === "completed" || status === "won" || status === "lost") return 100;
  if (status === "draft") return 25;
  return 65;
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["customer", "dashboard"],
    queryFn: fetchCustomerDashboard,
  });

  if (isError) {
    return (
      <div className="p-4 sm:p-6">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  const stats = dashboard?.stats ?? {
    activeProposals: 0,
    completedProposals: 0,
    collaborators: 0,
  };
  const credits = dashboard?.credits ?? user?.credits ?? 0;
  const usedThisMonth = dashboard?.usedThisMonth ?? 0;
  const allocationPercentage = dashboard?.allocationPercentage ?? 0;
  const upcomingDeadlines = dashboard?.upcomingDeadlines ?? [];
  const recentProposals = dashboard?.recentProposals ?? [];
  const averageCompletion = dashboard?.averageCompletion ?? 0;

  const getStatusBadgeClass = (status: string) => getProposalStatusBadgeClass(status);
  const getStatusLabel = (status: string) => {
    if (status === "in_progress") return "In Progress";
    return status.replace("_", " ");
  };

  const formatTimeAgo = (date: string | null) => {
    if (!date) return "Recently";
    const now = new Date();
    const past = new Date(date);
    const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "Less than an hour ago";
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="space-y-4 sm:space-y-8 w-full max-w-4xl">
          <div className="animate-pulse">
            <div className="h-6 sm:h-8 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-3 sm:h-4 bg-muted rounded w-1/2"></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 sm:h-32 bg-muted rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">
            Welcome back, {user?.firstName}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your RFP proposals and track your progress
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 md:gap-8">
        <Card className="stat-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-light rounded-lg flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <Link href="/credits">
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  Top Up
                </Button>
              </Link>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-1">{credits.toLocaleString()}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Available Credits</p>
            {(usedThisMonth > 0 || allocationPercentage > 0) && (
              <p className="text-xs text-muted-foreground mt-2">
                Used this month: {usedThisMonth.toLocaleString()} ({allocationPercentage}% of allocation)
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-light rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 icon-green" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-1">{stats.activeProposals}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Active Proposals</p>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-1">{stats.completedProposals}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-light rounded-lg flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 icon-orange" />
              </div>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-1">{stats.collaborators}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground">Collaborators</p>
          </CardContent>
        </Card>
      </div>

      {/* Completion & Deadlines Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              Overall Completion
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Average Progress</span>
                  <span className="font-semibold">{averageCompletion}%</span>
                </div>
                <Progress value={averageCompletion} className="h-2" />
              </div>
              {recentProposals.length > 0 && (
                <div className="space-y-3">
                  {recentProposals.slice(0, 3).map((proposal) => {
                    const completion = completionFromStatus(proposal.status);
                    return (
                      <div key={proposal.id}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="truncate flex-1">{proposal.title}</span>
                          <span className="ml-2 font-medium shrink-0">{completion}%</span>
                        </div>
                        <Progress value={completion} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming deadlines</p>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((deadline) => {
                  const deadlineDate = new Date(deadline.date);
                  const daysUntil = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isUrgent = daysUntil <= 7;
                  return (
                    <div key={deadline.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{deadline.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {deadlineDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <Badge variant={isUrgent ? "destructive" : "outline"} className="shrink-0">
                        {daysUntil === 0 ? "Today" : `${daysUntil}d left`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Proposals */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-base sm:text-lg">Recent Proposals</CardTitle>
            <Link href="/proposals/new" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto text-xs sm:text-sm theme-gradient-bg text-white border-0 hover:opacity-95">
                <Plus className="w-4 h-4 mr-2" />
                New Proposal
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          {recentProposals.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No proposals yet</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                Create your first RFP to get started
              </p>
              <Link href="/proposals/new">
                <Button className="text-xs sm:text-sm theme-gradient-bg text-white border-0 hover:opacity-95">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Proposal
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {recentProposals.map((proposal) => (
                <div key={proposal.id} className="proposal-card">
                  <div className={`flex ${isMobile ? "flex-col" : "items-center justify-between"} gap-3 sm:gap-4`}>
                    <div className={`flex items-center ${isMobile ? "w-full" : "space-x-4"} min-w-0 flex-1`}>
                      <div className="w-10 h-10 bg-blue-light rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm sm:text-base truncate">{proposal.title}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Updated {formatTimeAgo(proposal.updatedAt ?? proposal.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center ${isMobile ? "justify-between w-full" : "space-x-4"} shrink-0`}>
                      <Badge
                        variant="outline"
                        className={`${getStatusBadgeClass(proposal.status)} text-[10px] sm:text-xs shrink-0 border`}
                      >
                        {getStatusLabel(proposal.status)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 sm:h-10 sm:w-10"
                        onClick={() => navigate(`/rfp/${proposal.id}`)}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Action Button */}
      <Link href="/proposals/new">
        <Button className="floating-button fixed bottom-4 right-4 sm:bottom-8 sm:right-8 w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 z-50">
          <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
        </Button>
      </Link>
    </div>
  );
}
