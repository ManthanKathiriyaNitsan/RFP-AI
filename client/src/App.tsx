import { Switch, Route, Redirect, useLocation } from "wouter";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { StoreProvider } from "@/contexts/StoreContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { ApiStatusProvider } from "@/contexts/ApiStatusContext";
import { ApiStatusBanner } from "@/components/shared/api-status-banner";
import { AppLoader } from "@/components/shared/app-loader";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Navigation } from "@/components/layout/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { CustomerSidebar } from "@/components/customer/customer-sidebar";
import { CollaboratorSidebar } from "@/components/collaborator/collaborator-sidebar";

// Pages
import Auth from "@/pages/auth";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
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
import AdminSettings from "@/pages/admin/admin-settings";
import AdminOrganizations from "@/pages/admin/admin-organizations";
import AdminOrganizationDetail from "@/pages/admin/admin-organization-detail";
import AdminRoles from "@/pages/admin/admin-roles";
import AdminRfpTemplates from "@/pages/admin/admin-rfp-templates";
import AdminKnowledgeBase from "@/pages/admin/admin-knowledge-base";
import AdminSubscriptionBilling from "@/pages/admin/admin-subscription-billing";
import AdminAuditLogs from "@/pages/admin/admin-audit-logs";

// Customer Pages
import CustomerDashboard from "@/pages/customer/customer-dashboard";
import CollaboratorView from "@/pages/collaborator/collaborator-view";
import CollaboratorAnalytics from "@/pages/collaborator/collaborator-analytics";
import CreditPurchase from "@/pages/customer/credit-purchase";
import ProposalBuilder from "@/pages/customer/proposal-builder";
import ProposalQuestions from "@/pages/customer/proposal-questions";
import ProposalGenerate from "@/pages/customer/proposal-generate";
import RFPProjects from "@/pages/customer/rfp-projects";
import KnowledgeBase from "@/pages/customer/knowledge-base";
import CollaboratorManagement from "@/pages/customer/collaborator-management";
import RFPDetail from "@/pages/customer/rfp-detail";
import RFPReview from "@/pages/customer/rfp-review";
import PublicProposalAnswer from "@/pages/customer/public-proposal-answer";

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, currentRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = (currentRole || "").toLowerCase();

  if (!user) {
    return <Redirect to="/auth" />;
  }
  if (role !== "admin") {
    if (role === "collaborator") return <Redirect to="/collaborator" />;
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="bg-background w-full max-w-full overflow-x-hidden">
      <Navigation sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex w-full max-w-full overflow-x-hidden">
        <AdminSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <main className="flex-1 p-4 sm:p-6 md:ml-64 w-full max-w-full overflow-x-hidden" style={{ paddingTop: 'calc(var(--navbar-height) + 16px)' }}>
          <Component />
        </main>
      </div>
    </div>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, currentRole } = useAuth();
  
  if (user) {
    const role = (currentRole || "").toLowerCase();
    if (role === "admin") {
      return <Redirect to="/admin" />;
    } else if (role === "collaborator") {
      return <Redirect to="/collaborator" />;
    } else {
      return <Redirect to="/dashboard" />;
    }
  }
  
  return <Component />;
}

function CustomerRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, currentRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = (currentRole || "").toLowerCase();

  if (!user) {
    return <Redirect to="/auth" />;
  }
  if (role === "admin") {
    return <Redirect to="/admin" />;
  }
  if (role === "collaborator") {
    return <Redirect to="/collaborator" />;
  }

  return (
    <div className="bg-background w-full max-w-full overflow-x-hidden">
      <Navigation sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex w-full max-w-full overflow-x-hidden">
        <CustomerSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <main className="flex-1 p-4 sm:p-6 md:ml-64 w-full max-w-full overflow-x-hidden" style={{ paddingTop: 'calc(var(--navbar-height) + 16px)' }}>
          <Component />
        </main>
      </div>
    </div>
  );
}

function CollaboratorRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, currentRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const role = (currentRole || "").toLowerCase();

  if (!user) {
    return <Redirect to="/auth" />;
  }
  if (role !== "collaborator") {
    if (role === "admin") return <Redirect to="/admin" />;
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="bg-background w-full max-w-full overflow-x-hidden">
      <Navigation sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex w-full max-w-full overflow-x-hidden">
        <CollaboratorSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <main className="flex-1 p-4 sm:p-6 md:ml-64 w-full max-w-full overflow-x-hidden" style={{ paddingTop: 'calc(var(--navbar-height) + 16px)' }}>
          <Component />
        </main>
      </div>
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
    <div className="bg-background">
      <Navigation sidebarOpen={isAccountSettings ? sidebarOpen : undefined} setSidebarOpen={isAccountSettings ? setSidebarOpen : undefined} />
      <main className="p-4 sm:p-6" style={{ paddingTop: 'calc(var(--navbar-height) + 16px)' }}>
        {isAccountSettings ? (
          <Component sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        ) : (
          <Component />
        )}
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth" component={() => <PublicRoute component={Auth} />} />
      <Route path="/forgot-password" component={() => <PublicRoute component={ForgotPassword} />} />
      <Route path="/reset-password" component={() => <PublicRoute component={ResetPassword} />} />

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
      <Route path="/admin/rfp-templates" component={() => <AdminRoute component={AdminRfpTemplates} />} />
      <Route path="/admin/knowledge-base" component={() => <AdminRoute component={AdminKnowledgeBase} />} />
      <Route path="/admin/subscription-billing" component={() => <AdminRoute component={AdminSubscriptionBilling} />} />
      <Route path="/admin/users-terms" component={() => <AdminRoute component={AdminUsersTerms} />} />
      <Route path="/admin/content" component={() => <AdminRoute component={AdminContent} />} />
      <Route path="/admin/content/editor" component={() => <AdminRoute component={AdminContentEditor} />} />
      <Route path="/admin/ai-config" component={() => <AdminRoute component={AdminAIConfig} />} />
      <Route path="/admin/credits" component={() => <AdminRoute component={AdminCredits} />} />
      <Route path="/admin/usage" component={() => <AdminRoute component={AdminUsage} />} />
      <Route path="/admin/integrations" component={() => <AdminRoute component={AdminIntegrations} />} />
      <Route path="/admin/integrations/setup" component={() => <AdminRoute component={AdminIntegrationSetup} />} />
      <Route path="/admin/security" component={() => <AdminRoute component={AdminSecurity} />} />
      <Route path="/admin/audit-logs" component={() => <AdminRoute component={AdminAuditLogs} />} />
      <Route path="/admin/settings" component={() => <AdminRoute component={AdminSettings} />} />
      
      {/* Collaborator routes (dedicated panel – only collaborators) */}
      <Route path="/collaborator" component={() => <CollaboratorRoute component={CollaboratorView} />} />
      <Route path="/collaborator/analytics" component={() => <CollaboratorRoute component={CollaboratorAnalytics} />} />
      <Route path="/collaborator/rfp/:id" component={() => <CollaboratorRoute component={RFPDetail} />} />
      <Route path="/collaborator/rfp/:id/questions" component={() => <CollaboratorRoute component={ProposalQuestions} />} />
      <Route path="/collaborator/rfp/:id/generate" component={() => <CollaboratorRoute component={ProposalGenerate} />} />
      <Route path="/collaborator/rfp/:id/review" component={() => <CollaboratorRoute component={RFPReview} />} />

      {/* Customer routes (redirect collaborators to /collaborator) */}
      <Route path="/dashboard" component={() => <CustomerRoute component={CustomerDashboard} />} />
      <Route path="/credits" component={() => <CustomerRoute component={CreditPurchase} />} />
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

/** Renders app content or full-page loader while session is initializing (e.g. token refresh on refresh). */
function AppContent() {
  const { isInitializing } = useAuth();
  if (isInitializing) {
    return <AppLoader />;
  }
  return (
    <BrandingProvider>
      <StoreProvider>
        <ApiStatusProvider>
          <TooltipProvider>
            <Toaster />
            <ApiStatusBanner />
            <Router />
          </TooltipProvider>
        </ApiStatusProvider>
      </StoreProvider>
    </BrandingProvider>
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
