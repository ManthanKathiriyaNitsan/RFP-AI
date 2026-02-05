import { useState, useRef, useEffect } from "react";
import { Link, useLocation as useWouterLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useProposal, useDraft, useCreateProposal, useUpdateProposal } from "@/hooks/use-proposals-api";
import { QueryErrorState } from "@/components/shared/query-error-state";
import {
  ArrowLeft,
  FileText,
  Upload,
  X,
  Building2,
  DollarSign,
  Target,
  Plus,
  Calendar as CalendarIcon,
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
import { useIsMobile } from "@/hooks/use-mobile";
import { ProposalStepper } from "@/components/customer/proposal-stepper";
import type { ProposalFile } from "@/lib/store-types";
import { authStorage } from "@/lib/auth";
import { parseApiError } from "@/lib/utils";

export default function ProposalBuilder() {
  const [location] = useWouterLocation();
  const [, navigate] = useWouterLocation();
  const { user, currentRole } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const editProposalId = new URLSearchParams(location.split("?")[1] || "").get("edit");
  const isEditMode = !!editProposalId;
  const proposalId = isEditMode ? parseInt(editProposalId!, 10) : null;
  const { data: existingProposal, isLoading: proposalLoading, isError: proposalError, error: proposalErrorObj, refetch: refetchProposal } = useProposal(proposalId);
  const { data: draft } = useDraft(proposalId);
  const createProposalMutation = useCreateProposal();
  const updateProposalMutation = useUpdateProposal(proposalId ?? 0);
  const existingFiles: ProposalFile[] = []; // Files not persisted to API; keep local-only if needed

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    dueDate: "", // ISO "YYYY-MM-DD" or ""; default / primary
    timeline: "", // e.g. "6 months"; optional if dueDate set
    estimatedValue: "",
    clientName: "",
    clientIndustry: "",
    clientContact: "",
    clientEmail: "",
    summary: "",
    requirements: [] as string[],
    newRequirement: "",
  });
  const [files, setFiles] = useState<ProposalFile[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dueDateMode, setDueDateMode] = useState<"date" | "timeline">("date");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateForm = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (prev[field]) next[field] = "";
      if ((field === "dueDate" || field === "timeline") && prev.dueDate) next.dueDate = "";
      return next;
    });
  };

  // Rehydrate form from backend: prefer draft.proposal when editing (latest saved), else existingProposal.
  const proposalSource = isEditMode && draft?.proposal ? draft.proposal : existingProposal;
  useEffect(() => {
    if (proposalSource) {
      const due = proposalSource.dueDate ?? "";
      const tl = proposalSource.timeline ?? "";
      setFormData({
        title: proposalSource.title,
        category: proposalSource.industry || "",
        dueDate: due,
        timeline: tl,
        estimatedValue: proposalSource.budgetRange ? proposalSource.budgetRange.replace(/\$/g, "").trim() : "",
        clientName: proposalSource.clientName || "",
        clientIndustry: "",
        clientContact: proposalSource.clientContact || "",
        clientEmail: proposalSource.clientEmail || "",
        summary: proposalSource.description || "",
        requirements: [],
        newRequirement: "",
      });
      setDueDateMode(/^\d{4}-\d{2}-\d{2}$/.test(due) ? "date" : tl ? "timeline" : "date");
      setFiles(existingFiles);
    }
  }, [proposalSource]);

  const addRequirement = () => {
    if (formData.newRequirement.trim()) {
      updateForm("requirements", [...formData.requirements, formData.newRequirement.trim()]);
      updateForm("newRequirement", "");
    }
  };

  const removeRequirement = (index: number) => {
    updateForm(
      "requirements",
      formData.requirements.filter((_, i) => i !== index)
    );
  };

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const toAdd: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.size > 25 * 1024 * 1024) {
        toast({ title: "File too large", description: `${f.name} is over 25MB`, variant: "destructive" });
        continue;
      }
      toAdd.push(f);
    }
    if (toAdd.length) setPendingFiles((prev) => [...prev, ...toAdd]);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeStoredFile = (fileId: number) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = "Proposal title is required.";
    }
    if (!formData.category) {
      errors.category = "Please select a category.";
    }
    const hasDueDate = /^\d{4}-\d{2}-\d{2}$/.test(formData.dueDate.trim());
    const hasTimeline = formData.timeline.trim().length > 0;
    if (!hasDueDate && !hasTimeline) {
      errors.dueDate = dueDateMode === "date"
        ? "Please pick a due date."
        : "Please enter a timeline (e.g. 3–6 months).";
    }
    if (!formData.clientName.trim()) {
      errors.clientName = "Client / organization name is required.";
    }
    if (!formData.summary.trim()) {
      errors.summary = "Project summary is required.";
    }
    const emailVal = formData.clientEmail.trim();
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      errors.clientEmail = "Please enter a valid email address.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0];
      toast({
        title: "Please fix the form",
        description: first,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.summary.trim(),
        industry: formData.category || formData.clientIndustry || null,
        budgetRange: formData.estimatedValue ? `$${formData.estimatedValue}` : null,
        timeline: formData.timeline.trim() || null,
        dueDate: /^\d{4}-\d{2}-\d{2}$/.test(formData.dueDate.trim()) ? formData.dueDate.trim() : null,
        clientName: formData.clientName.trim() || null,
        clientContact: formData.clientContact.trim() || null,
        clientEmail: formData.clientEmail.trim() || null,
      };
      let id: number;
      if (isEditMode && proposalId) {
        await updateProposalMutation.mutateAsync(payload);
        id = proposalId;
        toast({ title: "Proposal updated", description: "Now add questions and share the link." });
      } else {
        const proposal = await createProposalMutation.mutateAsync(payload);
        id = proposal.id;
        toast({ title: "Proposal created", description: "Now add questions and get a share link." });
      }
      setPendingFiles([]);
      navigate(`/rfp/${id}/questions`);
    } catch (e) {
      const { message, fieldErrors: apiFieldErrors, isUnauthorized } = parseApiError(e);
      if (apiFieldErrors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(apiFieldErrors)) {
          if (k === "description") mapped.summary = v;
          else if (k === "industry") mapped.category = v;
          else mapped[k] = v;
        }
        setFieldErrors((prev) => ({ ...prev, ...mapped }));
      }
      toast({
        title: isUnauthorized ? "Session expired" : "Could not save proposal",
        description: message,
        variant: "destructive",
      });
      if (isUnauthorized) {
        authStorage.clearAuth();
        window.dispatchEvent(new CustomEvent("auth-refreshed"));
        navigate("/auth");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getHomeRoute = () => {
    if (currentRole === "admin") return "/admin/proposals";
    if (currentRole === "collaborator") return "/collaborator";
    return "/rfp-projects";
  };

  if (isEditMode && proposalId && proposalError) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <QueryErrorState refetch={refetchProposal} error={proposalErrorObj} />
      </div>
    );
  }

  if (isEditMode && proposalLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <p className="text-muted-foreground">Loading proposal...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in px-4 sm:px-6 overflow-x-hidden">
      <div className="mb-4 sm:mb-6">
        <Link href={getHomeRoute()}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground mb-3 sm:mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to {currentRole === "admin" ? "Proposals" : "Projects"}
          </Button>
        </Link>
        <ProposalStepper currentStep={1} />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          {isEditMode ? "Edit Proposal" : "Create Proposal"}
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Required: Proposal title, Category, Due date or Timeline, Client / organization name, Project summary. Then add questions and get a shareable link.
        </p>
      </div>

      <Card className="border shadow-sm mb-4 sm:mb-6 overflow-x-hidden">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Basic Info
          </CardTitle>
          
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div>
            <Label htmlFor="title" className="text-foreground text-sm sm:text-base">
              Proposal Title *
            </Label>
            <Input
              id="title"
              placeholder="e.g., Enterprise Cloud Migration Solution"
              value={formData.title}
              onChange={(e) => updateForm("title", e.target.value)}
              className={`mt-1.5 ${fieldErrors.title ? "border-destructive focus-visible:ring-destructive" : ""}`}
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? "title-error" : undefined}
            />
            {fieldErrors.title && (
              <p id="title-error" className="text-sm text-destructive mt-1" role="alert">
                {fieldErrors.title}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category" className="text-foreground text-sm sm:text-base">
                Category *
              </Label>
              <Select value={formData.category} onValueChange={(v) => updateForm("category", v)}>
                <SelectTrigger className={`mt-1.5 ${fieldErrors.category ? "border-destructive focus-visible:ring-destructive" : ""}`}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.category && (
                <p className="text-sm text-destructive mt-1" role="alert">
                  {fieldErrors.category}
                </p>
              )}
            </div>
            <div>
            <Label htmlFor="estimatedValue" className="text-foreground text-sm sm:text-base">
              Estimated Value
            </Label>
            <div className="relative mt-1.5">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="estimatedValue"
                placeholder="e.g., 500000"
                value={formData.estimatedValue}
                onChange={(e) => updateForm("estimatedValue", e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
            <div className="sm:col-span-2">
              <Label htmlFor="dueDate" className="text-foreground text-sm sm:text-base">
                Due Date *
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Select
                  value={dueDateMode}
                  onValueChange={(v) => setDueDateMode(v as "date" | "timeline")}
                >
                  <SelectTrigger className="w-[140px] shrink-0 rounded-md border border-input bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Due Date</SelectItem>
                    <SelectItem value="timeline">Timeline</SelectItem>
                  </SelectContent>
                </Select>
                {dueDateMode === "date" ? (
                  <div className="relative flex-1 flex items-center">
                    <Input
                      ref={dateInputRef}
                      id="dueDate"
                      type="date"
                      className={`flex-1 rounded-md border border-input bg-background min-w-0 [color-scheme:light] dark:[color-scheme:dark] input-date-no-indicator ${fieldErrors.dueDate ? "border-destructive focus-visible:ring-destructive" : ""}`}
                      value={formData.dueDate}
                      onChange={(e) => updateForm("dueDate", e.target.value)}
                      placeholder="dd/mm/yyyy"
                      aria-invalid={!!fieldErrors.dueDate}
                    />
                  </div>
                ) : (
                  <Input
                    id="timeline"
                    placeholder="e.g. 3-6 months, 1 year, or Q2 2025"
                    value={formData.timeline}
                    onChange={(e) => updateForm("timeline", e.target.value)}
                    className={`flex-1 min-w-0 placeholder:text-muted-foreground ${fieldErrors.dueDate ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    aria-invalid={!!fieldErrors.dueDate}
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {dueDateMode === "date"
                  ? "Pick a date. At least one of Due Date or Timeline is required."
                  : "Enter a timeline (e.g. 3-6 months). At least one of Due Date or Timeline is required."}
              </p>
              {fieldErrors.dueDate && (
                <p className="text-sm text-destructive mt-1" role="alert">
                  {fieldErrors.dueDate}
                </p>
              )}
            </div>
          </div>
         
        </CardContent>
      </Card>

      <Card className="border shadow-sm mb-4 sm:mb-6 overflow-x-hidden">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Client / Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div>
            <Label htmlFor="clientName" className="text-foreground text-sm sm:text-base">
              Client / Organization Name *
            </Label>
            <div className="relative mt-1.5">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="clientName"
                placeholder="e.g., TechCorp Inc."
                value={formData.clientName}
                onChange={(e) => updateForm("clientName", e.target.value)}
                className={`pl-10 ${fieldErrors.clientName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                aria-invalid={!!fieldErrors.clientName}
              />
            </div>
            {fieldErrors.clientName && (
              <p className="text-sm text-destructive mt-1" role="alert">
                {fieldErrors.clientName}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="clientIndustry" className="text-foreground text-sm sm:text-base">
              Industry
            </Label>
            <Select value={formData.clientIndustry} onValueChange={(v) => updateForm("clientIndustry", v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="healthcare">Healthcare</SelectItem>
                <SelectItem value="finance">Financial Services</SelectItem>
                <SelectItem value="government">Government</SelectItem>
                <SelectItem value="manufacturing">Manufacturing</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="education">Education</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientContact" className="text-foreground text-sm sm:text-base">
                Primary Contact
              </Label>
              <Input
                id="clientContact"
                placeholder="Contact name"
                value={formData.clientContact}
                onChange={(e) => updateForm("clientContact", e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="clientEmail" className="text-foreground text-sm sm:text-base">
                Contact Email
              </Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="email@company.com"
                value={formData.clientEmail}
                onChange={(e) => updateForm("clientEmail", e.target.value)}
                className={`mt-1.5 ${fieldErrors.clientEmail ? "border-destructive focus-visible:ring-destructive" : ""}`}
                aria-invalid={!!fieldErrors.clientEmail}
              />
              {fieldErrors.clientEmail && (
                <p className="text-sm text-destructive mt-1" role="alert">
                  {fieldErrors.clientEmail}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm mb-4 sm:mb-6 overflow-x-hidden">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Requirements & Files
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div>
            <Label htmlFor="summary" className="text-foreground text-sm sm:text-base">
              Project Summary *
            </Label>
            <Textarea
              id="summary"
              placeholder="Describe the project requirements and objectives..."
              value={formData.summary}
              onChange={(e) => updateForm("summary", e.target.value)}
              className={`mt-1.5 min-h-[120px] ${fieldErrors.summary ? "border-destructive focus-visible:ring-destructive" : ""}`}
              aria-invalid={!!fieldErrors.summary}
            />
            {fieldErrors.summary && (
              <p className="text-sm text-destructive mt-1" role="alert">
                {fieldErrors.summary}
              </p>
            )}
          </div>
          <div>
            <Label className="text-foreground text-sm sm:text-base">Key Requirements</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                placeholder="Add a requirement"
                value={formData.newRequirement}
                onChange={(e) => updateForm("newRequirement", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRequirement()}
                className="flex-1"
              />
              <Button type="button" onClick={addRequirement} variant="outline" className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {formData.requirements.map((req, index) => (
                <Badge key={index} variant="secondary" className="pl-3 pr-1.5 py-1.5 text-xs">
                  {req}
                  <button
                    type="button"
                    onClick={() => removeRequirement(index)}
                    className="ml-2 hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-foreground text-sm sm:text-base">Upload Files</Label>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX up to 25MB</p>
            <div
              className="border-2 border-dashed rounded-xl p-4 sm:p-6 text-center cursor-pointer mt-2 hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <Upload className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs sm:text-sm text-muted-foreground">
                Drop files here or <span className="text-primary font-medium">browse</span>
              </p>
            </div>
            {(files.length > 0 || pendingFiles.length > 0) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {files.map((f) => (
                  <span
                    key={f.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted text-sm"
                  >
                    {f.name}
                    <button type="button" onClick={() => removeStoredFile(f.id)} className="hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {pendingFiles.map((f, i) => (
                  <span
                    key={`p-${i}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted text-sm"
                  >
                    {f.name}
                    <button type="button" onClick={() => removePendingFile(i)} className="hover:opacity-70">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={isSubmitting} className="theme-gradient-bg text-white hover:opacity-95">
          {isSubmitting ? "Saving..." : isEditMode ? "Update & continue to Questions" : "Create & continue to Questions"}
        </Button>
      </div>
    </div>
  );
}
