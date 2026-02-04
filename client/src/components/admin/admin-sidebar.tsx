import { useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  FileText,
  Users,
  Library,
  Sparkles,
  Settings,
  TrendingUp,
  CreditCard,
  Shield,
  Zap,
  ChevronRight,
  BarChart3,
  FileCheck,
  Brain,
  Plus,
  Building2,
  ScrollText,
  ShieldCheck,
  LayoutTemplate,
  Database,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBranding } from "@/contexts/BrandingContext";
import { fetchAdminSidebar } from "@/api/admin-data";

const SIDEBAR_ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileText,
  Users,
  Library,
  Sparkles,
  Settings,
  TrendingUp,
  CreditCard,
  Shield,
  Zap,
  BarChart3,
  FileCheck,
  Building2,
  ScrollText,
  ShieldCheck,
  LayoutTemplate,
  Database,
  Receipt,
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: "default" | "success" | "warning";
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AdminSidebar({ open = false, onOpenChange }: AdminSidebarProps) {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { primaryLogoUrl } = useBranding();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navItemRefs = useRef<Map<string, HTMLSpanElement>>(new Map());

  const { data: sidebarData } = useQuery({
    queryKey: ["admin", "sidebar"],
    queryFn: fetchAdminSidebar,
  });
  const defaultNavGroups: NavGroup[] = useMemo(
    () => [
      {
        title: "Overview",
        items: [
          { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
          { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        ],
      },
      {
        title: "Management",
        items: [
          { href: "/admin/users", label: "Users", icon: Users },
          { href: "/admin/users-terms", label: "User terms", icon: FileText },
          { href: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck },
          { href: "/admin/organizations", label: "Organizations", icon: Building2 },
          { href: "/admin/proposals", label: "Proposals", icon: FileCheck },
          { href: "/admin/rfp-templates", label: "RFP Templates", icon: LayoutTemplate },
          { href: "/admin/content", label: "Content Library", icon: Library },
        ],
      },
      {
        title: "AI & Billing",
        items: [
          { href: "/admin/ai-config", label: "AI Config", icon: Sparkles },
          { href: "/admin/knowledge-base", label: "Knowledge Base", icon: Database },
          { href: "/admin/usage", label: "Usage", icon: TrendingUp },
          { href: "/admin/credits", label: "Credits", icon: CreditCard },
          { href: "/admin/subscription-billing", label: "Subscription & Billing", icon: Receipt },
        ],
      },
      {
        title: "Security & Settings",
        items: [
          { href: "/admin/security", label: "Security", icon: Shield },
          { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
          { href: "/admin/integrations", label: "Integrations", icon: Zap },
          { href: "/admin/settings", label: "Settings", icon: Settings },
        ],
      },
    ],
    []
  );

  // Always show full nav: use default groups as base so every page is linked (Organizations, Audit Logs, etc.).
  // When API returns data, only override label/icon for hrefs that exist in API; never drop links.
  const navGroups: NavGroup[] = useMemo(() => {
    const raw = sidebarData?.navGroups ?? [];
    if (raw.length === 0) return defaultNavGroups;
    const apiItemsByHref = new Map<string, { label: string; icon: string; badge?: string | number; badgeVariant?: string }>();
    raw.forEach((group: { title: string; items: { href: string; label: string; icon: string; badge?: string | number; badgeVariant?: string }[] }) => {
      (group.items || []).forEach((item: { href: string; label: string; icon: string; badge?: string | number; badgeVariant?: string }) => {
        apiItemsByHref.set(item.href, {
          label: item.label,
          icon: item.icon,
          badge: item.badge,
          badgeVariant: item.badgeVariant,
        });
      });
    });
    return defaultNavGroups.map((group) => ({
      title: group.title,
      items: group.items.map((item) => {
        const api = apiItemsByHref.get(item.href);
        if (api) {
          return {
            ...item,
            label: api.label,
            icon: SIDEBAR_ICON_MAP[api.icon] ?? item.icon,
            badge: api.badge,
            badgeVariant: (api.badgeVariant as "default" | "success" | "warning") || undefined,
          };
        }
        return item;
      }),
    }));
  }, [sidebarData?.navGroups, defaultNavGroups]);
  const sidebarWidget = sidebarData?.sidebarWidget ?? { title: "AI Credits", usedLabel: "Used this month", usedValue: "45,789", percentage: 75, percentageLabel: "75% of monthly allocation" };

  const { data: apiProposals = [] } = useQuery<unknown[]>({
    queryKey: ["/api/proposals", { userId: user?.id, userRole: user?.role }],
    enabled: !!user?.id && (user?.role === "admin"),
  });
  const proposalCount = Array.isArray(apiProposals) ? apiProposals.length : 0;

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    // Check exact match first for paths that could conflict
    if (location === href) return true;
    // For paths that are prefixes of others, check more carefully
    if (href === "/admin/users" && location.startsWith("/admin/users-")) return false;
    if (href === "/admin/users-terms") return location.startsWith("/admin/users-terms");
    return location.startsWith(href);
  };

  const handleLinkClick = () => {
    // Close sidebar on mobile when a link is clicked
    if (isMobile && onOpenChange) {
      onOpenChange(false);
    }
  };

  // Scroll active link into view when location changes
  useEffect(() => {
    // Helper function to check if a href is active (inline to avoid dependency issues)
    const checkIsActive = (href: string): boolean => {
      if (href === "/admin") return location === "/admin";
      if (location === href) return true;
      if (href === "/admin/users" && location.startsWith("/admin/users-")) return false;
      if (href === "/admin/users-terms") return location.startsWith("/admin/users-terms");
      return location.startsWith(href);
    };

    // Find the active link
    const activeItem = navGroups
      .flatMap(group => group.items)
      .find(item => checkIsActive(item.href));

    if (activeItem && scrollContainerRef.current) {
      const activeElement = navItemRefs.current.get(activeItem.href);
      
      if (activeElement) {
        // Use setTimeout to ensure DOM has updated after route change
        const timeoutId = setTimeout(() => {
          activeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 100);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [location]);

  const sidebarContent = (
    <>
      {/* RFP Logo - Only show on mobile */}
      {isMobile && (
        <div className="p-4 border-b border-border">
          <Link href="/admin" onClick={handleLinkClick} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            {primaryLogoUrl ? (
              <img src={primaryLogoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain bg-muted" />
            ) : (
              <div className="w-9 h-9 theme-gradient-bg rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                <Brain className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-lg font-bold theme-gradient-text">RFP AI</span>
              <span className="text-[10px] text-muted-foreground font-medium -mt-1">Admin Console</span>
            </div>
          </Link>
        </div>
      )}
      <div className="p-4">
        <Link href="/admin/users" onClick={handleLinkClick}>
          <Button 
            className="w-full justify-start gap-2 sidebar-button-primary"
            data-testid="button-add-user"
          >
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        </Link>
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-3 space-y-6 pb-4">
          {navGroups.map((group) => (
            <div key={group.title}>
              <h3 className="px-3 text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--sidebar-muted)' }}>
                {group.title}
              </h3>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href} onClick={handleLinkClick}>
                      <span
                        ref={(el) => {
                          if (el) {
                            navItemRefs.current.set(item.href, el);
                          } else {
                            navItemRefs.current.delete(item.href);
                          }
                        }}
                        className={cn(
                          "group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                          active ? "sidebar-nav-active" : "sidebar-nav-inactive"
                        )}
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <span className="flex items-center gap-3">
                          <item.icon className={cn(
                            "w-4 h-4 transition-colors",
                            active ? "sidebar-icon-active" : "sidebar-icon-inactive"
                          )} />
                          {item.label}
                        </span>
                        <span className="flex items-center gap-2">
                          {(item.href === "/admin/proposals" ? true : !!item.badge) && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] font-semibold px-1.5 py-0 border-0",
                                item.badgeVariant === "success" 
                                  ? "sidebar-badge-success"
                                  : item.badgeVariant === "warning"
                                  ? "sidebar-badge-warning"
                                  : "sidebar-badge-default"
                              )}
                            >
                              {item.href === "/admin/proposals" ? proposalCount : item.badge}
                            </Badge>
                          )}
                          {active && (
                            <ChevronRight className="w-4 h-4 sidebar-icon-active" />
                          )}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <div className="rounded-xl p-4 sidebar-widget-bg">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg sidebar-widget-icon-bg">
              <Sparkles className="w-3.5 h-3.5 sidebar-widget-icon" />
            </div>
            <span className="text-sm font-semibold text-foreground">{sidebarWidget.title}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{sidebarWidget.usedLabel}</span>
              <span className="font-medium text-foreground">{sidebarWidget.usedValue}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full theme-gradient-fill rounded-full" style={{ width: `${sidebarWidget.percentage ?? 75}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground">{sidebarWidget.percentageLabel}</p>
          </div>
        </div>
      </div>
    </>
  );

  // Mobile: Use Sheet overlay
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
          <aside className="admin-sidebar w-full flex flex-col h-full" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
            {sidebarContent}
          </aside>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Always visible sidebar
  return (
    <aside className="admin-sidebar w-64 flex flex-col fixed left-0 bottom-0 border-r border-border hidden md:flex" style={{ backgroundColor: 'var(--sidebar-bg)', top: 'var(--navbar-height)' }}>
      {sidebarContent}
    </aside>
  );
}
