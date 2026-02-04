import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { fetchAdminProposalsNewSupport, fetchAdminOptions } from "@/api/admin-data";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  FileText, 
  Users, 
  Target, 
  Sparkles,
  Building2,
  Calendar,
  DollarSign,
  Clock,
  Upload,
  Plus,
  X,
  Lightbulb
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const STEP_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Building2,
  Target,
  Users,
  Sparkles,
};

export default function AdminProposalsNew() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: supportData } = useQuery({
    queryKey: ["admin", "proposals-new-support"],
    queryFn: fetchAdminProposalsNewSupport,
  });
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const stepsRaw = supportData?.steps ?? [
    { id: 1, title: "Basic Info", description: "Project details", icon: "FileText" },
    { id: 2, title: "Client", description: "Organization info", icon: "Building2" },
    { id: 3, title: "Requirements", description: "RFP specifics", icon: "Target" },
    { id: 4, title: "Team", description: "Assign members", icon: "Users" },
    { id: 5, title: "AI Brief", description: "Generate content", icon: "Sparkles" },
  ];
  const steps = stepsRaw.map((s: { id: number; title: string; description: string; icon: string }) => ({
    ...s,
    icon: STEP_ICON_MAP[s.icon] ?? FileText,
  }));
  const pageTitles = (optionsData as { pageTitles?: Record<string, string> })?.pageTitles ?? {};
  const backToProposalsLabel = pageTitles?.backToProposals ?? "Back to Proposals";
  const proposalCategories = optionsData?.proposalCategories ?? [
    { value: "technology", label: "Technology" },
    { value: "healthcare", label: "Healthcare" },
    { value: "finance", label: "Finance" },
    { value: "government", label: "Government" },
    { value: "other", label: "Other" },
  ];
  const industries = optionsData?.industries ?? [
    { value: "technology", label: "Technology" },
    { value: "healthcare", label: "Healthcare" },
    { value: "finance", label: "Financial Services" },
    { value: "government", label: "Government" },
    { value: "manufacturing", label: "Manufacturing" },
    { value: "retail", label: "Retail" },
    { value: "education", label: "Education" },
  ];
  const teamMembers = supportData?.teamMembers ?? [];
  const aiSuggestions = supportData?.aiSuggestions ?? [];
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    dueDate: "",
    estimatedValue: "",
    clientName: "",
    clientIndustry: "",
    clientContact: "",
    clientEmail: "",
    summary: "",
    requirements: [] as string[],
    newRequirement: "",
    selectedTeam: [] as number[],
    aiContext: "",
  });

  const updateFormData = (field: string, value: string | string[] | number[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addRequirement = () => {
    if (formData.newRequirement.trim()) {
      updateFormData("requirements", [...formData.requirements, formData.newRequirement.trim()]);
      updateFormData("newRequirement", "");
    }
  };

  const removeRequirement = (index: number) => {
    updateFormData("requirements", formData.requirements.filter((_, i) => i !== index));
  };

  const toggleTeamMember = (id: number) => {
    const selected = formData.selectedTeam.includes(id)
      ? formData.selectedTeam.filter(m => m !== id)
      : [...formData.selectedTeam, id];
    updateFormData("selectedTeam", selected);
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const createProposalMutation = useMutation({
    mutationFn: async (proposalData: any) => {
      const response = await apiRequest("POST", "/api/proposals", proposalData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create proposal. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      setIsGenerating(false);
    },
  });

  const generateProposalMutation = useMutation({
    mutationFn: async (proposalId: number) => {
      const response = await apiRequest("POST", `/api/v1/ai/proposals/${proposalId}/generate`, {
        requirements: formData.requirements,
        aiContext: formData.aiContext,
        clientName: formData.clientName,
        clientContact: formData.clientContact,
        clientEmail: formData.clientEmail,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({
        title: "Proposal generated!",
        description: "Your proposal has been created and AI content has been generated successfully.",
      });
      setIsGenerating(false);
      setIsSubmitting(false);
      setLocation("/admin/proposals");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Proposal was created but failed to generate content. You can generate it later.",
        variant: "destructive",
      });
      setIsGenerating(false);
      setIsSubmitting(false);
      setLocation("/admin/proposals");
    },
  });

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to create a proposal.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    if (!formData.title || !formData.category || !formData.dueDate || !formData.clientName || !formData.summary) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setIsGenerating(true);
    
    const proposalData = {
      title: formData.title,
      description: formData.summary,
      status: "draft",
      ownerId: user.id,
      budgetRange: formData.estimatedValue ? `$${formData.estimatedValue}` : null,
      timeline: formData.dueDate,
      requirements: formData.requirements.join(", "),
      industry: formData.clientIndustry || formData.category,
      clientName: formData.clientName,
      clientContact: formData.clientContact,
      clientEmail: formData.clientEmail,
    };

    // Create proposal first, then generate content
    createProposalMutation.mutate(proposalData, {
      onSuccess: (createdProposal) => {
        // After proposal is created, generate AI content
        if (createdProposal && createdProposal.id) {
          generateProposalMutation.mutate(createdProposal.id);
        } else {
          toast({
            title: "Error",
            description: "Proposal was created but could not generate content. Please try again.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          setIsGenerating(false);
        }
      },
      onError: () => {
        setIsSubmitting(false);
        setIsGenerating(false);
      },
    });
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in px-4 sm:px-6 overflow-x-hidden">
      <div className="mb-4 sm:mb-6">
        <Link href="/admin/proposals">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground mb-3 sm:mb-4" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
            {backToProposalsLabel}
          </Button>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground" data-testid="text-page-title">Create New Proposal</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">Fill in the details to start your RFP response</p>
      </div>

      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs sm:text-sm font-medium text-foreground">Step {currentStep} of {steps.length}</span>
          <span className="text-xs sm:text-sm text-muted-foreground">{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
        
        <div className="flex justify-between mt-4 overflow-x-auto overflow-y-hidden -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
          {steps.map((step) => {
            const StepIcon = step.icon;
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            
            return (
              <div 
                key={step.id} 
                className={`flex flex-col items-center cursor-pointer transition-all shrink-0 ${
                  isCurrent ? 'scale-105' : ''
                }`}
                onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                data-testid={`step-${step.id}`}
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                  isCompleted 
                    ? 'bg-emerald-500 text-white' 
                    : isCurrent 
                    ? 'theme-gradient-bg text-white shadow-lg shadow-primary/20' 
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {isCompleted ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : <StepIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
                <span className={`text-[10px] sm:text-xs mt-1.5 sm:mt-2 font-medium text-center ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Card className="border shadow-sm mb-4 sm:mb-6 overflow-x-hidden" data-testid="card-step-content">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            {(() => {
              const CurrentIcon = steps[currentStep - 1].icon;
              return <CurrentIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />;
            })()}
            {steps[currentStep - 1].title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {currentStep === 1 && (
            <div className="space-y-4 sm:space-y-5">
              <div>
                <Label htmlFor="title" className="text-foreground text-sm sm:text-base">Proposal Title *</Label>
                <Input 
                  id="title"
                  placeholder="e.g., Enterprise Cloud Migration Solution"
                  value={formData.title}
                  onChange={(e) => updateFormData("title", e.target.value)}
                  className="mt-1.5"
                  data-testid="input-title"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category" className="text-foreground text-sm sm:text-base">Category *</Label>
                  <Select value={formData.category} onValueChange={(v) => updateFormData("category", v)}>
                    <SelectTrigger className="mt-1.5" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {proposalCategories.map((opt: { value: string; label: string }) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="dueDate" className="text-foreground text-sm sm:text-base">Due Date *</Label>
                  <div className="relative mt-1.5">
                    <Calendar 
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors z-10" 
                      onClick={() => {
                        dateInputRef.current?.focus();
                        if (dateInputRef.current && 'showPicker' in dateInputRef.current) {
                          (dateInputRef.current as any).showPicker();
                        }
                      }}
                    />
                    <Input 
                      ref={dateInputRef}
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => updateFormData("dueDate", e.target.value)}
                      className="pl-10"
                      data-testid="input-due-date"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="estimatedValue" className="text-foreground text-sm sm:text-base">Estimated Value</Label>
                <div className="relative mt-1.5">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="estimatedValue"
                    placeholder="e.g., 500,000"
                    value={formData.estimatedValue}
                    onChange={(e) => updateFormData("estimatedValue", e.target.value)}
                    className="pl-10"
                    data-testid="input-value"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 sm:space-y-5">
              <div>
                <Label htmlFor="clientName" className="text-foreground text-sm sm:text-base">Client/Organization Name *</Label>
                <div className="relative mt-1.5">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="clientName"
                    placeholder="e.g., TechCorp Inc."
                    value={formData.clientName}
                    onChange={(e) => updateFormData("clientName", e.target.value)}
                    className="pl-10"
                    data-testid="input-client-name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="clientIndustry" className="text-foreground text-sm sm:text-base">Industry</Label>
                <Select value={formData.clientIndustry} onValueChange={(v) => updateFormData("clientIndustry", v)}>
                  <SelectTrigger className="mt-1.5" data-testid="select-industry">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((opt: { value: string; label: string }) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientContact" className="text-foreground text-sm sm:text-base">Primary Contact</Label>
                  <Input 
                    id="clientContact"
                    placeholder="Contact name"
                    value={formData.clientContact}
                    onChange={(e) => updateFormData("clientContact", e.target.value)}
                    className="mt-1.5"
                    data-testid="input-contact"
                  />
                </div>
                <div>
                  <Label htmlFor="clientEmail" className="text-foreground text-sm sm:text-base">Contact Email</Label>
                  <Input 
                    id="clientEmail"
                    type="email"
                    placeholder="email@company.com"
                    value={formData.clientEmail}
                    onChange={(e) => updateFormData("clientEmail", e.target.value)}
                    className="mt-1.5"
                    data-testid="input-email"
                  />
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4 sm:space-y-5">
              <div>
                <Label htmlFor="summary" className="text-foreground text-sm sm:text-base">Project Summary *</Label>
                <Textarea 
                  id="summary"
                  placeholder="Describe the project requirements and objectives..."
                  value={formData.summary}
                  onChange={(e) => updateFormData("summary", e.target.value)}
                  className="mt-1.5 min-h-[120px]"
                  data-testid="textarea-summary"
                />
              </div>
              <div>
                <Label className="text-foreground text-sm sm:text-base">Key Requirements</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input 
                    placeholder="Add a requirement"
                    value={formData.newRequirement}
                    onChange={(e) => updateFormData("newRequirement", e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addRequirement()}
                    data-testid="input-requirement"
                    className="flex-1"
                  />
                  <Button onClick={addRequirement} variant="outline" data-testid="button-add-requirement" className="shrink-0">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {formData.requirements.map((req, index) => (
                    <Badge 
                      key={index} 
                      variant="secondary" 
                      className="pl-3 pr-1.5 py-1.5 requirement-badge text-xs"
                      data-testid={`badge-requirement-${index}`}
                    >
                      {req}
                      <button 
                        onClick={() => removeRequirement(index)} 
                        className="ml-2 hover:opacity-70"
                        data-testid={`button-remove-requirement-${index}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="border-2 border-dashed upload-area-border rounded-xl p-4 sm:p-6 text-center cursor-pointer">
                <Upload className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs sm:text-sm text-muted-foreground">Drop RFP document here or <span className="text-primary font-medium">browse</span></p>
                <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-1">PDF, DOC, DOCX up to 25MB</p>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-3 sm:space-y-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">Select team members to work on this proposal</p>
              <div className="grid grid-cols-1 gap-2 sm:gap-3">
                {teamMembers.map((member) => {
                  const isSelected = formData.selectedTeam.includes(member.id);
                  return (
                    <div 
                      key={member.id}
                      onClick={() => toggleTeamMember(member.id)}
                      className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected 
                          ? 'team-member-selected' 
                          : 'border-border hover:border-border/80 hover:bg-muted/50'
                      }`}
                      data-testid={`team-member-${member.id}`}
                    >
                      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0 ${
                        isSelected 
                          ? 'theme-gradient-bg text-white' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {member.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base text-foreground truncate">{member.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{member.role}</p>
                      </div>
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected 
                          ? 'bg-primary border-primary' 
                          : 'team-member-checkbox-border'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-4 sm:space-y-5">
              <div className="ai-suggestions-card">
                <div className="flex items-start gap-3">
                  <div className="ai-suggestions-icon-bg shrink-0">
                    <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 ai-suggestions-icon" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm sm:text-base text-foreground mb-1">AI Suggestions</h4>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3">Based on your inputs, here are some recommendations:</p>
                    <ul className="space-y-2">
                      {aiSuggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-foreground">
                          <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 ai-suggestions-icon mt-0.5 shrink-0" />
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              
              <div>
                <Label htmlFor="aiContext" className="text-foreground text-sm sm:text-base">Additional Context for AI</Label>
                <Textarea 
                  id="aiContext"
                  placeholder="Add any specific instructions or context you want the AI to consider when helping with this proposal..."
                  value={formData.aiContext}
                  onChange={(e) => updateFormData("aiContext", e.target.value)}
                  className="mt-1.5 min-h-[120px]"
                  data-testid="textarea-ai-context"
                />
              </div>

              <div className="flex items-center gap-3 ready-to-generate-card">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 ready-to-generate-icon shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm font-medium ready-to-generate-title">Ready to Generate</p>
                  <p className="text-[10px] sm:text-xs ready-to-generate-text">AI will help create your proposal content after setup</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className={`flex flex-col sm:flex-row items-stretch sm:items-center ${currentStep > 1 ? 'justify-between' : 'justify-end'} gap-3`}>
        {currentStep > 1 && (
          <Button 
            variant="outline" 
            onClick={handleBack} 
            className="gap-2 w-full sm:w-auto"
            data-testid="button-previous"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </Button>
        )}
        
        {currentStep < steps.length ? (
          <Button 
            onClick={handleNext}
            className="gap-2 theme-gradient-bg text-white hover:opacity-95 w-full sm:w-auto"
            data-testid="button-next"
          >
            Next Step
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting || isGenerating || createProposalMutation.isPending || generateProposalMutation.isPending}
            className="gap-2 theme-gradient-bg text-white hover:opacity-95 w-full sm:w-auto"
            data-testid="button-create"
          >
            <Sparkles className="w-4 h-4" />
            {isGenerating || generateProposalMutation.isPending 
              ? "Generating Proposal..." 
              : isSubmitting || createProposalMutation.isPending 
              ? "Creating..." 
              : "Create Proposal"}
          </Button>
        )}
      </div>
    </div>
  );
}
