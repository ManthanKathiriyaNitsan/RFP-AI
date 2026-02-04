import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { 
  Search, 
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Copy,
  Download,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  ArrowUpDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  buildExportPayloadFromProposal,
  downloadProposalPdf,
  downloadProposalDocx,
  downloadProposalXlsx,
  downloadProposalJson,
} from "@/lib/export-proposal";
import { fetchAdminOptions } from "@/api/admin-data";

export default function AdminProposals() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedProposals, setSelectedProposals] = useState<number[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [exportDialogProposal, setExportDialogProposal] = useState<any>(null);
  const itemsPerPage = 10;
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();

  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const pageTitles = (optionsData as { pageTitles?: Record<string, string> })?.pageTitles ?? {};
  const proposalsTitle = pageTitles.proposals ?? "Proposals";

  // Fetch real proposals from API (admin sees all proposals); refetch periodically for real-time updates
  const { data: apiProposals = [], isLoading: isLoadingProposals } = useQuery<any[]>({
    queryKey: ["/api/proposals", { userId: user?.id, userRole: user?.role }],
    enabled: !!user?.id,
    refetchInterval: 20000, // Refetch every 20s so list stays in sync
  });

  // Transform API proposals for display
  const allProposals = (apiProposals as any[]).map((p: any) => {
    const owner = p.owner || { name: "Unknown", avatar: "U" };
    const avatarInitials = typeof owner.avatar === 'string' && owner.avatar.length <= 2 
      ? owner.avatar 
      : owner.name 
        ? owner.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : "U";
    
    return {
      id: p.id,
      title: p.title || "Untitled Proposal",
      client: p.clientName || owner.company || "Unknown Client",
      owner: { 
        name: owner.name || "Unknown User", 
        avatar: avatarInitials 
      },
      status: p.status || "draft",
      value: p.budgetRange || "$0",
      dueDate: p.timeline || "Not set",
      progress: 0, // Can be calculated from content/questions if needed
      aiScore: 0, // Can be calculated from content quality if needed
      lastUpdated: p.updatedAt 
        ? new Date(p.updatedAt).toLocaleDateString() 
        : new Date().toLocaleDateString(),
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      questions: 0, // Can be calculated from requirements if needed
      answered: 0, // Can be calculated from requirements if needed
    };
  });

  // Calculate status counts dynamically
  const statusCounts = {
    all: allProposals.length,
    draft: allProposals.filter(p => p.status === 'draft').length,
    in_progress: allProposals.filter(p => p.status === 'in_progress').length,
    review: allProposals.filter(p => p.status === 'review').length,
    won: allProposals.filter(p => p.status === 'won').length,
    lost: allProposals.filter(p => p.status === 'lost').length,
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "won":
        return { 
          label: "Won", 
          icon: CheckCircle, 
          className: "badge-status-won" 
        };
      case "lost":
        return { 
          label: "Lost", 
          icon: XCircle, 
          className: "badge-status-lost" 
        };
      case "in_progress":
        return { 
          label: "In Progress", 
          icon: Clock, 
          className: "badge-status-in-progress" 
        };
      case "review":
        return { 
          label: "Review", 
          icon: AlertCircle, 
          className: "badge-status-review" 
        };
      default:
        return { 
          label: "Draft", 
          icon: FileText, 
          className: "badge-status-draft" 
        };
    }
  };

  const deleteProposalMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/proposals/${id}`);
      // Backend returns 204 No Content; avoid parsing empty body
      if (response.status === 204) return undefined;
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({
        title: "Proposal deleted",
        description: "The proposal has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete proposal.",
        variant: "destructive",
      });
    },
  });

  const filteredProposals = allProposals.filter((proposal: any) => {
    const matchesSearch = proposal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         proposal.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || proposal.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort proposals - by default sort by date (newest first), but allow title sorting
  const sortedProposals = [...filteredProposals].sort((a, b) => {
    // Default: sort by updatedAt/createdAt (newest first)
    const dateA = a.updatedAt?.getTime() || a.createdAt?.getTime() || 0;
    const dateB = b.updatedAt?.getTime() || b.createdAt?.getTime() || 0;
    
    // If user clicks sort button, sort by title instead
    // For now, we'll always sort by date (newest first) since that's what user wants
    // The sortOrder can be used for future title sorting if needed
    return dateB - dateA; // Descending order (newest first)
  });

  // Pagination
  const totalPages = Math.ceil(sortedProposals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProposals = sortedProposals.slice(startIndex, startIndex + itemsPerPage);

  const handleView = (proposalId: number) => {
    navigate(`/admin/proposals/${proposalId}`);
  };

  const handleEdit = (proposalId: number) => {
    navigate(`/admin/proposals/${proposalId}`);
  };

  const handleDuplicate = async (proposalId: number) => {
    try {
      const response = await apiRequest("GET", `/api/proposals/${proposalId}`);
      const orig = await response.json();
      // Build payload matching backend ProposalCreate: title, description, clientName required; timeline or dueDate required
      const payload = {
        title: `${orig.title || "Untitled"} (Copy)`,
        description: orig.description != null && String(orig.description).trim() ? String(orig.description).trim() : "Copy",
        clientName: (orig.clientName || orig.client || "Unknown Client").trim() || "Unknown Client",
        industry: orig.industry ?? null,
        budgetRange: orig.budgetRange ?? null,
        timeline: orig.timeline ?? "Not set",
        dueDate: orig.dueDate ?? null,
        clientContact: orig.clientContact ?? null,
        clientEmail: orig.clientEmail ?? null,
      };
      const duplicateResponse = await apiRequest("POST", "/api/proposals", payload);
      await duplicateResponse.json();
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({
        title: "Proposal duplicated",
        description: "A copy of the proposal has been created.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate proposal.",
        variant: "destructive",
      });
    }
  };

  const handleOpenExport = (proposal: any) => {
    const raw = (apiProposals as any[]).find((p: any) => p.id === proposal.id);
    setExportDialogProposal(raw ?? proposal);
  };

  const exportPayload = exportDialogProposal
    ? buildExportPayloadFromProposal(exportDialogProposal)
    : null;

  const handleExportPdf = () => {
    if (!exportPayload) return;
    downloadProposalPdf(exportPayload);
    toast({ title: "Exported", description: "PDF downloaded." });
    setExportDialogProposal(null);
  };
  const handleExportDocx = async () => {
    if (!exportPayload) return;
    await downloadProposalDocx(exportPayload);
    toast({ title: "Exported", description: "Word document downloaded." });
    setExportDialogProposal(null);
  };
  const handleExportXlsx = () => {
    if (!exportPayload) return;
    downloadProposalXlsx(exportPayload);
    toast({ title: "Exported", description: "Excel spreadsheet downloaded." });
    setExportDialogProposal(null);
  };
  const handleExportJson = () => {
    if (!exportDialogProposal) return;
    downloadProposalJson(exportDialogProposal);
    toast({ title: "Exported", description: "JSON downloaded." });
    setExportDialogProposal(null);
  };

  const handleDelete = async (proposalId: number, proposalTitle: string) => {
    const confirmed = await confirm({
      title: "Delete proposal",
      description: `Are you sure you want to delete "${proposalTitle}"? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (confirmed) {
      deleteProposalMutation.mutate(proposalId);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProposals.length === filteredProposals.length) {
      setSelectedProposals([]);
    } else {
      setSelectedProposals(filteredProposals.map(p => p.id));
    }
  };

  const toggleSelectProposal = (id: number) => {
    if (selectedProposals.includes(id)) {
      setSelectedProposals(selectedProposals.filter(p => p !== id));
    } else {
      setSelectedProposals([...selectedProposals, id]);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmDialog />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-proposals-title">{proposalsTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and track all RFP proposals in one place.</p>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="bg-muted/50 w-max sm:w-auto">
              <TabsTrigger value="all" onClick={() => setStatusFilter("all")} className="data-[state=active]:bg-background text-xs sm:text-sm">
                All <Badge variant="secondary" className="ml-2 text-[10px]">{statusCounts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="in_progress" onClick={() => setStatusFilter("in_progress")} className="data-[state=active]:bg-background text-xs sm:text-sm">
                In Progress <Badge variant="secondary" className="ml-2 text-[10px]">{statusCounts.in_progress}</Badge>
              </TabsTrigger>
              <TabsTrigger value="review" onClick={() => setStatusFilter("review")} className="data-[state=active]:bg-background text-xs sm:text-sm">
                Review <Badge variant="secondary" className="ml-2 text-[10px]">{statusCounts.review}</Badge>
              </TabsTrigger>
              <TabsTrigger value="won" onClick={() => setStatusFilter("won")} className="data-[state=active]:bg-background text-xs sm:text-sm">
                Won <Badge variant="secondary" className="ml-2 text-[10px]">{statusCounts.won}</Badge>
              </TabsTrigger>
              <TabsTrigger value="lost" onClick={() => setStatusFilter("lost")} className="data-[state=active]:bg-background text-xs sm:text-sm">
                Lost <Badge variant="secondary" className="ml-2 text-[10px]">{statusCounts.lost}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="relative flex-1 min-w-0 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search proposals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full sm:w-64"
                data-testid="input-search"
              />
            </div>
          </div>
        </div>

            {isLoadingProposals ? (
              <Card className="border shadow-sm">
                <CardContent className="p-8">
                  <div className="flex items-center justify-center">
                    <div className="text-muted-foreground">Loading proposals...</div>
                  </div>
                </CardContent>
              </Card>
            ) : allProposals.length === 0 ? (
              <Card className="border shadow-sm">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center justify-center text-center">
                    <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No proposals found</h3>
                    <p className="text-muted-foreground">Customer-created proposals will appear here. You can view, edit, and delete any proposal.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
            <Card className="border shadow-sm">
          <CardContent className="p-0">
            {/* Desktop Table View */}
            {!isMobile ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-3 px-4 w-12">
                        <Checkbox 
                          checked={selectedProposals.length === filteredProposals.length && filteredProposals.length > 0}
                          onCheckedChange={toggleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </th>
                      <th className="text-left py-3 px-4">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs font-semibold text-muted-foreground uppercase tracking-wider -ml-3 h-auto py-1"
                          onClick={() => {
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                            toast({
                              title: "Sorting",
                              description: `Sorted proposals ${sortOrder === "asc" ? "descending" : "ascending"}`,
                            });
                          }}
                        >
                          Proposal <ArrowUpDown className="w-3 h-3 ml-1" />
                        </Button>
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Owner</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Score</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Due Date</th>
                      <th className="text-right py-3 px-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProposals.map((proposal) => {
                      const statusConfig = getStatusConfig(proposal.status);
                      const StatusIcon = statusConfig.icon;
                      return (
                        <tr 
                          key={proposal.id} 
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                          data-testid={`row-proposal-${proposal.id}`}
                        >
                          <td className="py-3 px-4">
                            <Checkbox 
                              checked={selectedProposals.includes(proposal.id)}
                              onCheckedChange={() => toggleSelectProposal(proposal.id)}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-sm">{proposal.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{proposal.client}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8 shrink-0 rounded-full border border-border">
                                <AvatarFallback className="rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                                  {proposal.owner.avatar}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{proposal.owner.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={`${statusConfig.className} text-[10px] font-medium`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-24">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">{proposal.answered}/{proposal.questions}</span>
                                <span className="font-medium">{proposal.progress}%</span>
                              </div>
                              <Progress value={proposal.progress} className="h-1.5" />
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              proposal.aiScore >= 85 ? 'ai-score-high' :
                              proposal.aiScore >= 70 ? 'ai-score-medium' :
                              'ai-score-low'
                            }`}>
                              {proposal.aiScore}%
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm font-semibold">{proposal.value}</td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-sm">{proposal.dueDate}</p>
                              <p className="text-[10px] text-muted-foreground">{proposal.lastUpdated}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleView(proposal.id)}>
                                  <Eye className="w-4 h-4 mr-2" /> View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(proposal.id)}>
                                  <Edit className="w-4 h-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(proposal.id)}>
                                  <Copy className="w-4 h-4 mr-2" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenExport(proposal)}>
                                  <Download className="w-4 h-4 mr-2" /> Export
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleDelete(proposal.id, proposal.title)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Mobile Card View */
              <div className="divide-y divide-border">
                {paginatedProposals.map((proposal) => {
                  const statusConfig = getStatusConfig(proposal.status);
                  const StatusIcon = statusConfig.icon;
                  return (
                    <div 
                      key={proposal.id} 
                      className="p-4 space-y-3 hover:bg-muted/30 transition-colors"
                      data-testid={`row-proposal-${proposal.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Checkbox 
                            checked={selectedProposals.includes(proposal.id)}
                            onCheckedChange={() => toggleSelectProposal(proposal.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{proposal.title}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{proposal.client}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(proposal.id)}>
                              <Eye className="w-4 h-4 mr-2" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(proposal.id)}>
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(proposal.id)}>
                              <Copy className="w-4 h-4 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenExport(proposal)}>
                              <Download className="w-4 h-4 mr-2" /> Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDelete(proposal.id, proposal.title)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Avatar className="h-7 w-7 shrink-0 rounded-full border border-border">
                            <AvatarFallback className="rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                              {proposal.owner.avatar}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground truncate">{proposal.owner.name}</span>
                        </div>
                        <Badge variant="outline" className={`${statusConfig.className} text-[10px] font-medium shrink-0`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium shrink-0 ${
                          proposal.aiScore >= 85 ? 'ai-score-high' :
                          proposal.aiScore >= 70 ? 'ai-score-medium' :
                          'ai-score-low'
                        }`}>
                          AI: {proposal.aiScore}%
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium break-words">{proposal.answered}/{proposal.questions} questions • {proposal.progress}%</span>
                        </div>
                        <Progress value={proposal.progress} className="h-1.5 w-full" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs pt-2 border-t border-border/50">
                        <div className="min-w-0">
                          <p className="text-muted-foreground mb-0.5">Value</p>
                          <p className="font-semibold truncate">{proposal.value}</p>
                        </div>
                        <div className="min-w-0 text-right">
                          <p className="text-muted-foreground mb-0.5">Due Date</p>
                          <p className="font-medium truncate">{proposal.dueDate}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border">
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Showing {sortedProposals.length > 0 ? `${startIndex + 1}-${Math.min(startIndex + itemsPerPage, sortedProposals.length)}` : '0'} of {sortedProposals.length} proposals
              </p>
              <div className={`flex items-center gap-2 ${currentPage > 1 && sortedProposals.length > 0 ? 'justify-between' : 'justify-end'}`}>
                {currentPage > 1 && sortedProposals.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setCurrentPage(prev => Math.max(1, prev - 1));
                    }}
                  >
                    Previous
                  </Button>
                )}
                <span className="text-sm text-muted-foreground px-2">
                  Page {currentPage} of {totalPages || 1}
                </span>
                {currentPage < totalPages && sortedProposals.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setCurrentPage(prev => Math.min(totalPages, prev + 1));
                    }}
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
            )}
        </Tabs>

      {/* Export format dialog */}
      <Dialog open={!!exportDialogProposal} onOpenChange={(open) => !open && setExportDialogProposal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export proposal</DialogTitle>
            <DialogDescription>
              Choose a format to download
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Button variant="outline" className="w-full justify-start" onClick={handleExportPdf} disabled={!exportPayload}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={handleExportDocx} disabled={!exportPayload}>
              <FileText className="w-4 h-4 mr-2" /> Word (.docx)
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={handleExportXlsx} disabled={!exportPayload}>
              <FileText className="w-4 h-4 mr-2" /> Excel (.xlsx)
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={handleExportJson} disabled={!exportDialogProposal}>
              <FileText className="w-4 h-4 mr-2" /> JSON
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogProposal(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
