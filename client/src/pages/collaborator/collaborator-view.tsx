import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, FileText, Calendar, DollarSign, Edit, Eye, LayoutGrid, List, LayoutDashboard, MessageSquare, CheckCircle, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataTablePagination } from "@/components/shared/data-table-pagination";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMyCollaborations } from "@/hooks/use-proposals-api";
import { useAuth } from "@/hooks/use-auth";
import { fetchCollaboratorOptions, collaboratorOptionsFallback } from "@/api/collaborator-data";
import { toSoftBadgeClass, softBadgeClasses } from "@/lib/badge-classes";
import type { MyCollaborationItem } from "@/api/proposals";

type LayoutMode = "card" | "list" | "grid";

export default function CollaboratorView() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [layout, setLayout] = useState<LayoutMode>("list");
  const isMobile = useIsMobile();

  const { data: optionsData } = useQuery({
    queryKey: ["collaborator", "options"],
    queryFn: fetchCollaboratorOptions,
  });
  const options = optionsData ?? collaboratorOptionsFallback;
  const pageTitle = (options as { pageTitle?: string }).pageTitle ?? (collaboratorOptionsFallback as { pageTitle?: string }).pageTitle ?? "Assigned RFPs";
  const pageDescription = (options as { pageDescription?: string }).pageDescription ?? (collaboratorOptionsFallback as { pageDescription?: string }).pageDescription ?? "Proposals shared with you – view, edit, and collaborate based on your permissions";
  const statusFilterOptions = options.statusFilterOptions ?? collaboratorOptionsFallback.statusFilterOptions;
  const defaultStatusFilter = options.defaultStatusFilter ?? collaboratorOptionsFallback.defaultStatusFilter;
  const [statusFilter, setStatusFilter] = useState<string>(defaultStatusFilter);
  const [collabViewPage, setCollabViewPage] = useState(1);
  const [collabViewPageSize, setCollabViewPageSize] = useState(10);
  const statusDisplay = options.statusDisplay ?? collaboratorOptionsFallback.statusDisplay;
  const roleDisplay = options.roleDisplay ?? collaboratorOptionsFallback.roleDisplay;
  const permissionLabelsMap = options.permissionLabels ?? collaboratorOptionsFallback.permissionLabels;

  const { data: myCollaborations, isLoading, isError, error } = useMyCollaborations(user?.id);
  const list = Array.isArray(myCollaborations) ? myCollaborations : [];

  const filteredCollaborations = list.filter((item: MyCollaborationItem) => {
    const proposal = item.proposal;
    const matchesSearch =
      !searchTerm || (proposal?.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || (proposal?.status || "draft") === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const paginatedCollaborations = filteredCollaborations.slice(
    (collabViewPage - 1) * collabViewPageSize,
    collabViewPage * collabViewPageSize
  );
  useEffect(() => {
    setCollabViewPage(1);
  }, [searchTerm, statusFilter]);

  const getStatusColor = (status: string) => {
    const config = statusDisplay[status as keyof typeof statusDisplay] ?? statusDisplay.default;
    return toSoftBadgeClass(config?.className) ?? softBadgeClasses.archived;
  };

  const getStatusLabel = (status: string) => {
    const config = statusDisplay[status as keyof typeof statusDisplay] ?? statusDisplay.default;
    return config?.label ?? status.replace("_", " ");
  };

  const formatTimeAgo = (date: string | Date) => {
    const now = new Date();
    const past = new Date(date);
    const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "Less than an hour ago";
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  };

  const roleLabel = (role: string) => {
    const r = (role || "").toLowerCase();
    return (roleDisplay as Record<string, string>)[r] ?? roleDisplay.viewer ?? "Viewer";
  };

  const permissionLabels = (c: MyCollaborationItem["collaboration"]) => {
    const perms: string[] = [];
    const labels = permissionLabelsMap as Record<string, string>;
    if (c.canView && labels.canView) perms.push(labels.canView);
    if (c.canEdit && labels.canEdit) perms.push(labels.canEdit);
    if (c.canComment && labels.canComment) perms.push(labels.canComment);
    if (c.canReview && labels.canReview) perms.push(labels.canReview);
    if (c.canGenerateAi && labels.canGenerateAi) perms.push(labels.canGenerateAi);
    return perms.length ? perms.join(", ") : (roleLabel(c.role) ?? c.role);
  };

  /** Primary action label + icon by role so the panel reflects all five roles, not just View/Edit. */
  const getActionForCollaboration = (c: MyCollaborationItem["collaboration"]): { label: string; icon: LucideIcon } => {
    const r = (c.role || "").toLowerCase();
    if (r === "contributor") return { label: "Full access", icon: Sparkles };
    if (r === "reviewer") return { label: "Review", icon: CheckCircle };
    if (r === "editor") return { label: "Edit", icon: Edit };
    if (r === "commenter") return { label: "View & comment", icon: MessageSquare };
    return { label: "View only", icon: Eye };
  };

  const openProposal = (item: MyCollaborationItem) => {
    const { proposal, collaboration } = item;
    if (proposal?.id) {
      navigate(`/collaborator/rfp/${proposal.id}`);
      const { label } = getActionForCollaboration(collaboration);
      toast({
        title: `Opening — ${label.toLowerCase()}`,
        description: proposal?.title || "proposal",
      });
    } else {
      toast({ title: "Error", description: "Proposal not found", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{pageTitle}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {pageDescription}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-base sm:text-lg">Your Collaborations</CardTitle>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="search-box flex-1 sm:flex-initial min-w-[140px] w-full sm:w-64">
                <Search className="search-box-icon" />
                <Input
                  placeholder="Search proposals..."
                  className="text-sm sm:text-base"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-40 text-sm sm:text-base">
                  <SelectValue placeholder={statusFilterOptions[0]?.label} />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterOptions.map((opt: { value: string; label: string }) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ToggleGroup
                type="single"
                value={layout}
                onValueChange={(v) => v && setLayout(v as LayoutMode)}
                className="border rounded-md p-0.5 bg-muted/30"
              >
                <ToggleGroupItem value="card" aria-label="Card layout" className="px-2.5 py-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  <LayoutDashboard className="w-4 h-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List layout" className="px-2.5 py-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  <List className="w-4 h-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" aria-label="Grid layout" className="px-2.5 py-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  <LayoutGrid className="w-4 h-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-0">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : isError ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-destructive font-medium">Failed to load collaborations.</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {error instanceof Error ? error.message : "Request failed."}
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                If you see &quot;Insufficient permissions&quot;, your account must have the <strong>Collaborator</strong> role. If you see a database error, run the backend migration: <code className="text-xs bg-muted px-1 rounded">python scripts/migrate_collaboration_permissions.py</code>
              </p>
            </div>
          ) : filteredCollaborations.length === 0 ? (
            <div className="text-center py-6 sm:py-8">
              <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
              <h3 className="text-base sm:text-lg font-semibold mb-2">No collaborations yet</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                You haven&apos;t been assigned to any proposals yet. Ask a customer to invite you by email.
              </p>
            </div>
          ) : layout === "card" ? (
            <div className="space-y-3 sm:space-y-4">
              {paginatedCollaborations.map((item: MyCollaborationItem) => {
                const { proposal, collaboration } = item;
                return (
                  <Card key={`${proposal.id}-${collaboration.id}`} className="proposal-card overflow-hidden">
                    <CardContent className="p-4 sm:p-6">
                      <div
                        className={`flex ${isMobile ? "flex-col" : "items-start justify-between"} gap-4 mb-3 sm:mb-4`}
                      >
                        <div
                          className={`flex items-start ${isMobile ? "w-full" : "space-x-4"} min-w-0 flex-1`}
                        >
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold mb-1 truncate">
                              {proposal?.title || "Untitled Proposal"}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                              Assigned to you • Updated {formatTimeAgo(proposal?.updatedAt || new Date())}
                            </p>
                            <div
                              className={`flex ${isMobile ? "flex-col" : "items-center flex-wrap"} gap-2 sm:gap-4`}
                            >
                              <Badge variant="outline" className={`${getStatusColor(proposal?.status || "draft")} text-[10px] sm:text-xs shrink-0`}>
                                {getStatusLabel(proposal?.status || "draft")}
                              </Badge>
                              <Badge variant="outline" className={`${softBadgeClasses.primary} text-[10px] sm:text-xs shrink-0 capitalize`}>
                                {roleLabel(collaboration.role)}
                              </Badge>
                              <span className="text-xs sm:text-sm text-muted-foreground">
                                {permissionLabels(collaboration)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button className="text-xs sm:text-sm shrink-0 theme-gradient-bg text-white border-0 hover:opacity-95" onClick={() => openProposal(item)}>
                          {(() => {
                            const { label, icon: Icon } = getActionForCollaboration(collaboration);
                            return <><Icon className="w-4 h-4 mr-2" />{label}</>;
                          })()}
                        </Button>
                      </div>
                      <div
                        className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-3"} gap-3 sm:gap-4 text-xs sm:text-sm`}
                      >
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Budget:</span>
                          <span className="font-medium">{proposal?.budgetRange || "Not specified"}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Timeline:</span>
                          <span className="font-medium">{proposal?.timeline || "Not specified"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last edited: </span>
                          <span className="font-medium">{formatTimeAgo(proposal?.updatedAt || new Date())}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : layout === "list" ? (
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-4 py-3 text-xs font-medium text-muted-foreground border-b bg-muted/30">
                <div className="sm:col-span-4">Proposal</div>
                <div className="sm:col-span-2">Status</div>
                <div className="sm:col-span-2 hidden sm:block">Role</div>
                <div className="sm:col-span-2 hidden sm:block">Budget</div>
                <div className="sm:col-span-1 hidden sm:block">Updated</div>
                <div className="sm:col-span-1 text-right">Action</div>
              </div>
              {paginatedCollaborations.map((item: MyCollaborationItem) => {
                const { proposal, collaboration } = item;
                return (
                  <div
                    key={`${proposal.id}-${collaboration.id}`}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-4 py-3 items-center border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                  >
                    <div className="sm:col-span-4 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate text-sm">{proposal?.title || "Untitled Proposal"}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {roleLabel(collaboration.role)} • {proposal?.budgetRange || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Badge variant="outline" className={`${getStatusColor(proposal?.status || "draft")} text-[10px]`}>
                        {getStatusLabel(proposal?.status || "draft")}
                      </Badge>
                    </div>
                    <div className="sm:col-span-2 hidden sm:block text-sm capitalize">{roleLabel(collaboration.role)}</div>
                    <div className="sm:col-span-2 hidden sm:block text-sm truncate">{proposal?.budgetRange || "—"}</div>
                    <div className="sm:col-span-1 hidden sm:block text-xs text-muted-foreground">
                      {formatTimeAgo(proposal?.updatedAt || new Date())}
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <Button size="sm" className="h-8 theme-gradient-bg text-white border-0 hover:opacity-95" onClick={() => openProposal(item)}>
                        {(() => {
                          const { label, icon: Icon } = getActionForCollaboration(collaboration);
                          return <><Icon className="w-4 h-4 mr-1.5" />{label}</>;
                        })()}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedCollaborations.map((item: MyCollaborationItem) => {
                const { proposal, collaboration } = item;
                return (
                  <Card
                    key={`${proposal.id}-${collaboration.id}`}
                    className="group overflow-hidden transition-all hover:shadow-md hover:border-primary/20"
                  >
                    <CardContent className="p-4 flex flex-col h-full">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">
                            {proposal?.title || "Untitled Proposal"}
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline" className={`${getStatusColor(proposal?.status || "draft")} text-[10px]`}>
                              {getStatusLabel(proposal?.status || "draft")}
                            </Badge>
                            <Badge variant="outline" className={`${softBadgeClasses.primary} text-[10px] capitalize`}>
                              {roleLabel(collaboration.role)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{proposal?.budgetRange || "Not specified"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{proposal?.timeline || "Not specified"}</span>
                        </div>
                        <p>{formatTimeAgo(proposal?.updatedAt || new Date())}</p>
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-auto theme-gradient-bg text-white border-0 hover:opacity-95"
                        onClick={() => openProposal(item)}
                      >
                        {(() => {
                          const { label, icon: Icon } = getActionForCollaboration(collaboration);
                          return <><Icon className="w-3.5 h-3.5 mr-2" />{label}</>;
                        })()}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {filteredCollaborations.length > 0 && (
            <DataTablePagination
              totalItems={filteredCollaborations.length}
              page={collabViewPage}
              pageSize={collabViewPageSize}
              onPageChange={setCollabViewPage}
              onPageSizeChange={setCollabViewPageSize}
              itemLabel="proposals"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
