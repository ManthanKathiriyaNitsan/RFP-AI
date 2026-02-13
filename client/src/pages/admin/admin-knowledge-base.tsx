import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useAuth } from "@/hooks/use-auth";
import { folderIconUrl } from "@/assets/folder-icon-url";
import {
  fetchAdminKnowledgeBase,
  fetchAdminKnowledgeBaseVersions,
  rebuildAdminKnowledgeBase,
  restoreAdminKnowledgeBaseVersion,
} from "@/api/admin-data";
import type { KnowledgeBaseDocument } from "@/api/admin-data";
import {
  Database,
  RefreshCw,
  History,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  RotateCcw,
  List,
  Grid3X3,
  LayoutList,
  FolderOpen,
  ArrowLeft,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  indexed: { label: "Indexed", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  pending: { label: "Pending", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  failed: { label: "Failed", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

export default function AdminKnowledgeBase() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { currentRole } = useAuth();
  const isSuperAdmin = (currentRole ?? "").toLowerCase() === "super_admin";

  const [rebuilding, setRebuilding] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid" | "list">("list");
  const [kbPage, setKbPage] = useState(1);
  const [kbPageSize, setKbPageSize] = useState(10);

  const [folderSearch, setFolderSearch] = useState("");
  const [folderSort, setFolderSort] = useState<"a-z" | "z-a">("a-z");
  const [folderViewMode, setFolderViewMode] = useState<"grid" | "list">("grid");
  const [selectedCreatorName, setSelectedCreatorName] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "knowledge-base"],
    queryFn: fetchAdminKnowledgeBase,
  });

  const { data: versionsData } = useQuery({
    queryKey: ["admin", "knowledge-base-versions"],
    queryFn: fetchAdminKnowledgeBaseVersions,
  });

  const allDocuments = data?.documents ?? [];
  const creators = useMemo(() => {
    const byName = new Map<string, number>();
    for (const doc of allDocuments) {
      const name = (doc.creator ?? "—").trim() || "—";
      byName.set(name, (byName.get(name) ?? 0) + 1);
    }
    return Array.from(byName.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [allDocuments]);

  const filteredCreators = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    let list = q ? creators.filter((c) => c.name.toLowerCase().includes(q)) : [...creators];
    list = [...list].sort((a, b) =>
      folderSort === "a-z"
        ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        : b.name.localeCompare(a.name, undefined, { sensitivity: "base" })
    );
    return list;
  }, [creators, folderSearch, folderSort]);

  const documents: KnowledgeBaseDocument[] = useMemo(() => {
    if (isSuperAdmin && selectedCreatorName != null && selectedCreatorName.trim() !== "") {
      return allDocuments.filter((d) => (d.creator ?? "—").trim() === selectedCreatorName);
    }
    return allDocuments;
  }, [allDocuments, isSuperAdmin, selectedCreatorName]);

  const paginatedDocuments = documents.slice(
    (kbPage - 1) * kbPageSize,
    kbPage * kbPageSize
  );
  const versions = versionsData?.versions ?? [];
  const lastRebuildAt = data?.lastRebuildAt;
  const indexVersion = data?.indexVersion;

  const handleRebuild = async () => {
    const ok = await confirm({
      title: "Rebuild index?",
      description: "This will re-index all documents and may take a few minutes. Continue?",
    });
    if (!ok) return;
    setRebuilding(true);
    const { success } = await rebuildAdminKnowledgeBase();
    setRebuilding(false);
    if (success) {
      qc.invalidateQueries({ queryKey: ["admin", "knowledge-base"] });
      qc.invalidateQueries({ queryKey: ["admin", "knowledge-base-versions"] });
      toast({ title: "Rebuild started", description: "Index rebuild has been triggered." });
    } else {
      toast({ title: "Rebuild failed", variant: "destructive" });
    }
  };

  const handleRestore = async (versionId: string) => {
    const ok = await confirm({
      title: "Restore this version?",
      description: "The knowledge base index will be restored to this version. Continue?",
    });
    if (!ok) return;
    setRestoringId(versionId);
    const success = await restoreAdminKnowledgeBaseVersion(versionId);
    setRestoringId(null);
    if (success) {
      qc.invalidateQueries({ queryKey: ["admin", "knowledge-base"] });
      toast({ title: "Version restored", description: "Index restored to selected version." });
    } else {
      toast({ title: "Restore failed", variant: "destructive" });
    }
  };

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Super Admin: folder view – select a creator to see their knowledge base content
  if (isSuperAdmin && selectedCreatorName == null) {
    return (
      <>
        <ConfirmDialog />
        <div className="space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Knowledge Base</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Global docs, embeddings status, rebuild index, and version control.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-full">
            <Card className="border shadow-sm overflow-hidden rounded-xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <p className="text-lg font-bold tabular-nums">{creators.length}</p>
                <p className="text-xs text-muted-foreground">Creators</p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm overflow-hidden rounded-xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-lg font-bold tabular-nums">{allDocuments.length}</p>
                <p className="text-xs text-muted-foreground">Indexed documents</p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm overflow-hidden rounded-xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                  <Database className="h-4 w-4" />
                </div>
                <p className="text-lg font-bold truncate">{data?.indexVersion ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Index version</p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm overflow-hidden rounded-xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                  <Clock className="h-4 w-4" />
                </div>
                <p className="text-lg font-bold truncate">
                  {data?.lastRebuildAt ? new Date(data.lastRebuildAt).toLocaleDateString() : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Last rebuild</p>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-3">
            {creators.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search creators..."
                    value={folderSearch}
                    onChange={(e) => setFolderSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={folderSort} onValueChange={(v) => setFolderSort(v as "a-z" | "z-a")}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a-z">A → Z</SelectItem>
                    <SelectItem value="z-a">Z → A</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center border rounded-lg overflow-hidden shrink-0 sm:ml-auto">
                  <Button variant={folderViewMode === "grid" ? "default" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setFolderViewMode("grid")} title="Grid view">
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button variant={folderViewMode === "list" ? "default" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setFolderViewMode("list")} title="List view">
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            {creators.length === 0 ? (
              <Card className="border shadow-sm overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FolderOpen className="w-10 h-10 text-muted-foreground mb-3" />
                    <h3 className="text-base font-semibold mb-1">No indexed content yet</h3>
                    <p className="text-sm text-muted-foreground">Upload content in the Content Library, then trigger a rebuild.</p>
                  </div>
                </CardContent>
              </Card>
            ) : filteredCreators.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No creators match your search.</p>
            ) : folderViewMode === "list" ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <ul className="divide-y divide-border">
                  {filteredCreators.map(({ name, count }) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => { setSelectedCreatorName(name); setKbPage(1); }}
                        className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      >
                        <img src={folderIconUrl} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-foreground truncate">{name}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{count} document{count !== 1 ? "s" : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 sm:gap-2">
                {filteredCreators.map(({ name, count }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => { setSelectedCreatorName(name); setKbPage(1); }}
                    className="flex flex-col items-center gap-2 w-24 sm:w-28 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg p-2 transition-colors hover:bg-muted/50"
                  >
                    <img
                      src={folderIconUrl}
                      alt=""
                      className="w-12 h-12 sm:w-14 sm:h-14 object-contain group-hover:scale-105 transition-transform"
                    />
                    <span className="text-sm font-medium text-foreground text-center line-clamp-2 break-words w-full">
                      {name}
                    </span>
                    <span className="text-xs text-muted-foreground">{count} doc{count !== 1 ? "s" : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          {isSuperAdmin && selectedCreatorName != null && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedCreatorName(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to folders
            </Button>
          )}
          <h1 className="text-xl sm:text-2xl font-bold">
            {isSuperAdmin && selectedCreatorName != null ? `Knowledge Base · ${selectedCreatorName}` : "Knowledge Base"}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {isSuperAdmin && selectedCreatorName != null
              ? `Indexed documents from ${selectedCreatorName}.`
              : "Global docs, embeddings status, rebuild index, and version control."}
          </p>
        </div>
      </div>

      <Tabs defaultValue="embeddings" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="embeddings" className="data-[state=active]:bg-background">
            <Database className="w-4 h-4 mr-2" />
            Documents & embeddings
          </TabsTrigger>
          <TabsTrigger value="rebuild" className="data-[state=active]:bg-background">
            <RefreshCw className="w-4 h-4 mr-2" />
            Rebuild index
          </TabsTrigger>
          <TabsTrigger value="versions" className="data-[state=active]:bg-background">
            <History className="w-4 h-4 mr-2" />
            Version history
          </TabsTrigger>
        </TabsList>

        <TabsContent value="embeddings" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Embeddings status</CardTitle>
                  <CardDescription>
                    Documents from Content Library that have been indexed for search and AI. Upload docs in Content Library to include them here.
                  </CardDescription>
                </div>
                {documents.length > 0 && (
                  <div className="flex items-center border rounded-lg overflow-hidden shrink-0">
                    <Button
                      variant={viewMode === "table" ? "secondary" : "ghost"}
                      size="icon"
                      className="rounded-none h-9 w-9"
                      onClick={() => setViewMode("table")}
                      title="Table view"
                    >
                      <LayoutList className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="icon"
                      className="rounded-none h-9 w-9"
                      onClick={() => setViewMode("grid")}
                      title="Grid view"
                    >
                      <Grid3X3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="icon"
                      className="rounded-none h-9 w-9"
                      onClick={() => setViewMode("list")}
                      title="List view"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No documents in the knowledge base yet. Upload content in the Content Library, then trigger a rebuild.
                </p>
              ) : viewMode === "table" ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chunks</th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last indexed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDocuments.map((doc) => {
                        const config = STATUS_CONFIG[doc.embeddingStatus] ?? STATUS_CONFIG.pending;
                        const Icon = config.icon;
                        return (
                          <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-muted shrink-0">
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <p className="font-medium text-sm truncate">{doc.title}</p>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className={`text-[10px] ${config.className}`}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {doc.chunkCount != null ? `${doc.chunkCount} chunks` : "—"}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {doc.lastIndexedAt ? new Date(doc.lastIndexedAt).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {paginatedDocuments.map((doc) => {
                    const config = STATUS_CONFIG[doc.embeddingStatus] ?? STATUS_CONFIG.pending;
                    const Icon = config.icon;
                    return (
                      <div
                        key={doc.id}
                        className="rounded-lg border border-border p-4 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-muted shrink-0">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm line-clamp-2 break-words">{doc.title}</p>
                            <Badge variant="outline" className={`text-[10px] mt-2 ${config.className}`}>
                              <Icon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                              {doc.chunkCount != null && <span>{doc.chunkCount} chunks</span>}
                              {doc.lastIndexedAt && (
                                <span>Indexed {new Date(doc.lastIndexedAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedDocuments.map((doc) => {
                    const config = STATUS_CONFIG[doc.embeddingStatus] ?? STATUS_CONFIG.pending;
                    const Icon = config.icon;
                    return (
                      <div
                        key={doc.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{doc.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className={`text-[10px] ${config.className}`}>
                                <Icon className="w-3 h-3 mr-1" />
                                {config.label}
                              </Badge>
                              {doc.chunkCount != null && (
                                <span className="text-xs text-muted-foreground">{doc.chunkCount} chunks</span>
                              )}
                              {doc.lastIndexedAt && (
                                <span className="text-xs text-muted-foreground">
                                  Indexed {new Date(doc.lastIndexedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {documents.length > 0 && (
                <DataTablePagination
                  totalItems={documents.length}
                  page={kbPage}
                  pageSize={kbPageSize}
                  onPageChange={setKbPage}
                  onPageSizeChange={setKbPageSize}
                  itemLabel="documents"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rebuild" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rebuild index</CardTitle>
              <CardDescription>
                Re-process all documents and rebuild the vector index. Use after uploading or updating content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(lastRebuildAt || indexVersion) && (
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {indexVersion && <span>Current version: {indexVersion}</span>}
                  {lastRebuildAt && (
                    <span>Last rebuild: {new Date(lastRebuildAt).toLocaleString()}</span>
                  )}
                </div>
              )}
              <Button onClick={handleRebuild} disabled={rebuilding}>
                {rebuilding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {rebuilding ? "Rebuilding…" : "Rebuild index now"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4 sm:mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Version history</CardTitle>
              <CardDescription>
                Index snapshots from each rebuild. Restore a previous version if needed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No versions yet. Run a rebuild to create the first index version.
                </p>
              ) : (
                <ul className="space-y-2">
                  {versions.map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border"
                    >
                      <div>
                        <p className="font-medium text-sm">{v.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(v.createdAt).toLocaleString()}
                          {v.documentCount != null && ` • ${v.documentCount} documents`}
                          {v.size && ` • ${v.size}`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(v.id)}
                        disabled={restoringId !== null}
                      >
                        {restoringId === v.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4 mr-1" />
                        )}
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog />
    </div>
  );
}
