import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import {
  fetchAdminRoles,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  type RoleItem,
  type PermissionDefinition,
} from "@/api/admin-data";
import { Shield, Plus, Pencil, Trash2, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";

function formatPermissionSummary(permissions: Record<string, string[]>): string {
  const keys = Object.keys(permissions).filter((k) => (permissions[k]?.length ?? 0) > 0);
  if (keys.length === 0) return "No permissions";
  if (keys.length <= 3) return keys.join(", ");
  return `${keys.length} permissions`;
}

export default function AdminRoles() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { currentRole } = useAuth();
  const roleLower = (currentRole || "").toLowerCase();
  const isSuperAdmin = roleLower === "super_admin";
  const isAdmin = roleLower === "admin";

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "roles", roleLower],
    queryFn: () => fetchAdminRoles(roleLower || undefined),
  });

  const allRoles = data?.roles ?? [];
  // Super Admin: only Admin role. Admin: no Admin role (User & Collaborator only).
  const roles = isSuperAdmin
    ? allRoles.filter((r) => (r.id || "").toLowerCase() === "admin")
    : isAdmin
      ? allRoles.filter((r) => (r.id || "").toLowerCase() !== "admin")
      : allRoles;
  // Super Admin: edit only Admin. Admin: edit only User/Collaborator (and custom).
  const canEditRole = (role: RoleItem) => {
    if (!role.isBuiltIn) return true;
    const id = (role.id || "").toLowerCase();
    if (isSuperAdmin) return id === "admin";
    if (isAdmin) return id === "customer" || id === "user" || id === "collaborator";
    return false;
  };
  const permissionDefinitionsRaw = data?.permissionDefinitions ?? [];
  const defaultPermissionDefinitions: PermissionDefinition[] = [
    { key: "can_create_rfp", label: "Create Proposals", scopes: ["read", "write", "delete"] },
    { key: "can_edit_content", label: "Content Library", scopes: ["read", "write", "delete"] },
    { key: "can_view_rfp", label: "View Proposals", scopes: ["read", "write", "delete"] },
    { key: "can_comment", label: "Comment", scopes: ["read", "write", "delete"] },
    { key: "ai_chat", label: "Ai Chat", scopes: ["read", "write", "delete"] },
    { key: "ai_config", label: "Ai Config", scopes: ["read", "write", "delete"] },
    { key: "billing", label: "Billing", scopes: ["read", "write", "delete"] },
  ];
  const permissionDefinitions = permissionDefinitionsRaw.length > 0 ? permissionDefinitionsRaw : defaultPermissionDefinitions;

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleItem | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setNewRoleName("");
    setRolePermissions({});
    setCreateOpen(true);
  };

  const openEdit = (role: RoleItem) => {
    setEditRole(role);
    setNewRoleName(role.name);
    setRolePermissions({ ...role.permissions });
    setCreateOpen(false);
  };

  const closeEdit = () => {
    setEditRole(null);
    setNewRoleName("");
    setRolePermissions({});
  };

  const togglePermissionScope = (permKey: string, scope: string) => {
    const current = rolePermissions[permKey] ?? [];
    const next = current.includes(scope)
      ? current.filter((s) => s !== scope)
      : [...current, scope];
    setRolePermissions((prev) => ({ ...prev, [permKey]: next }));
  };

  const setPermissionAll = (permKey: string, scopes: string[] | undefined, checked: boolean) => {
    if (checked && scopes?.length) {
      setRolePermissions((prev) => ({ ...prev, [permKey]: [...scopes] }));
    } else {
      setRolePermissions((prev) => ({ ...prev, [permKey]: [] }));
    }
  };

  const handleCreate = async () => {
    const name = newRoleName.trim();
    if (!name) {
      toast({ title: "Enter role name", variant: "destructive" });
      return;
    }
    setSaving(true);
    const created = await createAdminRole({ name, permissions: rolePermissions });
    setSaving(false);
    if (created) {
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      setCreateOpen(false);
      toast({ title: "Role created", description: name });
    } else {
      toast({ title: "Failed to create role", variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    if (!editRole) return;
    const name = newRoleName.trim();
    if (!name) {
      toast({ title: "Enter role name", variant: "destructive" });
      return;
    }
    setSaving(true);
    const updated = await updateAdminRole(editRole.id, { name, permissions: rolePermissions }, roleLower || undefined);
    setSaving(false);
    if (updated) {
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      closeEdit();
      toast({ title: "Role updated", description: name });
    } else {
      toast({ title: "Failed to update role", variant: "destructive" });
    }
  };

  const handleDelete = async (role: RoleItem) => {
    const ok = await confirm({ title: "Delete role?", description: `Remove "${role.name}"? Users with this role will need to be reassigned.` });
    if (!ok) return;
    const deleted = await deleteAdminRole(role.id);
    if (deleted) {
      qc.invalidateQueries({ queryKey: ["admin", "roles"] });
      toast({ title: "Role deleted", variant: "destructive" });
    } else {
      toast({ title: "Failed to delete role", variant: "destructive" });
    }
  };

  const renderPermissionEditor = () =>
    permissionDefinitions.map((def) => {
      const scopes = def.scopes ?? ["read", "write", "delete"];
      const selected = rolePermissions[def.key] ?? [];
      const allChecked = scopes.length > 0 && scopes.every((s) => selected.includes(s));
      const checkboxId = `perm-${String(def.key).replace(/\s+/g, "-")}`;

      return (
        <div key={def.key} className="flex flex-col gap-2 py-2 border-b border-border last:border-0">
          <label
            htmlFor={checkboxId}
            className="flex items-start gap-2 cursor-pointer rounded-md p-1.5 -m-1.5 hover:bg-muted/50"
          >
            <Checkbox
              id={checkboxId}
              checked={allChecked}
              onCheckedChange={(c) => setPermissionAll(def.key, def.scopes ?? ["read", "write", "delete"], !!c)}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm">{def.label}</span>
              {def.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
              )}
            </div>
          </label>
          {scopes.length > 1 && (
            <div className="flex flex-wrap gap-3 pl-6">
              {scopes.map((scope) => (
                <label key={scope} className="flex items-center gap-1.5 text-sm cursor-pointer" htmlFor={`${checkboxId}-${scope}`}>
                  <Checkbox
                    id={`${checkboxId}-${scope}`}
                    checked={selected.includes(scope)}
                    onCheckedChange={() => togglePermissionScope(def.key, scope)}
                  />
                  <span className="capitalize">{scope}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      );
    });

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Roles & Permission Builder</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Create custom roles and assign granular permissions (e.g. can_create_rfp, read/write/delete scopes).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create custom role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Roles
          </CardTitle>
          <CardDescription>Built-in roles cannot be deleted. Custom roles can be edited and removed.</CardDescription>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No roles. Create a custom role to get started.</p>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{role.name}</span>
                    {role.isBuiltIn && (
                      <Badge variant="default" className="text-[10px]">Built-in</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatPermissionSummary(role.permissions)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {canEditRole(role) && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    {!role.isBuiltIn && canEditRole(role) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(role)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create custom role</DialogTitle>
            <DialogDescription>Give the role a name and select permissions with read/write/delete scopes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Role name</Label>
              <Input
                className="mt-1.5"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="e.g. Proposal Editor"
              />
            </div>
            <div>
              <Label className="mb-2 block">Permissions</Label>
              <div className="max-h-64 overflow-y-auto space-y-0 rounded-md border border-border p-2">
                {permissionDefinitions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No permissions defined. Configure role permissions in the backend.</p>
                ) : (
                  renderPermissionEditor()
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRole} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit role</DialogTitle>
            <DialogDescription>
              {editRole?.isBuiltIn ? "Built-in role: you can only change permission scopes (name is fixed)." : "Change name and permissions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Role name</Label>
              <Input
                className="mt-1.5"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Role name"
                disabled={editRole?.isBuiltIn}
              />
            </div>
            <div>
              <Label className="mb-2 block">Permissions</Label>
              <div className="max-h-64 overflow-y-auto space-y-0 rounded-md border border-border p-2">
                {permissionDefinitions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No permissions defined.</p>
                ) : (
                  renderPermissionEditor()
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
