import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import {
  fetchAdminKnowledgeBase,
  fetchAdminKnowledgeBaseVersions,
  rebuildAdminKnowledgeBase,
  restoreAdminKnowledgeBaseVersion,
} from "@/api/admin-data";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  indexed: { label: "Indexed", icon: CheckCircle, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  pending: { label: "Pending", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  failed: { label: "Failed", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

export default function AdminKnowledgeBase() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [rebuilding, setRebuilding] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "knowledge-base"],
    queryFn: fetchAdminKnowledgeBase,
  });

  const { data: versionsData } = useQuery({
    queryKey: ["admin", "knowledge-base-versions"],
    queryFn: fetchAdminKnowledgeBaseVersions,
  });

  const documents = data?.documents ?? [];
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Global docs, embeddings status, rebuild index, and version control.
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
              <CardTitle className="text-base">Embeddings status</CardTitle>
              <CardDescription>
                Documents from Content Library that have been indexed for search and AI. Upload docs in Content Library to include them here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No documents in the knowledge base yet. Upload content in the Content Library, then trigger a rebuild.
                </p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
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
