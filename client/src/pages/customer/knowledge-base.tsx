import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Upload, FileText, Tag, Trash2, MoreHorizontal, Search,
  Filter, Download, File, X, Plus, Edit, RefreshCw, LayoutGrid, List, LayoutDashboard
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePrompt } from "@/hooks/use-prompt";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { QueryErrorState } from "@/components/shared/query-error-state";

type LayoutMode = "card" | "list" | "grid";

type KbDocument = {
  id: number;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  tags: string[];
  version: number;
  description: string;
};

type KbVersion = {
  id: number;
  documentId: number;
  version: number;
  uploadedAt: string;
  uploadedBy: string;
  changes: string;
};

async function fetchKbDocuments(): Promise<KbDocument[]> {
  const res = await apiRequest("GET", "/api/v1/customer/knowledge-base/documents");
  return res.json();
}

async function fetchKbVersions(): Promise<KbVersion[]> {
  const res = await apiRequest("GET", "/api/v1/customer/knowledge-base/versions");
  return res.json();
}

export default function KnowledgeBase() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { prompt, PromptDialog } = usePrompt();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KbDocument | null>(null);
  const [activeTab, setActiveTab] = useState("documents");
  const [layout, setLayout] = useState<LayoutMode>("list");

  const { data: documentsFromApi = [], isLoading: documentsLoading, isError: documentsError, error: documentsErrorObj, refetch: refetchDocuments } = useQuery({
    queryKey: ["customer", "knowledge-base", "documents"],
    queryFn: fetchKbDocuments,
    staleTime: 0, // always refetch after mutations so list stays in sync
    refetchOnMount: "always", // refetch when opening Knowledge Base so proposal docs show up
  });
  const { data: versionHistoryFromApi = [] } = useQuery({
    queryKey: ["customer", "knowledge-base", "versions"],
    queryFn: fetchKbVersions,
    enabled: activeTab === "history",
  });

  const documents: KbDocument[] = useMemo(() => {
    return documentsFromApi.map((d) => ({
      ...d,
      uploadedAt: typeof d.uploadedAt === "string" ? d.uploadedAt : new Date().toISOString(),
    }));
  }, [documentsFromApi]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Create FormData with the file
      const formData = new FormData();
      formData.append("file", file);
      
      // Use authFetch to handle auth and token refresh
      const { authFetch } = await import("@/lib/queryClient");
      const { getApiUrl } = await import("@/lib/api");
      
      const res = await authFetch(getApiUrl("/api/v1/customer/knowledge-base/upload"), {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Upload failed");
      }
      
      return res.json() as Promise<KbDocument>;
    },
    onSuccess: (newDoc, file) => {
      // Optimistic update: show new document in the list immediately
      queryClient.setQueryData<KbDocument[]>(
        ["customer", "knowledge-base", "documents"],
        (old = []) => [...old, { ...newDoc, uploadedAt: newDoc.uploadedAt || new Date().toISOString() }]
      );
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
      queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
      toast({ title: "Document uploaded", description: `${file.name} has been uploaded and processed successfully.` });
      setIsUploadDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Upload failed", 
        description: error.message || "Failed to upload file. Please try again.",
        variant: "destructive" 
      });
    },
  });

  const syncFromProposalsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/v1/customer/knowledge-base/sync-from-proposals", { userId: user?.id });
      return res.json() as Promise<{ synced: number }>;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
      await queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      await queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
      if (data.synced > 0) {
        toast({ title: "Synced from proposals", description: `${data.synced} document(s) added from your proposals.` });
      } else {
        toast({ title: "No new documents", description: "All proposal documents are already in your Knowledge Base, or you have no proposal files." });
      }
    },
    onError: () => {
      toast({ title: "Sync failed", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/v1/customer/knowledge-base/documents/${id}`);
    },
    onSuccess: (_, id) => {
      // Optimistic update: remove document from list immediately
      queryClient.setQueryData<KbDocument[]>(
        ["customer", "knowledge-base", "documents"],
        (old = []) => old.filter((d) => d.id !== id)
      );
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
      queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
      const doc = documents.find((d) => d.id === id);
      toast({ title: "Document deleted", description: doc ? `${doc.name} has been deleted.` : "Deleted.", variant: "destructive" });
      setIsDeleteDialogOpen(false);
      setSelectedDocument(null);
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async ({ documentId, tags }: { documentId: number; tags: string[] }) => {
      const res = await apiRequest("PATCH", `/api/v1/customer/knowledge-base/documents/${documentId}`, { tags });
      return res.json() as Promise<KbDocument>;
    },
    onSuccess: (updatedDoc) => {
      // Optimistic update: merge updated doc into list
      if (updatedDoc) {
        queryClient.setQueryData<KbDocument[]>(
          ["customer", "knowledge-base", "documents"],
          (old = []) => old.map((d) => (d.id === updatedDoc.id ? { ...updatedDoc, uploadedAt: updatedDoc.uploadedAt || d.uploadedAt } : d))
        );
      }
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
      queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
    },
    onError: () => {
      toast({ title: "Failed to update document", variant: "destructive" });
    },
  });

  // On load: sync proposal documents into Knowledge Base so docs added during proposal creation show up
  useEffect(() => {
    if (!user?.id) return;
    apiRequest("POST", "/api/v1/customer/knowledge-base/sync-from-proposals", { userId: user.id })
      .then((res) => res.json() as Promise<{ synced: number }>)
      .then((data) => {
        if (data.synced > 0) {
          queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
          queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
          queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
          queryClient.refetchQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
          toast({ title: "Synced from proposals", description: `${data.synced} document(s) added from your proposals.` });
        }
      })
      .catch(() => { /* ignore: user can use Sync from proposals button */ });
  }, [user?.id, queryClient, toast]);

  const allTags = useMemo(() => Array.from(new Set(documents.flatMap((doc) => doc.tags))), [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = !searchTerm ||
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.description ?? "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag = tagFilter === "all" || (doc.tags && doc.tags.includes(tagFilter));
      return matchesSearch && matchesTag;
    });
  }, [documents, searchTerm, tagFilter]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInDays = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    return `${diffInDays} days ago`;
  };

  const handleUpload = (file: File | null) => {
    if (!file) return;
    uploadMutation.mutate(file);
  };

  const handleDelete = (doc: KbDocument) => {
    setSelectedDocument(doc);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedDocument) deleteMutation.mutate(selectedDocument.id);
  };

  const handleAddTag = (docId: number, tag: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const currentTags = Array.isArray(doc.tags) ? doc.tags : [];
    if (currentTags.includes(tag.trim())) return;
    const newTags = [...currentTags, tag.trim()];
    updateDocumentMutation.mutate({ documentId: docId, tags: newTags }, {
      onSuccess: () => toast({ title: "Tag added", description: `Tag "${tag.trim()}" has been added.` }),
    });
  };

  const handleRemoveTag = (docId: number, tag: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const currentTags = Array.isArray(doc.tags) ? doc.tags : [];
    const newTags = currentTags.filter((t) => t !== tag);
    updateDocumentMutation.mutate({ documentId: docId, tags: newTags }, {
      onSuccess: () => toast({ title: "Tag removed", description: `Tag "${tag}" has been removed.` }),
    });
  };

  const handleDownload = (doc: KbDocument) => {
    const content = doc.description?.trim() || `Knowledge base document: ${doc.name}\n\nNo content stored.`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const baseName = doc.name.replace(/\.[^.]+$/, "") || "document";
    const filename = `${baseName}.txt`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Download started", description: `${filename} has been downloaded.` });
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Knowledge Base</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Upload and manage documents for AI answer generation
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => syncFromProposalsMutation.mutate()}
            disabled={syncFromProposalsMutation.isPending}
          >
            <RefreshCw className={syncFromProposalsMutation.isPending ? "w-4 h-4 mr-2 animate-spin" : "w-4 h-4 mr-2"} />
            {syncFromProposalsMutation.isPending ? "Syncing…" : "Sync from proposals"}
          </Button>
          <Button
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => setIsUploadDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v ?? "documents")} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="documents" type="button">Documents</TabsTrigger>
          <TabsTrigger value="history" type="button">Version History</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" forceMount className="space-y-3 sm:space-y-4 data-[state=inactive]:hidden">
          {/* Filters */}
          <Card>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
                <div className="search-box flex-1">
                  <Search className="search-box-icon" />
                  <Input
                    placeholder="Search documents..."
                    className="text-sm sm:text-base"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={tagFilter} onValueChange={setTagFilter}>
                  <SelectTrigger className="w-full sm:w-40 text-sm sm:text-base">
                    <SelectValue placeholder="All Tags" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ToggleGroup
                  type="single"
                  value={layout}
                  onValueChange={(v) => v && setLayout(v as LayoutMode)}
                  className="border rounded-md p-0.5 bg-muted/30 shrink-0"
                >
                  <ToggleGroupItem value="card" aria-label="Card layout" className="px-2.5 py-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                    <LayoutDashboard className="w-4 h-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="List layout" className="px-2.5 py-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                    <List className="w-4 h-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="grid" aria-label="Grid layout" className="px-2.5 py-1.5 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                    <LayoutGrid className="w-4 h-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardContent>
          </Card>

          {/* Documents Grid */}
          {documentsError ? (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <QueryErrorState refetch={refetchDocuments} error={documentsErrorObj} />
              </CardContent>
            </Card>
          ) : documentsLoading ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center">
                <p className="text-sm text-muted-foreground">Loading documents...</p>
              </CardContent>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-6 sm:p-8 text-center">
                <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No documents found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload a document here or sync documents you already added to a proposal.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="outline"
                    onClick={() => syncFromProposalsMutation.mutate()}
                    disabled={syncFromProposalsMutation.isPending}
                  >
                    <RefreshCw className={syncFromProposalsMutation.isPending ? "w-4 h-4 mr-2 animate-spin" : "w-4 h-4 mr-2"} />
                    {syncFromProposalsMutation.isPending ? "Syncing…" : "Sync from proposals"}
                  </Button>
                  <Button onClick={() => setIsUploadDialogOpen(true)}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : layout === "list" ? (
            <div className="rounded-lg border overflow-hidden bg-card shadow-sm overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr className="border-b bg-muted">
                    <th scope="col" className="px-2 py-1.5 text-sm font-medium text-muted-foreground min-w-0 w-[22%]">Name</th>
                    <th scope="col" className="px-2 py-1.5 text-sm font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Size</th>
                    <th scope="col" className="px-2 py-1.5 text-sm font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Updated</th>
                    <th scope="col" className="px-2 py-1.5 text-sm font-medium text-muted-foreground min-w-0">Tags</th>
                    <th scope="col" className="px-2 py-1.5 text-sm font-medium text-muted-foreground whitespace-nowrap">Download</th>
                    <th scope="col" className="px-2 py-1.5 pr-4 text-sm font-medium text-muted-foreground text-center whitespace-nowrap w-16 min-w-[4rem]">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-card">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="border-b border-border/50 last:border-b-0 hover:bg-muted/50 transition-colors">
                      <td className="px-2 py-1.5 align-middle min-w-0 max-w-0 w-[22%]">
                        <p className="font-medium text-sm truncate" title={doc.name}>{doc.name}</p>
                        {doc.description && <p className="text-[13px] text-muted-foreground truncate" title={doc.description}>{doc.description}</p>}
                      </td>
                      <td className="px-2 py-1.5 align-middle text-[13px] whitespace-nowrap hidden sm:table-cell">{formatFileSize(doc.size)}</td>
                      <td className="px-2 py-1.5 align-middle text-[13px] text-muted-foreground whitespace-nowrap hidden sm:table-cell">{formatTimeAgo(doc.uploadedAt)}</td>
                      <td className="px-2 py-1.5 align-middle min-w-0">
                        <div className="flex flex-wrap gap-1 min-w-0">
                          {doc.tags.slice(0, 3).map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-[11px] py-0 max-w-[6rem] truncate" title={tag}>{tag}</Badge>
                          ))}
                          {doc.tags.length > 3 && <span className="text-[13px] text-muted-foreground shrink-0">+{doc.tags.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle whitespace-nowrap">
                        <Button size="icon" variant="outline" className="h-8 w-8 ml-5" onClick={() => handleDownload(doc)} title="Download">
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                      <td className="px-2 py-1.5 pr-4 align-middle text-center whitespace-nowrap w-16 min-w-[4rem]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 ml-5"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload(doc)}><Download className="w-4 h-4 mr-2" /> Download</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(doc)}><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={layout === "card" ? "grid grid-cols-1 gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"}>
              {filteredDocuments.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-3 sm:p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <File className="w-4 h-4 text-primary shrink-0" />
                          <h3 className="font-semibold text-sm truncate">{doc.name}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {formatFileSize(doc.size)} • {formatTimeAgo(doc.uploadedAt)}
                        </p>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(doc)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDelete(doc)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 sm:p-4 pt-0">
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Tags</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {doc.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs py-0">
                              {tag}
                              <button
                                onClick={() => handleRemoveTag(doc.id, tag)}
                                className="ml-1 hover:text-destructive"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </Badge>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs"
                            onClick={async () => {
                              const tag = await prompt({
                                title: "Add Tag",
                                description: "Enter a name for the new tag.",
                                placeholder: "Tag name",
                                confirmText: "Add",
                                cancelText: "Cancel",
                              });
                              if (tag?.trim()) handleAddTag(doc.id, tag.trim());
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Tag
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground pt-0.5">
                        <span>Version {doc.version}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" forceMount className="space-y-3 sm:space-y-4 data-[state=inactive]:hidden">
          <Card>
            <CardHeader className="p-3 sm:p-4">
              <CardTitle className="text-base sm:text-lg">Version History</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              {versionHistoryFromApi.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No version history available</p>
              ) : (
                <div className="space-y-4">
                  {versionHistoryFromApi.map((version) => {
                    const docName = documents.find((d) => d.id === version.documentId)?.name ?? `Document #${version.documentId}`;
                    return (
                      <div key={version.id} className="flex items-start justify-between gap-4 p-4 rounded-lg border">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">v{version.version}</Badge>
                            <span className="text-sm font-medium">{docName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {version.changes}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {version.uploadedBy} • {formatTimeAgo(version.uploadedAt)}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a document to your knowledge base for AI answer generation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-2">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground mb-4">
                Supported formats: PDF, DOC, DOCX, XLSX, TXT, Audio (MP3, WAV, M4A), Video (MP4, MOV, AVI, WebM) (Max 25MB)
              </p>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xlsx,.txt,.mp3,.mp4,.wav,.m4a,.mov,.avi,.webm,.mpeg,.mpg,.mpga,.flv,.wmv"
                onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                className="max-w-xs mx-auto"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedDocument?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PromptDialog />
    </div>
  );
}
