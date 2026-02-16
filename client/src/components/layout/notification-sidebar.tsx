import { useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Bell, Check, X, Clock, AlertCircle, Info, CheckCircle2, Trash2, AtSign, Calendar, RefreshCw, MessageSquare, MessageCircle, Coins, Building2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useConfirm } from "@/hooks/use-confirm";
import { useToast } from "@/hooks/use-toast";
import {
  fetchNotifications,
  markNotificationRead,
  dismissNotification,
  markAllNotificationsRead,
  dismissAllNotifications,
  type AppNotification,
  type NotificationType,
} from "@/api/notifications";
import { QueryErrorState } from "@/components/shared/query-error-state";

interface NotificationSidebarProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case "success":
      return CheckCircle2;
    case "warning":
    case "error":
    case "credit_alert":
      return AlertCircle;
    case "mention":
      return AtSign;
    case "comment":
      return MessageSquare;
    case "chat":
      return MessageCircle;
    case "credit_added":
    case "credit_assigned":
    case "credit_allocated":
    case "credit_purchase":
    case "credit_plan_assigned":
      return Coins;
    case "credit_removed":
    case "credit_deducted":
      return AlertCircle;
    case "organization_created":
      return Building2;
    case "collaboration_invite":
      return UserPlus;
    case "deadline_reminder":
      return Calendar;
    case "status_change":
      return RefreshCw;
    default:
      return Info;
  }
};

const getNotificationColor = (type: NotificationType) => {
  switch (type) {
    case "success":
      return "text-green-500";
    case "warning":
    case "credit_alert":
      return "text-yellow-500";
    case "error":
      return "text-red-500";
    case "mention":
      return "text-primary";
    case "comment":
    case "chat":
      return "text-blue-500";
    case "credit_added":
    case "credit_assigned":
    case "credit_allocated":
    case "credit_purchase":
    case "credit_plan_assigned":
      return "text-emerald-500";
    case "credit_removed":
    case "credit_deducted":
      return "text-amber-500";
    case "organization_created":
      return "text-violet-500";
    case "collaboration_invite":
      return "text-cyan-500";
    case "deadline_reminder":
      return "text-amber-500";
    case "status_change":
      return "text-primary";
    default:
      return "text-primary";
  }
};

export function NotificationSidebar({ open = false, onOpenChange }: NotificationSidebarProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: apiNotifications = [], isError, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 4000,
  });
  const prevIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (open && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [open]);
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const unread = apiNotifications.filter((n: AppNotification) => !n.read);
    const currentIds = new Set(unread.map((n: AppNotification) => n.id));
    const previous = prevIdsRef.current;
    // Only show browser notifications for persisted events (id starts with "n_"), not computed ones like "credits_low" or "deadline_*"
    const persistedUnread = unread.filter((n: AppNotification) => n.id.startsWith("n_"));
    const newPersistedIds = Array.from(persistedUnread.map((n: AppNotification) => n.id)).filter((id) => !previous.has(id));
    // Only fire when we have a previous state (avoids re-showing on every navigation/remount)
    if (previous.size > 0 && newPersistedIds.length > 0 && Notification.permission === "granted") {
      persistedUnread
        .filter((n: AppNotification) => newPersistedIds.includes(n.id))
        .slice(0, 3)
        .forEach((n: AppNotification) => {
          try {
            new Notification(n.title, { body: n.message || n.body || "" });
          } catch {
            // ignore
          }
        });
    }
    prevIdsRef.current = currentIds;
  }, [apiNotifications]);
  const notifications = useMemo(() => {
    return apiNotifications.map((n: AppNotification) => {
      const link = n.link ?? (n.meta?.proposalId != null ? `/rfp/${n.meta.proposalId}` : undefined);
      return {
        ...n,
        link,
        read: n.read,
        message: n.body ?? n.message ?? "",
        time: n.createdAt ?? n.time ?? "",
      };
    });
  }, [apiNotifications]);
  const { confirm, ConfirmDialog } = useConfirm();

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => toast({ title: "Error", description: "Could not mark as read.", variant: "destructive" }),
  });
  const dismissMutation = useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => toast({ title: "Error", description: "Could not dismiss notification.", variant: "destructive" }),
  });
  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => toast({ title: "Error", description: "Could not mark all as read.", variant: "destructive" }),
  });
  const dismissAllMutation = useMutation({
    mutationFn: dismissAllNotifications,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: () => toast({ title: "Error", description: "Could not dismiss all.", variant: "destructive" }),
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => readMutation.mutate(id);
  const markAllAsRead = () => readAllMutation.mutate();
  const deleteNotification = (id: string) => dismissMutation.mutate(id);

  const deleteAllNotifications = async () => {
    const confirmed = await confirm({
      title: "Delete All Notifications",
      description: "Are you sure you want to delete all notifications? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (confirmed) dismissAllMutation.mutate();
  };

  const sidebarContent = (
    <>
      <ConfirmDialog />
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 theme-gradient-bg rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange?.(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="flex-1 text-xs"
            >
              <Check className="w-3 h-3 mr-2" />
              Mark all as read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={deleteAllNotifications}
              className={cn(
                "text-xs",
                unreadCount > 0 ? "flex-1" : "w-full"
              )}
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Delete all
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-4 space-y-2">
          {isError ? (
            <QueryErrorState refetch={refetch} error={error} className="py-4" />
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-sm font-medium text-foreground mb-1">No notifications</p>
              <p className="text-xs text-muted-foreground">
                You're all caught up!
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const iconColor = getNotificationColor(notification.type);
              const rowClass = cn(
                "group relative p-3 rounded-lg border transition-all duration-200 block",
                notification.link && "hover:bg-muted/50 cursor-pointer",
                notification.read
                  ? "bg-background border-border opacity-75"
                  : "sidebar-widget-bg border-primary/20"
              );
              const content = (
                  <div className="flex items-start gap-3">
                    <div className={cn("p-1.5 rounded-lg shrink-0", notification.read ? "bg-muted" : "sidebar-widget-icon-bg")}>
                      <Icon className={cn("w-4 h-4", notification.read ? "text-muted-foreground" : iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className={cn(
                          "text-sm font-semibold",
                          notification.read ? "text-muted-foreground" : "text-foreground"
                        )}>
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>
                      <p className={cn(
                        "text-xs mb-2",
                        notification.read ? "text-muted-foreground" : "text-foreground/80"
                      )}>
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {notification.time}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsRead(notification.id); }}
                              title="Mark as read"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteNotification(notification.id); }}
                            title="Delete"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
              );
              return notification.link ? (
                <Link key={notification.id} to={notification.link} className={rowClass} onClick={() => onOpenChange?.(false)}>
                  {content}
                </Link>
              ) : (
                <div key={notification.id} className={rowClass}>
                  {content}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );

  // Use Sheet for both mobile and desktop - it has built-in slide animations from right
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className={cn(
          "w-full max-w-[100vw] sm:w-[500px] sm:max-w-[500px] p-0 bg-sidebar text-sidebar-foreground border-l [&>button]:hidden h-full !top-0 !inset-y-0"
        )}
        style={{ 
          backgroundColor: 'var(--sidebar-bg)',
          top: '0',
          height: '100vh',
          zIndex: 60,
        }}
      >
        <aside 
          className="notification-sidebar w-full flex flex-col h-full" 
          style={{ backgroundColor: 'var(--sidebar-bg)' }}
        >
          {sidebarContent}
        </aside>
      </SheetContent>
    </Sheet>
  );
}
