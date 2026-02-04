import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  Search,
  UserPlus,
  UserX,
  MoreHorizontal,
  Users,
  Eye,
  FileEdit,
  MessageSquare,
  CheckCircle,
  Sparkles,
  ListTodo,
  FolderPlus,
  Trash2,
  UserCog,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useProposalsList, useSearchUsers, proposalKeys } from "@/hooks/use-proposals-api";
import {
  addCollaboration,
  updateCollaboration,
  deleteCollaboration,
  fetchCollaborations,
} from "@/api/proposals";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { Collaboration as ApiCollaboration, CollaboratorUserInfo } from "@/api/proposals";
import { COLLABORATOR_ROLE_OPTIONS, getPermissionsForRole, DEFAULT_COLLABORATOR_PERMISSIONS } from "@/lib/collaborator-roles";

type CollaboratorAggregate = {
  user: CollaboratorUserInfo;
  assignments: { proposalId: number; title: string; role: string; collaboration: ApiCollaboration }[];
};

export default function CollaboratorManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<CollaboratorAggregate | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editCollaborator, setEditCollaborator] = useState<CollaboratorAggregate | null>(null);
  const [editRole, setEditRole] = useState("viewer");
  const [editAssignmentIds, setEditAssignmentIds] = useState<{ proposalId: number; collaborationId: number }[]>([]);
  const [isAssignMoreDialogOpen, setIsAssignMoreDialogOpen] = useState(false);
  const [assignMoreCollaborator, setAssignMoreCollaborator] = useState<CollaboratorAggregate | null>(null);
  const [assignMoreProposalIds, setAssignMoreProposalIds] = useState<number[]>([]);
  const [isTasksDialogOpen, setIsTasksDialogOpen] = useState(false);
  const [tasksCollaborator, setTasksCollaborator] = useState<CollaboratorAggregate | null>(null);
  const [activeTab, setActiveTab] = useState("collaborators");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [invitePermissions, setInvitePermissions] = useState(DEFAULT_COLLABORATOR_PERMISSIONS);
  const [inviteProjects, setInviteProjects] = useState<number[]>([]);
  const [selectedSearchUser, setSelectedSearchUser] = useState<{ id: number; email: string; firstName: string; lastName: string } | null>(null);
  const [pendingRemoveFromProposal, setPendingRemoveFromProposal] = useState<{
    agg: CollaboratorAggregate;
    proposalId: number;
    collaborationId: number;
    proposalTitle: string;
  } | null>(null);
  const [removeFromProposalDialogAgg, setRemoveFromProposalDialogAgg] = useState<CollaboratorAggregate | null>(null);

  const { data: proposalsData } = useProposalsList();
  const myProposals = proposalsData ?? [];
  const myProposalIds = myProposals.map((p) => p.id);

  const collaborationQueries = useQueries({
    queries: myProposalIds.map((id) => ({
      queryKey: proposalKeys.collaborations(id),
      queryFn: () => fetchCollaborations(id),
      enabled: myProposalIds.length > 0,
    })),
  });

  const collaboratorsAggregate: CollaboratorAggregate[] = useMemo(() => {
    const byUserId = new Map<number, { user: CollaboratorUserInfo; assignments: CollaboratorAggregate["assignments"] }>();
    collaborationQueries.forEach((q, idx) => {
      const list = q.data as ApiCollaboration[] | undefined;
      const proposalId = myProposalIds[idx];
      const proposal = myProposals.find((p) => p.id === proposalId);
      const title = proposal?.title ?? "Unknown";
      if (!list) return;
      list.forEach((c) => {
        const u = c.user ?? { id: c.userId, email: "", firstName: "User", lastName: String(c.userId) };
        if (!byUserId.has(u.id)) {
          byUserId.set(u.id, { user: u, assignments: [] });
        }
        byUserId.get(u.id)!.assignments.push({ proposalId, title, role: c.role, collaboration: c });
      });
    });
    return Array.from(byUserId.entries()).map(([, v]) => ({
      user: v.user,
      assignments: v.assignments,
    }));
  }, [collaborationQueries, myProposalIds, myProposals]);

  const filteredCollaborators = collaboratorsAggregate.filter((agg) => {
    const name = `${agg.user.firstName} ${agg.user.lastName}`;
    const matchesSearch =
      !searchTerm ||
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agg.user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const primaryRole = agg.assignments[0]?.role ?? "viewer";
    const matchesRole = roleFilter === "all" || primaryRole === roleFilter;
    return matchesSearch && matchesRole;
  });

  const { data: searchResults = [] } = useSearchUsers({
    email: inviteEmail.trim() || null,
    role: "collaborator",
  });

  const getRoleConfig = (role: string) => COLLABORATOR_ROLE_OPTIONS.find((r) => r.value === role) || COLLABORATOR_ROLE_OPTIONS[0];

  const handleInvite = async () => {
    if (!selectedSearchUser) {
      toast({ title: "Select a user", description: "Search by email and select a collaborator.", variant: "destructive" });
      return;
    }
    const proposalIds = inviteProjects.length > 0 ? inviteProjects : myProposalIds;
    if (proposalIds.length === 0) {
      toast({ title: "No proposals", description: "Create a proposal first.", variant: "destructive" });
      return;
    }
    const existingByProposal = new Set(
      collaborationQueries.flatMap((q, idx) => {
        const list = (q.data as ApiCollaboration[] | undefined) ?? [];
        return list.filter((c) => c.userId === selectedSearchUser.id).map(() => myProposalIds[idx]);
      })
    );
    let added = 0;
    try {
      for (const proposalId of proposalIds) {
        if (existingByProposal.has(proposalId)) continue;
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
        qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Invitation sent", description: `${selectedSearchUser.email} has been added to ${added} proposal(s).` });
      setIsInviteDialogOpen(false);
      setInviteEmail("");
      setSelectedSearchUser(null);
      setInviteProjects([]);
      setInviteRole("viewer");
      setInvitePermissions(DEFAULT_COLLABORATOR_PERMISSIONS);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleRemove = (agg: CollaboratorAggregate) => {
    setSelectedCollaborator(agg);
    setIsRemoveDialogOpen(true);
  };

  const confirmRemove = async () => {
    if (!selectedCollaborator) return;
    try {
      for (const a of selectedCollaborator.assignments) {
        await deleteCollaboration(a.proposalId, a.collaboration.id);
        qc.invalidateQueries({ queryKey: proposalKeys.collaborations(a.proposalId) });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({
        title: "Collaborator removed",
        description: `${selectedCollaborator.user.firstName} has been removed from all your proposals.`,
        variant: "destructive",
      });
      setIsRemoveDialogOpen(false);
      setSelectedCollaborator(null);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleToggleEnabled = async (agg: CollaboratorAggregate, enabled: boolean) => {
    try {
      for (const a of agg.assignments) {
        await updateCollaboration(a.proposalId, a.collaboration.id, { enabled });
        qc.invalidateQueries({ queryKey: proposalKeys.collaborations(a.proposalId) });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: enabled ? "Enabled" : "Disabled", description: `Collaborator ${enabled ? "enabled" : "disabled"}.` });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const toggleProject = (proposalId: number) => {
    setInviteProjects((prev) =>
      prev.includes(proposalId) ? prev.filter((id) => id !== proposalId) : [...prev, proposalId]
    );
  };

  const handleInviteRoleChange = (role: string) => {
    setInviteRole(role);
    setInvitePermissions(getPermissionsForRole(role));
  };

  const openEditDialog = (agg: CollaboratorAggregate) => {
    setEditCollaborator(agg);
    setEditRole(agg.assignments[0]?.role ?? "viewer");
    setEditAssignmentIds(agg.assignments.map((a) => ({ proposalId: a.proposalId, collaborationId: a.collaboration.id })));
    setIsEditDialogOpen(true);
  };

  const toggleEditAssignment = (proposalId: number, collaborationId: number) => {
    setEditAssignmentIds((prev) => {
      const exists = prev.some((e) => e.proposalId === proposalId && e.collaborationId === collaborationId);
      if (exists) return prev.filter((e) => !(e.proposalId === proposalId && e.collaborationId === collaborationId));
      return [...prev, { proposalId, collaborationId }];
    });
  };

  const confirmEdit = async () => {
    if (!editCollaborator) return;
    const toUpdate = editAssignmentIds.length > 0
      ? editCollaborator.assignments.filter((a) =>
          editAssignmentIds.some((e) => e.proposalId === a.proposalId && e.collaborationId === a.collaboration.id)
        )
      : editCollaborator.assignments;
    try {
      for (const a of toUpdate) {
        await updateCollaboration(a.proposalId, a.collaboration.id, { role: editRole });
        qc.invalidateQueries({ queryKey: proposalKeys.collaborations(a.proposalId) });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Updated", description: `Role set to ${editRole} for selected proposals.` });
      setIsEditDialogOpen(false);
      setEditCollaborator(null);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const openAssignMoreDialog = (agg: CollaboratorAggregate) => {
    setAssignMoreCollaborator(agg);
    setAssignMoreProposalIds([]);
    setIsAssignMoreDialogOpen(true);
  };

  const toggleAssignMoreProject = (proposalId: number) => {
    setAssignMoreProposalIds((prev) =>
      prev.includes(proposalId) ? prev.filter((id) => id !== proposalId) : [...prev, proposalId]
    );
  };

  const confirmAssignMore = async () => {
    if (!assignMoreCollaborator || assignMoreProposalIds.length === 0) {
      toast({ title: "Select proposals", description: "Select at least one proposal to add.", variant: "destructive" });
      return;
    }
    const first = assignMoreCollaborator.assignments[0];
    const role = first?.role ?? "viewer";
    const perms = getPermissionsForRole(role);
    try {
      for (const proposalId of assignMoreProposalIds) {
        await addCollaboration(proposalId, {
          userId: assignMoreCollaborator.user.id,
          role,
          ...perms,
        });
        qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Added", description: `Collaborator added to ${assignMoreProposalIds.length} proposal(s).` });
      setIsAssignMoreDialogOpen(false);
      setAssignMoreCollaborator(null);
      setAssignMoreProposalIds([]);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const openTasksDialog = (agg: CollaboratorAggregate) => {
    setTasksCollaborator(agg);
    setIsTasksDialogOpen(true);
  };

  const handleChangeRole = async (agg: CollaboratorAggregate, newRole: string) => {
    try {
      for (const a of agg.assignments) {
        await updateCollaboration(a.proposalId, a.collaboration.id, { role: newRole });
        qc.invalidateQueries({ queryKey: proposalKeys.collaborations(a.proposalId) });
      }
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Role updated", description: `Role set to ${newRole} for all proposals.` });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const openRemoveFromProposalConfirm = (agg: CollaboratorAggregate, proposalId: number, collaborationId: number, proposalTitle: string) => {
    setPendingRemoveFromProposal({ agg, proposalId, collaborationId, proposalTitle });
  };

  const confirmRemoveFromProposal = async () => {
    if (!pendingRemoveFromProposal) return;
    const { proposalId, collaborationId, proposalTitle } = pendingRemoveFromProposal;
    try {
      await deleteCollaboration(proposalId, collaborationId);
      qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      toast({ title: "Removed", description: `Removed from ${proposalTitle}.` });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setPendingRemoveFromProposal(null);
    }
  };

  const getTasksForCollaborator = (agg: CollaboratorAggregate) => {
    return agg.assignments.flatMap((a, i) => [
      { id: `t-${agg.user.id}-${a.proposalId}-1`, title: `Review draft for ${a.title}`, proposalTitle: a.title, status: i === 0 ? "In progress" : "Pending", dueDate: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toLocaleDateString() },
      { id: `t-${agg.user.id}-${a.proposalId}-2`, title: `Submit answers`, proposalTitle: a.title, status: "Pending", dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString() },
    ]);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Collaborator Management</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Invite and manage collaborators for your proposals (search by email; user must be registered as collaborator)
          </p>
        </div>
        <Button size="sm" className="w-full sm:w-auto text-xs sm:text-sm" onClick={() => setIsInviteDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Collaborator
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="collaborators">Collaborators</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="collaborators" className="space-y-4 sm:space-y-6">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search collaborators..."
                    className="pl-10 text-sm sm:text-base"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-40 text-sm sm:text-base">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {filteredCollaborators.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <Users className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No collaborators found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Invite collaborators from a proposal&apos;s Team tab or here. They must be registered with role &quot;collaborator&quot;.
                </p>
                <Button onClick={() => setIsInviteDialogOpen(true)}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Collaborator
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              {filteredCollaborators.map((agg) => {
                const primaryRole = agg.assignments[0]?.role ?? "viewer";
                const roleConfig = getRoleConfig(primaryRole);
                const RoleIcon = roleConfig.icon;
                const enabled = agg.assignments[0]?.collaboration.enabled !== false;
                return (
                  <Card key={agg.user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 sm:p-6">
                      <div className={`flex ${isMobile ? "flex-col" : "items-start justify-between"} gap-4`}>
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <Avatar className="w-12 h-12 sm:w-14 sm:h-14">
                            <AvatarFallback className="theme-gradient-bg text-white text-sm sm:text-base font-semibold">
                              {agg.user.firstName?.[0] ?? ""}
                              {agg.user.lastName?.[0] ?? ""}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 sm:gap-3 mb-2">
                              <h3 className="font-semibold text-sm sm:text-base">
                                {agg.user.firstName} {agg.user.lastName}
                              </h3>
                              <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
                                {enabled ? "Active" : "Disabled"}
                              </Badge>
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground mb-2">{agg.user.email}</p>
                            <div className="flex items-center gap-2 mb-2">
                              <RoleIcon className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                              <Badge variant="outline" className="text-xs">
                                {roleConfig.label}
                              </Badge>
                            </div>
                            {agg.assignments.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {agg.assignments.map(({ proposalId, title, role, collaboration }) => (
                                  <Badge key={proposalId} variant="secondary" className="text-xs">
                                    {title} ({role})
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`flex ${isMobile ? "flex-col" : "items-center"} gap-3 shrink-0`}>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Enable</Label>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) => handleToggleEnabled(agg, checked)}
                            />
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => openEditDialog(agg)}>
                                <FileEdit className="w-4 h-4 mr-2" />
                                Edit role & permissions
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <UserCog className="w-4 h-4 mr-2" />
                                  Change role
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {COLLABORATOR_ROLE_OPTIONS.map((r) => (
                                    <DropdownMenuItem key={r.value} onClick={() => handleChangeRole(agg, r.value)}>
                                      <r.icon className="w-4 h-4 mr-2" />
                                      {r.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              <DropdownMenuItem onClick={() => openAssignMoreDialog(agg)}>
                                <FolderPlus className="w-4 h-4 mr-2" />
                                Assign to more proposals
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRemoveFromProposalDialogAgg(agg)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Remove from a proposal...
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openTasksDialog(agg)}>
                                <ListTodo className="w-4 h-4 mr-2" />
                                View tasks
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleRemove(agg)}>
                                <UserX className="w-4 h-4 mr-2" />
                                Remove from all proposals
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="roles" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {COLLABORATOR_ROLE_OPTIONS.map((role) => {
              const RoleIcon = role.icon;
              return (
                <Card key={role.value}>
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <RoleIcon className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-base sm:text-lg">{role.label}</CardTitle>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{role.description}</p>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurable permissions</CardTitle>
              <CardDescription>When inviting, you can set: View, Edit, Comment, Review, Generate AI</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Collaborator</DialogTitle>
            <DialogDescription>
              Search by email. User must already be registered with role &quot;collaborator&quot;. Then choose a role and assign to proposals.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="collaborator@example.com"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setSelectedSearchUser(null);
                }}
              />
            </div>
            {inviteEmail.trim() && searchResults.length > 0 && (
              <div className="space-y-2">
                <Label>Select user</Label>
                <div className="border rounded-lg divide-y max-h-32 overflow-y-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center justify-between"
                      onClick={() =>
                        setSelectedSearchUser({
                          id: u.id,
                          email: u.email,
                          firstName: u.firstName,
                          lastName: u.lastName,
                        })
                      }
                    >
                      <span>{u.firstName} {u.lastName} ({u.email})</span>
                      {selectedSearchUser?.id === u.id && <span className="text-primary">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {inviteEmail.trim() && searchResults.length === 0 && !selectedSearchUser && (
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
                {myProposals.map((p) => (
                  <div key={p.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`proj-${p.id}`}
                      checked={inviteProjects.length === 0 || inviteProjects.includes(p.id)}
                      onCheckedChange={() => toggleProject(p.id)}
                    />
                    <label htmlFor={`proj-${p.id}`} className="text-sm font-medium cursor-pointer">
                      {p.title}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={!selectedSearchUser}>
              Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Collaborator</DialogTitle>
            <DialogDescription>
              Remove &quot;{selectedCollaborator?.user.firstName} {selectedCollaborator?.user.lastName}&quot; from all your proposals? They will lose access to every proposal you shared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeFromProposalDialogAgg} onOpenChange={(open) => !open && setRemoveFromProposalDialogAgg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove from a proposal</DialogTitle>
            <DialogDescription>
              Choose which proposal to remove {removeFromProposalDialogAgg ? `${removeFromProposalDialogAgg.user.firstName} ${removeFromProposalDialogAgg.user.lastName}` : ""} from. A confirmation will appear next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {removeFromProposalDialogAgg?.assignments.map(({ proposalId, title, collaboration }) => (
              <div key={proposalId} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <span className="font-medium text-sm">{title}</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    openRemoveFromProposalConfirm(removeFromProposalDialogAgg, proposalId, collaboration.id, title);
                    setRemoveFromProposalDialogAgg(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveFromProposalDialogAgg(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingRemoveFromProposal} onOpenChange={(open) => !open && setPendingRemoveFromProposal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm remove</DialogTitle>
            <DialogDescription>
              Remove &quot;{pendingRemoveFromProposal?.agg.user.firstName} {pendingRemoveFromProposal?.agg.user.lastName}&quot; from &quot;{pendingRemoveFromProposal?.proposalTitle}&quot;? They will lose access to this proposal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemoveFromProposal(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemoveFromProposal}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit collaborator</DialogTitle>
            <DialogDescription>
              Change role for {editCollaborator ? `${editCollaborator.user.firstName} ${editCollaborator.user.lastName}` : ""}. Select which proposals to update.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={setEditRole}>
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
              <Label>Apply to proposals</Label>
              <div className="space-y-2 border rounded-lg p-3 max-h-40 overflow-y-auto">
                {editCollaborator?.assignments.map((a) => (
                  <div key={a.proposalId} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${a.proposalId}-${a.collaboration.id}`}
                      checked={editAssignmentIds.some((e) => e.proposalId === a.proposalId && e.collaborationId === a.collaboration.id)}
                      onCheckedChange={() => toggleEditAssignment(a.proposalId, a.collaboration.id)}
                    />
                    <label htmlFor={`edit-${a.proposalId}-${a.collaboration.id}`} className="text-sm font-medium cursor-pointer">
                      {a.title} ({a.role})
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAssignMoreDialogOpen} onOpenChange={setIsAssignMoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to more proposals</DialogTitle>
            <DialogDescription>
              Add {assignMoreCollaborator ? `${assignMoreCollaborator.user.firstName} ${assignMoreCollaborator.user.lastName}` : ""} to more proposals. Select proposals below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proposals (not yet assigned)</Label>
              <div className="space-y-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
                {myProposals
                  .filter((p) => !assignMoreCollaborator?.assignments.some((a) => a.proposalId === p.id))
                  .map((p) => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`assign-more-${p.id}`}
                        checked={assignMoreProposalIds.includes(p.id)}
                        onCheckedChange={() => toggleAssignMoreProject(p.id)}
                      />
                      <label htmlFor={`assign-more-${p.id}`} className="text-sm font-medium cursor-pointer">
                        {p.title}
                      </label>
                    </div>
                  ))}
                {myProposals.filter((p) => !assignMoreCollaborator?.assignments.some((a) => a.proposalId === p.id)).length === 0 && (
                  <p className="text-sm text-muted-foreground">Already assigned to all your proposals.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignMoreDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmAssignMore} disabled={assignMoreProposalIds.length === 0}>
              Add to selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTasksDialogOpen} onOpenChange={setIsTasksDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tasks</DialogTitle>
            <DialogDescription>
              Tasks for {tasksCollaborator ? `${tasksCollaborator.user.firstName} ${tasksCollaborator.user.lastName}` : ""} (from API).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {tasksCollaborator && getTasksForCollaborator(tasksCollaborator).length > 0 ? (
              <ul className="space-y-2 border rounded-lg divide-y p-2 max-h-64 overflow-y-auto">
                {getTasksForCollaborator(tasksCollaborator).map((task) => (
                  <li key={task.id} className="flex items-start justify-between gap-2 py-2 first:pt-0">
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.proposalTitle} · {task.dueDate}</p>
                    </div>
                    <Badge variant={task.status === "In progress" ? "default" : "secondary"} className="text-xs shrink-0">
                      {task.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No tasks for this collaborator.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTasksDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
