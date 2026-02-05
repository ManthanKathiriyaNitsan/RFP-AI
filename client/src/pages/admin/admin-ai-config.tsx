import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchAdminAIConfig, fetchAdminOptions, updateAdminAIConfig } from "@/api/admin-data";
import { 
  Sparkles, 
  Zap,
  Brain,
  Settings,
  Sliders,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Info,
  Globe,
  Shield,
  Gauge
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { QueryErrorState } from "@/components/shared/query-error-state";

export default function AdminAIConfig() {
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "ai-config"],
    queryFn: fetchAdminAIConfig,
  });
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const aiModels = data?.aiModels ?? [];
  const qualityMetrics = data?.qualityMetrics ?? [];
  const creditsUsed = data?.creditsUsed ?? "0";
  const systemPromptDefault = data?.systemPromptDefault ?? "";
  const defaultTemperature = data?.defaultTemperature ?? 0.7;
  const defaultMaxTokens = data?.defaultMaxTokens ?? 2048;
  const defaultModel = (data as { defaultModel?: string })?.defaultModel ?? (aiModels[0] as { id?: string })?.id ?? "";
  const aiToneOptions = optionsData?.aiToneOptions ?? [];
  const aiDetailLevels = optionsData?.aiDetailLevels ?? [];
  const pageTitles = (optionsData as { pageTitles?: Record<string, string> })?.pageTitles ?? {};
  const aiConfigTitle = pageTitles.aiConfig ?? "AI Configuration";
  const [selectedModel, setSelectedModel] = useState("");
  const effectiveModel = selectedModel || defaultModel;
  const [temperature, setTemperature] = useState([defaultTemperature]);
  const [maxTokens, setMaxTokens] = useState([defaultMaxTokens]);
  const [systemPrompt, setSystemPrompt] = useState(systemPromptDefault);
  const features = data?.features ?? {};
  const [autoSuggest, setAutoSuggest] = useState(features.autoSuggest ?? true);
  const [contentFiltering, setContentFiltering] = useState(features.contentFiltering ?? true);
  const [allowBulkGenerate, setAllowBulkGenerate] = useState(features.allowBulkGenerate ?? true);
  const [allowToneSelection, setAllowToneSelection] = useState(features.allowToneSelection ?? true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (data?.systemPromptDefault != null) setSystemPrompt(data.systemPromptDefault);
  }, [data?.systemPromptDefault]);
  useEffect(() => {
    if (data?.defaultTemperature != null) setTemperature([data.defaultTemperature]);
  }, [data?.defaultTemperature]);
  useEffect(() => {
    if (data?.defaultMaxTokens != null) setMaxTokens([data.defaultMaxTokens]);
  }, [data?.defaultMaxTokens]);
  useEffect(() => {
    const f = data?.features;
    if (f && typeof f === "object") {
      if (f.autoSuggest !== undefined) setAutoSuggest(f.autoSuggest);
      if (f.contentFiltering !== undefined) setContentFiltering(f.contentFiltering);
      if (f.allowBulkGenerate !== undefined) setAllowBulkGenerate(f.allowBulkGenerate);
      if (f.allowToneSelection !== undefined) setAllowToneSelection(f.allowToneSelection);
    }
  }, [data?.features]);

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateAdminAIConfig>[0]) =>
      updateAdminAIConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-config"] });
      toast({ title: "Settings saved", description: "AI configuration has been saved successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message || "Could not save AI configuration.", variant: "destructive" });
    },
  });

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-ai-config-title">{aiConfigTitle}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Configure AI models, parameters, and behavior settings.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            data-testid="button-reset"
            className="w-full sm:w-auto"
            onClick={() => {
              setSelectedModel(defaultModel || "gpt-4o");
              setTemperature([defaultTemperature]);
              setMaxTokens([defaultMaxTokens]);
              setSystemPrompt(systemPromptDefault || "");
              const f = data?.features ?? {};
              setAutoSuggest(f.autoSuggest ?? true);
              setContentFiltering(f.contentFiltering ?? true);
              setAllowBulkGenerate(f.allowBulkGenerate ?? true);
              setAllowToneSelection(f.allowToneSelection ?? true);
              toast({
                title: "Reset to defaults",
                description: "AI configuration has been reset to loaded values. Save to persist.",
              });
            }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
          <Button 
            size="sm" 
            className="theme-gradient-bg text-white w-full sm:w-auto" 
            data-testid="button-save"
            disabled={saveMutation.isPending}
            onClick={() => {
              saveMutation.mutate({
                defaultModel: effectiveModel,
                defaultTemperature: temperature[0],
                defaultMaxTokens: maxTokens[0],
                systemPromptDefault: systemPrompt,
                features: {
                  autoSuggest,
                  contentFiltering,
                  allowBulkGenerate,
                  allowToneSelection,
                },
              });
            }}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold truncate">GPT-4o</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Active Model</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 icon-emerald" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold truncate">94.2%</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Avg Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 icon-blue" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold truncate">2.3s</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Avg Response</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Gauge className="w-4 h-4 sm:w-5 sm:h-5 icon-amber" />
              </div>
              <div className="min-w-0">
                <p className="text-base sm:text-lg font-bold truncate">{creditsUsed}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Credits Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="model" className="w-full">
        <TabsList className="bg-muted/50 overflow-x-auto overflow-y-hidden w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsTrigger value="model" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <Brain className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Model Settings</span><span className="sm:hidden">Model</span>
          </TabsTrigger>
          <TabsTrigger value="behavior" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <Sliders className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Behavior
          </TabsTrigger>
          <TabsTrigger value="prompts" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">System Prompts</span><span className="sm:hidden">Prompts</span>
          </TabsTrigger>
          <TabsTrigger value="quality" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <Gauge className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> <span className="hidden sm:inline">Quality Metrics</span><span className="sm:hidden">Quality</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="model" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">AI Model Selection</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Choose the AI model for generating proposal content</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {aiModels.map((model) => (
                  <div 
                    key={model.id}
                    className={`p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      effectiveModel === model.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedModel(model.id)}
                    data-testid={`model-${model.id}`}
                  >
                    <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm sm:text-base truncate">{model.name}</h4>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{model.provider}</p>
                      </div>
                      {effectiveModel === model.id && (
                        <Badge className="bg-primary text-white text-[10px] sm:text-xs shrink-0">Active</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 shrink-0" /> {model.speed}
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 shrink-0" /> {model.quality}
                      </span>
                      <span className="text-muted-foreground">{model.cost}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Model Parameters</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Fine-tune the AI response characteristics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Temperature</Label>
                  <span className="text-sm font-medium">{temperature[0]}</span>
                </div>
                <Slider 
                  value={temperature} 
                  onValueChange={setTemperature}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                  data-testid="slider-temperature"
                />
                <p className="text-xs text-muted-foreground">Lower values produce more focused, deterministic outputs. Higher values increase creativity.</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Max Output Tokens</Label>
                  <span className="text-sm font-medium">{maxTokens[0]}</span>
                </div>
                <Slider 
                  value={maxTokens} 
                  onValueChange={setMaxTokens}
                  min={512}
                  max={8192}
                  step={256}
                  className="w-full"
                  data-testid="slider-max-tokens"
                />
                <p className="text-xs text-muted-foreground">Maximum number of tokens in the generated response.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">AI Features</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Enable or disable AI-powered features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium">Auto-Suggest Responses</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">AI suggests answers as users type questions</p>
                  </div>
                </div>
                <Switch checked={autoSuggest} onCheckedChange={setAutoSuggest} data-testid="switch-auto-suggest" className="shrink-0" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium">Content Filtering</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Filter inappropriate or non-compliant content</p>
                  </div>
                </div>
                <Switch checked={contentFiltering} onCheckedChange={setContentFiltering} data-testid="switch-content-filter" className="shrink-0" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium">Allow bulk generate</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Let users generate AI answers for all questions at once</p>
                  </div>
                </div>
                <Switch checked={allowBulkGenerate} onCheckedChange={setAllowBulkGenerate} data-testid="switch-allow-bulk-generate" className="shrink-0" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Sliders className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium">Allow tone selection</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Let users choose tone and length (detail level) for AI answers</p>
                  </div>
                </div>
                <Switch checked={allowToneSelection} onCheckedChange={setAllowToneSelection} data-testid="switch-allow-tone-selection" className="shrink-0" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium">Multi-language Support</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Generate responses in 30+ languages</p>
                  </div>
                </div>
                <Switch defaultChecked data-testid="switch-multilang" className="shrink-0" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <Info className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium">Source Citations</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Include references to content library sources</p>
                  </div>
                </div>
                <Switch defaultChecked data-testid="switch-citations" className="shrink-0" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">System Prompt</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Configure the AI's base personality and guidelines</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <Textarea 
                className="min-h-[200px] font-mono text-xs sm:text-sm"
                placeholder="You are an expert RFP response writer..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                data-testid="textarea-system-prompt"
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Use Save Changes above to persist. Changes apply to all new AI interactions.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Brand Voice Guidelines</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Define how the AI should communicate</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <Label className="text-sm">Tone</Label>
                  <Select defaultValue={aiToneOptions[0]?.value ?? ""}>
                    <SelectTrigger className="mt-1.5" data-testid="select-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiToneOptions.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Formality Level</Label>
                  <Select defaultValue={aiDetailLevels[2]?.value ?? aiDetailLevels[0]?.value ?? ""}>
                    <SelectTrigger className="mt-1.5" data-testid="select-formality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aiDetailLevels.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Quality Metrics</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Monitor AI response quality against targets</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3 sm:space-y-4">
                {qualityMetrics.map((metric, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs sm:text-sm font-medium truncate">{metric.label}</span>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <span className={`text-xs sm:text-sm font-semibold ${metric.value >= metric.target ? 'text-emerald' : 'text-amber'}`}>
                          {metric.value}%
                        </span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground">/ {metric.target}%</span>
                      </div>
                    </div>
                    <div className="relative">
                      <Progress value={metric.value} className="h-2" />
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
                        style={{ left: `${metric.target}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="p-3 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 icon-amber shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-amber">Quality Alert</p>
                <p className="text-[10px] sm:text-sm text-muted-foreground mt-1">
                  Brand Voice Match is below target. Consider updating the system prompt or providing more training examples.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
