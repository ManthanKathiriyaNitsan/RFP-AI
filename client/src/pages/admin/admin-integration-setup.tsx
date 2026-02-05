import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { API_PATHS } from "@/lib/api-paths";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchAdminIntegrationSetup } from "@/api/admin-data";
import { 
  ArrowLeft, 
  Save, 
  CheckCircle,
  AlertCircle,
  Key,
  Link as LinkIcon,
  Eye,
  EyeOff,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminIntegrationSetup() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  const isMobile = useIsMobile();
  
  // Extract integration name from URL
  const integrationName = new URLSearchParams(location.split('?')[1] || '').get('name');
  const integrationType = new URLSearchParams(location.split('?')[1] || '').get('type') || '';

  const [formData, setFormData] = useState({
    name: integrationName || "",
    type: integrationType || "",
    apiKey: "",
    apiSecret: "",
    webhookUrl: "",
    enabled: true,
    autoSync: false,
    syncInterval: "15",
    description: "",
  });

  const { data: setupData, isError, error, refetch } = useQuery({
    queryKey: ["admin", "integrations-setup"],
    queryFn: fetchAdminIntegrationSetup,
  });
  const integrationTypeMap: Record<string, string> = setupData?.integrationTypeMap ?? {};
  const integrationConfigs: Record<string, { name: string; description: string; fields: { key: string; label: string; type: string; required: boolean }[] }> = setupData?.integrationConfigs ?? {};
  const defaultConfig = setupData?.defaultIntegrationConfig ?? {
    name: "Integration",
    description: "Configure integration settings",
    fields: [
      { key: "apiKey", label: "API Key", type: "text", required: true },
      { key: "apiSecret", label: "API Secret", type: "password", required: false },
      { key: "webhookUrl", label: "Webhook URL", type: "text", required: false },
    ],
  };
  const mappedType = integrationTypeMap[integrationType] || integrationType?.toLowerCase().replace(/\s+/g, "-") || "";
  const config = integrationConfigs[mappedType] || { ...defaultConfig, name: integrationName || defaultConfig.name };

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Connection successful",
        description: "Successfully connected to the integration.",
      });
    },
    onError: () => {
      toast({
        title: "Connection failed",
        description: "Could not connect to the integration. Please check your credentials.",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", API_PATHS.integrations, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "integrations"] });
      toast({
        title: "Integration configured",
        description: "Your integration has been set up successfully.",
      });
      setLocation("/admin/integrations");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to configure integration. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // Validate required fields
    const requiredFields = config.fields.filter((f: any) => f.required);
    const missingFields = requiredFields.filter((f: any) => !formData[f.key as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in: ${missingFields.map((f: any) => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      name: formData.name,
      type: integrationType,
      config: {
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        webhookUrl: formData.webhookUrl,
      },
      enabled: formData.enabled,
      autoSync: formData.autoSync,
      syncInterval: parseInt(formData.syncInterval),
    });
  };

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <Link href="/admin/integrations">
            <Button variant="ghost" size="sm" className="shrink-0">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Setup {config.name}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {config.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => testConnectionMutation.mutate()} className="flex-1 sm:flex-initial">
            <RefreshCw className={`w-4 h-4 mr-2 ${testConnectionMutation.isPending ? 'animate-spin' : ''}`} />
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1 sm:flex-initial">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save & Connect"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Configuration */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Configuration</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Enter your integration credentials and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              {config.fields.map((field: any) => (
                <div key={field.key}>
                  <Label className="text-xs sm:text-sm">
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {field.type === "password" ? (
                    <div className="relative mt-1.5">
                      <Input
                        type={showApiKey ? "text" : "password"}
                        value={formData[field.key as keyof typeof formData] as string}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        className="pr-10 text-sm sm:text-base"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  ) : (
                    <Input
                      type={field.type || "text"}
                      value={formData[field.key as keyof typeof formData] as string}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      className="mt-1.5 text-sm sm:text-base"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Sync Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Label className="text-xs sm:text-sm">Auto Sync</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Automatically sync data at regular intervals
                  </p>
                </div>
                <Switch
                  checked={formData.autoSync}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoSync: checked })}
                  className="shrink-0"
                />
              </div>
              {formData.autoSync && (
                <div>
                  <Label className="text-xs sm:text-sm">Sync Interval (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.syncInterval}
                    onChange={(e) => setFormData({ ...formData, syncInterval: e.target.value })}
                    min="5"
                    max="1440"
                    className="mt-1.5 text-sm sm:text-base"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs sm:text-sm">Enable Integration</Label>
                <Switch
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  className="shrink-0"
                />
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-amber dark:text-amber shrink-0" />
                  <span className="text-xs sm:text-sm font-medium">Not Connected</span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Configure and save to establish connection
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Documentation</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                Need help setting up this integration?
              </p>
              <Button variant="outline" className="w-full text-xs sm:text-sm">
                <LinkIcon className="w-4 h-4 mr-2" />
                View Documentation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
