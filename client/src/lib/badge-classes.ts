/**
 * Shared soft-tint badge classes (Content Library / Terms & Policy style).
 * Use with <Badge variant="outline" className={...} /> for consistent look in light and dark mode.
 */

/** Proposal/Project status: Won, Lost, In Progress, Review, Draft */
export const proposalStatusBadgeClasses = {
  won: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald border-emerald-500/20 dark:border-emerald-500/30",
  lost: "bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400 border-red-500/20 dark:border-red-500/30",
  in_progress: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber border-amber-500/20 dark:border-amber-500/30",
  review: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber border-amber-500/20 dark:border-amber-500/30",
  draft: "bg-gray-400/15 dark:bg-gray-500/20 text-muted-foreground dark:text-muted-foreground border-gray-400/25 dark:border-gray-500/30",
  completed: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald border-emerald-500/20 dark:border-emerald-500/30",
} as const;

/** RFP answer status: Approved, Pending, Draft, Rejected, Locked */
export const answerStatusBadgeClasses = {
  approved: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald border-emerald-500/20 dark:border-emerald-500/30",
  pending: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber border-amber-500/20 dark:border-amber-500/30",
  draft: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/30",
  rejected: "bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400 border-red-500/20 dark:border-red-500/30",
  locked: "bg-gray-400/15 dark:bg-gray-500/20 text-muted-foreground dark:text-muted-foreground border-gray-400/25 dark:border-gray-500/30",
  default: "bg-gray-400/15 dark:bg-gray-500/20 text-muted-foreground dark:text-muted-foreground border-gray-400/25 dark:border-gray-500/30",
} as const;

/** Collaborator assignment status */
export const collaboratorStatusBadgeClasses = {
  draft: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber border-amber-500/20 dark:border-amber-500/30",
  in_progress: "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/30",
  completed: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald border-emerald-500/20 dark:border-emerald-500/30",
  default: "bg-gray-400/15 dark:bg-gray-500/20 text-muted-foreground dark:text-muted-foreground border-gray-400/25 dark:border-gray-500/30",
} as const;

/** AI Score tiers (high / medium / low) */
export const aiScoreBadgeClasses = {
  high: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald border-emerald-500/20 dark:border-emerald-500/30",
  medium: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber border-amber-500/20 dark:border-amber-500/30",
  low: "bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400 border-red-500/20 dark:border-red-500/30",
} as const;

/** Single-purpose soft badges */
export const softBadgeClasses = {
  success: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald border-emerald-500/20 dark:border-emerald-500/30",
  primary: "bg-primary/10 dark:bg-primary/20 text-primary border-primary/20 dark:border-primary/30",
  archived: "bg-gray-400/15 dark:bg-gray-500/20 text-muted-foreground dark:text-muted-foreground border-gray-400/25 dark:border-gray-500/30",
  warning: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber border-amber-500/20 dark:border-amber-500/30",
} as const;

/** Map legacy badge-status-* class names to soft classes (for API-driven statusDisplay) */
export const legacyBadgeToSoft: Record<string, string> = {
  "badge-status-won": proposalStatusBadgeClasses.won,
  "badge-status-lost": proposalStatusBadgeClasses.lost,
  "badge-status-in-progress": proposalStatusBadgeClasses.in_progress,
  "badge-status-review": proposalStatusBadgeClasses.review,
  "badge-status-draft": proposalStatusBadgeClasses.draft,
  "badge-status-success": softBadgeClasses.success,
  "badge-status-warning": softBadgeClasses.warning,
  "badge-status-error": answerStatusBadgeClasses.rejected,
  "badge-status-info": collaboratorStatusBadgeClasses.in_progress,
  "badge-status-neutral": softBadgeClasses.archived,
};

export function getProposalStatusBadgeClass(status: string): string {
  const key = status === "won" || status === "completed" ? (status === "won" ? "won" : "completed") : status;
  return proposalStatusBadgeClasses[key as keyof typeof proposalStatusBadgeClasses] ?? proposalStatusBadgeClasses.draft;
}

export function getAnswerStatusBadgeClass(status: string): string {
  return answerStatusBadgeClasses[status as keyof typeof answerStatusBadgeClasses] ?? answerStatusBadgeClasses.default;
}

export function getAiScoreBadgeClass(score: number): string {
  if (score >= 85) return aiScoreBadgeClasses.high;
  if (score >= 70) return aiScoreBadgeClasses.medium;
  return aiScoreBadgeClasses.low;
}

export function toSoftBadgeClass(className: string | undefined): string {
  if (!className) return softBadgeClasses.archived;
  return legacyBadgeToSoft[className] ?? className;
}
