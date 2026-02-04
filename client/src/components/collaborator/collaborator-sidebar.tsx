import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { FolderOpen, Brain, ChevronRight, type LucideIcon } from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchCollaboratorSidebar, collaboratorSidebarFallback } from "@/api/collaborator-data";

const SIDEBAR_ICON_MAP: Record<string, LucideIcon> = {
  FolderOpen,
};

interface CollaboratorSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CollaboratorSidebar({ open = false, onOpenChange }: CollaboratorSidebarProps) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { primaryLogoUrl } = useBranding();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: sidebarData } = useQuery({
    queryKey: ["collaborator", "sidebar"],
    queryFn: fetchCollaboratorSidebar,
  });
  const data = sidebarData ?? collaboratorSidebarFallback;
  // Never show empty nav: if API returns no items or fails, use fallback so "Assigned RFPs" is always linked.
  const navItems = (data.navItems && data.navItems.length > 0) ? data.navItems : collaboratorSidebarFallback.navItems;
  const sectionTitle = (data as { sectionTitle?: string }).sectionTitle ?? (collaboratorSidebarFallback as { sectionTitle?: string }).sectionTitle ?? "Work";
  const portalSubtitle = (data as { portalSubtitle?: string }).portalSubtitle ?? (collaboratorSidebarFallback as { portalSubtitle?: string }).portalSubtitle ?? "Collaborator Portal";

  const isActive = (href: string) => {
    if (href === "/collaborator") {
      return location === "/collaborator" || location.startsWith("/collaborator/rfp/");
    }
    return location === href || location.startsWith(href + "/");
  };

  const handleLinkClick = () => {
    if (isMobile && onOpenChange) onOpenChange(false);
  };

  useEffect(() => {
    const activeItem = navItems.find((item: { href: string }) => isActive(item.href));
    if (activeItem && scrollContainerRef.current) {
      const el = document.querySelector(`[data-nav="${activeItem.href}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [location, navItems]);

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
              <span className="text-[10px] text-muted-foreground font-medium -mt-1">{portalSubtitle}</span>
            </div>
          </Link>
        </div>
      )}
      <div ref={scrollContainerRef} className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
        <div className="px-3 space-y-6 pb-4">
          <h3 className="px-3 text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--sidebar-muted)" }}>
            {sectionTitle}
          </h3>
          <nav className="space-y-0.5">
            {navItems.map((item: { href: string; label: string; icon?: string }) => {
              const active = isActive(item.href);
              const IconComponent = SIDEBAR_ICON_MAP[item.icon ?? "FolderOpen"] ?? FolderOpen;
              return (
                <Link key={item.href} href={item.href} onClick={handleLinkClick}>
                  <span
                    data-nav={item.href}
                    className={cn(
                      "group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                      active ? "sidebar-nav-active" : "sidebar-nav-inactive"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <IconComponent className={cn("w-4 h-4 transition-colors", active ? "sidebar-icon-active" : "sidebar-icon-inactive")} />
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
