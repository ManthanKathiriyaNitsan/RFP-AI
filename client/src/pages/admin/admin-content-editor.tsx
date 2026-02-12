import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchAdminOptions } from "@/api/admin-data";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { 
  ArrowLeft, 
  Save, 
  Eye,
  FileText,
  Tag,
  CheckCircle,
  AlertCircle,
  Clock,
  Upload,
  X,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminContentEditor() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isPreview, setIsPreview] = useState(false);
  const isMobile = useIsMobile();
  const creatorName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "Admin"
    : "Admin";

  // Extract content ID from URL
  const contentId = new URLSearchParams(location.split('?')[1] || '').get('id');
  const isNew = !contentId;

  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const contentCategories = optionsData?.contentCategories ?? [
    { value: "Company Overview", label: "Company Overview" },
    { value: "Technical Capabilities", label: "Technical Capabilities" },
    { value: "Case Studies", label: "Case Studies" },
    { value: "Pricing Templates", label: "Pricing Templates" },
    { value: "Security & Compliance", label: "Security & Compliance" },
  ];
  const contentStatuses = optionsData?.contentStatuses ?? [
    { value: "draft", label: "Draft" },
    { value: "review", label: "In Review" },
    { value: "approved", label: "Approved" },
    { value: "needs_update", label: "Needs Update" },
  ];

  type AttachmentItem = { name: string; dataUrl: string; size?: number };
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    content: "",
    tags: [] as string[],
    status: "draft" as const,
    newTag: "",
    attachments: [] as AttachmentItem[],
  });

  // Fetch content if editing
  const { data: content, isLoading, isError, error, refetch } = useQuery<any>({
    queryKey: [`/api/content/${contentId}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/content/${contentId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!contentId && !isNew,
  });

  useEffect(() => {
    if (content && typeof content === 'object') {
      const c = content as any;
      setFormData({
        title: c.title || "",
        category: c.category || "",
        content: c.content || "",
        tags: c.tags || [],
        status: c.status || "draft",
        newTag: "",
        attachments: Array.isArray(c.attachments) ? c.attachments : [],
      });
    }
  }, [content]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isNew) {
        const response = await apiRequest("POST", "/api/content", data);
        return response.json();
      } else {
        const response = await apiRequest("PATCH", `/api/content/${contentId}`, data);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
      queryClient.invalidateQueries({ queryKey: [`/api/content/${contentId}`] });
      toast({
        title: isNew ? "Content created" : "Content updated",
        description: "Your changes have been saved successfully.",
      });
      setLocation("/admin/content");
    },
    onError: () => {
      toast({
        title: "Error",
        description: `Failed to ${isNew ? 'create' : 'update'} content. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const handleAddTag = () => {
    if (formData.newTag.trim() && !formData.tags.includes(formData.newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, formData.newTag.trim()],
        newTag: "",
      });
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(t => t !== tag),
    });
  };

  const handleSave = () => {
    if (!formData.title || !formData.content) {
      toast({
        title: "Validation Error",
        description: "Please fill in title and content.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      title: formData.title,
      category: formData.category,
      content: formData.content,
      tags: formData.tags,
      status: formData.status,
      attachments: formData.attachments.length ? formData.attachments : undefined,
      ...(isNew ? { author: creatorName, createdBy: creatorName } : {}),
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const limit = 25 * 1024 * 1024; // 25MB per file
    const toRead: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > limit) {
        toast({ title: "File too large", description: `${file.name} is over 25MB.`, variant: "destructive" });
        continue;
      }
      toRead.push(file);
    }
    Promise.all(
      toRead.map(
        (file) =>
          new Promise<AttachmentItem>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, dataUrl: reader.result as string, size: file.size });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    ).then((newAttachments) => {
      setFormData((prev) => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
    }).catch(() => {
      toast({ title: "Upload failed", description: "Could not read one or more files.", variant: "destructive" });
    });
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const formatSize = (bytes?: number) => {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "approved":
        return { label: "Approved", icon: CheckCircle, className: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald dark:text-emerald" };
      case "review":
        return { label: "In Review", icon: AlertCircle, className: "bg-amber-500/10 dark:bg-amber-500/20 text-amber dark:text-amber" };
      case "needs_update":
        return { label: "Needs Update", icon: AlertCircle, className: "bg-red-500/10 dark:bg-red-500/20 text-red dark:text-red" };
      default:
        return { label: "Draft", icon: Clock, className: "bg-gray-500/10 dark:bg-gray-500/20 text-muted-foreground" };
    }
  };

  if (contentId && !isNew && isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="text-muted-foreground">Loading content...</div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(formData.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <Link href="/admin/content">
            <Button variant="ghost" size="sm" className="shrink-0">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold">
              {isNew ? "Create New Content" : "Edit Content"}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {isNew ? "Add a new content item to the library" : "Update content details"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => setIsPreview(!isPreview)} className="flex-1 sm:flex-initial">
            <Eye className="w-4 h-4 mr-2" />
            {isPreview ? "Edit" : "Preview"}
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1 sm:flex-initial">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              <div>
                <Label className="text-xs sm:text-sm">Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter content title..."
                  className="mt-1.5 text-sm sm:text-base"
                  disabled={isPreview}
                />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Content *</Label>
                {isPreview ? (
                  <div className="mt-1.5 p-3 sm:p-4 border rounded-lg min-h-[300px] sm:min-h-[400px] bg-muted/50">
                    <div className="prose max-w-none prose-sm sm:prose-base">
                      <h2 className="text-lg sm:text-2xl">{formData.title || "Untitled"}</h2>
                      <p className="whitespace-pre-wrap text-sm sm:text-base">{formData.content || "No content"}</p>
                    </div>
                  </div>
                ) : (
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter content text..."
                    className="mt-1.5 min-h-[300px] sm:min-h-[400px] text-sm sm:text-base"
                  />
                )}
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Documents</Label>
                <p className="text-muted-foreground text-xs mt-0.5 mb-2">Attach PDFs, Word docs, audio, video, or other files (max 25MB per file).</p>
                {!isPreview && (
                  <label className="flex items-center justify-center gap-2 mt-1.5 p-4 border border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload document</span>
                    <input
                      type="file"
                      className="sr-only"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,image/*,.mp3,.mp4,.wav,.m4a,.mov,.avi,.webm,.mpeg,.mpg,.mpga,.flv,.wmv"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
                {formData.attachments.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {formData.attachments.map((att, index) => (
                      <li
                        key={`${att.name}-${index}`}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 border text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{att.name}</span>
                          {att.size != null && (
                            <span className="text-muted-foreground text-xs shrink-0">{formatSize(att.size)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {att.dataUrl.startsWith("data:") && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(att.dataUrl, "_blank")}
                              title="Open"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          {!isPreview && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => removeAttachment(index)}
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
              <div>
                <Label className="text-xs sm:text-sm">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                  disabled={isPreview}
                >
                  <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {contentCategories.map((opt: { value: string; label: string }) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v: any) => setFormData({ ...formData, status: v })}
                  disabled={isPreview}
                >
                  <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contentStatuses.map((opt: { value: string; label: string }) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Tags</Label>
                <div className="flex flex-col sm:flex-row gap-2 mt-1.5">
                  <Input
                    value={formData.newTag}
                    onChange={(e) => setFormData({ ...formData, newTag: e.target.value })}
                    placeholder="Add tag"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    disabled={isPreview}
                    className="text-sm sm:text-base"
                  />
                  <Button onClick={handleAddTag} disabled={isPreview || !formData.newTag.trim()} className="w-full sm:w-auto shrink-0">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="pl-2 pr-1 text-xs sm:text-sm">
                      {tag}
                      {!isPreview && (
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-2 hover:text-destructive"
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 sm:p-6 pt-0 text-xs sm:text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className={`${statusConfig.className} text-xs sm:text-sm`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </div>
              {!isNew && content && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Created:</span>
                    <span className="text-right">{new Date(content.createdAt || new Date()).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="text-right">{new Date(content.updatedAt || new Date()).toLocaleDateString()}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
