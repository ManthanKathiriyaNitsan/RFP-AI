/**
 * Collaborator role options and permissions from backend (GET /customer/collaborator-role-options).
 * All role data is dynamic; icons are UI-only and mapped by role value.
 */
import { useQuery } from "@tanstack/react-query";
import { Eye, FileEdit, CheckCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchCollaboratorRoleOptions, type CollaboratorPermissions } from "@/api/customer-data";

const ROLE_ICONS: Record<string, LucideIcon> = {
  viewer: Eye,
  editor: FileEdit,
  reviewer: CheckCircle,
};

const DEFAULT_PERMISSIONS: CollaboratorPermissions = {
  canView: true,
  canEdit: false,
  canComment: false,
  canReview: false,
  canGenerateAi: false,
};

export type RoleOptionWithIcon = { value: string; label: string; icon: LucideIcon };

export function useCollaboratorRoleOptions() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["customer", "collaborator-role-options"],
    queryFn: fetchCollaboratorRoleOptions,
  });

  const roleOptions: RoleOptionWithIcon[] = (data?.roleOptions ?? []).map((r) => ({
    value: r.value,
    label: r.label,
    icon: ROLE_ICONS[r.value] ?? Eye,
  }));

  const rolePermissions = data?.rolePermissions ?? {};
  const getPermissionsForRole = (role: string): CollaboratorPermissions => {
    const key = (role || "viewer").toLowerCase();
    return rolePermissions[key] ?? DEFAULT_PERMISSIONS;
  };

  return {
    roleOptions,
    rolePermissions,
    getPermissionsForRole,
    defaultPermissions: rolePermissions.viewer ?? DEFAULT_PERMISSIONS,
    isLoading,
    isError,
    error,
  };
}
