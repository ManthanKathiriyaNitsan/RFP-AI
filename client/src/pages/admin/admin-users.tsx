import { useState, useRef, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { fetchAdminPermissions, fetchAdminOptions } from "@/api/admin-data";
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { toSoftBadgeClass, softBadgeClasses } from "@/lib/badge-classes";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/use-auth";
import { UserDialog } from "./admin-user-dialog";
import { 
  Search, 
  Plus, 
  MoreHorizontal,
  Shield,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  Download,
  Upload,
  Users,
  Crown,
  Clock,
  KeyRound,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ROLE_ICON_MAP: Record<string, LucideIcon> = {
  Shield,
  Crown,
  UserCheck,
  Users,
};
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminUsers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [changeRoleUser, setChangeRoleUser] = useState<any>(null);
  const [changeRoleValue, setChangeRoleValue] = useState<string>("");
  const [resetPasswordUser, setResetPasswordUser] = useState<any>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [activityLogsUser, setActivityLogsUser] = useState<any>(null);
  const [subUsersAdmin, setSubUsersAdmin] = useState<any>(null);
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false);
  const [editRoleTarget, setEditRoleTarget] = useState<string | null>(null);

  const ROLE_PERMISSIONS_STORAGE_KEY = "admin-role-permissions";
  const { data: permissionsData } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: fetchAdminPermissions,
  });
  const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = { Admin: [], User: [], Collaborator: [] };
  const defaultRolePermissions =
    (permissionsData && !Array.isArray(permissionsData) && (permissionsData as { defaultRolePermissions?: Record<string, string[]> }).defaultRolePermissions) ??
    DEFAULT_ROLE_PERMISSIONS;
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem(ROLE_PERMISSIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, string[]>;
        if (parsed.Admin?.length !== undefined && parsed.User?.length !== undefined && parsed.Collaborator?.length !== undefined) {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_ROLE_PERMISSIONS;
  });
  useEffect(() => {
    const fromApi = permissionsData && !Array.isArray(permissionsData) && (permissionsData as { defaultRolePermissions?: Record<string, string[]> }).defaultRolePermissions;
    if (!fromApi) return;
    try {
      if (!localStorage.getItem(ROLE_PERMISSIONS_STORAGE_KEY)) {
        setRolePermissions(fromApi);
      }
    } catch {
      /* ignore */
    }
  }, [permissionsData]);

  const { user: currentUser, currentRole } = useAuth();
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const rolesOptions = useMemo(() => {
    const list = optionsData?.roles ?? [];
    const r = (currentRole || "").toLowerCase();
    if (r === "super_admin") return list;
    return list.filter((x: { value: string }) => (x.value || "").toLowerCase() !== "super_admin");
  }, [optionsData?.roles, currentRole]);
  const roleDisplay = (optionsData as { roleDisplay?: Record<string, { label: string; icon: string; className: string }> })?.roleDisplay ?? {};
  const statusDisplay = (optionsData as { statusDisplay?: Record<string, { label: string; className: string }> })?.statusDisplay ?? {};
  const pageTitles = (optionsData as { pageTitles?: Record<string, string> })?.pageTitles ?? {};
  const usersTitle = pageTitles.users ?? "Users & Teams";
  const permissionsList = permissionsData && !Array.isArray(permissionsData) ? (permissionsData as { permissions?: string[] }).permissions : permissionsData;
  const allAvailablePermissions = Array.isArray(permissionsList) ? permissionsList : [];

  const handleSaveRolePermissions = () => {
    if (!editRoleTarget) return;
    try {
      localStorage.setItem(ROLE_PERMISSIONS_STORAGE_KEY, JSON.stringify(rolePermissions));
    } catch {
      /* ignore */
    }
    setEditRoleDialogOpen(false);
    setEditRoleTarget(null);
    toast({ title: "Permissions saved", description: `${editRoleTarget} permissions have been updated.` });
  };

  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: apiUsers = [], isLoading: isLoadingUsers } = useQuery<any[]>({
    queryKey: ["/api/v1/users"],
  });

  const { data: subUsersList = [], isLoading: subUsersLoading } = useQuery<any[]>({
    queryKey: ["/api/v1/users", { created_by: subUsersAdmin?.id }],
    enabled: !!subUsersAdmin?.id,
  });

  const { data: apiProposals = [] } = useQuery<any[]>({
    queryKey: ["/api/proposals", { userId: currentUser?.id, userRole: currentUser?.role }],
    enabled: !!currentUser?.id,
  });

  const getRoleConfig = (role: string) => {
    const key = role.toLowerCase();
    const config = roleDisplay[key] ?? roleDisplay.collaborator ?? { label: "Collaborator", icon: "Users", className: "badge-role-collaborator" };
    const icon = ROLE_ICON_MAP[config.icon] ?? Users;
    // Always use our known badge classNames so Admin/User/Collaborator/Super Admin colors work in light and dark mode
    const roleClassName =
      key === "super_admin" ? "badge-role-super-admin"
      : key === "admin" ? "badge-role-admin"
      : key === "user" || key === "customer" ? "badge-role-user"
      : "badge-role-collaborator";
    return { label: config.label, icon, className: roleClassName };
  };

  const getStatusConfig = (status: string) => {
    const config = statusDisplay[status] ?? statusDisplay.default ?? { label: "Pending", className: softBadgeClasses.warning };
    return { label: config.label, className: toSoftBadgeClass(config.className) ?? softBadgeClasses.warning };
  };

  /** Format lastActiveAt as "Just now", "5 min ago", "2 hours ago", "Yesterday", or "Never". */
  const formatLastActive = (lastActiveAt: string | null | undefined): string => {
    if (!lastActiveAt) return "Never";
    const d = new Date(lastActiveAt);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  const proposalsByOwner = (apiProposals as any[]).reduce((acc: Record<number, any[]>, p: any) => {
    const oid = p.ownerId;
    if (oid != null) {
      if (!acc[oid]) acc[oid] = [];
      acc[oid].push(p);
    }
    return acc;
  }, {});

  const allUsers = (apiUsers as any[]).map((u: any) => {
    const firstName = u.firstName || u.username || u.email?.split("@")[0] || "";
    const lastName = u.lastName || "";
    const initials = (firstName?.[0] || "") + (lastName?.[0] || "");
    const userProposals = proposalsByOwner[u.id] || [];
    const won = userProposals.filter((p: any) => p.status === "won").length;
    const winRate = userProposals.length > 0 ? Math.round((won / userProposals.length) * 100) : 0;
    const credits = Number(u.credits) || 0;
    const creditsUsed = 0;

    const isActive = u.isActive !== false;
    return {
      ...u,
      id: u.id,
      name: `${firstName} ${lastName}`.trim() || u.email,
      email: u.email,
      role: u.role,
      isActive,
      status: !isActive ? "deactivated" : (u.status ?? "inactive"),
      avatar: u.avatar || initials.toUpperCase() || "U",
      proposals: userProposals.length,
      winRate,
      credits,
      creditsUsed,
      lastActive: formatLastActive(u.lastActiveAt),
      joinedDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—",
    };
  });

  const filteredUsers = allUsers.filter((user: any) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /** Map a raw sub-user (from API list) to the same shape as main table user for dialogs/actions. */
  const subUserToUser = (u: any) => {
    const fn = u.firstName ?? u.first_name ?? u.email?.split("@")[0] ?? "";
    const ln = u.lastName ?? u.last_name ?? "";
    return {
      id: u.id,
      name: `${fn} ${ln}`.trim() || u.email,
      email: u.email,
      role: u.role,
      isActive: u.isActive !== false,
      firstName: fn,
      lastName: ln,
      company: u.company ?? "",
      jobTitle: u.jobTitle ?? u.job_title ?? "",
      avatar: (fn?.[0] || "") + (ln?.[0] || "") || "U",
      status: u.status ?? "active",
      proposals: 0,
      winRate: 0,
      credits: Number(u.credits) || 0,
      creditsUsed: 0,
      lastActive: "—",
      ...u,
    };
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsUserDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setIsUserDialogOpen(open);
    if (!open) {
      setSelectedUser(null);
    }
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/users/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "User deleted", description: "The user has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete user.", variant: "destructive" });
    },
  });

  const handleDeleteUser = async (user: any) => {
    const confirmed = await confirm({
      title: "Delete user",
      description: `Are you sure you want to delete ${user.name}? This cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (confirmed) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, { role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      toast({ title: "Role updated", description: "The user's role has been updated successfully." });
      setChangeRoleUser(null);
      setChangeRoleValue("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update role. Please try again.", variant: "destructive" });
    },
  });

  const handleChangeRoleClick = (user: any) => {
    setChangeRoleUser(user);
    setChangeRoleValue(user.role || "customer");
  };

  const handleChangeRoleSubmit = () => {
    if (!changeRoleUser || !changeRoleValue) return;
    changeRoleMutation.mutate({ id: changeRoleUser.id, role: changeRoleValue });
  };

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await apiRequest("PATCH", `/api/v1/users/${id}`, { isActive });
      return response.json();
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      toast({
        title: isActive ? "User activated" : "User deactivated",
        description: isActive ? "The user can log in again." : "The user can no longer log in.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user status.", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: number; newPassword: string }) => {
      const response = await apiRequest("POST", `/api/v1/users/${id}/reset-password`, { newPassword });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      toast({ title: "Password reset", description: "Password updated and all sessions revoked." });
      setResetPasswordUser(null);
      setResetPasswordValue("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reset password.", variant: "destructive" });
    },
  });

  const { data: activityLogs = [], isLoading: activityLogsLoading } = useQuery<any[]>({
    queryKey: ["/api/v1/users/activity-logs", { user_id: activityLogsUser?.id }],
    enabled: !!activityLogsUser?.id,
  });

  const handleToggleActive = (user: any) => {
    const isActive = !user.isActive;
    toggleActiveMutation.mutate({ id: user.id, isActive });
  };

  const handleResetPasswordSubmit = () => {
    if (!resetPasswordUser || !resetPasswordValue || resetPasswordValue.length < 6) {
      toast({ title: "Validation", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    resetPasswordMutation.mutate({ id: resetPasswordUser.id, newPassword: resetPasswordValue });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmDialog />
      <Dialog open={!!changeRoleUser} onOpenChange={(open) => { if (!open) { setChangeRoleUser(null); setChangeRoleValue(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              {changeRoleUser
                ? `Set a new role for ${changeRoleUser.name} (${changeRoleUser.email}).`
                : "Select a new role for this user."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={changeRoleValue} onValueChange={setChangeRoleValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {rolesOptions.map((opt: { value: string; label: string }) => {
                    const Icon = opt.value === "super_admin" ? Shield : opt.value === "admin" ? Crown : opt.value === "customer" ? UserCheck : Users;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4" /> {opt.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangeRoleUser(null); setChangeRoleValue(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleChangeRoleSubmit}
              disabled={changeRoleMutation.isPending || !changeRoleValue}
            >
              {changeRoleMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => { if (!open) { setResetPasswordUser(null); setResetPasswordValue(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {resetPasswordUser ? `Set a new password for ${resetPasswordUser.name} (${resetPasswordUser.email}). All existing sessions will be revoked.` : "Set a new password."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New password</Label>
              <Input
                type="password"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                placeholder="Min 6 characters"
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPasswordUser(null); setResetPasswordValue(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleResetPasswordSubmit}
              disabled={resetPasswordMutation.isPending || resetPasswordValue.length < 6}
            >
              {resetPasswordMutation.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!activityLogsUser} onOpenChange={(open) => { if (!open) setActivityLogsUser(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Activity logs</SheetTitle>
            <SheetDescription>
              {activityLogsUser ? `Recent activity for ${activityLogsUser.name} (${activityLogsUser.email})` : "User activity"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {activityLogsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : Array.isArray(activityLogs) && activityLogs.length > 0 ? (
              <ul className="space-y-3">
                {(activityLogs as any[]).map((log: any) => (
                  <li key={log.id} className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{String(log.action || "").replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                    {log.details && <p className="text-muted-foreground text-xs">{log.details}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!subUsersAdmin} onOpenChange={(open) => { if (!open) setSubUsersAdmin(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Users & collaborators</SheetTitle>
            <SheetDescription>
              {subUsersAdmin ? `Users and collaborators under ${subUsersAdmin.name} (${subUsersAdmin.email})` : "Sub-users"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {subUsersLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : Array.isArray(subUsersList) && subUsersList.length > 0 ? (
              <ul className="space-y-3">
                {(subUsersList as any[]).map((u: any) => {
                  const fn = u.firstName ?? u.first_name ?? u.email?.split("@")[0] ?? "";
                  const ln = u.lastName ?? u.last_name ?? "";
                  const name = `${fn} ${ln}`.trim() || u.email;
                  const roleConfig = getRoleConfig(u.role);
                  const RoleIcon = roleConfig.icon;
                  const userForActions = subUserToUser(u);
                  return (
                    <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <Badge variant="outline" className={`${roleConfig.className} text-[10px] font-medium shrink-0`}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {roleConfig.label}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditUser(userForActions)}>
                            <Edit className="w-4 h-4 mr-2" /> Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleChangeRoleClick(userForActions)}>
                            <Shield className="w-4 h-4 mr-2" /> Change Role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(userForActions)}
                            disabled={toggleActiveMutation.isPending}
                          >
                            {userForActions.isActive ? (
                              <><UserX className="w-4 h-4 mr-2" /> Deactivate</>
                            ) : (
                              <><UserCheck className="w-4 h-4 mr-2" /> Activate</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setResetPasswordUser(userForActions); setResetPasswordValue(""); }}>
                            <KeyRound className="w-4 h-4 mr-2" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setActivityLogsUser(userForActions)}>
                            <Activity className="w-4 h-4 mr-2" /> View Activity
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeleteUser(userForActions)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No users or collaborators under this admin.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-users-title">{usersTitle}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage user accounts and permissions.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            data-testid="button-import"
            onClick={() => setIsImportDialogOpen(true)}
            className="flex-1 sm:flex-initial"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button 
            className="theme-gradient-bg text-white flex-1 sm:flex-initial" 
            data-testid="button-add-user"
            onClick={handleAddUser}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 icon-blue" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{allUsers.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 icon-emerald" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{allUsers.filter((u: any) => u.status === 'active').length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 icon-amber" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-bold">{allUsers.filter((u: any) => u.role === 'admin').length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Administrators</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
          <TabsList className="bg-muted/50 overflow-x-auto w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsTrigger value="users" className="data-[state=active]:bg-background text-xs sm:text-sm">Users</TabsTrigger>
            <TabsTrigger value="roles" className="data-[state=active]:bg-background text-xs sm:text-sm">Roles & Permissions</TabsTrigger>
          </TabsList>
          <div className="search-box w-full sm:w-64">
            <Search className="search-box-icon" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-users"
            />
          </div>
        </div>

        <TabsContent value="users">
          {isLoadingUsers ? (
            <Card className="border shadow-sm">
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <div className="text-muted-foreground">Loading users...</div>
                </div>
              </CardContent>
            </Card>
          ) : allUsers.length === 0 ? (
            <Card className="border shadow-sm">
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center text-center">
                  <Users className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No users yet</h3>
                  <p className="text-muted-foreground mb-4 max-w-sm">
                    Create your first user or staff member to get started. You can add administrators, customers, and collaborators.
                  </p>
                  <Button
                    className="theme-gradient-bg text-white hover:opacity-95"
                    onClick={handleAddUser}
                    data-testid="button-create-first-user"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create first user
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
          <Card className="border shadow-sm">
            <CardContent className="p-0">
              {!isMobile ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proposals</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credits</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Active</th>
                        <th className="text-right py-3 px-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => {
                        const roleConfig = getRoleConfig(user.role);
                        const statusConfig = getStatusConfig(user.status);
                        const RoleIcon = roleConfig.icon;
                        return (
                          <tr 
                            key={user.id} 
                            className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                            data-testid={`row-user-${user.id}`}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-9 h-9 ring-2 ring-primary/20">
                                  <AvatarFallback className="theme-gradient-bg text-white text-xs font-semibold">
                                    {user.avatar}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{user.name}</p>
                                  <p className="text-xs text-muted-foreground">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className={`${roleConfig.className} text-[10px] font-medium`}>
                                <RoleIcon className="w-3 h-3 mr-1" />
                                {roleConfig.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className={`${statusConfig.className} text-[10px] font-medium`}>
                                {statusConfig.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{user.proposals}</span>
                                <span className="text-xs text-muted-foreground">({user.winRate}% win)</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="w-24">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-muted-foreground">{user.creditsUsed}</span>
                                  <span className="font-medium">{user.credits}</span>
                                </div>
                                <Progress value={user.credits > 0 ? (user.creditsUsed / user.credits) * 100 : 0} className="h-1.5" />
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {user.lastActive}
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
                                  <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                    <Edit className="w-4 h-4 mr-2" /> Edit User
                                  </DropdownMenuItem>
                                  {(currentRole || "").toLowerCase() === "super_admin" && (user.role || "").toLowerCase() === "admin" && (
                                    <DropdownMenuItem onClick={() => setSubUsersAdmin(user)}>
                                      <Users className="w-4 h-4 mr-2" /> View sub-users
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleChangeRoleClick(user)}>
                                    <Shield className="w-4 h-4 mr-2" /> Change Role
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleToggleActive(user)}
                                    disabled={toggleActiveMutation.isPending}
                                  >
                                    {user.isActive ? (
                                      <><UserX className="w-4 h-4 mr-2" /> Deactivate</>
                                    ) : (
                                      <><UserCheck className="w-4 h-4 mr-2" /> Activate</>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setResetPasswordUser(user); setResetPasswordValue(""); }}>
                                    <KeyRound className="w-4 h-4 mr-2" /> Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setActivityLogsUser(user)}>
                                    <Activity className="w-4 h-4 mr-2" /> View Activity
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleDeleteUser(user)}
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
                  {filteredUsers.map((user) => {
                    const roleConfig = getRoleConfig(user.role);
                    const statusConfig = getStatusConfig(user.status);
                    const RoleIcon = roleConfig.icon;
                    return (
                      <div
                        key={user.id}
                        className="p-4 space-y-3 hover:bg-muted/30 transition-colors"
                        data-testid={`row-user-${user.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Avatar className="w-10 h-10 ring-2 ring-primary/20">
                              <AvatarFallback className="theme-gradient-bg text-white text-xs font-semibold">
                                {user.avatar}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm truncate">{user.name}</h3>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit className="w-4 h-4 mr-2" /> Edit User
                              </DropdownMenuItem>
                              {(currentRole || "").toLowerCase() === "super_admin" && (user.role || "").toLowerCase() === "admin" && (
                                <DropdownMenuItem onClick={() => setSubUsersAdmin(user)}>
                                  <Users className="w-4 h-4 mr-2" /> View sub-users
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleChangeRoleClick(user)}>
                                <Shield className="w-4 h-4 mr-2" /> Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleActive(user)}
                                disabled={toggleActiveMutation.isPending}
                              >
                                {user.isActive ? <><UserX className="w-4 h-4 mr-2" /> Deactivate</> : <><UserCheck className="w-4 h-4 mr-2" /> Activate</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setResetPasswordUser(user); setResetPasswordValue(""); }}>
                                <KeyRound className="w-4 h-4 mr-2" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setActivityLogsUser(user)}>
                                <Activity className="w-4 h-4 mr-2" /> View Activity
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleDeleteUser(user)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`${roleConfig.className} text-[10px] font-medium`}>
                            <RoleIcon className="w-3 h-3 mr-1" />
                            {roleConfig.label}
                          </Badge>
                          <Badge variant="outline" className={`${statusConfig.className} text-[10px] font-medium`}>
                            {statusConfig.label}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Proposals</p>
                            <p className="text-sm font-medium">{user.proposals} <span className="text-xs text-muted-foreground">({user.winRate}% win)</span></p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Last Active</p>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {user.lastActive}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Credits</span>
                            <span className="font-medium">{user.creditsUsed} / {user.credits}</span>
                          </div>
                          <Progress value={user.credits > 0 ? (user.creditsUsed / user.credits) * 100 : 0} className="h-1.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="roles">
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Role Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4">
                {(Object.keys(defaultRolePermissions) as string[]).map((roleName) => (
                  <div key={roleName} className="p-3 sm:p-4 rounded-lg border border-border">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getRoleConfig(roleName.toLowerCase()).className}>
                          {roleName}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditRoleTarget(roleName);
                          setEditRoleDialogOpen(true);
                        }}
                        className="w-full sm:w-auto"
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(rolePermissions[roleName] ?? []).map((perm, pIndex) => (
                        <span key={pIndex} className="px-2 py-1 bg-muted rounded text-xs">{perm}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Role Permissions Dialog */}
        <Dialog
          open={editRoleDialogOpen}
          onOpenChange={(open) => {
            setEditRoleDialogOpen(open);
            if (!open) setEditRoleTarget(null);
          }}
        >
          <DialogContent className="w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit {editRoleTarget} permissions</DialogTitle>
              <DialogDescription>
                Check the permissions that the {editRoleTarget} role should have.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 max-h-60 overflow-y-auto">
              {editRoleTarget &&
                allAvailablePermissions.map((perm) => (
                  <div
                    key={perm}
                    className="flex items-center gap-2"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const current = rolePermissions[editRoleTarget] ?? [];
                      const next = current.includes(perm)
                        ? current.filter((p) => p !== perm)
                        : [...current, perm];
                      setRolePermissions((prev) => ({ ...prev, [editRoleTarget]: next }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const current = rolePermissions[editRoleTarget] ?? [];
                        const next = current.includes(perm)
                          ? current.filter((p) => p !== perm)
                          : [...current, perm];
                        setRolePermissions((prev) => ({ ...prev, [editRoleTarget]: next }));
                      }
                    }}
                  >
                    <Checkbox
                      id={`perm-${editRoleTarget}-${perm}`}
                      checked={(rolePermissions[editRoleTarget] ?? []).includes(perm)}
                      onCheckedChange={(checked) => {
                        const current = rolePermissions[editRoleTarget] ?? [];
                        const next = checked
                          ? [...current, perm]
                          : current.filter((p) => p !== perm);
                        setRolePermissions((prev) => ({ ...prev, [editRoleTarget]: next }));
                      }}
                    />
                    <label
                      htmlFor={`perm-${editRoleTarget}-${perm}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {perm}
                    </label>
                  </div>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditRoleDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRolePermissions}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Tabs>

      <UserDialog open={isUserDialogOpen} onOpenChange={handleCloseDialog} user={selectedUser} />
      
      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { setIsImportDialogOpen(open); if (!open) setImportFile(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Users</DialogTitle>
            <DialogDescription>
              Upload a CSV file with user data (Name, Email, Role, Company, Password). Each row is registered as a user with the given role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">Drop CSV file here or click to browse</p>
              <p className="text-xs text-muted-foreground mb-4">CSV format: Name, Email, Role, Company, Password (Role: admin, customer, or collaborator)</p>
              <Input
                ref={importFileInputRef}
                type="file"
                accept=".csv"
                className="max-w-xs mx-auto"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              />
              {importFile && <p className="text-sm text-muted-foreground mt-2">Selected: {importFile.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!importFile || importing}
              onClick={async () => {
                if (!importFile) return;
                setImporting(true);
                try {
                  const formData = new FormData();
                  formData.append("file", importFile);
                  const token = authStorage.getAccessToken();
                  const res = await fetch(getApiUrl("/api/v1/users/import-csv"), {
                    method: "POST",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    body: formData,
                    credentials: "include",
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error((err as { detail?: string }).detail || res.statusText);
                  }
                  const result = (await res.json()) as { created: number; skipped: number; errors: { row: number; email: string; reason: string }[] };
                  queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
                  const msg = result.errors?.length
                    ? `Created ${result.created}, ${result.skipped} row(s) had errors.`
                    : `Created ${result.created} user(s).`;
                  toast({ title: "Import completed", description: msg });
                  setIsImportDialogOpen(false);
                  setImportFile(null);
                  if (importFileInputRef.current) importFileInputRef.current.value = "";
                } catch (e) {
                  toast({
                    title: "Import failed",
                    description: e instanceof Error ? e.message : "Failed to import users.",
                    variant: "destructive",
                  });
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
