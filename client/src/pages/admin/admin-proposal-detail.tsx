import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { apiRequest } from "@/lib/queryClient";
import {
  useCollaborations,
  useProposalsList,
  useDeleteCollaboration,
  useSearchUsers,
  proposalKeys,
} from "@/hooks/use-proposals-api";
import { addCollaboration, updateCollaboration, deleteCollaboration, fetchCollaborations, fetchProposalFiles, fetchProposalFileBlob, type ProposalFileApi } from "@/api/proposals";
import { syncProposalFilesToContentLibrary } from "@/api/admin-data";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { 
  ArrowLeft, 
  Edit, 
  Save, 
  Trash2,
  Download,
  Share2,
  Copy,
  FileText,
  Calendar,
  DollarSign,
  Building2,
  User,
  UserPlus,
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Send,
  Sparkles,
  Coins,
  FileEdit,
  MessageSquare,
  MoreHorizontal,
  ListTodo,
  FolderPlus,
  UserCog,
  UserX,
  Paperclip,
  FileDown,
  Library,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";
import {
  buildExportPayload,
  downloadProposalPdf,
  downloadProposalDocx,
  downloadProposalXlsx,
  downloadProposalJson,
} from "@/lib/export-proposal";
import { fetchAdminOptions, fetchAdminUsersListForAssignees } from "@/api/admin-data";
import type { CollaboratorPermissions } from "@/api/customer-data";
import { ProposalDiscussionTab } from "@/components/customer/proposal-discussion";
import { ProposalQuillEditor } from "@/components/editor/ProposalQuillEditor";
import { createNotification } from "@/api/notifications";
import { getLowCreditsToastOptions, LOW_CREDIT_WARNING_THRESHOLD, showCreditAlertBrowserNotification } from "@/lib/utils";

const COLLABORATOR_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  viewer: Eye,
  editor: FileEdit,
  reviewer: CheckCircle,
};
const PERMISSION_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  canView: Eye,
  canEdit: FileEdit,
  canComment: MessageSquare,
  canReview: CheckCircle,
  canGenerateAi: Sparkles,
};

function SyncToContentLibraryButton({ proposalId, onSuccess }: { proposalId: number; onSuccess: () => void }) {
  const { toast } = useToast();
  const syncMutation = useMutation({
    mutationFn: () => syncProposalFilesToContentLibrary(proposalId),
    onSuccess: (data) => {
      onSuccess();
      toast({
        title: "Synced to Content Library",
        description: data.synced === 0
          ? "All documents were already in the Content Library."
          : `${data.synced} document(s) added to Content Library. They will appear in Knowledge Base.`,
      });
    },
    onError: (e: Error) => {
      toast({ title: "Sync failed", description: e.message ?? "Could not sync to Content Library.", variant: "destructive" });
    },
  });
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 gap-2"
      onClick={() => syncMutation.mutate()}
      disabled={syncMutation.isPending}
    >
      <Library className="w-4 h-4" />
      {syncMutation.isPending ? "Syncing…" : "Sync to Content Library"}
    </Button>
  );
}

export default function AdminProposalDetail() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const proposalStatuses = optionsData?.proposalStatuses ?? [];
  const collaboratorRoles = optionsData?.collaboratorRoles ?? [];
  const collaboratorRolePermissions = (optionsData as { collaboratorRolePermissions?: Record<string, CollaboratorPermissions> })?.collaboratorRolePermissions ?? {};
  const collaboratorPermissions = (optionsData as { collaboratorPermissions?: { key: string; label: string }[] })?.collaboratorPermissions ?? [];
  const pageTitles = (optionsData as { pageTitles?: Record<string, string> })?.pageTitles ?? {};
  const backToProposalsLabel = pageTitles.backToProposals ?? "Back to Proposals";
  const getPermissionsForRole = (role: string): CollaboratorPermissions =>
    collaboratorRolePermissions[(role || "viewer").toLowerCase()] ?? { canView: true, canEdit: false, canComment: false, canReview: false, canGenerateAi: false };
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [oldContent, setOldContent] = useState<any>(null);
  const [newContent, setNewContent] = useState<any>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [lastGenerationCreditsUsed, setLastGenerationCreditsUsed] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const defaultInviteRole = collaboratorRoles[0]?.value ?? "viewer";
  const [inviteRole, setInviteRole] = useState(defaultInviteRole);
  const [selectedInviteUser, setSelectedInviteUser] = useState<{ id: number; email: string; firstName: string; lastName: string } | null>(null);
  const [invitePermissions, setInvitePermissions] = useState<CollaboratorPermissions>(() => getPermissionsForRole(defaultInviteRole));
  const [inviteProjects, setInviteProjects] = useState<number[]>([]);
  const [isEditCollaboratorOpen, setIsEditCollaboratorOpen] = useState(false);
  const [editCollaboratorRow, setEditCollaboratorRow] = useState<{ c: { id: number; userId: number; role: string; user?: { id: number; email: string; firstName: string; lastName: string } }; proposalTitle: string } | null>(null);
  const [editCollaboratorRole, setEditCollaboratorRole] = useState("viewer");
  const [isAssignMoreOpen, setIsAssignMoreOpen] = useState(false);
  const [assignMoreRow, setAssignMoreRow] = useState<{ c: { id: number; userId: number; role: string; user?: { id: number; email: string; firstName: string; lastName: string } }; proposalTitle: string } | null>(null);
  const [assignMoreProposalIds, setAssignMoreProposalIds] = useState<number[]>([]);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [tasksRow, setTasksRow] = useState<{ c: { id: number; userId: number; role: string; user?: { id: number; email: string; firstName: string; lastName: string } }; proposalTitle: string } | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignAddUserId, setAssignAddUserId] = useState<string>("");
  const { confirm, ConfirmDialog } = useConfirm();

  // Extract proposal ID from URL
  const proposalId = location.split('/').pop();
  const id = proposalId ? parseInt(proposalId) : null;

  const { data: proposalFilesData = [] } = useQuery({
    queryKey: [...proposalKeys.detail(id ?? 0), "files"],
    queryFn: () => fetchProposalFiles(id!),
    enabled: !!id,
  });
  const proposalFiles: ProposalFileApi[] = proposalFilesData;

  const downloadProposalFile = async (file: ProposalFileApi) => {
    if (!id) return;
    try {
      const blob = await fetchProposalFileBlob(id, file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", description: "Could not download file.", variant: "destructive" });
    }
  };

  const { data: collaborationsData = [] } = useCollaborations(id);
  const collaborations = collaborationsData;
  const deleteCollaborationMutation = useDeleteCollaboration(id ?? 0);
  const { data: proposalsListData } = useProposalsList();
  const adminProposals = proposalsListData ?? [];
  const adminProposalIds = adminProposals.map((p) => p.id);
  const { data: inviteSearchResults = [] } = useSearchUsers({
    email: inviteEmail.trim().length >= 2 ? inviteEmail.trim() : null,
    role: "collaborator",
  });
  const { data: assignUsersList = [] } = useQuery({
    queryKey: ["/api/v1/users", "for_assignees"],
    queryFn: fetchAdminUsersListForAssignees,
    enabled: isAssignOpen && !!id,
  });

  const openInviteDialog = () => {
    setInviteProjects(id ? [id] : []);
    setInviteRole(defaultInviteRole);
    setInvitePermissions(getPermissionsForRole(defaultInviteRole));
    setSelectedInviteUser(null);
    setInviteEmail("");
    setIsInviteOpen(true);
  };

  const handleInviteRoleChange = (role: string) => {
    setInviteRole(role);
    setInvitePermissions(getPermissionsForRole(role));
  };

  const toggleInviteProject = (proposalId: number) => {
    setInviteProjects((prev) =>
      prev.includes(proposalId) ? prev.filter((pid) => pid !== proposalId) : [...prev, proposalId]
    );
  };

  const handleInviteCollaboratorSubmit = async () => {
    if (!selectedInviteUser) {
      toast({ title: "Select a user", description: "Search by email and select a collaborator.", variant: "destructive" });
      return;
    }
    const proposalIds = inviteProjects.length > 0 ? inviteProjects : adminProposalIds;
    if (proposalIds.length === 0) {
      toast({ title: "No proposals", description: "Select at least one proposal.", variant: "destructive" });
      return;
    }
    let added = 0;
    try {
      for (const pid of proposalIds) {
        try {
          await addCollaboration(pid, {
            userId: selectedInviteUser.id,
            role: inviteRole,
            ...invitePermissions,
          } as { userId: number; role: string; canView?: boolean; canEdit?: boolean; canComment?: boolean; canReview?: boolean; canGenerateAi?: boolean });
          added++;
        } catch (_) {
          /* already on this proposal */
        }
        queryClient.invalidateQueries({ queryKey: proposalKeys.collaborations(pid) });
      }
      queryClient.invalidateQueries({ queryKey: proposalKeys.list() });
      queryClient.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Invitation sent", description: `${selectedInviteUser.email} has been added to ${added} proposal(s).` });
      setIsInviteOpen(false);
      setInviteEmail("");
      setSelectedInviteUser(null);
      setInviteProjects([]);
      setInviteRole(defaultInviteRole);
      setInvitePermissions(getPermissionsForRole(defaultInviteRole));
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  // Fetch proposal data
  const { data: proposal, isLoading, isError, error, refetch } = useQuery<any>({
    queryKey: [`/api/proposals/${id}`],
    enabled: !!id,
  });
  const assignees = (proposal as { assignees?: { id: number; name: string; avatar: string; avatarUrl?: string | null; email?: string }[] })?.assignees ?? [];
  const assigneeIds = assignees.map((a) => a.id);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    industry: "",
    budgetRange: "",
    timeline: "",
    status: "draft" as const,
  });
  const [contentData, setContentData] = useState<any>(null);

  useEffect(() => {
    if (proposal && typeof proposal === 'object') {
      const p = proposal as any;
      setFormData({
        title: p.title || "",
        description: p.description || "",
        industry: p.industry || "",
        budgetRange: p.budgetRange || "",
        timeline: p.timeline || "",
        status: p.status || "draft",
      });
      // Initialize contentData from proposal.content
      if (p.content && typeof p.content === 'object' && Object.keys(p.content).length > 0) {
        setContentData(p.content);
      } else {
        // Initialize with empty content structure if no content exists
        setContentData({
          executiveSummary: "",
          introduction: "",
          projectOverview: {
            title: p.title || "",
            description: p.description || "",
            industry: p.industry || "",
            timeline: p.timeline || "",
            budget: p.budgetRange || "",
          },
          requirements: [],
          solutionApproach: "",
          technicalSpecifications: [],
          deliverables: [],
          timeline: "",
          team: "",
          pricing: "",
          nextSteps: "",
        });
      }
    }
  }, [proposal]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", `/api/proposals/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/proposals/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setIsEditing(false);
      toast({
        title: "Proposal updated",
        description: "Your changes have been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update proposal. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/proposals/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({
        title: "Proposal deleted",
        description: "The proposal has been deleted successfully.",
      });
      setLocation("/admin/proposals");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete proposal.",
        variant: "destructive",
      });
    },
  });

  const generateAiContentMutation = useMutation({
    mutationFn: async () => {
      const requirements = proposal.description 
        ? proposal.description.split('.').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
        : [];
      const response = await apiRequest("POST", `/api/v1/ai/proposals/${id}/generate`, {
        requirements,
        aiContext: `Generate comprehensive proposal content for ${proposal.title || 'this proposal'} in the ${proposal.industry || 'general'} industry.`,
        userId: user?.id,
      });
      const content = await response.json();
      return content;
    },
    onSuccess: (content) => {
      if (content && (content.fullDocument != null || content.content)) {
        setNewContent(content.fullDocument != null ? content : content.content);
        setGenerationProgress(100);
        setIsGenerating(false);
        const creditsUsed = typeof content.creditsUsed === "number" ? content.creditsUsed : null;
        if (creditsUsed != null) setLastGenerationCreditsUsed(creditsUsed);
        toast({
          title: creditsUsed != null ? `AI content ready • ${creditsUsed} credit(s) used` : "AI content ready",
          description: "New AI-generated content is ready for review.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "credits"] });
      queryClient.invalidateQueries({ queryKey: [`/api/proposals/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => {
      setIsGenerating(false);
      setGenerationProgress(0);
      const message = e instanceof Error ? e.message : "Failed to generate AI content. Please try again.";
      const is402 = e instanceof Error && /^402:/.test(e.message);
      toast({
        title: is402 ? "Insufficient credits" : "Generation Failed",
        description: is402 ? "Buy new credits to generate content." : message,
        variant: "destructive",
        action: is402 ? (
          <Button variant="outline" size="sm" className="bg-white text-destructive border-white/20 hover:bg-white/90" onClick={() => window.location.href = "/admin/credits"}>
            Buy new credits
          </Button>
        ) : undefined,
      });
    },
  });

  const handleGenerateAiContent = () => {
    const credits = user?.credits ?? 0;
    if (credits <= 0) {
      toast({
        title: "No credits",
        description: "Buy new credits to generate content. Go to Credits to purchase.",
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" className="bg-white text-destructive border-white/20 hover:bg-white/90" onClick={() => window.location.href = "/admin/credits"}>
            Buy new credits
          </Button>
        ),
      });
      return;
    }
    if (credits > 0 && credits <= LOW_CREDIT_WARNING_THRESHOLD) {
      const lowOpts = getLowCreditsToastOptions(credits, { isAdmin: true });
      if (lowOpts) {
        toast({ ...lowOpts, variant: "destructive" });
        showCreditAlertBrowserNotification(lowOpts.title, lowOpts.description);
        createNotification({ title: lowOpts.title, message: lowOpts.description, type: "credit_alert", link: lowOpts.actionHref }).catch(() => {}).finally(() => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        });
      }
    }
    // Save current content as old content
    const currentContent = proposal.content || contentData || {};
    setOldContent(currentContent);
    setNewContent(null);
    setIsGenerating(true);
    setGenerationProgress(0);

    // Call the API to generate new content
    generateAiContentMutation.mutate();
  };

  const handleAcceptNewContent = async () => {
    if (newContent) {
      try {
        await updateMutation.mutateAsync({
          ...formData,
          content: newContent,
        });
        setOldContent(null);
        setNewContent(null);
        setIsGenerating(false);
        toast({
          title: "Content Updated",
          description: "New AI-generated content has been applied.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update content.",
          variant: "destructive",
        });
      }
    }
  };

  const handleRejectNewContent = () => {
    setOldContent(null);
    setNewContent(null);
    setIsGenerating(false);
    setGenerationProgress(0);
    toast({
      title: "Content Rejected",
      description: "Keeping the original content.",
    });
  };

  const handleSave = () => {
    updateMutation.mutate({
      ...formData,
      content: contentData,
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete proposal",
      description: "Are you sure you want to delete this proposal? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (ok) deleteMutation.mutate();
  };

  const handleExport = () => {
    if (!proposal) return;
    setIsExportDialogOpen(true);
  };

  const exportPayload = proposal
    ? buildExportPayload(
        proposal as Record<string, unknown>,
        formData as Record<string, unknown>,
        contentData
      )
    : null;

  const handleExportPdf = () => {
    if (!exportPayload) return;
    downloadProposalPdf(exportPayload);
    toast({ title: "Exported", description: "PDF downloaded." });
    setIsExportDialogOpen(false);
  };
  const handleExportDocx = async () => {
    if (!exportPayload) return;
    await downloadProposalDocx(exportPayload);
    toast({ title: "Exported", description: "Word document downloaded." });
    setIsExportDialogOpen(false);
  };
  const handleExportXlsx = () => {
    if (!exportPayload) return;
    downloadProposalXlsx(exportPayload);
    toast({ title: "Exported", description: "Excel spreadsheet downloaded." });
    setIsExportDialogOpen(false);
  };
  const handleExportJson = () => {
    if (!proposal) return;
    downloadProposalJson(proposal as Record<string, unknown>);
    toast({ title: "Exported", description: "JSON downloaded." });
    setIsExportDialogOpen(false);
  };

  const handleDuplicate = async () => {
    if (!proposal) return;
    try {
      const response = await apiRequest("POST", "/api/proposals", {
        ...proposal,
        title: `${proposal.title} (Copy)`,
        status: "draft",
      });
      await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({
        title: "Proposal duplicated",
        description: "A copy of the proposal has been created.",
      });
      setLocation("/admin/proposals");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to duplicate proposal.",
        variant: "destructive",
      });
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "won":
        return { label: "Won", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600" };
      case "lost":
        return { label: "Lost", icon: XCircle, className: "bg-red-500/10 text-red-600" };
      case "in_progress":
        return { label: "In Progress", icon: Clock, className: "bg-primary/10 text-primary" };
      case "review":
        return { label: "Review", icon: AlertCircle, className: "bg-amber-500/10 text-amber-600" };
      default:
        return { label: "Draft", icon: FileText, className: "badge-status-draft" };
    }
  };

  const isFullDocumentContent = (c: any) => c && typeof (c as { fullDocument?: string }).fullDocument === "string";
  const getFullDocumentText = (c: any): string => (c && typeof (c as { fullDocument?: string }).fullDocument === "string" ? (c as { fullDocument: string }).fullDocument : "") ?? "";
  const structuredContentToDocumentString = (c: any): string => {
    if (!c || typeof c !== "object") return "";
    const parts: string[] = [];
    const es = c.executiveSummary; if (typeof es === "string" && es) parts.push(`Executive Summary\n\n${es}`); else if (es && typeof es === "object" && (es as { description?: string }).description) parts.push(`Executive Summary\n\n${(es as { description: string }).description}`);
    const intro = c.introduction; if (typeof intro === "string" && intro) parts.push(`Introduction\n\n${intro}`); else if (intro && typeof intro === "object" && (intro as { description?: string }).description) parts.push(`Introduction\n\n${(intro as { description: string }).description}`);
    const po = c.projectOverview; if (po && typeof po === "object") { const desc = (po as { description?: string }).description || (po as { industry?: string }).industry || ""; if (desc) parts.push(`Project Overview\n\n${desc}`); }
    if (typeof c.solutionApproach === "string" && c.solutionApproach) parts.push(`Solution Approach\n\n${c.solutionApproach}`);
    if (Array.isArray(c.requirements) && c.requirements.length > 0) parts.push(`Requirements\n\n${c.requirements.map((r: string | { description?: string }) => typeof r === "string" ? r : (r as { description?: string })?.description ?? "").join("\n")}`);
    if (typeof c.timeline === "string" && c.timeline) parts.push(`Timeline\n\n${c.timeline}`); if (typeof c.team === "string" && c.team) parts.push(`Team\n\n${c.team}`); if (typeof c.pricing === "string" && c.pricing) parts.push(`Pricing\n\n${c.pricing}`); if (typeof c.nextSteps === "string" && c.nextSteps) parts.push(`Next Steps\n\n${c.nextSteps}`);
    return parts.join("\n\n");
  };
  const getContentEditorValue = (c: any): string => isFullDocumentContent(c) ? getFullDocumentText(c) : structuredContentToDocumentString(c);

  const renderContentSections = (content: any, isGenerating: boolean, isEditable: boolean = false) => {
    if (isFullDocumentContent(content)) {
      return (
        <ProposalQuillEditor
          value={getFullDocumentText(content)}
          onChange={(html) => setContentData({ ...content, fullDocument: html })}
          readOnly={!isEditable}
          minHeight="280px"
        />
      );
    }
    return (
      <div className="space-y-4">
        {/* Executive Summary */}
        {content.executiveSummary && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Executive Summary
            </h2>
            <p className="text-muted-foreground dark:text-foreground/90 p-0 leading-relaxed whitespace-pre-wrap">
              {typeof content.executiveSummary === 'string' ? content.executiveSummary : ''}
            </p>
          </section>
        )}

        {/* Introduction */}
        {content.introduction && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Introduction
            </h2>
            <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {typeof content.introduction === 'string' ? content.introduction : ''}
            </p>
          </section>
        )}

        {/* Project Overview */}
        {content.projectOverview && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <Building2 className="w-4 h-4 text-primary" />
              Project Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Industry</Label>
                <p className="font-medium  text-sm text-foreground">{content.projectOverview.industry || "Not specified"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Timeline</Label>
                <p className="font-medium text-sm text-foreground">{content.projectOverview.timeline || "Not specified"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Budget</Label>
                <p className="font-medium text-sm text-foreground">{content.projectOverview.budget || "Not specified"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <p className="font-medium text-sm text-foreground">{content.projectOverview.description || "Not specified"}</p>
              </div>
            </div>
          </section>
        )}

        {/* Requirements */}
        {content.requirements && Array.isArray(content.requirements) && content.requirements.length > 0 && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <CheckCircle className="w-4 h-4 text-primary" />
              Requirements
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground dark:text-foreground/90">
              {content.requirements.map((req: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{req}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Solution Approach */}
        {content.solutionApproach && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Solution Approach
            </h2>
            <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {typeof content.solutionApproach === 'string' ? content.solutionApproach : ''}
            </p>
          </section>
        )}

        {/* Technical Specifications */}
        {content.technicalSpecifications && Array.isArray(content.technicalSpecifications) && content.technicalSpecifications.length > 0 && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Technical Specifications
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground dark:text-foreground/90">
              {content.technicalSpecifications.map((spec: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{spec}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Deliverables */}
        {content.deliverables && Array.isArray(content.deliverables) && content.deliverables.length > 0 && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Deliverables
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground dark:text-foreground/90">
              {content.deliverables.map((deliverable: string, idx: number) => (
                <li key={idx} className="leading-relaxed">{deliverable}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Timeline */}
        {content.timeline && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-3 flex items-center gap-2 text-foreground">
              <Calendar className="w-4 h-4 text-primary" />
              Timeline
            </h2>
            {typeof content.timeline === 'string' ? (
              <p className="text-muted-foreground dark:text-foreground/90 m-0 leading-relaxed text-sm whitespace-pre-wrap">
                {content.timeline}
              </p>
            ) : typeof content.timeline === 'object' && content.timeline !== null ? (
              <div className="space-y-3">
                {Object.entries(content.timeline).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">
                        {key.replace('phase', '')}
                      </span>
                    </div>
                    <p className="text-muted-foreground dark:text-foreground/90 m-0 leading-relaxed text-sm flex-1">
                      {typeof value === 'string' ? value : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {/* Team */}
        {content.team && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <User className="w-4 h-4 text-primary" />
              Team
            </h2>
            {typeof content.team === 'string' ? (
              <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {content.team}
              </p>
            ) : typeof content.team === 'object' && content.team !== null ? (
              <div className="space-y-2">
                {Object.entries(content.team).map(([key, value]) => (
                  <div key={key} className="flex flex-col sm:flex-row items-start gap-1 sm:gap-2">
                    <span className="font-medium text-foreground capitalize min-w-0 sm:min-w-[120px]">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="text-muted-foreground dark:text-foreground/90">
                      {typeof value === 'string' ? value : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {/* Pricing */}
        {content.pricing && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <DollarSign className="w-4 h-4 text-primary" />
              Pricing
            </h2>
            {typeof content.pricing === 'string' ? (
              <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {content.pricing}
              </p>
            ) : typeof content.pricing === 'object' && content.pricing !== null ? (
              <div className="space-y-2">
                {Object.entries(content.pricing).map(([key, value]) => (
                  <div key={key} className="flex flex-col sm:flex-row items-start gap-1 sm:gap-2">
                    <span className="font-medium text-foreground capitalize min-w-0 sm:min-w-[140px]">
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>
                    <span className="text-muted-foreground dark:text-foreground/90">
                      {typeof value === 'string' ? value : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {/* Next Steps */}
        {content.nextSteps && (
          <section className={isGenerating ? "opacity-100 animate-fade-in" : ""}>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <ArrowLeft className="w-4 h-4 text-primary rotate-180" />
              Next Steps
            </h2>
            {typeof content.nextSteps === 'string' ? (
              <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {content.nextSteps}
              </p>
            ) : Array.isArray(content.nextSteps) ? (
              <ul className="list-disc list-inside space-y-2 text-muted-foreground dark:text-foreground/90">
                {content.nextSteps.map((step: any, idx: number) => (
                  <li key={idx} className="leading-relaxed">
                    {typeof step === 'string' ? step : String(step)}
                  </li>
                ))}
              </ul>
            ) : typeof content.nextSteps === 'object' && content.nextSteps !== null ? (
              <ul className="list-disc list-inside space-y-2 text-muted-foreground dark:text-foreground/90">
                {Object.values(content.nextSteps).map((step: any, idx: number) => (
                  <li key={idx} className="leading-relaxed">
                    {typeof step === 'string' ? step : String(step)}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}
      </div>
    );
  };


  if (id && isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="text-muted-foreground dark:text-foreground/90">Loading proposal...</div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-2" />
        <h3 className="text-lg font-semibold mb-2">Proposal not found</h3>
        <p className="text-muted-foreground dark:text-foreground/90 mb-2">The proposal you're looking for doesn't exist.</p>
        <Link href="/admin/proposals">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backToProposalsLabel}
          </Button>
        </Link>
      </div>
    );
  }

  const statusConfig = getStatusConfig(formData.status);
  const StatusIcon = statusConfig.icon;

  return (
    <>
      <ConfirmDialog />
      <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Link href="/admin/proposals">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="text-xl sm:text-2xl font-bold border-none p-0 h-auto"
                placeholder="Proposal Title"
              />
            ) : (
              <h1 className="text-xl sm:text-2xl font-bold truncate">{formData.title || "Untitled Proposal"}</h1>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={statusConfig.className}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
              <span className="text-xs sm:text-sm text-muted-foreground">
                Created {new Date(proposal.createdAt || new Date()).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {isEditing ? (
                <>
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                // Reset contentData to original proposal content
                if (proposal && typeof proposal === 'object') {
                  const p = proposal as any;
                  if (p.content && typeof p.content === 'object' && Object.keys(p.content).length > 0) {
                    setContentData(p.content);
                  } else {
                    setContentData({
                      executiveSummary: "",
                      introduction: "",
                      projectOverview: {
                        title: p.title || "",
                        description: p.description || "",
                        industry: p.industry || "",
                        timeline: p.timeline || "",
                        budget: p.budgetRange || "",
                      },
                      requirements: [],
                      solutionApproach: "",
                      technicalSpecifications: [],
                      deliverables: [],
                      timeline: "",
                      team: "",
                      pricing: "",
                      nextSteps: "",
                    });
                  }
                }
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleExport} disabled={!proposal}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" onClick={handleDuplicate}>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-muted/50 overflow-x-auto w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="content" className="text-xs sm:text-sm">Content</TabsTrigger>
            <TabsTrigger value="team" className="text-xs sm:text-sm">Team</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
            <TabsTrigger value="discussion" className="text-xs sm:text-sm inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Discussion
            </TabsTrigger>
            {id && (
              <TabsTrigger asChild value="questions" className="text-xs sm:text-sm">
                <Link href={`/admin/proposals/${id}/questions`} className="inline-flex items-center justify-center gap-1.5">
                  <ListTodo className="w-3.5 h-3.5" />
                  Questions
                </Link>
              </TabsTrigger>
            )}
          </TabsList>
          {activeTab === "content" && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {assignees.length > 0 ? (
                <button
                  type="button"
                  onClick={() => { setAssignAddUserId(""); setIsAssignOpen(true); }}
                  className="flex items-center -space-x-4 rtl:space-x-reverse focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                  title="Manage assignees"
                >
                  {assignees.slice(0, 4).map((a) => (
                    <Avatar key={a.id} className="h-9 w-9 rounded-full border-2 border-white/80 dark:border-white/50 shadow-sm ring-2 ring-background shrink-0">
                      {getAvatarUrl(a.avatarUrl ?? null) ? (
                        <AvatarImage src={getAvatarUrl(a.avatarUrl ?? null)!} alt={a.name} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="text-xs font-medium theme-gradient-bg text-white rounded-full border-0">
                        {a.avatar}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {assignees.length > 4 && (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/80 dark:border-white/50 ring-2 ring-background bg-muted text-foreground text-xs font-medium shrink-0">
                      +{assignees.length - 4}
                    </span>
                  )}
                </button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => { setAssignAddUserId(""); setIsAssignOpen(true); }}
                >
                  <UserPlus className="w-4 h-4" />
                  Assign
                </Button>
              )}
              <Button
                onClick={handleGenerateAiContent}
                disabled={isGenerating || (oldContent && newContent) || (user?.credits ?? 0) <= 0}
                className="theme-gradient-bg text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title={(user?.credits ?? 0) <= 0 ? "Buy new credits to generate content" : undefined}
              >
                {isGenerating ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (user?.credits ?? 0) <= 0 ? (
                  <>
                    <Coins className="w-4 h-4 mr-2" />
                    No credits — buy credits
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate New AI Content
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Assignees &amp; stage
              </DialogTitle>
              <DialogDescription>
                Assign users to this proposal and set the current stage. Assignees receive notifications when added or when status changes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Stage</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Select
                    value={formData.status}
                    onValueChange={(v) => {
                      setFormData((prev) => ({ ...prev, status: v as typeof prev.status }));
                      updateMutation.mutate({ status: v });
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {proposalStatuses.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className={getStatusConfig(formData.status).className}>
                    {getStatusConfig(formData.status).label}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Assignees</Label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {assignees.map((a) => (
                      <div key={a.id} className="relative flex-shrink-0">
                        <button
                          type="button"
                          className="flex h-9 w-9 rounded-full border-2 border-background hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all overflow-hidden"
                          title={`${a.name} (click to remove)`}
                          onClick={() => {
                            const next = assigneeIds.filter((id) => id !== a.id);
                            updateMutation.mutate({ assigneeIds: next });
                          }}
                        >
                          <Avatar className="h-full w-full rounded-full border-0">
                            {getAvatarUrl(a.avatarUrl ?? null) ? (
                              <AvatarImage src={getAvatarUrl(a.avatarUrl ?? null)!} alt={a.name} className="object-cover" />
                            ) : null}
                            <AvatarFallback className="text-xs font-medium theme-gradient-bg text-white rounded-full border-0">
                              {a.avatar}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = assigneeIds.filter((id) => id !== a.id);
                            updateMutation.mutate({ assigneeIds: next });
                          }}
                          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground border-2 border-background flex items-center justify-center shadow-sm hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 z-10"
                          title={`Remove ${a.name}`}
                          aria-label={`Remove ${a.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Select
                    value={assignAddUserId}
                    onValueChange={(val) => {
                      if (!val) return;
                      const uid = parseInt(val, 10);
                      if (!assigneeIds.includes(uid)) {
                        updateMutation.mutate({ assigneeIds: [...assigneeIds, uid] });
                        setAssignAddUserId("");
                      }
                    }}
                  >
                    <SelectTrigger className="w-[200px] h-9">
                      <SelectValue placeholder="Add user, collaborator, or admin" />
                    </SelectTrigger>
                    <SelectContent>
                      {(assignUsersList as { id: number; email?: string; first_name?: string; last_name?: string; firstName?: string; lastName?: string }[])
                        .filter((u) => !assigneeIds.includes(u.id))
                        .map((u) => {
                          const name = [u.first_name ?? u.firstName, u.last_name ?? u.lastName].filter(Boolean).join(" ") || u.email || `User ${u.id}`;
                          return (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {name}{u.email ? ` (${u.email})` : ""}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <TabsContent value="overview" className="mt-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Industry</Label>
                  {isEditing ? (
                    <Input
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="mt-1.5"
                    />
                  ) : (
                    <p className="mt-1.5">{formData.industry || "Not specified"}</p>
                  )}
                </div>
                <div>
                  <Label>Budget Range</Label>
                  {isEditing ? (
                    <Input
                      value={formData.budgetRange}
                      onChange={(e) => setFormData({ ...formData, budgetRange: e.target.value })}
                      className="mt-1.5"
                    />
                  ) : (
                    <p className="mt-1.5">{formData.budgetRange || "Not specified"}</p>
                  )}
                </div>
                <div>
                  <Label>Timeline</Label>
                  {isEditing ? (
                    <Input
                      value={formData.timeline}
                      onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                      className="mt-1.5"
                    />
                  ) : (
                    <p className="mt-1.5">{formData.timeline || "Not specified"}</p>
                  )}
                </div>
                <div>
                  <Label>Status</Label>
                  {isEditing ? (
                    <Select
                      value={formData.status}
                      onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {proposalStatuses.map((opt: { value: string; label: string }) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={`mt-1.5 ${statusConfig.className}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="min-h-[200px]"
                    placeholder="Enter proposal description..."
                  />
                ) : (
                  <div className="max-h-[min(50vh,320px)] overflow-y-auto rounded-md border border-border/50 bg-muted/20 p-3">
                    <p className="text-muted-foreground dark:text-foreground/90 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {formData.description || "No description provided."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {id && (
            <Card className="mt-4 sm:mt-6">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                      Documents
                    </CardTitle>
                    <CardDescription>
                      Files uploaded when this proposal was created. They appear in Content Library and Knowledge Base.
                    </CardDescription>
                  </div>
                  {proposalFiles.length > 0 && (
                    <SyncToContentLibraryButton
                      proposalId={Number(id)}
                      onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
                        queryClient.invalidateQueries({ queryKey: [...proposalKeys.detail(Number(id)), "files"] });
                      }}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {proposalFiles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                ) : (
                  <ul className="space-y-2">
                    {proposalFiles.map((file) => (
                      <li key={file.id} className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2">
                        <span className="text-sm font-medium truncate flex-1 min-w-0" title={file.name}>{file.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={() => downloadProposalFile(file)}
                        >
                          <FileDown className="w-4 h-4 mr-1.5" />
                          Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="content" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex mb-2 items-center gap-2 text-lg sm:text-xl">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Proposal Content
                  </CardTitle>
                  <CardDescription>
                    {isGenerating ? "Generating new AI content..." : "AI-generated proposal content"}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {isGenerating ? (
                    <Badge variant="outline" className="bg-primary text-white border-primary/20">
                      <Clock className="w-3 h-3 mr-1 animate-spin" />
                      Generating {generationProgress}%
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-primary text-white border-primary/20">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Generated
                    </Badge>
                  )}
                  {!isGenerating && lastGenerationCreditsUsed != null && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 dark:bg-primary/20 text-primary px-3 py-1.5 text-sm font-medium border border-primary/20 shadow-sm">
                      <Coins className="w-4 h-4 shrink-0" />
                      This generation: {lastGenerationCreditsUsed} credit{lastGenerationCreditsUsed !== 1 ? "s" : ""} used
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {oldContent && (isGenerating || newContent) ? (
                <div className="relative">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Side - Current Content */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 items-center px-4 py-3 border-b sticky top-0 bg-background z-10">
                        <h3 className="text-base sm:text-lg font-semibold flex items-center justify-start gap-2 text-foreground">
                          <FileText className="w-4 h-4 text-foreground/70" />
                          Current Content
                        </h3>
                        <div></div>
                        <div className="flex justify-end">
                          <Badge variant="outline" className="text-xs text-foreground/90 border-border bg-muted/50">Original</Badge>
                        </div>
                      </div>
                      <div className="prose max-w-none space-y-6 px-4">
                        {renderContentSections(oldContent, false, isEditing)}
                      </div>
                    </div>

                    {/* Right Side - New Content (skeleton while generating, then content) */}
                    <div className="space-y-4 lg:border-l lg:pl-6">
                      <div className="grid grid-cols-3 items-center px-4 py-3 border-b sticky top-0 bg-background z-10">
                        <h3 className="text-base sm:text-lg font-semibold flex items-center justify-start gap-2 text-foreground">
                          <Sparkles className={`w-4 h-4 text-primary ${isGenerating ? "animate-pulse" : ""}`} />
                          New Content
                        </h3>
                        <div></div>
                        <div className="flex justify-end">
                          <Badge variant="outline" className={`text-xs text-white ${isGenerating ? "bg-primary border-primary/20" : "bg-emerald-600 border-emerald-500/20"}`}>
                            {isGenerating ? (
                              <>
                                <Sparkles className="w-3 h-3 mr-1 animate-pulse" />
                                {generationProgress}%
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Ready
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                      <div className="prose max-w-none space-y-6 px-4">
                        {isGenerating && !newContent ? (
                          <div className="space-y-4 py-2" aria-label="Content generating">
                            <div className="h-3 w-full rounded bg-muted animate-pulse" style={{ animationDuration: "1.2s" }} />
                            <div className="h-3 w-[95%] rounded bg-muted animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.1s" }} />
                            <div className="h-3 w-[88%] rounded bg-muted animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.2s" }} />
                            <div className="h-3 w-[92%] rounded bg-muted animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.3s" }} />
                            <div className="h-3 w-[75%] rounded bg-muted animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.4s" }} />
                            <div className="h-3 w-[70%] rounded bg-muted animate-pulse" style={{ animationDuration: "1.2s", animationDelay: "0.5s" }} />
                            <div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4 animate-spin text-primary" />
                              <span>Generating content...</span>
                            </div>
                          </div>
                        ) : newContent ? (
                          <>
                            {renderContentSections(newContent, true, isEditing)}
                            {generationProgress < 100 && isGenerating && (
                              <div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4 animate-spin text-primary" />
                                <span>Generating remaining sections...</span>
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                      {!isGenerating && newContent && (
                        <div className="sticky bottom-0 pt-4 border-t bg-background/95 backdrop-blur mt-4 z-20">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                              onClick={handleAcceptNewContent}
                              className="flex-1 theme-gradient-bg text-white hover:opacity-95 w-full sm:w-auto"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Accept New Content
                            </Button>
                            <Button
                              onClick={handleRejectNewContent}
                              variant="outline"
                              className="flex-1 w-full sm:w-auto"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Keep Original
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="prose max-w-none space-y-6">
                    {(() => {
                      const content = contentData || proposal.content || {
                        executiveSummary: "",
                        introduction: "",
                        projectOverview: {
                          title: proposal.title || "",
                          description: proposal.description || "",
                          industry: proposal.industry || "",
                          timeline: proposal.timeline || "",
                          budget: proposal.budgetRange || "",
                        },
                        requirements: [],
                        solutionApproach: "",
                        technicalSpecifications: [],
                        deliverables: [],
                        timeline: "",
                        team: "",
                        pricing: "",
                        nextSteps: "",
                      };
                      return (
                        <ProposalQuillEditor
                          value={getContentEditorValue(content)}
                          onChange={(html) => setContentData({ ...content, fullDocument: html })}
                          readOnly={!isEditing}
                          placeholder="Proposal content"
                          minHeight="400px"
                        />
                      );
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-6 mb-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="mb-2">Assigned collaborators</CardTitle>
                  <CardDescription className="mt-1">View and manage who can work on this proposal. You have full control to add or remove collaborators.</CardDescription>
                </div>
                <Button onClick={openInviteDialog}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite collaborator
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {collaborations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No collaborators assigned yet</p>
                    <Button variant="outline" className="mt-4" onClick={openInviteDialog}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite collaborator
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {collaborations.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-4 p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="bg-muted text-xs">
                              {c.user
                                ? `${(c.user.firstName || "")[0] || ""}${(c.user.lastName || "")[0] || ""}`.toUpperCase() || "?"
                                : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() || c.user.email : `User #${c.userId}`}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{c.user?.email ?? ""}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 capitalize">{c.role}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            const name = c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() || c.user.email : "This collaborator";
                            const ok = await confirm({
                              title: "Remove from this proposal",
                              description: `Remove ${name} from this proposal? They will lose access to it.`,
                              confirmText: "Remove",
                              cancelText: "Cancel",
                              variant: "destructive",
                            });
                            if (ok) {
                              deleteCollaborationMutation.mutate(c.id, {
                                onSuccess: () => toast({ title: "Removed", description: "Collaborator has been removed." }),
                                onError: () => toast({ title: "Error", description: "Failed to remove collaborator.", variant: "destructive" }),
                              });
                            }
                          }}
                          disabled={deleteCollaborationMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="mb-2">Activity Log</CardTitle>
              <CardDescription className="mt-1">Recent activity on this proposal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Proposal created</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(proposal.createdAt || new Date()).toLocaleString()}
                    </p>
                  </div>
                </div>
                {proposal.updatedAt && proposal.updatedAt !== proposal.createdAt && (
                  <div className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Proposal updated</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(proposal.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discussion" className="mt-6">
          {id && (
            <ProposalDiscussionTab
              proposalId={id}
              canComment={true}
              questionsHref="/admin/proposals"
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Invite Collaborator Dialog (full: Permissions + Assign to proposals) */}
      <Dialog open={isInviteOpen} onOpenChange={(open) => { if (!open) { setSelectedInviteUser(null); setInviteProjects([]); } setIsInviteOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Collaborator</DialogTitle>
            <DialogDescription>
              Search by email. User must already be registered with role &quot;collaborator&quot;. Then choose a role and assign to proposals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="collaborator@example.com"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setSelectedInviteUser(null); }}
              />
            </div>
            {inviteEmail.trim().length >= 2 && inviteSearchResults.length > 0 && (
              <div className="space-y-2">
                <Label>Select user</Label>
                <div className="border rounded-lg divide-y max-h-32 overflow-y-auto">
                  {inviteSearchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                      onClick={() => setSelectedInviteUser({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName })}
                    >
                      <span>{u.firstName} {u.lastName} ({u.email})</span>
                      {selectedInviteUser?.id === u.id && <span className="text-primary">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {inviteEmail.trim().length >= 2 && inviteSearchResults.length === 0 && !selectedInviteUser && (
              <p className="text-sm text-muted-foreground">No collaborator found with this email. They must register first.</p>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={handleInviteRoleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {collaboratorRoles.map((r) => {
                    const RoleIcon = COLLABORATOR_ICON_MAP[r.value];
                    return (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="flex items-center gap-2">
                          {RoleIcon && <RoleIcon className="w-4 h-4" />}
                          <span>{r.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to proposals (leave empty = all)</Label>
              <div className="space-y-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                {adminProposals.map((p) => (
                  <div key={p.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`invite-proj-${p.id}`}
                      checked={inviteProjects.length === 0 || inviteProjects.includes(p.id)}
                      onCheckedChange={() => toggleInviteProject(p.id)}
                    />
                    <label htmlFor={`invite-proj-${p.id}`} className="text-sm font-medium cursor-pointer">
                      {p.title}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInviteCollaboratorSubmit} disabled={!selectedInviteUser}>
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export format dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export proposal</DialogTitle>
            <DialogDescription>Choose a format to download</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Button variant="outline" className="w-full justify-start" onClick={handleExportPdf} disabled={!exportPayload}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={handleExportDocx} disabled={!exportPayload}>
              <FileText className="w-4 h-4 mr-2" /> Docs (.docx)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
