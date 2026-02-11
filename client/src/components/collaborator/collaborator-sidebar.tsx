import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, BarChart3, Brain, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/hooks/use-auth";
import { fetchCollaboratorSidebar } from "@/api/collaborator-data";

const WORK_ITEMS = [
  { href: "/collaborator", label: "Assigned RFPs", icon: FolderOpen },
  { href: "/collaborator/analytics", label: "Analytics", icon: BarChart3 },
] as const;

interface CollaboratorSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CollaboratorSidebar({ open = false, onOpenChange }: CollaboratorSidebarProps) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const branding = useBranding();
  const { user } = useAuth();
  const primaryLogoUrl = "primaryLogoUrl" in branding ? (branding as { primaryLogoUrl?: string | null }).primaryLogoUrl : null;

  const { data: sidebarData } = useQuery({
    queryKey: ["collaborator", "sidebar"],
    queryFn: fetchCollaboratorSidebar,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
  const widget = sidebarData?.sidebarWidget;
  const credits = (widget as { credits?: number } | undefined)?.credits ?? user?.credits ?? 0;
  const creditsLabel = (widget as { creditsLabel?: string } | undefined)?.creditsLabel ?? "available";
  const creditsTitle = (widget as { title?: string } | undefined)?.title ?? "AI Credits";
  const usedThisMonth = (widget as { usedThisMonth?: number } | undefined)?.usedThisMonth ?? 0;
  const usageDetailHref = (widget as { usageDetailHref?: string } | undefined)?.usageDetailHref ?? "/collaborator/credits-usage";

  const isActive = (href: string) => {
    if (href === "/collaborator") return location === "/collaborator" || location.startsWith("/collaborator/rfp/");
    return location.startsWith(href);
  };

  const handleLinkClick = () => {
    if (isMobile && onOpenChange) onOpenChange(false);
  };

  const sidebarContent = (
    <>
      {isMobile && (
        <div className="p-4 border-b border-border">
          <Link href="/collaborator" onClick={handleLinkClick} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            {primaryLogoUrl ? (
              <img src={primaryLogoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain bg-muted" />
            ) : (
              <div className="w-9 h-9 theme-gradient-bg rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                <Brain className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-lg font-bold theme-gradient-text">RFP AI</span>
              <span className="text-[10px] text-muted-foreground font-medium -mt-1">Collaborator Portal</span>
            </div>
          </Link>
        </div>
      )}
      <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
        <div className="px-3 space-y-6 pb-4">
          <div>
            <h3 className="px-3 text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--sidebar-muted)" }}>
              Work
            </h3>
            <nav className="space-y-0.5">
              {WORK_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={handleLinkClick}>
                    <span
                      className={cn(
                        "group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                        active ? "sidebar-nav-active" : "sidebar-nav-inactive"
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className={cn("w-4 h-4 transition-colors", active ? "sidebar-icon-active" : "sidebar-icon-inactive")} />
                        {item.label}
                      </span>
                      {active && <ChevronRight className="w-4 h-4 sidebar-icon-active" />}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <div className="rounded-xl p-4 sidebar-widget-bg">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg sidebar-widget-icon-bg">
              <Sparkles className="w-3.5 h-3.5 sidebar-widget-icon" />
            </div>
            <span className="text-sm font-semibold text-foreground">{creditsTitle}</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-bold text-foreground tabular-nums">{typeof credits === "number" ? credits.toLocaleString() : credits}</span>
            <span className="text-xs text-muted-foreground">{creditsLabel}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">Used this month: {(typeof usedThisMonth === "number" ? usedThisMonth : 0).toLocaleString()}</p>
          {usageDetailHref && (
            <Link href={usageDetailHref} onClick={handleLinkClick} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
              See where credits are used
              <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
          <aside className="admin-sidebar w-full flex flex-col h-full" style={{ backgroundColor: "var(--sidebar-bg)" }}>
            {sidebarContent}
          </aside>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="admin-sidebar w-64 flex flex-col fixed left-0 bottom-0 border-r border-border hidden md:flex"
      style={{ backgroundColor: "var(--sidebar-bg)", top: "var(--navbar-height)" }}
    >
      {sidebarContent}
    </aside>
  );
}
