import { useState, useMemo, useEffect } from "react";
import { useRoute, Redirect } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ArrowLeft, Users, Plus, X, Settings2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  fetchAdminOrganization,
  updateAdminOrganization,
  deleteAdminOrganization,
  type OrganizationItem,
} from "@/api/admin-data";
import { useConfirm } from "@/hooks/use-confirm";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";

function useOrgId(): number | null {
  const [, params] = useRoute("/admin/organizations/:id");
  const id = params?.id != null ? parseInt(params.id, 10) : NaN;
  return Number.isNaN(id) ? null : id;
}

export default function AdminOrganizationDetail() {
  const orgId = useOrgId();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: org, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "organization", orgId],
    queryFn: () => fetchAdminOrganization(orgId!),
    enabled: orgId != null,
  });

  const { data: apiUsers = [] } = useQuery<{ id: number; email?: string; firstName?: string; lastName?: string; role?: string }[]>({
    queryKey: ["/api/v1/users"],
  });

  const [editName, setEditName] = useState("");
  const [nameDirty, setNameDirty] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsForm, setSettingsForm] = useState<{ timezone?: string; defaultRole?: string }>({});
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  const customers = useMemo(() => (org?.customerIds ?? []).slice(), [org?.customerIds]);
  const customerUsers = useMemo(() => {
    const list = Array.isArray(apiUsers) ? apiUsers : [];
    return list.filter((u) => customers.includes(u.id));
  }, [apiUsers, customers]);
  const availableToAdd = useMemo(() => {
    const list = Array.isArray(apiUsers) ? apiUsers : [];
    return list.filter((u) => !customers.includes(u.id));
  }, [apiUsers, customers]);

  useEffect(() => {
    if (org?.name != null) {
      setEditName(org.name);
      setNameDirty(false);
    }
  }, [org?.id, org?.name]);
  useEffect(() => {
    if (org?.settings && typeof org.settings === "object") {
      const s = org.settings as Record<string, string>;
      setSettingsForm((prev) => ({ timezone: s.timezone ?? prev.timezone, defaultRole: s.defaultRole ?? prev.defaultRole }));
    }
  }, [org?.id]);

  const handleSaveName = async () => {
    if (orgId == null || !org) return;
    const name = editName.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const updated = await updateAdminOrganization(orgId, { name });
    if (updated) {
      qc.setQueryData(["admin", "organization", orgId], updated);
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      setNameDirty(false);
      toast({ title: "Name updated", description: name });
    } else {
      toast({ title: "Failed to update name", variant: "destructive" });
    }
  };

  const handleAddCustomer = async () => {
    if (orgId == null || !org || !selectedUserId) return;
    const uid = parseInt(selectedUserId, 10);
    if (Number.isNaN(uid) || customers.includes(uid)) return;
    const nextIds = [...customers, uid];
    const updated = await updateAdminOrganization(orgId, { customerIds: nextIds });
    if (updated) {
      qc.setQueryData(["admin", "organization", orgId], updated);
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      setSelectedUserId("");
      setAssignOpen(false);
      toast({ title: "Customer assigned", description: "User added to this organization." });
    } else {
      toast({ title: "Failed to assign", variant: "destructive" });
    }
  };

  const handleRemoveCustomer = async (userId: number) => {
    if (orgId == null || !org) return;
    const nextIds = customers.filter((id) => id !== userId);
    const updated = await updateAdminOrganization(orgId, { customerIds: nextIds });
    if (updated) {
      qc.setQueryData(["admin", "organization", orgId], updated);
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      toast({ title: "Removed", description: "User removed from this organization." });
    } else {
      toast({ title: "Failed to remove", variant: "destructive" });
    }
  };

  const handleSaveSettings = async () => {
    if (orgId == null || !org) return;
    const settings = { ...(org.settings ?? {}), ...settingsForm };
    const updated = await updateAdminOrganization(orgId, { settings });
    if (updated) {
      qc.setQueryData(["admin", "organization", orgId], updated);
      setSettingsDirty(false);
      toast({ title: "Settings saved", description: "Organization settings updated." });
    } else {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

  const handleArchiveToggle = async () => {
    if (orgId == null || !org) return;
    setArchiving(true);
    const newArchived = !org.archived;
    const updated = await updateAdminOrganization(orgId, { archived: newArchived });
    setArchiving(false);
    if (updated) {
      qc.setQueryData(["admin", "organization", orgId], updated);
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      toast({ title: newArchived ? "Organization archived" : "Organization unarchived" });
    } else {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (orgId == null || !org) return;
    const ok = await confirm({
      title: "Delete organization?",
      description: `This will permanently delete "${org.name}". This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    setDeleting(true);
    const success = await deleteAdminOrganization(orgId);
    setDeleting(false);
    if (success) {
      qc.removeQueries({ queryKey: ["admin", "organization", orgId] });
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      toast({ title: "Organization deleted" });
      window.location.href = "/admin/organizations";
    } else {
      toast({ title: "Failed to delete organization", variant: "destructive" });
    }
  };

  if (orgId == null) {
    return <Redirect to="/admin/organizations" />;
  }

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  if (isLoading || (org === undefined && orgId != null)) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground text-sm">Loading organization…</p>
      </div>
    );
  }

  if (org === null || !org) {
    return (
      <div className="space-y-4">
        <Link href="/admin/organizations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to organizations
          </Button>
        </Link>
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  const userName = (u: { firstName?: string; lastName?: string; email?: string }) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "—";

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/organizations">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
                setNameDirty(true);
              }}
              className="max-w-[240px] font-medium"
              placeholder="Organization name"
              disabled={org.archived}
            />
            {nameDirty && !org.archived && (
              <Button size="sm" onClick={handleSaveName}>
                <Save className="w-4 h-4 mr-1" />
                Save name
              </Button>
            )}
          </div>
          {org.archived && <Badge variant="secondary">Archived</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleArchiveToggle} disabled={archiving}>
            {org.archived ? <ArchiveRestore className="w-4 h-4 mr-1" /> : <Archive className="w-4 h-4 mr-1" />}
            {org.archived ? "Unarchive" : "Archive"}
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Assigned customers
          </CardTitle>
          <CardDescription>Users (customers) belonging to this organization. Assign from Users & Teams or add below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {customerUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No customers assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-muted">
                            {userName(u)
                              .split(/\s+/)
                              .map((s) => s[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{userName(u)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveCustomer(u.id)}
                        aria-label="Remove customer"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Assign customer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Organization settings
          </CardTitle>
          <CardDescription>Optional defaults for this organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={settingsForm.timezone ?? (org.settings as Record<string, string> | undefined)?.timezone ?? ""}
                onValueChange={(v) => {
                  setSettingsForm((s) => ({ ...s, timezone: v }));
                  setSettingsDirty(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default role for new users</Label>
              <Select
                value={settingsForm.defaultRole ?? (org.settings as Record<string, string> | undefined)?.defaultRole ?? ""}
                onValueChange={(v) => {
                  setSettingsForm((s) => ({ ...s, defaultRole: v }));
                  setSettingsDirty(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="collaborator">Collaborator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {settingsDirty && (
            <Button size="sm" onClick={handleSaveSettings}>
              <Save className="w-4 h-4 mr-2" />
              Save settings
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign customer to organization</DialogTitle>
            <DialogDescription>Select a user to add to this organization. Only users not already assigned are listed.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {userName(u)} {u.email ? `(${u.email})` : ""}
                  </SelectItem>
                ))}
                {availableToAdd.length === 0 && (
                  <SelectItem value="__no_users__" disabled>
                    No users available to add
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCustomer} disabled={!selectedUserId}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
