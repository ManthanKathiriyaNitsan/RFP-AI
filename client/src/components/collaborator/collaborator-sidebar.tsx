import { Link, useLocation } from "wouter";
import { FolderOpen, BarChart3, Brain, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBranding } from "@/contexts/BrandingContext";

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
  const primaryLogoUrl = "primaryLogoUrl" in branding ? (branding as { primaryLogoUrl?: string | null }).primaryLogoUrl : null;

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
