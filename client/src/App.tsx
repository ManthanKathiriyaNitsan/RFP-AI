import { Switch, Route, Redirect, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster as HotToaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { StoreProvider } from "@/contexts/StoreContext";
import { AdminSelectedOrgProvider } from "@/contexts/AdminSelectedOrgContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ApiStatusProvider } from "@/contexts/ApiStatusContext";
import { ApiStatusBanner } from "@/components/shared/api-status-banner";
import { AppLoader } from "@/components/shared/app-loader";
import { CopyrightFooter } from "@/components/shared/copyright-footer";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Navigation } from "@/components/layout/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { CustomerSidebar } from "@/components/customer/customer-sidebar";
import { CollaboratorSidebar } from "@/components/collaborator/collaborator-sidebar";
import { useToast } from "@/hooks/use-toast";
import { fetchAdminSidebar } from "@/api/admin-data";
import { fetchCustomerSidebar } from "@/api/customer-data";
import { fetchCollaboratorSidebar } from "@/api/collaborator-data";
import { createNotification } from "@/api/notifications";
import {
  getLowCreditsToastOptions,
  getOutOfCreditsToastOptions,
  getCreditsDeductedToastOptions,
  getCreditThresholdToAlert,
  getCreditThresholdAlertOptions,
  markCreditThresholdNotifiedThisSession,
  hasShownLowCreditsToastThisSession,
  setLowCreditsToastShownThisSession,
  showCreditAlertBrowserNotification,
} from "@/lib/utils";

// Pages
import Auth from "@/pages/auth";
import ForgotPassword from "@/pages/forgot-password";
import Register from "@/pages/register";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import VerifyEmailPending from "@/pages/verify-email-pending";
import AccountSettings from "@/pages/account-settings";
import AIChat from "@/pages/ai-chat";
import NotFound from "@/pages/not-found";

// Admin Pages
import AdminDashboard from "@/pages/admin/admin-dashboard";
import AdminAnalytics from "@/pages/admin/admin-analytics";
import AdminProposals from "@/pages/admin/admin-proposals";
import AdminProposalDetail from "@/pages/admin/admin-proposal-detail";
import AdminProposalsNew from "@/pages/admin/admin-proposals-new";
import AdminUsers from "@/pages/admin/admin-users";
import AdminUsersTerms from "@/pages/admin/admin-users-terms";
import AdminContent from "@/pages/admin/admin-content";
import AdminContentEditor from "@/pages/admin/admin-content-editor";
import AdminAIConfig from "@/pages/admin/admin-ai-config";
import AdminCredits from "@/pages/admin/admin-credits";
import AdminUsage from "@/pages/admin/admin-usage";
import AdminIntegrations from "@/pages/admin/admin-integrations";
import AdminIntegrationSetup from "@/pages/admin/admin-integration-setup";
import AdminSecurity from "@/pages/admin/admin-security";
import AdminIpAccess from "@/pages/admin/admin-ip-access";
import AdminSettings from "@/pages/admin/admin-settings";
import AdminOrganizations from "@/pages/admin/admin-organizations";
import AdminOrganizationDetail from "@/pages/admin/admin-organization-detail";
import AdminRoles from "@/pages/admin/admin-roles";
import AdminKnowledgeBase from "@/pages/admin/admin-knowledge-base";
import AdminSubscriptionBilling from "@/pages/admin/admin-subscription-billing";
import AdminAuditLogs from "@/pages/admin/admin-audit-logs";
import AdminProposalOptions from "@/pages/admin/admin-proposal-options";

// Customer Pages
import CustomerDashboard from "@/pages/customer/customer-dashboard";
import CollaboratorView from "@/pages/collaborator/collaborator-view";
import CollaboratorAnalytics from "@/pages/collaborator/collaborator-analytics";
import ProposalBuilder from "@/pages/customer/proposal-builder";
import ProposalQuestions from "@/pages/customer/proposal-questions";
import ProposalGenerate from "@/pages/customer/proposal-generate";
import RFPProjects from "@/pages/customer/rfp-projects";
import KnowledgeBase from "@/pages/customer/knowledge-base";
import CollaboratorManagement from "@/pages/customer/collaborator-management";
import RFPDetail from "@/pages/customer/rfp-detail";
import RFPReview from "@/pages/customer/rfp-review";
import PublicProposalAnswer from "@/pages/customer/public-proposal-answer";
import CustomerCreditUsage from "@/pages/customer/credit-usage";
import CollaboratorCreditUsage from "@/pages/collaborator/credit-usage";

/** True if user can access the admin panel (admin or super_admin). */
function isAdminPanelRole(role: string) {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "super_admin";
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, currentRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const role = (currentRole || "").toLowerCase();

  const { data: sidebarData } = useQuery({
    queryKey: ["admin", "sidebar"],
    queryFn: fetchAdminSidebar,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  const widget = sidebarData?.sidebarWidget as { credits?: number } | undefined;
  const credits = widget?.credits ?? user?.credits ?? 0;
  const creditsRef = useRef(credits);
  creditsRef.current = credits;
  const prevCreditsRef = useRef<number | null>(null);
  const hasCreatedOutOfCreditsNotifRef = useRef(false);

  useEffect(() => {
    if (role === "super_admin") return;
    if (!sidebarData?.sidebarWidget) return;
    const prev = prevCreditsRef.current;
    if (prev === null) {
      prevCreditsRef.current = credits;
      return;
    }
    if (credits > 0) hasCreatedOutOfCreditsNotifRef.current = false;
    if (credits < prev) {
      const deducted = prev - credits;
      const opts = getCreditsDeductedToastOptions(deducted, credits, { isAdmin: true });
      if (opts) {
        toast({ ...opts, variant: "destructive" });
        showCreditAlertBrowserNotification(opts.title, opts.description);
        createNotification({ title: opts.title, message: opts.description, type: "credit_deducted", link: opts.actionHref }).catch(() => {}).finally(() => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        });
      }
      if (credits <= 0) {
        const outOpts = getOutOfCreditsToastOptions(credits, { isAdmin: true });
        if (outOpts && !hasCreatedOutOfCreditsNotifRef.current) {
          hasCreatedOutOfCreditsNotifRef.current = true;
          showCreditAlertBrowserNotification(outOpts.title, outOpts.description);
          createNotification({ title: outOpts.title, message: outOpts.description, type: "credit_alert", link: outOpts.actionHref }).catch(() => {}).finally(() => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          });
        }
      }
    }
    prevCreditsRef.current = credits;
  }, [role, sidebarData, user?.credits, credits, toast]);

  useEffect(() => {
    if (role === "super_admin") return;
    if (!sidebarData?.sidebarWidget) return;
    if (hasShownLowCreditsToastThisSession("admin")) return;
    const lowOpts = getLowCreditsToastOptions(credits, { isAdmin: true });
    if (!lowOpts) return;
    setLowCreditsToastShownThisSession("admin");
    toast({ ...lowOpts, variant: "destructive" });
    showCreditAlertBrowserNotification(lowOpts.title, lowOpts.description);
    createNotification({ title: lowOpts.title, message: lowOpts.description, type: "credit_alert", link: lowOpts.actionHref }).catch(() => {}).finally(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [role, sidebarData, user?.credits, toast, credits]);

  useEffect(() => {
    if (role === "super_admin") return;
    if (!sidebarData?.sidebarWidget) return;
    const threshold = getCreditThresholdToAlert(credits, "admin");
    if (threshold == null) return;
    const opts = getCreditThresholdAlertOptions(threshold, credits, { isAdmin: true });
    markCreditThresholdNotifiedThisSession("admin", threshold);
    toast({ ...opts, variant: "destructive" });
    showCreditAlertBrowserNotification(opts.title, opts.description);
    createNotification({ title: opts.title, message: opts.description, type: "credit_alert", link: opts.actionHref }).catch(() => {}).finally(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [role, sidebarData, user?.credits, credits, toast]);

  useEffect(() => {
    if (role === "super_admin") return;
    const id = setInterval(() => {
      if (creditsRef.current > 0) return;
      const opts = getOutOfCreditsToastOptions(creditsRef.current, { isAdmin: true });
      if (!opts) return;
      createNotification({ title: opts.title, message: opts.description, type: "credit_alert", link: opts.actionHref }).catch(() => {}).finally(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });
      showCreditAlertBrowserNotification(opts.title, opts.description);
      toast({ ...opts, variant: "destructive" });
    }, 24 * 60 * 60 * 1000); // 24 hours
    return () => clearInterval(id);
  }, [role, toast]);

  if (!user) {
    return <Redirect to="/auth" />;
  }
  if (!isAdminPanelRole(role)) {
    if (role === "collaborator") return <Redirect to="/collaborator" />;
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="bg-background w-full max-w-full overflow-x-hidden min-h-screen flex flex-col">
      <Navigation sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex flex-1 w-full max-w-full overflow-x-hidden">
        <AdminSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <main className="flex-1 flex flex-col min-h-[calc(100vh-var(--navbar-height))] p-4 sm:p-6 md:ml-64 w-full max-w-full overflow-x-hidden" style={{ paddingTop: 'calc(var(--navbar-height) + 16px)' }}>
          <Component />
        </main>
      </div>
      <CopyrightFooter />
    </div>
  );
}

/** Admin routes that only super_admin may access; admin is redirected to /admin. */
function SuperAdminOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, currentRole } = useAuth();
  const role = (currentRole || "").toLowerCase();
  if (!user) return <Redirect to="/auth" />;
  if (!isAdminPanelRole(role)) {
    if (role === "collaborator") return <Redirect to="/collaborator" />;
    return <Redirect to="/dashboard" />;
  }
  if (role !== "super_admin") return <Redirect to="/admin" />;
  return <AdminRoute component={Component} />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, currentRole } = useAuth();
  
  if (user) {
    const role = (currentRole || "").toLowerCase();
    if (isAdminPanelRole(role)) {
      return <Redirect to="/admin" />;
    } else if (role === "collaborator") {
      return <Redirect to="/collaborator" />;
    } else {
      return <Redirect to="/dashboard" />;
    }
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1">
        <Component />
      </div>
      <CopyrightFooter />
    </div>
  );
}

function CustomerRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, currentRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const role = (currentRole || "").toLowerCase();

  const { data: sidebarData } = useQuery({
    queryKey: ["customer", "sidebar"],
    queryFn: fetchCustomerSidebar,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  const widget = sidebarData?.sidebarWidget as { credits?: number } | undefined;
  const credits = widget?.credits ?? user?.credits ?? 0;
  const creditsRef = useRef(credits);
  creditsRef.current = credits;
  const prevCreditsRef = useRef<number | null>(null);
  const hasCreatedOutOfCreditsNotifRef = useRef(false);

  useEffect(() => {
    if (!sidebarData?.sidebarWidget) return;
    const prev = prevCreditsRef.current;
    if (prev === null) {
      prevCreditsRef.current = credits;
      return;
    }
    if (credits > 0) hasCreatedOutOfCreditsNotifRef.current = false;
    if (credits < prev) {
      const deducted = prev - credits;
      const opts = getCreditsDeductedToastOptions(deducted, credits, { isAdmin: false });
      if (opts) {
        toast({ ...opts, variant: "destructive" });
        showCreditAlertBrowserNotification(opts.title, opts.description);
        createNotification({ title: opts.title, message: opts.description, type: "credit_deducted", link: opts.actionHref }).catch(() => {}).finally(() => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        });
      }
      if (credits <= 0) {
        const outOpts = getOutOfCreditsToastOptions(credits, { isAdmin: false });
        if (outOpts && !hasCreatedOutOfCreditsNotifRef.current) {
          hasCreatedOutOfCreditsNotifRef.current = true;
          showCreditAlertBrowserNotification(outOpts.title, outOpts.description);
          createNotification({ title: outOpts.title, message: outOpts.description, type: "credit_alert", link: outOpts.actionHref }).catch(() => {}).finally(() => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          });
        }
      }
    }
    prevCreditsRef.current = credits;
  }, [sidebarData, user?.credits, credits, toast]);

  useEffect(() => {
    if (!sidebarData?.sidebarWidget) return;
    if (hasShownLowCreditsToastThisSession("customer")) return;
    const lowOpts = getLowCreditsToastOptions(credits, { isAdmin: false });
    if (!lowOpts) return;
    setLowCreditsToastShownThisSession("customer");
    toast({ ...lowOpts, variant: "destructive" });
    showCreditAlertBrowserNotification(lowOpts.title, lowOpts.description);
    createNotification({ title: lowOpts.title, message: lowOpts.description, type: "credit_alert", link: lowOpts.actionHref }).catch(() => {}).finally(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [sidebarData, user?.credits, toast, credits]);

  useEffect(() => {
    if (!sidebarData?.sidebarWidget) return;
    const threshold = getCreditThresholdToAlert(credits, "customer");
    if (threshold == null) return;
    const opts = getCreditThresholdAlertOptions(threshold, credits, { isAdmin: false });
    markCreditThresholdNotifiedThisSession("customer", threshold);
    toast({ ...opts, variant: "destructive" });
    showCreditAlertBrowserNotification(opts.title, opts.description);
    createNotification({ title: opts.title, message: opts.description, type: "credit_alert", link: opts.actionHref }).catch(() => {}).finally(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [sidebarData, user?.credits, credits, toast]);

  useEffect(() => {
    const id = setInterval(() => {
      if (creditsRef.current > 0) return;
      const opts = getOutOfCreditsToastOptions(creditsRef.current, { isAdmin: false });
      if (!opts) return;
      createNotification({ title: opts.title, message: opts.description, type: "credit_alert", link: opts.actionHref }).catch(() => {}).finally(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });
      showCreditAlertBrowserNotification(opts.title, opts.description);
      toast({ ...opts, variant: "destructive" });
    }, 24 * 60 * 60 * 1000); // 24 hours
    return () => clearInterval(id);
  }, [toast]);

  if (!user) {
    return <Redirect to="/auth" />;
  }
  if (isAdminPanelRole(role)) {
    return <Redirect to="/admin" />;
  }
  if (role === "collaborator") {
    return <Redirect to="/collaborator" />;
  }

  return (
    <div className="bg-background w-full max-w-full overflow-x-hidden min-h-screen flex flex-col">
      <Navigation sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex flex-1 w-full max-w-full overflow-x-hidden">
        <CustomerSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <main className="flex-1 flex flex-col min-h-[calc(100vh-var(--navbar-height))] p-4 sm:p-6 md:ml-64 w-full max-w-full overflow-x-hidden" style={{ paddingTop: 'calc(var(--navbar-height) + 16px)' }}>
          <Component />
        </main>
      </div>
      <CopyrightFooter />
    </div>
  );
}

function CollaboratorRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, currentRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const role = (currentRole || "").toLowerCase();

  const { data: sidebarData } = useQuery({
    queryKey: ["collaborator", "sidebar"],
    queryFn: fetchCollaboratorSidebar,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  const widget = sidebarData?.sidebarWidget as { credits?: number } | undefined;
  const credits = widget?.credits ?? user?.credits ?? 0;
  const creditsRef = useRef(credits);
  creditsRef.current = credits;
  const prevCreditsRef = useRef<number | null>(null);
  const hasCreatedOutOfCreditsNotifRef = useRef(false);

  useEffect(() => {
    if (!sidebarData?.sidebarWidget) return;
    const prev = prevCreditsRef.current;
    if (prev === null) {
      prevCreditsRef.current = credits;
      return;
    }
    if (credits > 0) hasCreatedOutOfCreditsNotifRef.current = false;
    if (credits < prev) {
      const deducted = prev - credits;
      const opts = getCreditsDeductedToastOptions(deducted, credits, {
        isAdmin: false,
        creditsHref: "/collaborator/credits-usage",
        actionLabel: "See where credits are used",
      });
      if (opts) {
        toast({ ...opts, variant: "destructive" });
        showCreditAlertBrowserNotification(opts.title, opts.description);
        createNotification({ title: opts.title, message: opts.description, type: "credit_deducted", link: opts.actionHref }).catch(() => {}).finally(() => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        });
      }
      if (credits <= 0) {
        const outOpts = getOutOfCreditsToastOptions(credits, {
          isAdmin: false,
          creditsHref: "/collaborator/credits-usage",
          actionLabel: "See where credits are used",
        });
        if (outOpts && !hasCreatedOutOfCreditsNotifRef.current) {
          hasCreatedOutOfCreditsNotifRef.current = true;
          showCreditAlertBrowserNotification(outOpts.title, outOpts.description);
          createNotification({ title: outOpts.title, message: outOpts.description, type: "credit_alert", link: outOpts.actionHref }).catch(() => {}).finally(() => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          });
        }
      }
    }
    prevCreditsRef.current = credits;
  }, [sidebarData, user?.credits, credits, toast]);

  useEffect(() => {
    if (!sidebarData?.sidebarWidget) return;
    if (hasShownLowCreditsToastThisSession("collaborator")) return;
    const lowOpts = getLowCreditsToastOptions(credits, {
      isAdmin: false,
      creditsHref: "/collaborator/credits-usage",
      actionLabel: "See where credits are used",
    });
    if (!lowOpts) return;
    setLowCreditsToastShownThisSession("collaborator");
    toast({ ...lowOpts, variant: "destructive" });
    showCreditAlertBrowserNotification(lowOpts.title, lowOpts.description);
    createNotification({ title: lowOpts.title, message: lowOpts.description, type: "credit_alert", link: lowOpts.actionHref }).catch(() => {}).finally(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [sidebarData, user?.credits, toast, credits]);

  useEffect(() => {
    if (!sidebarData?.sidebarWidget) return;
    const threshold = getCreditThresholdToAlert(credits, "collaborator");
    if (threshold == null) return;
    const opts = getCreditThresholdAlertOptions(threshold, credits, {
      isAdmin: false,
      creditsHref: "/collaborator/credits-usage",
    });
    markCreditThresholdNotifiedThisSession("collaborator", threshold);
    toast({ ...opts, variant: "destructive" });
    showCreditAlertBrowserNotification(opts.title, opts.description);
    createNotification({ title: opts.title, message: opts.description, type: "credit_alert", link: opts.actionHref }).catch(() => {}).finally(() => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [sidebarData, user?.credits, credits, toast]);

  useEffect(() => {
    const id = setInterval(() => {
      if (creditsRef.current > 0) return;
      const opts = getOutOfCreditsToastOptions(creditsRef.current, {
        isAdmin: false,
        creditsHref: "/collaborator/credits-usage",
        actionLabel: "See where credits are used",
      });
      if (!opts) return;
      createNotification({ title: opts.title, message: opts.description, type: "credit_alert", link: opts.actionHref }).catch(() => {}).finally(() => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
      });
      showCreditAlertBrowserNotification(opts.title, opts.description);
      toast({ ...opts, variant: "destructive" });
    }, 24 * 60 * 60 * 1000); // 24 hours
    return () => clearInterval(id);
  }, [toast]);

  if (!user) {
    return <Redirect to="/auth" />;
  }
  if (role !== "collaborator") {
    if (isAdminPanelRole(role)) return <Redirect to="/admin" />;
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="bg-background w-full max-w-full overflow-x-hidden min-h-screen flex flex-col">
      <Navigation sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex flex-1 w-full max-w-full overflow-x-hidden">
        <CollaboratorSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <main className="flex-1 flex flex-col min-h-[calc(100vh-var(--navbar-height))] p-4 sm:p-6 md:ml-64 w-full max-w-full overflow-x-hidden" style={{ paddingTop: 'calc(var(--navbar-height) + 16px)' }}>
          <Component />
        </main>
      </div>
      <CopyrightFooter />
    </div>
  );
}

function AuthenticatedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  // Check if we're on the account-settings route to pass sidebar props
  const isAccountSettings = location === "/account-settings";
  
  return (
    <div className="bg-background min-h-screen flex flex-col">
      <Navigation sidebarOpen={isAccountSettings ? sidebarOpen : undefined} setSidebarOpen={isAccountSettings ? setSidebarOpen : undefined} />
      <main className="flex-1 p-4 sm:p-6" style={{ paddingTop: 'calc(var(--navbar-height) + 16px)' }}>
        {isAccountSettings ? (
          <Component sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        ) : (
          <Component />
        )}
      </main>
      <CopyrightFooter />
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth" component={() => <PublicRoute component={Auth} />} />
      <Route path="/forgot-password" component={() => <PublicRoute component={ForgotPassword} />} />
      <Route path="/register" component={() => <PublicRoute component={Register} />} />
      <Route path="/reset-password" component={() => <PublicRoute component={ResetPassword} />} />
      <Route path="/verify-email" component={() => <PublicRoute component={VerifyEmail} />} />
      <Route path="/verify-email-pending" component={() => <PublicRoute component={VerifyEmailPending} />} />

      {/* Admin routes */}
      <Route path="/admin" component={() => <AdminRoute component={AdminDashboard} />} />
      <Route path="/admin/analytics" component={() => <AdminRoute component={AdminAnalytics} />} />
      <Route path="/admin/proposals" component={() => <AdminRoute component={AdminProposals} />} />
      <Route path="/admin/proposals/new" component={() => <AdminRoute component={AdminProposalsNew} />} />
      <Route path="/admin/proposals/:id" component={() => <AdminRoute component={AdminProposalDetail} />} />
      <Route path="/admin/proposals/:id/questions" component={() => <AdminRoute component={ProposalQuestions} />} />
      <Route path="/admin/proposals/:id/generate" component={() => <AdminRoute component={ProposalGenerate} />} />
      <Route path="/admin/proposals/:id/review" component={() => <AdminRoute component={RFPReview} />} />
      <Route path="/admin/organizations" component={() => <AdminRoute component={AdminOrganizations} />} />
      <Route path="/admin/organizations/:id" component={() => <AdminRoute component={AdminOrganizationDetail} />} />
      <Route path="/admin/users" component={() => <AdminRoute component={AdminUsers} />} />
      <Route path="/admin/roles" component={() => <AdminRoute component={AdminRoles} />} />
      <Route path="/admin/knowledge-base" component={() => <AdminRoute component={AdminKnowledgeBase} />} />
      <Route path="/admin/subscription-billing" component={() => <SuperAdminOnlyRoute component={AdminSubscriptionBilling} />} />
      <Route path="/admin/users-terms" component={() => <AdminRoute component={AdminUsersTerms} />} />
      <Route path="/admin/content" component={() => <AdminRoute component={AdminContent} />} />
      <Route path="/admin/content/editor" component={() => <AdminRoute component={AdminContentEditor} />} />
      <Route path="/admin/ai-config" component={() => <SuperAdminOnlyRoute component={AdminAIConfig} />} />
      <Route path="/admin/credits" component={() => <AdminRoute component={AdminCredits} />} />
      <Route path="/admin/usage" component={() => <AdminRoute component={AdminUsage} />} />
      <Route path="/admin/integrations" component={() => <AdminRoute component={AdminIntegrations} />} />
      <Route path="/admin/integrations/setup" component={() => <AdminRoute component={AdminIntegrationSetup} />} />
      <Route path="/admin/security/ip-access" component={() => <AdminRoute component={AdminIpAccess} />} />
      <Route path="/admin/security" component={() => <AdminRoute component={AdminSecurity} />} />
      <Route path="/admin/audit-logs" component={() => <AdminRoute component={AdminAuditLogs} />} />
      <Route path="/admin/proposal-options" component={() => <AdminRoute component={AdminProposalOptions} />} />
      <Route path="/admin/settings" component={() => <AdminRoute component={AdminSettings} />} />
      
      {/* Collaborator routes (dedicated panel – only collaborators) */}
      <Route path="/collaborator" component={() => <CollaboratorRoute component={CollaboratorView} />} />
      <Route path="/collaborator/analytics" component={() => <CollaboratorRoute component={CollaboratorAnalytics} />} />
      <Route path="/collaborator/credits-usage" component={() => <CollaboratorRoute component={CollaboratorCreditUsage} />} />
      <Route path="/collaborator/rfp/:id" component={() => <CollaboratorRoute component={RFPDetail} />} />
      <Route path="/collaborator/rfp/:id/questions" component={() => <CollaboratorRoute component={ProposalQuestions} />} />
      <Route path="/collaborator/rfp/:id/generate" component={() => <CollaboratorRoute component={ProposalGenerate} />} />
      <Route path="/collaborator/rfp/:id/review" component={() => <CollaboratorRoute component={RFPReview} />} />

      {/* Customer routes (redirect collaborators to /collaborator) */}
      <Route path="/dashboard" component={() => <CustomerRoute component={CustomerDashboard} />} />
      <Route path="/credits-usage" component={() => <CustomerRoute component={CustomerCreditUsage} />} />
      <Route path="/credits">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/proposals/new" component={() => <CustomerRoute component={ProposalBuilder} />} />
      <Route path="/rfp-projects" component={() => <CustomerRoute component={RFPProjects} />} />
      <Route path="/knowledge-base" component={() => <CustomerRoute component={KnowledgeBase} />} />
      <Route path="/collaborators" component={() => <CustomerRoute component={CollaboratorManagement} />} />
      <Route path="/rfp/:id" component={() => <CustomerRoute component={RFPDetail} />} />
      <Route path="/rfp/:id/questions" component={() => <CustomerRoute component={ProposalQuestions} />} />
      <Route path="/rfp/:id/generate" component={() => <CustomerRoute component={ProposalGenerate} />} />
      <Route path="/rfp/:id/review" component={() => <CustomerRoute component={RFPReview} />} />
      <Route path="/p/:token" component={PublicProposalAnswer} />
      
      {/* Authenticated routes (available to all authenticated users) */}
      <Route path="/account-settings" component={() => <AuthenticatedRoute component={AccountSettings} />} />
      <Route path="/ai-chat" component={() => <AuthenticatedRoute component={AIChat} />} />
      
      {/* Root redirect */}
      <Route path="/">
        {() => {
          const { user, currentRole } = useAuth();
          if (!user) {
            return <Redirect to="/auth" />;
          }
          const role = (currentRole || "").toLowerCase();
          if (role === "admin") {
            return <Redirect to="/admin" />;
          } else if (role === "collaborator") {
            return <Redirect to="/collaborator" />;
          } else {
            return <Redirect to="/dashboard" />;
          }
        }}
      </Route>
      
      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

/** Toast styles using CSS variables so they update with theme without refresh. */
const TOAST_OPTIONS = {
  duration: 4500,
  style: {
    padding: "14px 18px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 1px currentColor",
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--card-foreground)",
    fontSize: "14px",
    maxWidth: "min(90vw, 420px)",
  },
  iconTheme: { primary: "hsl(174, 70%, 42%)", secondary: "var(--muted)" },
  success: { iconTheme: { primary: "hsl(142, 71%, 45%)", secondary: "var(--muted)" } },
  error: { iconTheme: { primary: "var(--destructive)", secondary: "var(--muted)" } },
};

/** Renders app content or full-page loader while session is initializing (e.g. token refresh on refresh). */
function AppContent() {
  const { isInitializing } = useAuth();
  if (isInitializing) {
    return <AppLoader />;
  }
  return (
    <AdminSelectedOrgProvider>
      <BrandingProvider>
        <StoreProvider>
          <ApiStatusProvider>
            <TooltipProvider>
              <HotToaster
                position="top-center"
                reverseOrder={false}
                toastOptions={TOAST_OPTIONS}
              />
              <ApiStatusBanner />
              <Router />
            </TooltipProvider>
          </ApiStatusProvider>
        </StoreProvider>
      </BrandingProvider>
    </AdminSelectedOrgProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="rfp-ai-theme">
        <ErrorBoundary>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
