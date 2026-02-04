import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Upload, FileText, Tag, Trash2, MoreHorizontal, Search,
  Filter, Download, History, File, X, Plus, Edit
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KbDocument | null>(null);
  const [activeTab, setActiveTab] = useState("documents");

  const { data: documentsFromApi = [], isLoading: documentsLoading } = useQuery({
    queryKey: ["customer", "knowledge-base", "documents"],
    queryFn: fetchKbDocuments,
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
      const res = await apiRequest("POST", "/api/v1/customer/knowledge-base/documents", {
        name: file.name,
        type: file.name.split(".").pop() || "unknown",
        size: file.size,
        tags: [],
        description: "",
      });
      return res.json();
    },
    onSuccess: (_, file) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
      toast({ title: "Document uploaded", description: `${file.name} has been uploaded successfully.` });
      setIsUploadDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Upload failed", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/v1/customer/knowledge-base/documents/${id}`);
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "documents"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "knowledge-base", "versions"] });
      const doc = documents.find((d) => d.id === id);
      toast({ title: "Document deleted", description: doc ? `${doc.name} has been deleted.` : "Deleted.", variant: "destructive" });
      setIsDeleteDialogOpen(false);
      setSelectedDocument(null);
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

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

  const handleAddTag = (_docId: number, tag: string) => {
    toast({ title: "Tag added", description: `Tag "${tag}" added (save via document edit when supported).` });
  };

  const handleRemoveTag = (_docId: number, _tag: string) => {};

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Knowledge Base</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Upload and manage documents for AI answer generation
          </p>
        </div>
        <Button
          size="sm"
          className="w-full sm:w-auto text-xs sm:text-sm"
          onClick={() => setIsUploadDialogOpen(true)}
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Version History</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4 sm:space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    className="pl-10 text-sm sm:text-base"
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
              </div>
            </CardContent>
          </Card>

          {/* Documents Grid */}
          {documentsLoading ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <p className="text-sm text-muted-foreground">Loading documents...</p>
              </CardContent>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No documents found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your first document to build your knowledge base
                </p>
                <Button onClick={() => setIsUploadDialogOpen(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredDocuments.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="p-4 sm:p-6 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <File className="w-5 h-5 text-primary shrink-0" />
                          <h3 className="font-semibold text-sm sm:text-base truncate">{doc.name}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
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
                          <DropdownMenuItem onClick={() => toast({ title: "Downloading", description: `Downloading ${doc.name}...` })}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast({ title: "Viewing history", description: "Opening version history..." })}>
                            <History className="w-4 h-4 mr-2" />
                            View History
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
                  <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">Tags</Label>
                        <div className="flex flex-wrap gap-2">
                          {doc.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                              <button
                                onClick={() => handleRemoveTag(doc.id, tag)}
                                className="ml-1.5 hover:text-destructive"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => {
                              const tag = prompt("Enter tag name:");
                              if (tag) handleAddTag(doc.id, tag);
                            }}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Tag
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Version {doc.version}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toast({ title: "Viewing history", description: "Opening version history..." })}
                        >
                          <History className="w-3 h-3 mr-1" />
                          History
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Version History</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
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
                Supported formats: PDF, DOC, DOCX, XLSX, TXT (Max 10MB)
              </p>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.xlsx,.txt"
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
    </div>
  );
}
