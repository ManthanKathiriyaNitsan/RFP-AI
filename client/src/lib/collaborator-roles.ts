/**
 * Single source of truth for collaborator roles.
 * Permissions are derived from role only (no separate permission checkboxes in UI).
 */
import { Eye, FileEdit, CheckCircle, MessageSquare, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CollaboratorPermissions = {
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  canReview: boolean;
  canGenerateAi: boolean;
};

export const ROLE_TO_PERMISSIONS: Record<string, CollaboratorPermissions> = {
  viewer: {
    canView: true,
    canEdit: false,
    canComment: false,
    canReview: false,
    canGenerateAi: false,
  },
  commenter: {
    canView: true,
    canEdit: false,
    canComment: true,
    canReview: false,
    canGenerateAi: false,
  },
  editor: {
    canView: true,
    canEdit: true,
    canComment: true,
    canReview: false,
    canGenerateAi: false,
  },
  reviewer: {
    canView: true,
    canEdit: true,
    canComment: true,
    canReview: true,
    canGenerateAi: false,
  },
  contributor: {
    canView: true,
    canEdit: true,
    canComment: true,
    canReview: true,
    canGenerateAi: true,
  },
};

export const DEFAULT_COLLABORATOR_PERMISSIONS: CollaboratorPermissions = ROLE_TO_PERMISSIONS.viewer;

export function getPermissionsForRole(role: string): CollaboratorPermissions {
  const key = (role || "viewer").toLowerCase();
  return ROLE_TO_PERMISSIONS[key] ?? DEFAULT_COLLABORATOR_PERMISSIONS;
}

export type RoleOption = { value: string; label: string; description?: string; icon: LucideIcon };

export const COLLABORATOR_ROLE_OPTIONS: RoleOption[] = [
  { value: "viewer", label: "Viewer", description: "Can view only", icon: Eye },
  { value: "commenter", label: "Commenter", description: "Can view and comment", icon: MessageSquare },
  { value: "editor", label: "Editor", description: "Can edit answers", icon: FileEdit },
  { value: "reviewer", label: "Reviewer", description: "Can review and approve", icon: CheckCircle },
  { value: "contributor", label: "Contributor", description: "Full access including AI", icon: Sparkles },
];
