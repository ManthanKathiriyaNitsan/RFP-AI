import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useProposal,
  useProposalsList,
  useUpdateProposal,
  useCreateProposal,
  useGenerateProposalContent,
  useCollaborations,
  useAddCollaboration,
  useDeleteCollaboration,
  useSearchUsers,
  useMyCollaboration,
  proposalKeys,
} from "@/hooks/use-proposals-api";
import { addCollaboration, updateCollaboration, deleteCollaboration, fetchCollaborations, fetchProposalActivity } from "@/api/proposals";
import { QueryErrorState } from "@/components/shared/query-error-state";
import {
  ArrowLeft,
  Edit,
  Save,
  Download,
  Copy,
  FileText,
  Calendar,
  DollarSign,
  Building2,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Sparkles,
  Coins,
  Users as UsersIcon,
  UserPlus,
  X,
  Link2,
  Eye,
  FileEdit,
  MessageSquare,
  MoreHorizontal,
  ListTodo,
  FolderPlus,
  Trash2,
  UserCog,
  UserX,
  Paperclip,
  FileDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAvatarUrl } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getProposalStatusBadgeClass, softBadgeClasses } from "@/lib/badge-classes";
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
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfirm } from "@/hooks/use-confirm";
import {
  buildExportPayload,
  downloadProposalPdf,
  downloadProposalDocx,
  downloadProposalXlsx,
} from "@/lib/export-proposal";
import { useCollaboratorRoleOptions } from "@/hooks/use-collaborator-role-options";
import { ProposalDiscussionTab } from "@/components/customer/proposal-discussion";
import { fetchProposalFiles, fetchProposalFileBlob, type ProposalFileApi } from "@/api/proposals";
import { ProposalQuillEditor } from "@/components/editor/ProposalQuillEditor";

/** Reveals text letter-by-letter with a blinking cursor, matching left-panel paragraph style. */
function TypingReveal({
  text,
  speedMs = 18,
  className = "",
  onComplete,
}: {
  text: string;
  speedMs?: number;
  className?: string;
  onComplete?: () => void;
}) {
  const [visibleLength, setVisibleLength] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setVisibleLength(0);
    if (!text) return;
    let len = 0;
    const t = setInterval(() => {
      len += 1;
      setVisibleLength((l) => Math.min(l + 1, text.length));
      if (len >= text.length) {
        clearInterval(t);
        onCompleteRef.current?.();
      }
    }, speedMs);
    return () => clearInterval(t);
  }, [text, speedMs]);

  const visible = text.slice(0, visibleLength);
  const isComplete = visibleLength >= text.length;

  return (
    <div className={className}>
      <span className="text-muted-foreground dark:text-foreground/90 p-0 leading-relaxed whitespace-pre-wrap font-normal text-[15px]">
        {visible}
      </span>
      {!isComplete && (
        <span className="inline-block w-2 h-4 bg-primary/80 rounded-sm align-middle animate-cursor-blink ml-0.5" aria-hidden />
      )}
    </div>
  );
}

export default function RFPDetail() {
  const params = useParams();
  const [location] = useLocation();
  const rfpId = params.id;
  const proposalId = rfpId ? parseInt(rfpId, 10) : null;
  const { user } = useAuth();
  const fromAdmin = location.startsWith("/admin/proposals");
  const isCollaborator = location.startsWith("/collaborator");
  const rfpBase = fromAdmin ? "/admin/proposals" : isCollaborator ? "/collaborator/rfp" : "/rfp";
  const backHref = fromAdmin ? "/admin/proposals" : isCollaborator ? "/collaborator" : "/rfp-projects";
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [oldContent, setOldContent] = useState<any>(null);
  const [newContent, setNewContent] = useState<any>(null);
  const [editableNewContent, setEditableNewContent] = useState<any>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [newContentTypingComplete, setNewContentTypingComplete] = useState(false);
  const [isEditingNewContent, setIsEditingNewContent] = useState(false);
  const [lastGenerationCreditsUsed, setLastGenerationCreditsUsed] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [selectedInviteUser, setSelectedInviteUser] = useState<{ id: number; email: string; firstName: string; lastName: string } | null>(null);
  const { roleOptions, getPermissionsForRole, defaultPermissions } = useCollaboratorRoleOptions();
  const [invitePermissions, setInvitePermissions] = useState(defaultPermissions);
  const [inviteProjects, setInviteProjects] = useState<number[]>([]);
  const [isEditCollaboratorOpen, setIsEditCollaboratorOpen] = useState(false);
  const [editCollaboratorRow, setEditCollaboratorRow] = useState<{ c: { id: number; userId: number; role: string; user?: { id: number; email: string; firstName: string; lastName: string } }; proposalTitle: string } | null>(null);
  const [editCollaboratorRole, setEditCollaboratorRole] = useState("viewer");
  const [isAssignMoreOpen, setIsAssignMoreOpen] = useState(false);
  const [assignMoreRow, setAssignMoreRow] = useState<{ c: { id: number; userId: number; role: string; user?: { id: number; email: string; firstName: string; lastName: string } }; proposalTitle: string } | null>(null);
  const [assignMoreProposalIds, setAssignMoreProposalIds] = useState<number[]>([]);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [tasksRow, setTasksRow] = useState<{ c: { id: number; userId: number; role: string; user?: { id: number; email: string; firstName: string; lastName: string } }; proposalTitle: string } | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const qc = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: proposalFilesData = [] } = useQuery({
    queryKey: [...proposalKeys.detail(proposalId ?? 0), "files"],
    queryFn: () => fetchProposalFiles(proposalId!),
    enabled: !!proposalId,
  });
  const proposalFiles: ProposalFileApi[] = proposalFilesData;

  const downloadProposalFile = async (file: ProposalFileApi) => {
    if (!proposalId) return;
    try {
      const blob = await fetchProposalFileBlob(proposalId, file.id);
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

  const { data: inviteSearchResults = [] } = useSearchUsers({
    email: inviteEmail.trim().length >= 2 ? inviteEmail.trim() : null,
    role: "collaborator",
  });

  const { data: proposal, isLoading: proposalLoading, isError: proposalError, error: proposalErrorObj, refetch: refetchProposal } = useProposal(proposalId);
  const { data: proposalsListData } = useProposalsList();
  const myProposals = proposalsListData ?? [];
  const myProposalIds = myProposals.map((p) => p.id);
  const updateProposalMutation = useUpdateProposal(proposalId ?? 0);
  const createProposalMutation = useCreateProposal();
  const generateContentMutation = useGenerateProposalContent(proposalId ?? 0);
  const { data: collaborationsData = [] } = useCollaborations(proposalId);
  const deleteCollaborationMutation = useDeleteCollaboration(proposalId ?? 0);
  const { data: myCollaboration } = useMyCollaboration(isCollaborator ? proposalId : null);
  const { data: activityData } = useQuery({
    queryKey: [...proposalKeys.detail(proposalId ?? 0), "activity"],
    queryFn: () => fetchProposalActivity(proposalId!),
    enabled: !!proposalId,
  });
  const activityEntries = activityData?.entries ?? [];
  const myActivityEntries = isCollaborator && user?.id ? activityEntries.filter((e) => e.userId === user.id) : [];
  const isLoading = !!rfpId && (proposalLoading || !proposal);
  const collaborations = collaborationsData;
  const isEditorRole = (myCollaboration?.role ?? "").toLowerCase() === "editor";
  const canEdit = fromAdmin || !isCollaborator || myCollaboration?.canEdit === true || isEditorRole;
  const canGenerateAi =
    fromAdmin ||
    !isCollaborator ||
    myCollaboration?.canGenerateAi === true ||
    isEditorRole ||
    (isCollaborator && myCollaboration?.canEdit === true);
  const canComment = isCollaborator && myCollaboration?.canComment === true;
  const canCommentDiscussion = !isCollaborator || (myCollaboration?.canComment === true);
  const canReview = isCollaborator && myCollaboration?.canReview === true;

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    industry: "",
    budgetRange: "",
    timeline: "",
    dueDate: "",
    status: "draft" as const,
    clientName: "",
    clientContact: "",
    clientEmail: "",
  });
  const [contentData, setContentData] = useState<any>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignSearchEmail, setAssignSearchEmail] = useState("");

  const assignees = (proposal as { assignees?: { id: number; name: string; avatar: string; avatarUrl?: string | null; email?: string }[] })?.assignees ?? [];
  const assigneeIds = assignees.map((a) => a.id);

  const { data: assignSearchResults = [] } = useSearchUsers({
    email: isAssignOpen && assignSearchEmail.trim().length >= 2 ? assignSearchEmail.trim() : null,
  });

  useEffect(() => {
    if (proposal) {
      const p = proposal;
      setFormData({
        title: p.title || "",
        description: p.description || "",
        industry: p.industry || "",
        budgetRange: p.budgetRange || "",
        timeline: p.timeline || "",
        dueDate: p.dueDate ?? "",
        status: (p.status as "draft") || "draft",
        clientName: "",
        clientContact: "",
        clientEmail: "",
      });
      if (p.content && typeof p.content === "object" && Object.keys(p.content).length > 0) {
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
  }, [proposal]);

  // Open in edit mode when navigating with ?edit=true (e.g. from list dropdown "Edit")
  useEffect(() => {
    if (!proposal) return;
    const edit = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("edit");
    if (edit === "true") setIsEditing(true);
  }, [proposal]);

  // Open Content tab when navigating with #content (e.g. from Generate page "View Document")
  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkHash = () => {
      if (window.location.hash === "#content") setActiveTab("content");
    };
    checkHash();
    window.addEventListener("hashchange", checkHash);
    return () => window.removeEventListener("hashchange", checkHash);
  }, [proposalId]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);


  const openInviteDialog = () => {
    setInviteProjects(proposalId ? [proposalId] : []);
    setInvitePermissions({ canView: true, canEdit: false, canComment: false, canReview: false, canGenerateAi: false });
    setInviteRole("viewer");
    setSelectedInviteUser(null);
    setInviteEmail("");
    setIsInviteOpen(true);
  };

  const toggleInviteProject = (proposalId: number) => {
    setInviteProjects((prev) =>
      prev.includes(proposalId) ? prev.filter((id) => id !== proposalId) : [...prev, proposalId]
    );
  };

  const handleInviteRoleChange = (role: string) => {
    setInviteRole(role);
    setInvitePermissions(getPermissionsForRole(role));
  };

  const handleInviteCollaboratorSubmit = async () => {
    if (!selectedInviteUser) {
      toast({ title: "Select a user", description: "Search by email and select a collaborator.", variant: "destructive" });
      return;
    }
    const proposalIds = inviteProjects.length > 0 ? inviteProjects : myProposalIds;
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
            canView: invitePermissions.canView,
            canEdit: invitePermissions.canEdit,
            canComment: invitePermissions.canComment,
            canReview: invitePermissions.canReview,
            canGenerateAi: invitePermissions.canGenerateAi,
          });
          added++;
        } catch (_) {
          /* already on this proposal */
        }
        qc.invalidateQueries({ queryKey: proposalKeys.collaborations(pid) });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Invitation sent", description: `${selectedInviteUser.email} has been added to ${added} proposal(s).` });
      setIsInviteOpen(false);
      setInviteEmail("");
      setSelectedInviteUser(null);
      setInviteProjects([]);
      setInviteRole("viewer");
      setInvitePermissions(defaultPermissions);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const proposalTitle = formData?.title || proposal?.title || "this proposal";
  const openEditCollaborator = (c: (typeof collaborations)[0]) => {
    setEditCollaboratorRow({ c, proposalTitle });
    setEditCollaboratorRole(c.role || "viewer");
    setIsEditCollaboratorOpen(true);
  };
  const confirmEditCollaborator = async () => {
    if (!editCollaboratorRow || !proposalId) return;
    try {
      await updateCollaboration(proposalId, editCollaboratorRow.c.id, { role: editCollaboratorRole });
      qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Updated", description: "Role updated." });
      setIsEditCollaboratorOpen(false);
      setEditCollaboratorRow(null);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const openAssignMore = (c: (typeof collaborations)[0]) => {
    setAssignMoreRow({ c, proposalTitle });
    setAssignMoreProposalIds([]);
    setIsAssignMoreOpen(true);
  };
  const otherProposalsForAssign = myProposals.filter((p) => p.id !== proposalId);
  const toggleAssignMoreProject = (pid: number) => {
    setAssignMoreProposalIds((prev) => (prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid]));
  };
  const confirmAssignMore = async () => {
    if (!assignMoreRow || assignMoreProposalIds.length === 0) return;
    const role = assignMoreRow.c.role || "viewer";
    const perms = getPermissionsForRole(role);
    try {
      for (const pid of assignMoreProposalIds) {
        await addCollaboration(pid, { userId: assignMoreRow.c.userId, role, ...perms });
        qc.invalidateQueries({ queryKey: proposalKeys.collaborations(pid) });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Added", description: `Added to ${assignMoreProposalIds.length} proposal(s).` });
      setIsAssignMoreOpen(false);
      setAssignMoreRow(null);
      setAssignMoreProposalIds([]);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const openTasks = (c: (typeof collaborations)[0]) => {
    setTasksRow({ c, proposalTitle });
    setIsTasksOpen(true);
  };
  const getTasksForRow = (c: { id: number }, title: string) => [
    { id: `t-${c.id}-1`, title: `Review draft for ${title}`, status: "In progress", dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString() },
    { id: `t-${c.id}-2`, title: "Submit answers", status: "Pending", dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString() },
  ];

  const handleChangeRoleRow = async (c: (typeof collaborations)[0], newRole: string) => {
    if (!proposalId) return;
    try {
      await updateCollaboration(proposalId, c.id, { role: newRole });
      qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Role updated", description: `Role set to ${newRole}.` });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleRemoveFromThisProposal = async (c: (typeof collaborations)[0]) => {
    if (!proposalId) return;
    const name = c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() || c.user.email : "This collaborator";
    const ok = await confirm({
      title: "Remove from this proposal",
      description: `Remove ${name} from this proposal? They will lose access to it.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    deleteCollaboration(proposalId, c.id).then(() => {
      qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Removed", description: "Collaborator removed from this proposal." });
    }).catch((e) => toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" }));
  };

  const handleRemoveFromAll = async (c: (typeof collaborations)[0]) => {
    const name = c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() || c.user.email : "This collaborator";
    const ok = await confirm({
      title: "Remove from all proposals",
      description: `Remove ${name} from all your proposals? They will lose access to every proposal you shared.`,
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      for (const pid of myProposalIds) {
        const list = await fetchCollaborations(pid);
        const found = list.find((x) => x.userId === c.userId);
        if (found) {
          await deleteCollaboration(pid, found.id);
          qc.invalidateQueries({ queryKey: proposalKeys.collaborations(pid) });
        }
      }
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Removed", description: "Collaborator removed from all proposals." });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const [updatePending, setUpdatePending] = useState(false);
  const handleUpdate = async (data: any) => {
    if (!proposalId) return;
    setUpdatePending(true);
    updateProposalMutation.mutate(data, {
      onSuccess: () => {
        toast({ title: "Proposal updated", description: "Your changes have been saved." });
        setIsEditing(false);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update proposal.", variant: "destructive" });
      },
      onSettled: () => setUpdatePending(false),
    });
  };

  const handleGenerateAiContent = () => {
    if (!proposalId || !proposal) return;
    const credits = user?.credits ?? 0;
    if (credits <= 0) {
      toast({
        title: "No credits",
        description: "Contact your admin for more credits to generate content.",
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" className="bg-white text-destructive border-white/20 hover:bg-white/90" onClick={() => window.location.href = "/rfp-projects"}>
            Go to Dashboard
          </Button>
        ),
      });
      return;
    }
    const currentContent = proposal.content || contentData || {};
    setOldContent(currentContent);
    setNewContent(null);
    setIsGenerating(true);
    setGenerationProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 90) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          return prev;
        }
        return prev + 10;
      });
    }, 300);
    generateContentMutation.mutate({ userId: user?.id }, {
      onSuccess: (data) => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
        // Normalize: backend may return { fullDocument, generatedAt } or { content: { fullDocument, ... } }
        const content =
          data && typeof data === "object" && (data as { content?: unknown }).content != null
            ? (data as { content: Record<string, unknown> }).content
            : (data as Record<string, unknown>);
        if (content && typeof content === "object") {
          setNewContent(content);
          setEditableNewContent({ ...content });
          setGenerationProgress(100);
          setNewContentTypingComplete(true);
          setIsEditingNewContent(false);
          const creditsUsed = data && typeof (data as { creditsUsed?: number }).creditsUsed === "number" ? (data as { creditsUsed: number }).creditsUsed : null;
          if (creditsUsed != null) setLastGenerationCreditsUsed(creditsUsed);
          toast({
            title: creditsUsed != null ? `AI content ready • ${creditsUsed} credit(s) used` : "AI content ready",
            description: "New content is ready for review.",
          });
          qc.invalidateQueries({ queryKey: ["customer", "sidebar"] });
          qc.invalidateQueries({ queryKey: ["customer", "credits", "usage"] });
          qc.invalidateQueries({ queryKey: ["customer", "dashboard"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        }
        setIsGenerating(false);
      },
      onError: (e) => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
        setIsGenerating(false);
        const message = e instanceof Error ? e.message : "Failed to generate content.";
        const is402 = e instanceof Error && /^402:/.test(e.message);
        const creditMsg = "Contact your admin for more credits.";
        toast({
          title: is402 ? "Insufficient credits" : "Error",
          description: is402 ? (message ? `${message} ${creditMsg}` : creditMsg) : message,
          variant: "destructive",
          action: is402 ? (
            <Button variant="outline" size="sm" className="bg-white text-destructive border-white/20 hover:bg-white/90" onClick={() => window.location.href = "/rfp-projects"}>
              Go to Dashboard
            </Button>
          ) : undefined,
        });
      },
    });
  };

  const handleAcceptNewContent = async () => {
    const contentToSave = editableNewContent ?? newContent;
    if (contentToSave && proposalId) {
      try {
        await handleUpdate({ ...formData, content: contentToSave });
        setContentData(contentToSave);
        setOldContent(null);
        setNewContent(null);
        setEditableNewContent(null);
        setNewContentTypingComplete(false);
        setIsEditingNewContent(false);
        setIsGenerating(false);
        setGenerationProgress(0);
        toast({ title: "Content Updated", description: "New AI-generated content has been applied." });
      } catch {
        toast({ title: "Error", description: "Failed to update content.", variant: "destructive" });
      }
    }
  };

  const handleRejectNewContent = () => {
    setOldContent(null);
    setNewContent(null);
    setEditableNewContent(null);
    setNewContentTypingComplete(false);
    setIsEditingNewContent(false);
    setIsGenerating(false);
    setGenerationProgress(0);
    toast({
      title: "Content Rejected",
      description: "Keeping the original content.",
    });
  };

  const handleSave = () => {
    if (proposalId) handleUpdate({ ...formData, content: contentData });
  };

  const handleExport = () => {
    if (!proposal) return;
    setIsExportDialogOpen(true);
  };

  const exportPayload = proposal
    ? buildExportPayload(
        proposal as unknown as Record<string, unknown>,
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

  const handleDuplicate = () => {
    if (!proposal || !user) return;
    createProposalMutation.mutate(
      {
        title: `${proposal.title} (Copy)`,
        description: proposal.description ?? undefined,
        industry: proposal.industry ?? undefined,
        budgetRange: proposal.budgetRange ?? undefined,
        timeline: proposal.timeline ?? undefined,
        dueDate: proposal.dueDate ?? undefined,
      },
      {
        onSuccess: () => toast({ title: "Proposal duplicated", description: "A copy has been created." }),
        onError: () => toast({ title: "Error", description: "Failed to duplicate.", variant: "destructive" }),
      }
    );
  };

  const getStatusConfig = (status: string) => {
    const labels: Record<string, string> = { won: "Won", lost: "Lost", in_progress: "In Progress", review: "Review", completed: "Completed", draft: "Draft" };
    const icons: Record<string, typeof FileText> = { won: CheckCircle, lost: XCircle, in_progress: Clock, review: AlertCircle, completed: CheckCircle, draft: FileText };
    return {
      label: labels[status] ?? "Draft",
      icon: icons[status] ?? FileText,
      className: getProposalStatusBadgeClass(status),
    };
  };

  const proposalStatuses = [
    { value: "draft", label: "Draft" },
    { value: "in_progress", label: "In Progress" },
    { value: "review", label: "Review" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
  ];


  const isFullDocumentContent = (c: any) =>
    c && (typeof (c as { fullDocument?: string }).fullDocument === "string" || typeof (c as { full_document?: string }).full_document === "string");
  const getFullDocumentText = (c: any): string =>
    (c && (typeof (c as { fullDocument?: string }).fullDocument === "string" ? (c as { fullDocument: string }).fullDocument : typeof (c as { full_document?: string }).full_document === "string" ? (c as { full_document: string }).full_document : "")) ?? "";

  /** Build a single document string from structured content for display in Quill. */
  const structuredContentToDocumentString = (c: any): string => {
    if (!c || typeof c !== "object") return "";
    const parts: string[] = [];
    const es = c.executiveSummary;
    if (typeof es === "string" && es) parts.push(`Executive Summary\n\n${es}`);
    else if (es && typeof es === "object" && (es as { description?: string }).description) parts.push(`Executive Summary\n\n${(es as { description: string }).description}`);
    const intro = c.introduction;
    if (typeof intro === "string" && intro) parts.push(`Introduction\n\n${intro}`);
    else if (intro && typeof intro === "object" && (intro as { description?: string }).description) parts.push(`Introduction\n\n${(intro as { description: string }).description}`);
    const po = c.projectOverview;
    if (po && typeof po === "object") {
      const desc = (po as { description?: string }).description || (po as { industry?: string }).industry || "";
      if (desc) parts.push(`Project Overview\n\n${desc}`);
    }
    if (typeof c.solutionApproach === "string" && c.solutionApproach) parts.push(`Solution Approach\n\n${c.solutionApproach}`);
    if (Array.isArray(c.requirements) && c.requirements.length > 0) parts.push(`Requirements\n\n${c.requirements.map((r: string | { description?: string }) => typeof r === "string" ? r : (r as { description?: string })?.description ?? "").join("\n")}`);
    if (typeof c.timeline === "string" && c.timeline) parts.push(`Timeline\n\n${c.timeline}`);
    if (typeof c.team === "string" && c.team) parts.push(`Team\n\n${c.team}`);
    if (typeof c.pricing === "string" && c.pricing) parts.push(`Pricing\n\n${c.pricing}`);
    if (typeof c.nextSteps === "string" && c.nextSteps) parts.push(`Next Steps\n\n${c.nextSteps}`);
    return parts.join("\n\n");
  };

  const getContentEditorValue = (c: any): string =>
    isFullDocumentContent(c) ? getFullDocumentText(c) : structuredContentToDocumentString(c);

  const renderFullDocumentLikeCurrent = (text: string) => (
    <div className="space-y-6">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base sm:text-lg font-semibold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-muted-foreground dark:text-foreground/90 p-0 leading-relaxed whitespace-pre-wrap">{children}</p>
          ),
          ul: ({ children }) => <ul className="list-disc list-inside text-muted-foreground dark:text-foreground/90 space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside text-muted-foreground dark:text-foreground/90 space-y-2">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );

  const renderContentSections = (content: any, isEditable: boolean = false, onContentChange?: (next: any) => void) => {
    const applyUpdate = onContentChange ?? ((next: any) => setContentData(next));
    if (isFullDocumentContent(content)) {
      return (
        <ProposalQuillEditor
          value={getFullDocumentText(content)}
          onChange={(html) => applyUpdate({ ...content, fullDocument: html })}
          readOnly={!isEditable}
          minHeight="280px"
        />
      );
    }
    return (
      <div className="space-y-6">
        {/* Executive Summary */}
        {(content.executiveSummary && (typeof content.executiveSummary === 'string' || (content.executiveSummary as any)?.description)) && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Executive Summary
            </h2>
            {isEditable ? (
              <Textarea
                value={typeof content.executiveSummary === 'string' ? content.executiveSummary : (content.executiveSummary as any)?.description ?? ''}
                onChange={(e) => applyUpdate({ ...content, executiveSummary: e.target.value })}
                className="min-h-[150px]"
                placeholder="Enter executive summary..."
              />
            ) : (
              (() => {
                const es = content.executiveSummary;
                if (typeof es === 'string' && es) return <p className="text-muted-foreground dark:text-foreground/90 p-0 leading-relaxed whitespace-pre-wrap">{es}</p>;
                if (es && typeof es === 'object' && (es as any).description) {
                  const o = es as { description?: string; keyPoints?: string[]; budgetImpact?: string };
                  return (
                    <div className="space-y-2 text-muted-foreground dark:text-foreground/90">
                      <p className="p-0 leading-relaxed whitespace-pre-wrap">{o.description}</p>
                      {Array.isArray(o.keyPoints) && o.keyPoints.length > 0 && <ul className="list-disc list-inside">{o.keyPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>}
                      {o.budgetImpact && <p className="font-medium text-foreground">Budget impact: {o.budgetImpact}</p>}
                    </div>
                  );
                }
                return null;
              })()
            )}
          </section>
        )}

        {/* Introduction */}
        {(content.introduction && (typeof content.introduction === 'string' || (content.introduction as any)?.description)) && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Introduction
            </h2>
            {isEditable ? (
              <Textarea
                value={typeof content.introduction === 'string' ? content.introduction : (content.introduction as any)?.description ?? ''}
                onChange={(e) => applyUpdate({ ...content, introduction: e.target.value })}
                className="min-h-[150px]"
                placeholder="Enter introduction..."
              />
            ) : (
              (() => {
                const intro = content.introduction;
                if (typeof intro === 'string' && intro) return <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">{intro}</p>;
                if (intro && typeof intro === 'object' && (intro as any).description) {
                  const o = intro as { description?: string; problemStatement?: string; solutionOverview?: string };
                  return (
                    <div className="space-y-2 text-muted-foreground dark:text-foreground/90">
                      <p className="leading-relaxed">{o.description}</p>
                      {o.problemStatement && <p><span className="font-medium text-foreground">Problem: </span>{o.problemStatement}</p>}
                      {o.solutionOverview && <p><span className="font-medium text-foreground">Solution: </span>{o.solutionOverview}</p>}
                    </div>
                  );
                }
                return null;
              })()
            )}
          </section>
        )}

        {/* Project Overview */}
        {content.projectOverview && (
          <section>
            <h2 className="text-lg sm:text-xl  font-bold mb-2 flex items-center gap-2 text-foreground">
              <Building2 className="w-4 h-4 text-primary" />
              Project Overview
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Industry</Label>
                  <p className="font-medium text-sm text-foreground">{(content.projectOverview as any).industry || formData.industry || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Timeline</Label>
                  <p className="font-medium text-sm text-foreground">{(content.projectOverview as any).timeline || (content.projectOverview as any).projectTimeline?.description || formData.timeline || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Budget</Label>
                  <p className="font-medium text-sm text-foreground">{(content.projectOverview as any).budget || formData.budgetRange || "Not specified"}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <p className="font-medium text-sm text-foreground">{(content.projectOverview as any).description || formData.description || "Not specified"}</p>
                </div>
              </div>
              {Array.isArray((content.projectOverview as any).projectScope) && (content.projectOverview as any).projectScope.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Scope</Label>
                  <ul className="list-disc list-inside text-sm text-muted-foreground dark:text-foreground/90 mt-1">{(content.projectOverview as any).projectScope.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Requirements */}
        {content.requirements && Array.isArray(content.requirements) && content.requirements.length > 0 && (
          <section>
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
        {(content.solutionApproach && (typeof content.solutionApproach === 'string' || (content.solutionApproach as any)?.description)) && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Solution Approach
            </h2>
            {isEditable ? (
              <Textarea
                value={typeof content.solutionApproach === 'string' ? content.solutionApproach : (content.solutionApproach as any)?.description ?? ''}
                onChange={(e) => applyUpdate({ ...content, solutionApproach: e.target.value })}
                className="min-h-[150px]"
                placeholder="Enter solution approach..."
              />
            ) : (
              (() => {
                const sa = content.solutionApproach;
                if (typeof sa === 'string' && sa) return <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">{sa}</p>;
                if (sa && typeof sa === 'object' && (sa as any).description) {
                  const o = sa as { description?: string; keySteps?: string[]; technologiesUsed?: string[] };
                  return (
                    <div className="space-y-2 text-muted-foreground dark:text-foreground/90">
                      <p className="leading-relaxed">{o.description}</p>
                      {Array.isArray(o.keySteps) && o.keySteps.length > 0 && <><span className="font-medium text-foreground">Key steps: </span><ul className="list-disc list-inside mt-1">{o.keySteps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul></>}
                      {Array.isArray(o.technologiesUsed) && o.technologiesUsed.length > 0 && <p><span className="font-medium text-foreground">Technologies: </span>{o.technologiesUsed.join(", ")}</p>}
                    </div>
                  );
                }
                return null;
              })()
            )}
          </section>
        )}

        {/* Technical Specifications */}
        {content.technicalSpecifications && Array.isArray(content.technicalSpecifications) && content.technicalSpecifications.length > 0 && (
          <section>
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
        {(content.deliverables && (Array.isArray(content.deliverables) && content.deliverables.length > 0 || ((content.deliverables as any)?.keyDeliverables?.length > 0) || (content.deliverables as any)?.description)) && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              Deliverables
            </h2>
            {(() => {
              const deliv = content.deliverables;
              const list = Array.isArray(deliv) ? deliv : (deliv as any)?.keyDeliverables ?? [];
              const desc = (deliv as any)?.description;
              const standards = (deliv as any)?.qualityStandards;
              return (
                <div className="space-y-2 text-muted-foreground dark:text-foreground/90">
                  {desc && <p className="leading-relaxed">{desc}</p>}
                  {list.length > 0 && <ul className="list-disc list-inside">{list.map((d: string, i: number) => <li key={i}>{d}</li>)}</ul>}
                  {Array.isArray(standards) && standards.length > 0 && <p><span className="font-medium text-foreground">Quality standards: </span>{standards.join(", ")}</p>}
                </div>
              );
            })()}
          </section>
        )}

        {/* Timeline */}
        {content.timeline && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-3 flex items-center gap-2 text-foreground">
              <Calendar className="w-4 h-4 text-primary" />
              Timeline
            </h2>
            {typeof content.timeline === 'string' ? (
              <p className="text-muted-foreground dark:text-foreground/90 m-0 leading-relaxed text-sm whitespace-pre-wrap">
                {content.timeline}
              </p>
            ) : typeof content.timeline === 'object' && content.timeline !== null ? (
              (content.timeline as any).description ? (
                <p className="text-muted-foreground dark:text-foreground/90 m-0 leading-relaxed text-sm whitespace-pre-wrap">{(content.timeline as any).description}</p>
              ) : (
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
              )
            ) : null}
          </section>
        )}

        {/* Team */}
        {content.team && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <User className="w-4 h-4 text-primary" />
              Team
            </h2>
            {typeof content.team === 'string' ? (
              <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {content.team}
              </p>
            ) : typeof content.team === 'object' && content.team !== null ? (
              (content.team as any).description ? (
                <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">{(content.team as any).description}</p>
              ) : (
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
              )
            ) : null}
          </section>
        )}

        {/* Pricing */}
        {content.pricing && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <DollarSign className="w-4 h-4 text-primary" />
              Pricing
            </h2>
            {typeof content.pricing === 'string' ? (
              <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {content.pricing}
              </p>
            ) : typeof content.pricing === 'object' && content.pricing !== null ? (
              (content.pricing as any).description ? (
                <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">{(content.pricing as any).description}</p>
              ) : (
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
              )
            ) : null}
          </section>
        )}

        {/* Next Steps */}
        {content.nextSteps && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-2 flex items-center gap-2 text-foreground">
              <ArrowLeft className="w-4 h-4 text-primary rotate-180" />
              Next Steps
            </h2>
            {(() => {
              const ns = content.nextSteps;
              if (typeof ns === 'string' && ns) return <p className="text-muted-foreground dark:text-foreground/90 leading-relaxed whitespace-pre-wrap">{ns}</p>;
              const actions = Array.isArray(ns) ? ns : (ns as any)?.keyActions ?? (ns && typeof ns === 'object' ? Object.values(ns).filter((v: any) => typeof v === 'string') : []);
              const desc = (ns as any)?.description;
              if (desc || (Array.isArray(actions) && actions.length > 0)) {
                return (
                  <div className="space-y-2 text-muted-foreground dark:text-foreground/90">
                    {desc && <p className="leading-relaxed">{desc}</p>}
                    {Array.isArray(actions) && actions.length > 0 && (
                      <ul className="list-disc list-inside">{actions.map((step: any, idx: number) => <li key={idx}>{typeof step === 'string' ? step : String(step)}</li>)}</ul>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </section>
        )}
      </div>
    );
  };

  if (proposalId && proposalError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetchProposal} error={proposalErrorObj} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="text-muted-foreground">Loading proposal...</div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-2" />
        <h3 className="text-lg font-semibold mb-2">Proposal not found</h3>
        <p className="text-muted-foreground mb-2">The proposal you're looking for doesn't exist.</p>
        <Link href={backHref}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isCollaborator ? "Back to Assigned RFPs" : "Back to Projects"}
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
          <Link href={backHref}>
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
          {isEditing && canEdit ? (
            <>
              <Button variant="outline" onClick={() => {
                setIsEditing(false);
                if (proposal && typeof proposal === 'object') {
                  const p = proposal as any;
                  if (p.content && typeof p.content === 'object' && Object.keys(p.content).length > 0) {
                    setContentData(p.content);
                  }
                }
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updatePending}>
                <Save className="w-4 h-4 mr-2" />
                {updatePending ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              {!isCollaborator && (
                <>
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" onClick={handleDuplicate}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </Button>
                </>
              )}
              {canEdit && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
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
            {proposalId && (
              <TabsTrigger asChild value="questions" className="text-xs sm:text-sm">
                <Link href={`${rfpBase}/${proposalId}/questions`} className="inline-flex items-center justify-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" />
                  Questions
                </Link>
              </TabsTrigger>
            )}
          </TabsList>
          {activeTab === "content" && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {canEdit && (
                assignees.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => { setAssignSearchEmail(""); setIsAssignOpen(true); }}
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
                    onClick={() => { setAssignSearchEmail(""); setIsAssignOpen(true); }}
                  >
                    <UserPlus className="w-4 h-4" />
                    Assign
                  </Button>
                )
              )}
              {canGenerateAi && (
                <Button
                  onClick={handleGenerateAiContent}
                  disabled={isGenerating || (user?.credits ?? 0) <= 0}
                  className="theme-gradient-bg text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={(user?.credits ?? 0) <= 0 ? "Contact your admin for more credits" : undefined}
                >
                  {isGenerating ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (user?.credits ?? 0) <= 0 ? (
                    <>
                      <Coins className="w-4 h-4 mr-2" />
                      No credits — contact admin
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate New AI Content
                    </>
                  )}
                </Button>
              )}
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
                      updateProposalMutation.mutate({ status: v });
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {proposalStatuses.map((opt) => (
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
                            updateProposalMutation.mutate({ assigneeIds: next });
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
                            updateProposalMutation.mutate({ assigneeIds: next });
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
                  <div className="flex flex-col gap-1.5 w-full">
                    <Label className="text-xs text-muted-foreground">Add by email</Label>
                    <Input
                      placeholder="Search by email to add assignee"
                      value={assignSearchEmail}
                      onChange={(e) => setAssignSearchEmail(e.target.value)}
                      className="w-full max-w-[280px]"
                    />
                    {assignSearchEmail.trim().length >= 2 && (
                      <div className="border rounded-md divide-y max-h-40 overflow-auto w-full max-w-[280px]">
                        {assignSearchResults
                          .filter((u) => !assigneeIds.includes(u.id))
                          .map((u) => {
                            const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.email || `User ${u.id}`;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/80 flex items-center gap-2"
                                onClick={() => {
                                  updateProposalMutation.mutate({ assigneeIds: [...assigneeIds, u.id] });
                                  setAssignSearchEmail("");
                                }}
                              >
                                <span className="font-medium truncate">{name}</span>
                                {u.email ? <span className="text-muted-foreground truncate">({u.email})</span> : null}
                              </button>
                            );
                          })}
                        {assignSearchResults.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
                        )}
                      </div>
                    )}
                  </div>
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
                  <Label>Due Date / Timeline</Label>
                  {isEditing ? (
                    <div className="mt-1.5 space-y-2">
                      <Input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                      <Input
                        placeholder="e.g. 6 months (optional)"
                        value={formData.timeline}
                        onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                      />
                    </div>
                  ) : (
                    <p className="mt-1.5">
                      {formData.dueDate ? (formData.timeline ? `${formData.dueDate} · ${formData.timeline}` : formData.dueDate) : (formData.timeline || "Not specified")}
                    </p>
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
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="review">Review</SelectItem>
                        <SelectItem value="won">Won</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={`mt-1.5 ${statusConfig.className}`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  )}
                </div>
                {formData.clientName && (
                  <div>
                    <Label>Client Name</Label>
                    <p className="mt-1.5">{formData.clientName}</p>
                  </div>
                )}
                {formData.clientContact && (
                  <div>
                    <Label>Primary Contact</Label>
                    <p className="mt-1.5">{formData.clientContact}</p>
                  </div>
                )}
                {formData.clientEmail && (
                  <div>
                    <Label>Contact Email</Label>
                    <p className="mt-1.5">{formData.clientEmail}</p>
                  </div>
                )}
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

          {proposalId && (
            <Card className="mt-4 sm:mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-muted-foreground" />
                  Documents
                </CardTitle>
                <CardDescription>
                  Files uploaded when this proposal was created
                </CardDescription>
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
                    <Badge variant="outline" className={softBadgeClasses.primary}>
                      <Clock className="w-3 h-3 mr-1 animate-spin" />
                      Generating {generationProgress}%
                    </Badge>
                  ) : (
                    <Badge variant="outline" className={softBadgeClasses.primary}>
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
                    {/* Left Side - Current Content (editable while generating) */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 items-center px-4 py-3 border-b sticky top-0 bg-background z-10">
                        <h3 className="text-base sm:text-lg font-semibold flex items-center justify-start gap-2 text-foreground">
                          <FileText className="w-4 h-4 text-foreground/70" />
                          Current Content
                        </h3>
                        <div></div>
                        <div className="flex justify-end">
                          <Badge variant="outline" className={`text-xs ${softBadgeClasses.archived}`}>Original</Badge>
                        </div>
                      </div>
                      <div className="prose max-w-none space-y-6 px-4">
                        {renderContentSections(oldContent, isEditing)}
                      </div>
                    </div>

                    {/* Right Side - New Content (generating animation or editable new content) */}
                    <div className="space-y-4 lg:border-l lg:pl-6">
                      <div className="grid grid-cols-3 items-center px-4 py-3 border-b sticky top-0 bg-background z-10">
                        <h3 className="text-base sm:text-lg font-semibold flex items-center justify-start gap-2 text-foreground">
                          <Sparkles className={`w-4 h-4 text-primary ${isGenerating ? "animate-pulse" : ""}`} />
                          New Content
                        </h3>
                        <div className="flex justify-center">
                          {!isGenerating && newContent && isFullDocumentContent(editableNewContent ?? newContent) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => setIsEditingNewContent((prev) => !prev)}
                            >
                              <Edit className="w-3.5 h-3.5 mr-1.5" />
                              {isEditingNewContent ? "Done" : "Edit"}
                            </Button>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <Badge variant="outline" className={`text-xs ${isGenerating ? softBadgeClasses.primary : softBadgeClasses.success}`}>
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
                          isFullDocumentContent(editableNewContent ?? newContent) ? (
                            <div className="space-y-6">
                              <ProposalQuillEditor
                                key={`content-${(editableNewContent ?? newContent)?.generatedAt ?? "new"}`}
                                value={getFullDocumentText(editableNewContent ?? newContent)}
                                onChange={(html) =>
                                  setEditableNewContent({ ...(editableNewContent ?? newContent), fullDocument: html })
                                }
                                readOnly={!isEditingNewContent}
                                placeholder="AI-generated proposal"
                                minHeight="280px"
                              />
                            </div>
                          ) : (
                            renderContentSections(editableNewContent ?? newContent, true, (next) => setEditableNewContent(next))
                          )
                        ) : null}
                      </div>
                      {!isGenerating && newContent && (
                        <div className="sticky bottom-0 pt-4 border-t bg-background/95 backdrop-blur mt-4 z-20">
                          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                            <Button
                              onClick={handleAcceptNewContent}
                              className="flex-1 min-w-[140px] theme-gradient-bg text-white hover:opacity-95"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Accept New Content
                            </Button>
                            <Button
                              onClick={handleRejectNewContent}
                              variant="outline"
                              className="flex-1 min-w-[140px]"
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
                          readOnly={!(canEdit && isEditing)}
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

        {/* Content tab now uses Quill editor only */}

        <TabsContent value="team" className="mt-6 mb-2">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="mb-2">Assigned collaborators</CardTitle>
                  <CardDescription className="mt-1">
                    {isCollaborator
                      ? "Collaborators assigned to this proposal."
                      : "View and manage who can work on this proposal. You have full control to add or remove collaborators."}
                  </CardDescription>
                </div>
                {!isCollaborator && (
                  <Button onClick={openInviteDialog}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite collaborator
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {collaborations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No collaborators assigned yet</p>
                    {!isCollaborator && (
                      <Button variant="outline" className="mt-4" onClick={openInviteDialog}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite collaborator
                      </Button>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {collaborations.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-4 p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                            {c.user
                              ? `${(c.user.firstName || "")[0] || ""}${(c.user.lastName || "")[0] || ""}`.toUpperCase() || "?"
                              : "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() || c.user.email : `User #${c.userId}`}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">{c.user?.email ?? ""}</p>
                          </div>
                          <Badge variant="secondary" className="shrink-0 capitalize">{c.role}</Badge>
                        </div>
                        {!isCollaborator && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => openEditCollaborator(c)}>
                                <FileEdit className="w-4 h-4 mr-2" />
                                Edit role & permissions
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <UserCog className="w-4 h-4 mr-2" />
                                  Change role
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {roleOptions.map((r) => (
                                    <DropdownMenuItem key={r.value} onClick={() => handleChangeRoleRow(c, r.value)}>
                                      <r.icon className="w-4 h-4 mr-2" />
                                      {r.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuItem onClick={() => openAssignMore(c)}>
                                <FolderPlus className="w-4 h-4 mr-2" />
                                Assign to more proposals
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRemoveFromThisProposal(c)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove from &quot;{proposalTitle}&quot;
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openTasks(c)}>
                                <ListTodo className="w-4 h-4 mr-2" />
                                View tasks
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleRemoveFromAll(c)}>
                                <UserX className="w-4 h-4 mr-2" />
                                Remove from all proposals
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          {isCollaborator && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="mb-2">My changes</CardTitle>
                <CardDescription className="mt-1">Your edits and version history on this proposal</CardDescription>
              </CardHeader>
              <CardContent>
                {myActivityEntries.length > 0 ? (
                  <div className="space-y-3">
                    {myActivityEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{entry.action}</p>
                          {entry.details && <p className="text-xs text-muted-foreground">{entry.details}</p>}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Your edits and version history will appear here when the backend supports activity tracking.</p>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="mb-2">Activity Log</CardTitle>
              <CardDescription className="mt-1">Recent activity on this proposal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityEntries.length > 0 ? (
                  activityEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{entry.action}</p>
                        {entry.userName && <p className="text-xs text-muted-foreground">{entry.userName}</p>}
                        {entry.details && <p className="text-xs text-muted-foreground">{entry.details}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discussion" className="mt-6">
          {proposalId && (
            <ProposalDiscussionTab
              proposalId={proposalId}
              canComment={canCommentDiscussion}
              questionsHref={rfpBase}
            />
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isEditCollaboratorOpen} onOpenChange={setIsEditCollaboratorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit collaborator</DialogTitle>
            <DialogDescription>Change role for {editCollaboratorRow ? `${editCollaboratorRow.c.user?.firstName ?? ""} ${editCollaboratorRow.c.user?.lastName ?? ""}`.trim() || editCollaboratorRow.c.user?.email : ""} on this proposal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Role</Label>
            <Select value={editCollaboratorRole} onValueChange={setEditCollaboratorRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r) => (
                  <SelectItem key={r.value} value={r.value}><div className="flex items-center gap-2"><r.icon className="w-4 h-4" /><span>{r.label}</span></div></SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditCollaboratorOpen(false)}>Cancel</Button>
            <Button onClick={confirmEditCollaborator}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignMoreOpen} onOpenChange={setIsAssignMoreOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to more proposals</DialogTitle>
            <DialogDescription>Add {assignMoreRow?.c.user?.firstName} {assignMoreRow?.c.user?.lastName} to more proposals.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Select proposals</Label>
            <div className="space-y-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
              {otherProposalsForAssign.map((p) => (
                <div key={p.id} className="flex items-center space-x-2">
                  <Checkbox id={`am-${p.id}`} checked={assignMoreProposalIds.includes(p.id)} onCheckedChange={() => toggleAssignMoreProject(p.id)} />
                  <label htmlFor={`am-${p.id}`} className="text-sm font-medium cursor-pointer">{p.title}</label>
                </div>
              ))}
              {otherProposalsForAssign.length === 0 && <p className="text-sm text-muted-foreground">No other proposals.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignMoreOpen(false)}>Cancel</Button>
            <Button onClick={confirmAssignMore} disabled={assignMoreProposalIds.length === 0}>Add to selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTasksOpen} onOpenChange={setIsTasksOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tasks</DialogTitle>
            <DialogDescription>Tasks for {tasksRow?.c.user?.firstName} {tasksRow?.c.user?.lastName} (from API).</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {tasksRow && getTasksForRow(tasksRow.c, tasksRow.proposalTitle).length > 0 ? (
              <ul className="space-y-2 border rounded-lg divide-y p-2">
                {tasksRow && getTasksForRow(tasksRow.c, tasksRow.proposalTitle).map((task) => (
                  <li key={task.id} className="flex items-start justify-between gap-2 py-2">
                    <div><p className="font-medium text-sm">{task.title}</p><p className="text-xs text-muted-foreground">{task.dueDate}</p></div>
                    <Badge variant={task.status === "In progress" ? "default" : "secondary"} className="text-xs">{task.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTasksOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <r.icon className="w-4 h-4" />
                        <span>{r.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign to proposals (leave empty = all)</Label>
              <div className="space-y-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                {myProposals.map((p) => (
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

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export RFP</DialogTitle>
            <DialogDescription>
              Choose a format to export your RFP responses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportDocx}
              disabled={!exportPayload}
            >
              <FileText className="w-4 h-4 mr-2" />
              Export to Word (.docx)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportPdf}
              disabled={!exportPayload}
            >
              <FileText className="w-4 h-4 mr-2" />
              Export to PDF
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleExportXlsx}
              disabled={!exportPayload}
            >
              <FileText className="w-4 h-4 mr-2" />
              Export to Excel (.xlsx)
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
