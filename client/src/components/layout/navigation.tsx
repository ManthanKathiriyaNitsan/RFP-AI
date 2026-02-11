import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Brain, User, LogOut, Bell, Settings, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/contexts/BrandingContext";
import { getAvatarUrl } from "@/lib/api";
import { fetchAdminOrganizations } from "@/api/admin-data";
import { fetchNotifications } from "@/api/notifications";
import { ThemeToggle } from "../shared/theme-toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationSidebar } from "./notification-sidebar";
import { GlobalSearch } from "./global-search";
import { useState, useMemo, useEffect } from "react";

const ADMIN_SELECTED_ORG_ID_KEY = "admin_selected_org_id";
const ADMIN_ORG_CHANGED_EVENT = "admin_selected_org_changed";

interface NavigationProps {
  sidebarOpen?: boolean;
  setSidebarOpen?: (open: boolean) => void;
}

export function Navigation({ sidebarOpen, setSidebarOpen }: NavigationProps = {}) {
  const [location] = useLocation();
  const { user, logout, currentRole } = useAuth();
  const { primaryLogoUrl } = useBranding();
  const isMobile = useIsMobile();
  const isAdminRoute = location.startsWith("/admin");
  const isCustomerRoute = !isAdminRoute && location !== "/auth" && location !== "/account-settings" && location !== "/ai-chat";
  const isAccountSettingsRoute = location === "/account-settings";
  const [notificationSidebarOpen, setNotificationSidebarOpen] = useState(false);
  const [adminSelectedOrgId, setAdminSelectedOrgId] = useState<number | null>(() => {
    try {
      const s = localStorage.getItem(ADMIN_SELECTED_ORG_ID_KEY);
      return s ? parseInt(s, 10) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handler = (e: CustomEvent<{ orgId: number }>) => {
      setAdminSelectedOrgId(e.detail?.orgId ?? null);
    };
    window.addEventListener(ADMIN_ORG_CHANGED_EVENT, handler as EventListener);
    return () => window.removeEventListener(ADMIN_ORG_CHANGED_EVENT, handler as EventListener);
  }, []);

  if (!user) return null;

  // Determine home route based on role
  const getHomeRoute = () => {
    const r = (currentRole || "").toLowerCase();
    if (r === "admin" || r === "super_admin") return "/admin";
    if (r === "collaborator") return "/collaborator";
    return "/dashboard";
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/auth";
  };

  const handleNotifications = () => {
    setNotificationSidebarOpen(!notificationSidebarOpen);
  };

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    retry: false,
    staleTime: 60 * 1000,
  });
  const notificationUnreadCount = useMemo(
    () => (Array.isArray(notifications) ? notifications.filter((n: { read?: boolean }) => !n.read).length : 0),
    [notifications]
  );

  const { data: orgsList = [] } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: fetchAdminOrganizations,
    enabled: isAdminRoute,
  });
  const organizations = Array.isArray(orgsList) ? orgsList : [];
  const adminOrgDisplayName = useMemo(() => {
    if (!isAdminRoute || organizations.length === 0) return null;
    const id = adminSelectedOrgId;
    const org = id ? organizations.find((o: { id: number }) => o.id === id) : null;
    const current = org ?? organizations[0];
    return current?.name ?? null;
  }, [isAdminRoute, organizations, adminSelectedOrgId]);

  return (
    <nav className="glass-card border-b border-border px-3 sm:px-6 py-3 fixed top-0 left-0 right-0 z-50 backdrop-blur-md w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between w-full max-w-full overflow-x-hidden">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {isMobile && (isAdminRoute || isCustomerRoute || isAccountSettingsRoute) && setSidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden"
              data-testid="button-sidebar-toggle"
            >
              <Menu className="w-5 h-5" />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          )}
          {/* Hide logo on mobile for admin routes, customer routes, and account settings - it will be in sidebar instead */}
          {!(isMobile && (isAdminRoute || isCustomerRoute || isAccountSettingsRoute)) && (
            <Link href={getHomeRoute()} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              {primaryLogoUrl ? (
                <img src={primaryLogoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain bg-muted" />
              ) : (
                <div className="w-9 h-9 theme-gradient-bg rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                  <Brain className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-lg font-bold theme-gradient-text">
                  {((currentRole || "").toLowerCase() === "admin" || (currentRole || "").toLowerCase() === "super_admin") && adminOrgDisplayName ? adminOrgDisplayName : "RFP AI"}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium -mt-1">
                  {(currentRole || "").toLowerCase() === "super_admin" || currentRole === "admin" ? "Admin Console" : currentRole === "collaborator" ? "Collaborator Portal" : "Customer Portal"}
                </span>
              </div>
            </Link>
          )}
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex items-center gap-2 text-muted-foreground border-border h-9"
            onClick={() => window.dispatchEvent(new CustomEvent("open-global-search"))}
          >
            <Search className="w-4 h-4" />
            <span className="text-xs">Search</span>
            <kbd className="pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">⌘K</kbd>
          </Button>
          <GlobalSearch />
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative h-8 w-8 sm:h-10 sm:w-10 shrink-0" 
            data-testid="button-notifications"
            onClick={handleNotifications}
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            {notificationUnreadCount > 0 && (
              <span className="absolute top-0 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded-full text-[8px] sm:text-[10px] text-white flex items-center justify-center font-bold min-w-[10px]">
                {notificationUnreadCount > 99 ? "99+" : notificationUnreadCount}
              </span>
            )}
          </Button>
          
          <ThemeToggle />
          
          <div className="flex items-center space-x-2 sm:space-x-3 pl-2 sm:pl-3 border-l border-border shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center space-x-2 sm:space-x-3 hover:opacity-80 transition-opacity cursor-pointer shrink-0">
                  <Avatar className="w-8 h-8 sm:w-9 sm:h-9 ring-2 ring-primary/20 shrink-0">
                    {getAvatarUrl(user.avatar) && (
                      <AvatarImage src={getAvatarUrl(user.avatar)!} alt="" />
                    )}
                    <AvatarFallback className="theme-gradient-bg text-white text-xs sm:text-sm font-semibold">
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left min-w-0">
                    <p className="text-sm font-semibold truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(currentRole || "").toLowerCase() === "super_admin" ? "Super Administrator" : currentRole === "admin" ? "Administrator" : currentRole === "collaborator" ? "Collaborator" : "Customer"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <Link href="/account-settings">
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Account Settings
                  </DropdownMenuItem>
                </Link>
                <Link href="/ai-chat">
                  <DropdownMenuItem>
                    <Brain className="w-4 h-4 mr-2" />
                    AI Chat
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <NotificationSidebar open={notificationSidebarOpen} onOpenChange={setNotificationSidebarOpen} />
    </nav>
  );
}
