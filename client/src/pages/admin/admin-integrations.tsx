import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { usePrompt } from "@/hooks/use-prompt";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchAdminIntegrations } from "@/api/admin-data";
import { 
  Zap, 
  Plus,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Settings,
  RefreshCw,
  Trash2,
  Key
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryErrorState } from "@/components/shared/query-error-state";

export default function AdminIntegrations() {
  const [activeTab, setActiveTab] = useState("connected");
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "integrations"],
    queryFn: fetchAdminIntegrations,
  });
  const connectedIntegrations = data?.connectedIntegrations ?? [];
  const availableIntegrations = data?.availableIntegrations ?? [];
  const activeCount = connectedIntegrations.filter((i) => (i as { status?: string }).status === "connected").length;
  const needsAttentionCount = connectedIntegrations.filter((i) => (i as { status?: string }).status === "error").length;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { prompt, PromptDialog } = usePrompt();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "connected":
        return { label: "Connected", icon: CheckCircle, className: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald dark:text-emerald border-emerald-500/20 dark:border-emerald-500/30" };
      case "error":
        return { label: "Error", icon: AlertCircle, className: "bg-red-500/10 dark:bg-red-500/20 text-red dark:text-red border-red-500/20 dark:border-red-500/30" };
      default:
        return { label: "Disconnected", icon: AlertCircle, className: "bg-gray-500/10 dark:bg-gray-500/20 text-muted-foreground border-gray-500/20 dark:border-gray-500/30" };
    }
  };

  const getLogoColor = (logo: string) => {
    const colors: Record<string, string> = {
      SF: "bg-blue-500",
      GD: "bg-yellow-500",
      SL: "bg-primary",
      MS: "bg-blue-600",
      HS: "bg-orange-500",
      CF: "bg-blue-400",
      NT: "bg-gray-900",
      AS: "bg-pink-500",
      MD: "bg-pink-600",
      JR: "bg-blue-500",
      DB: "bg-blue-500",
      SP: "bg-teal-500",
      TM: "bg-primary",
    };
    return colors[logo] || "bg-primary";
  };

  if (isError) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PromptDialog />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-integrations-title">Integrations</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Connect your favorite tools and services.</p>
        </div>
        <Button 
          className="theme-gradient-bg text-white w-full sm:w-auto" 
          data-testid="button-add-integration"
          onClick={async () => {
            const integrationName = await prompt({
              title: "Add Integration",
              description: "Enter the name of the integration to add",
              placeholder: "Integration name",
            });
            if (integrationName) {
              toast({
                title: "Integration added",
                description: `${integrationName} integration has been added. Configure it in the Available tab.`,
              });
            }
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Integration
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald dark:text-emerald" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold">{isLoading ? "—" : activeCount}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Active Integrations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-red dark:text-red" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold">{isLoading ? "—" : needsAttentionCount}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Needs Attention</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm sm:col-span-2 md:col-span-1">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold">{isLoading ? "—" : availableIntegrations.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Available to Connect</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="connected" className="w-full">
        <TabsList className="bg-muted/50 overflow-x-auto overflow-y-hidden w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsTrigger value="connected" className="data-[state=active]:bg-background text-xs sm:text-sm">
            Connected <Badge variant="secondary" className="ml-2 text-[10px]">{connectedIntegrations.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="available" className="data-[state=active]:bg-background text-xs sm:text-sm">
            Available <Badge variant="secondary" className="ml-2 text-[10px]">{availableIntegrations.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-background text-xs sm:text-sm">
            API Keys
          </TabsTrigger>
        </TabsList>

        {isError && (
          <Card className="mt-4 border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <p className="text-sm font-medium">Failed to load integrations</p>
              <p className="text-xs text-muted-foreground mt-1">{error != null && typeof (error as { message?: string }).message === "string" ? (error as Error).message : "Check your connection and try again."}</p>
            </CardContent>
          </Card>
        )}

        <TabsContent value="connected" className="mt-4 sm:mt-6 data-[state=inactive]:hidden">
          <div className="space-y-3 sm:space-y-4 min-h-[200px]">
            {isLoading && (
              <Card className="border shadow-sm">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">Loading integrations…</CardContent>
              </Card>
            )}
            {!isLoading && connectedIntegrations.length === 0 && (
              <Card className="border shadow-sm">
                <CardContent className="p-6 sm:p-8 text-center">
                  <p className="text-sm font-medium">No connected integrations</p>
                  <p className="text-xs text-muted-foreground mt-1">Connect an integration from the Available tab to get started.</p>
                  <Link href="/admin/integrations/setup">
                    <Button variant="outline" size="sm" className="mt-3">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Integration
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
            {connectedIntegrations.map((integration) => {
              const statusConfig = getStatusConfig(integration.status);
              const StatusIcon = statusConfig.icon;
              return (
                <Card key={integration.id} className="border shadow-sm" data-testid={`card-integration-${integration.id}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3 sm:gap-4`}>
                      <div className={`flex items-center gap-3 sm:gap-4 ${isMobile ? '' : 'flex-1 min-w-0'}`}>
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${getLogoColor(integration.logo)} flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0`}>
                          {integration.logo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2`}>
                            <h3 className="font-semibold text-sm sm:text-base truncate">{integration.name}</h3>
                            <Badge variant="outline" className={`${statusConfig.className} text-[10px] font-medium shrink-0`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">{integration.description}</p>
                          <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2 sm:gap-4 mt-2 text-[10px] sm:text-xs text-muted-foreground`}>
                            <span>{integration.category}</span>
                            {!isMobile && <span>•</span>}
                            <span>Last sync: {integration.lastSync}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`flex items-center gap-2 ${isMobile ? 'justify-end' : ''} shrink-0`}>
                        <Switch defaultChecked={integration.status === 'connected'} />
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8 sm:h-10 sm:w-10"
                          onClick={() => {
                            toast({
                              title: "Refreshing",
                              description: `Refreshing ${integration.name} integration...`,
                            });
                          }}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Link href={`/admin/integrations/setup?name=${encodeURIComponent(integration.name)}&type=${integration.id}`}>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 sm:h-10 sm:w-10"
                            onClick={(e) => {
                              // Allow navigation
                            }}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="available" className="mt-4 sm:mt-6 data-[state=inactive]:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 min-h-[200px]">
            {isLoading && (
              <Card className="border shadow-sm sm:col-span-2 lg:col-span-3">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">Loading…</CardContent>
              </Card>
            )}
            {availableIntegrations.length === 0 && !isLoading && (
              <Card className="border shadow-sm sm:col-span-2 lg:col-span-3">
                <CardContent className="p-6 sm:p-8 text-center">
                  <p className="text-sm font-medium">No available integrations</p>
                  <p className="text-xs text-muted-foreground mt-1">Available integrations will appear here when provided by the server.</p>
                </CardContent>
              </Card>
            )}
            {availableIntegrations.map((integration) => (
              <Card key={integration.id} className="border shadow-sm hover:shadow-md transition-all cursor-pointer group" data-testid={`card-available-${integration.id}`}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className={`w-10 h-10 rounded-xl ${getLogoColor(integration.logo)} flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0`}>
                      {integration.logo}
                    </div>
                    <Link href={`/admin/integrations/setup?name=${encodeURIComponent(integration.name)}&type=${integration.id}`}>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs sm:text-sm"
                      >
                        Connect
                      </Button>
                    </Link>
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base">{integration.name}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{integration.description}</p>
                  <Badge variant="secondary" className="mt-2 sm:mt-3 text-[10px]">{integration.category}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="api" className="mt-4 sm:mt-6 data-[state=inactive]:hidden">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">API Keys</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Manage API keys for external integrations</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3 sm:space-y-4">
                {[
                  { name: "Production API Key", created: "Nov 15, 2025", lastUsed: "2 hours ago", prefix: "rfp_prod_" },
                  { name: "Development API Key", created: "Dec 1, 2025", lastUsed: "5 mins ago", prefix: "rfp_dev_" },
                ].map((key, index) => (
                  <div key={index} className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-border`} data-testid={`row-api-key-${index}`}>
                    <div className={`flex items-center gap-3 sm:gap-4 ${isMobile ? '' : 'flex-1 min-w-0'}`}>
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <Key className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm">{key.name}</p>
                        <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-1 sm:gap-2 mt-1`}>
                          <code className="text-[10px] sm:text-xs bg-muted px-2 py-0.5 rounded">{key.prefix}••••••••</code>
                          <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-1 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground`}>
                            <span>Created: {key.created}</span>
                            {!isMobile && <span>•</span>}
                            <span>Last used: {key.lastUsed}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-2 ${isMobile ? 'justify-end' : ''} shrink-0`}>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-xs sm:text-sm"
                        onClick={() => {
                          toast({
                            title: "Regenerating API key",
                            description: "A new API key has been generated.",
                          });
                        }}
                      >
                        Regenerate
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 sm:h-10 sm:w-10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full text-xs sm:text-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New API Key
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
