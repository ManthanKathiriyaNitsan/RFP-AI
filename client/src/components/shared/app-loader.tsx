import { Loader2 } from "lucide-react";

/**
 * Full-page loader shown while the app is initializing (e.g. session validation on refresh).
 * Use when isInitializing is true so users see a single loading state instead of mock/placeholder data.
 */
export function AppLoader() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background"
      role="status"
      aria-label="Loading"
    >
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
