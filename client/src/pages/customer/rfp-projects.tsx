import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useStore } from "@/contexts/StoreContext";
import { useProposalsList, useDeleteProposal, useSearchUsers, useCreateProposal, proposalKeys } from "@/hooks/use-proposals-api";
import { fetchQuestions, fetchAnswers, addCollaboration, parseRfpUpload, createQuestion } from "@/api/proposals";
import {
  Plus, Search, FileText, Upload, Edit, Trash2, MoreHorizontal,
  Calendar, Filter, Download, FileUp, CheckCircle, Clock, AlertCircle, Users, Link2, UserPlus,
  Eye, FileEdit, MessageSquare, Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { getProposalStatusBadgeClass, softBadgeClasses } from "@/lib/badge-classes";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  buildExportPayloadFromProposal,
  downloadProposalPdf,
  downloadProposalDocx,
  downloadProposalXlsx,
  downloadProposalJson,
} from "@/lib/export-proposal";
import { COLLABORATOR_ROLE_OPTIONS, getPermissionsForRole, DEFAULT_COLLABORATOR_PERMISSIONS } from "@/lib/collaborator-roles";

export default function RFPProjects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const store = useStore();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteProject, setInviteProject] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [invitePermissions, setInvitePermissions] = useState(DEFAULT_COLLABORATOR_PERMISSIONS);
  const [inviteProjects, setInviteProjects] = useState<number[]>([]);
  const [selectedSearchUser, setSelectedSearchUser] = useState<{ id: number; email: string; firstName: string; lastName: string } | null>(null);
  const [exportDialogProject, setExportDialogProject] = useState<any>(null);

  const { data: proposalsData, isLoading: proposalsLoading } = useProposalsList();
  const proposals = proposalsData ?? [];
  const myProposalIds = useMemo(() => proposals.map((p) => p.id), [proposals]);
  const { data: inviteSearchResults = [] } = useSearchUsers({
    email: inviteEmail.trim().length >= 2 ? inviteEmail.trim() : null,
    role: "collaborator",
  });
  const deleteProposalMutation = useDeleteProposal();
  const createProposalMutation = useCreateProposal();

  const proposalIds = useMemo(() => proposals.map((p) => p.id), [proposals]);
  const questionsQueries = useQueries({
    queries: proposalIds.map((id) => ({
      queryKey: proposalKeys.questions(id),
      queryFn: () => fetchQuestions(id),
      enabled: id > 0,
    })),
  });
  const answersQueries = useQueries({
    queries: proposalIds.map((id) => ({
      queryKey: proposalKeys.answers(id),
      queryFn: () => fetchAnswers(id),
      enabled: id > 0,
    })),
  });

  const questionCountByProposalId = useMemo(() => {
    const map: Record<number, number> = {};
    proposalIds.forEach((id, i) => {
      map[id] = questionsQueries[i]?.data?.length ?? 0;
    });
    return map;
  }, [proposalIds, questionsQueries]);
  const answeredCountByProposalId = useMemo(() => {
    const map: Record<number, number> = {};
    proposalIds.forEach((id, i) => {
      const answers = answersQueries[i]?.data ?? [];
      map[id] = answers.filter((a) => a.answer?.trim()).length;
    });
    return map;
  }, [proposalIds, answersQueries]);

  const allProjects = proposals.map((p) => ({
    ...p,
    questionCount: questionCountByProposalId[p.id] ?? 0,
    answeredCount: answeredCountByProposalId[p.id] ?? 0,
    collaboratorsCount: store.getCollaborationsByProposal(p.id).length,
    deadline: (p as { deadline?: string }).deadline ?? p.updatedAt,
  }));

  const filteredProjects = allProjects.filter((project: any) => {
    const matchesSearch = !searchTerm || 
      project.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeClass = (status: string) => getProposalStatusBadgeClass(status);
  const getStatusLabel = (status: string) => {
    if (status === "in_progress") return "In Progress";
    return status.replace("_", " ");
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Less than an hour ago";
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const formatDeadline = (date: Date | string) => {
    const deadline = new Date(date);
    const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return "Overdue";
    if (daysUntil === 0) return "Due today";
    if (daysUntil === 1) return "Due tomorrow";
    return `${daysUntil} days left`;
  };

  const handleDelete = (project: any) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedProject?.id) {
      deleteProposalMutation.mutate(selectedProject.id, {
        onSuccess: () => {
          toast({
            title: "Project deleted",
            description: `${selectedProject.title} has been deleted.`,
            variant: "destructive",
          });
          setDeleteDialogOpen(false);
          setSelectedProject(null);
        },
        onError: (err) => {
          toast({
            title: "Delete failed",
            description: err instanceof Error ? err.message : "Could not delete project",
            variant: "destructive",
          });
        },
      });
    }
  };

  const openInviteDialog = (project: any) => {
    setInviteProject(project);
    setInviteProjects(project ? [project.id] : []);
    setInviteEmail("");
    setInviteRole("viewer");
    setInvitePermissions({ canView: true, canEdit: false, canComment: false, canReview: false, canGenerateAi: false });
    setSelectedSearchUser(null);
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

  const handleInviteCollaborator = async () => {
    if (!selectedSearchUser) {
      toast({ title: "Select a user", description: "Search by email and select a collaborator.", variant: "destructive" });
      return;
    }
    const proposalIds = inviteProjects.length > 0 ? inviteProjects : myProposalIds;
    if (proposalIds.length === 0) {
      toast({ title: "No proposals", description: "Create a proposal first.", variant: "destructive" });
      return;
    }
    let added = 0;
    try {
      for (const proposalId of proposalIds) {
        try {
          await addCollaboration(proposalId, {
            userId: selectedSearchUser.id,
            role: inviteRole,
            canView: invitePermissions.canView,
            canEdit: invitePermissions.canEdit,
            canComment: invitePermissions.canComment,
            canReview: invitePermissions.canReview,
            canGenerateAi: invitePermissions.canGenerateAi,
          });
          added++;
        } catch (_) {
          // User already on this proposal, skip
        }
        qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Invitation sent", description: `${selectedSearchUser.email} has been added to ${added} proposal(s).` });
      setIsInviteOpen(false);
      setInviteProject(null);
      setInviteEmail("");
      setSelectedSearchUser(null);
      setInviteProjects([]);
      setInviteRole("viewer");
      setInvitePermissions(DEFAULT_COLLABORATOR_PERMISSIONS);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const [importing, setImporting] = useState(false);
  const handleImport = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    toast({
      title: "Importing RFP",
      description: `Parsing ${file.name}...`,
    });
    try {
      let title: string;
      let questions: { question: string; order: number }[];
      try {
        const parsed = await parseRfpUpload(file);
        title = (parsed.title ?? file.name.replace(/\.[^.]+$/, "")) || "Imported RFP";
        questions = Array.isArray(parsed.questions) && parsed.questions.length > 0
          ? parsed.questions
          : [{ question: `Imported from "${file.name}". Add or edit questions below.`, order: 0 }];
      } catch {
        title = (file.name.replace(/\.[^.]+$/, "") || "Imported RFP");
        questions = [{ question: `Imported from "${file.name}". Add or edit questions below, or use AI to generate more.`, order: 0 }];
      }
      const proposal = await createProposalMutation.mutateAsync({
        title,
        description: null,
      });
      const proposalId = proposal.id;
      for (let i = 0; i < questions.length; i++) {
        await createQuestion(proposalId, {
          question: questions[i].question,
          order: questions[i].order ?? i,
          source: "import",
        });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
      qc.invalidateQueries({ queryKey: proposalKeys.questions(proposalId) });
      toast({
        title: "RFP imported",
        description: questions.length > 1 ? `${questions.length} questions extracted. You can edit them in the project.` : "Project created. Add or edit questions.",
      });
      setIsImportDialogOpen(false);
      navigate(`/rfp/${proposalId}/questions`);
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const exportPayload = exportDialogProject
    ? buildExportPayloadFromProposal(exportDialogProject)
    : null;

  const handleExportPdf = () => {
    if (!exportPayload) return;
    downloadProposalPdf(exportPayload);
    toast({ title: "Exported", description: "PDF downloaded." });
    setExportDialogProject(null);
  };
  const handleExportDocx = async () => {
    if (!exportPayload) return;
    await downloadProposalDocx(exportPayload);
    toast({ title: "Exported", description: "Word document downloaded." });
    setExportDialogProject(null);
  };
  const handleExportXlsx = () => {
    if (!exportPayload) return;
    downloadProposalXlsx(exportPayload);
    toast({ title: "Exported", description: "Excel spreadsheet downloaded." });
    setExportDialogProject(null);
  };
  const handleExportJson = () => {
    if (!exportDialogProject) return;
    downloadProposalJson(exportDialogProject);
    toast({ title: "Exported", description: "JSON downloaded." });
    setExportDialogProject(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">RFP Projects</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your RFP projects, import files, and track progress
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-initial text-xs sm:text-sm"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import RFP
          </Button>
          <Link href="/proposals/new" className="flex-1 sm:flex-initial">
            <Button size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="search-box flex-1">
              <Search className="search-box-icon" />
              <Input
                placeholder="Search projects..."
                className="text-sm sm:text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 text-sm sm:text-base">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects List */}
      {proposalsLoading ? (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <p className="text-muted-foreground">Loading projects...</p>
          </CardContent>
        </Card>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold mb-2">No projects found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first RFP project to get started"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Link href="/proposals/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {filteredProjects.map((project: any) => {
            const daysUntilDeadline = Math.ceil(
              (new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            const isUrgent = daysUntilDeadline <= 7 && project.status !== "completed";

            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className={`flex ${isMobile ? 'flex-col' : 'items-start justify-between'} gap-4`}>
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 sm:gap-3 mb-2">
                            <h3 className="text-base sm:text-lg font-semibold truncate">
                              {project.title}
                            </h3>
                            <Badge variant="outline" className={`${getStatusBadgeClass(project.status)} text-[10px] sm:text-xs shrink-0 border`}>
                              {getStatusLabel(project.status)}
                            </Badge>
                            {isUrgent && (
                              <Badge variant="outline" className={`${softBadgeClasses.warning} text-[10px] sm:text-xs shrink-0 border`}>
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Urgent
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-muted-foreground mb-3">
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span>{project.answeredCount ?? 0} / {project.questionCount ?? 0} questions</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span>{project.collaboratorsCount ?? 0} collaborators</span>
                            </div>
                            {project.timeline && (
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span>{project.timeline}</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">
                                {project.questionCount ? Math.round(((project.answeredCount ?? 0) / project.questionCount) * 100) : 0}%
                              </span>
                            </div>
                            <Progress
                              value={project.questionCount ? ((project.answeredCount ?? 0) / project.questionCount) * 100 : 0}
                              className="h-2"
                            />
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/rfp/${project.id}`)}>
                              <FileText className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openInviteDialog(project)}>
                              <UserPlus className="w-4 h-4 mr-2" />
                              Invite collaborator
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/rfp/${project.id}?edit=true`)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setExportDialogProject(project)}>
                              <Download className="w-4 h-4 mr-2" />
                              Export
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDelete(project)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import RFP File</DialogTitle>
            <DialogDescription>
              Upload a PDF or Word document to automatically parse questions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <FileUp className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground mb-4">
                Supported formats: PDF, DOC, DOCX (Max 10MB)
              </p>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                disabled={importing}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f) handleImport(f);
                  e.target.value = "";
                }}
                className="max-w-xs mx-auto"
              />
            {importing && (
              <p className="text-sm text-primary mt-2">Parsing file… Creating project…</p>
            )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• The system will automatically extract questions from your document</p>
              <p>• You can edit questions after import</p>
              <p>• Import may take a few moments depending on file size</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={importing}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Collaborator Dialog (same as Collaborator Management page) */}
      <Dialog open={isInviteOpen} onOpenChange={(open) => { if (!open) { setInviteProject(null); setSelectedSearchUser(null); setInviteProjects([]); } setIsInviteOpen(open); }}>
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
                onChange={(e) => { setInviteEmail(e.target.value); setSelectedSearchUser(null); }}
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
                      onClick={() => setSelectedSearchUser({ id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName })}
                    >
                      <span>{u.firstName} {u.lastName} ({u.email})</span>
                      {selectedSearchUser?.id === u.id && <span className="text-primary">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {inviteEmail.trim().length >= 2 && inviteSearchResults.length === 0 && !selectedSearchUser && (
              <p className="text-sm text-muted-foreground">No collaborator found with this email. They must register first.</p>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={handleInviteRoleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLABORATOR_ROLE_OPTIONS.map((r) => (
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
                {allProjects.map((p) => (
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
            <Button onClick={handleInviteCollaborator} disabled={!selectedSearchUser}>
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProject?.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export format dialog */}
      <Dialog open={!!exportDialogProject} onOpenChange={(open) => !open && setExportDialogProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export project</DialogTitle>
            <DialogDescription>Choose a format to download</DialogDescription>
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
            <Button variant="outline" className="w-full justify-start" onClick={handleExportJson} disabled={!exportDialogProject}>
              <FileText className="w-4 h-4 mr-2" /> JSON
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogProject(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
