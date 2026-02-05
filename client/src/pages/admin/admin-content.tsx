import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfirm } from "@/hooks/use-confirm";
import { usePrompt } from "@/hooks/use-prompt";
import { fetchAdminContent } from "@/api/admin-data";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { 
  Search, 
  Plus, 
  FolderOpen,
  FileText,
  Star,
  Clock,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Tag,
  Filter,
  Grid3X3,
  List,
  BookOpen,
  Lightbulb,
  CheckCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { LucideIcon } from "lucide-react";

const CONTENT_ICON_MAP: Record<string, LucideIcon> = {
  BookOpen,
  Lightbulb,
  FileText,
  Tag,
  CheckCircle,
};

export default function AdminContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [activeTab, setActiveTab] = useState("all");
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "content"],
    queryFn: fetchAdminContent,
  });
  const contentCategoriesRaw = data?.contentCategories ?? [];
  const contentCategories = contentCategoriesRaw.map((c: { icon?: string; [k: string]: unknown }) => ({
    ...c,
    icon: CONTENT_ICON_MAP[c.icon as string] ?? FileText,
  }));
  const [contentItemsState, setContentItemsState] = useState(data?.contentItems ?? []);
  useEffect(() => {
    if (data?.contentItems != null) setContentItemsState(data.contentItems);
  }, [data?.contentItems]);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { prompt, PromptDialog } = usePrompt();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "approved":
        return { label: "Approved", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
      case "review":
        return { label: "In Review", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
      case "needs_update":
        return { label: "Needs Update", className: "bg-red-500/10 text-red-500 border-red-500/20" };
      default:
        return { label: "Draft", className: "bg-gray-500/10 text-gray-600 border-gray-500/20" };
    }
  };

  const toggleStar = async (item: { id: number; title: string; starred: boolean }) => {
    const nextStarred = !item.starred;
    setContentItemsState((items) =>
      items.map((i) => (i.id === item.id ? { ...i, starred: nextStarred } : i))
    );
    try {
      await apiRequest("PATCH", `/api/content/${item.id}`, { starred: nextStarred });
      queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
      toast({
        title: nextStarred ? "Starred" : "Unstarred",
        description: `${item.title} has been ${nextStarred ? "starred" : "unstarred"}.`,
      });
    } catch {
      setContentItemsState((items) =>
        items.map((i) => (i.id === item.id ? { ...i, starred: item.starred } : i))
      );
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  let filteredContent = contentItemsState;
  
  // Filter by tab
  if (activeTab === "starred") {
    filteredContent = filteredContent.filter(item => item.starred);
  } else if (activeTab === "recent") {
    filteredContent = [...filteredContent].sort((a, b) => {
      const dateA = new Date(a.lastUpdated || 0);
      const dateB = new Date(b.lastUpdated || 0);
      const tA = Number.isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const tB = Number.isNaN(dateB.getTime()) ? 0 : dateB.getTime();
      return tB - tA;
    }).slice(0, 10);
  }
  
  // Filter by search term (guard: title, category, tags may be missing)
  const term = (searchTerm || "").toLowerCase();
  if (term) {
    filteredContent = filteredContent.filter(item =>
      (item.title || "").toLowerCase().includes(term) ||
      (item.category || "").toLowerCase().includes(term) ||
      (item.tags || []).some((tag: string) => String(tag).toLowerCase().includes(term))
    );
  }

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  return (
    <>
      <ConfirmDialog />
      {PromptDialog}
      <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-content-title">Content Library</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 break-words">Manage reusable content blocks, templates, and knowledge base.</p>
        </div>
        <Link href="/admin/content/editor" className="w-full sm:w-auto shrink-0">
          <Button 
            className="theme-gradient-bg text-white w-full sm:w-auto" 
            data-testid="button-add-content"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Content
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 w-full max-w-full overflow-x-hidden">
        {contentCategories.map((category) => (
          <Card 
            key={category.id} 
            className="border shadow-sm hover:shadow-md transition-all cursor-pointer group w-full max-w-full overflow-x-hidden"
            data-testid={`card-category-${category.id}`}
            onClick={() => {
              setSearchTerm(category.name);
              toast({
                title: "Filtered by category",
                description: `Showing content from ${category.name}`,
              });
            }}
          >
            <CardContent className="p-3 sm:p-4 w-full max-w-full overflow-x-hidden">
              <div className="flex flex-col items-center sm:flex-row sm:items-start gap-2 sm:gap-3 w-full">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${category.color.includes('purple') ? 'bg-primary/10' : `${category.color}/10`} flex items-center justify-center shrink-0`}>
                  <category.icon
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${category.color.includes('purple') ? 'text-primary' : ''}`}
                  style={category.color.includes('purple') ? undefined : {
                    color: category.color.replace('bg-', '').replace('-500', '') === 'blue' ? '#3b82f6' : category.color.replace('bg-', '').replace('-500', '') === 'emerald' ? '#10b981' : category.color.replace('bg-', '').replace('-500', '') === 'amber' ? '#f59e0b' : '#ef4444',
                  }}
                />
                </div>
                <div className="text-center sm:text-left min-w-0 flex-1 w-full">
                  <p className="text-xs sm:text-sm font-medium group-hover:text-primary transition-colors break-words line-clamp-2">{category.name}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{category.count} items</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4 w-full max-w-full overflow-x-hidden">
          <div className="w-full sm:flex-shrink-0 overflow-x-auto overflow-y-hidden -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
            <TabsList className="bg-muted/50 inline-flex">
              <TabsTrigger value="all" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap shrink-0">
                All Content <Badge variant="secondary" className="ml-2 text-[10px]">{contentItemsState.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="starred" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap shrink-0">
                <Star className="w-3 h-3 mr-1" /> Starred <Badge variant="secondary" className="ml-2 text-[10px]">{contentItemsState.filter(i => i.starred).length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="recent" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap shrink-0">
                <Clock className="w-3 h-3 mr-1" /> Recent
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto sm:flex-shrink-0 min-w-0">
            <div className="relative flex-1 sm:flex-initial min-w-0 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full sm:w-64"
                data-testid="input-search-content"
              />
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Button 
                variant="outline" 
                size="icon" 
                data-testid="button-filter"
                className="shrink-0 h-9 w-9"
                onClick={async () => {
                  // Show filter options
                  const category = await prompt({
                    title: "Filter by Category",
                    description: "Enter a category to filter by, or leave empty to show all",
                    placeholder: "Category name",
                    defaultValue: "",
                  });
                  if (category !== null) {
                    if (category) {
                      setSearchTerm(category);
                      toast({
                        title: "Filter applied",
                        description: `Filtering by category: ${category}`,
                      });
                    } else {
                      setSearchTerm("");
                      toast({
                        title: "Filter cleared",
                        description: "Showing all content",
                      });
                    }
                  }
                }}
              >
                <Filter className="w-4 h-4" />
              </Button>
              <div className="flex items-center border rounded-lg overflow-hidden shrink-0">
                <Button 
                  variant={viewMode === "list" ? "secondary" : "ghost"} 
                  size="icon" 
                  className="rounded-none h-9 w-9"
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button 
                  variant={viewMode === "grid" ? "secondary" : "ghost"} 
                  size="icon" 
                  className="rounded-none h-9 w-9"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {(["all", "starred", "recent"] as const).map((tabValue) => (
        <TabsContent key={tabValue} value={tabValue} className="w-full max-w-full overflow-x-hidden">
          {viewMode === "list" ? (
            <Card className="border shadow-sm w-full max-w-full overflow-x-hidden">
              <CardContent className="p-0 w-full max-w-full overflow-x-hidden">
                <div className="overflow-x-auto w-full max-w-full">
                  <table className="w-full min-w-[600px]">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usage</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Updated</th>
                          <th className="text-right py-3 px-4 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContent.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 px-4">
                              <div className="flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                                  <FileText className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <p className="font-medium text-foreground mb-1">No content yet</p>
                                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                                  {activeTab === "starred"
                                    ? "Star items to see them here."
                                    : activeTab === "recent"
                                    ? "Content you've updated recently will appear here."
                                    : "Add reusable blocks, templates, or knowledge base items to get started."}
                                </p>
                                {activeTab === "all" && (
                                  <Link href="/admin/content/editor">
                                    <Button className="theme-gradient-bg text-white">
                                      <Plus className="w-4 h-4 mr-2" />
                                      Add Content
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : (
                        filteredContent.map((item) => {
                          const statusConfig = getStatusConfig(item.status);
                          return (
                            <tr 
                              key={item.id} 
                              className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                              data-testid={`row-content-${item.id}`}
                            >
                              <td className="py-3 px-4 min-w-0">
                                <div className="flex items-center gap-3 min-w-0">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStar(item);
                                    }}
                                  >
                                    <Star className={`w-4 h-4 ${item.starred ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
                                  </Button>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm truncate">{item.title}</p>
                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                      {(item.tags || []).slice(0, 3).map((tag, idx) => (
                                        <span key={idx} className="px-1.5 py-0.5 bg-muted rounded text-[10px] shrink-0">{tag}</span>
                                      ))}
                                      {(item.tags || []).length > 3 && (
                                        <span className="text-[10px] text-muted-foreground shrink-0">+{(item.tags || []).length - 3}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 min-w-0">
                                <span className="text-sm truncate block">{item.category}</span>
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className={`${statusConfig.className} text-[10px] font-medium shrink-0`}>
                                  {statusConfig.label}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 min-w-0">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{item.usageCount} times</p>
                                  <p className="text-[10px] text-muted-foreground truncate">Last: {item.lastUsed}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4 min-w-0">
                                <div className="min-w-0">
                                  <p className="text-sm truncate">{item.lastUpdated}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">by {item.author}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link href={`/admin/content/editor?id=${item.id}`} className="flex items-center">
                                        <Edit className="w-4 h-4 mr-2" /> Edit
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={async () => {
                                        try {
                                          const res = await apiRequest("GET", `/api/content/${item.id}`);
                                          const full = await res.json();
                                          await apiRequest("POST", "/api/content", {
                                            title: `${full.title} (Copy)`,
                                            category: full.category,
                                            content: full.content,
                                            tags: full.tags || [],
                                            status: full.status || "draft",
                                          });
                                          queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
                                          toast({ title: "Duplicated", description: `${item.title} has been duplicated.` });
                                        } catch {
                                          toast({ title: "Failed to duplicate", variant: "destructive" });
                                        }
                                      }}
                                    >
                                      <Copy className="w-4 h-4 mr-2" /> Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={async () => {
                                        const newTag = await prompt({
                                          title: "Add Tag",
                                          description: `Add a tag to "${item.title}"`,
                                          placeholder: "Tag name",
                                          defaultValue: "",
                                        });
                                        if (newTag && newTag.trim()) {
                                          try {
                                            const nextTags = [...(item.tags || []), newTag.trim()];
                                            await apiRequest("PATCH", `/api/content/${item.id}`, { tags: nextTags });
                                            queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
                                            toast({ title: "Tag added", description: `Tag "${newTag.trim()}" added to ${item.title}` });
                                          } catch {
                                            toast({ title: "Failed to add tag", variant: "destructive" });
                                          }
                                        }
                                      }}
                                    >
                                      <Tag className="w-4 h-4 mr-2" /> Manage Tags
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={async () => {
                                        const confirmed = await confirm({
                                          title: "Delete Content",
                                          description: `Are you sure you want to delete "${item.title}"?`,
                                          confirmText: "Delete",
                                          cancelText: "Cancel",
                                          variant: "destructive",
                                        });
                                        if (confirmed) {
                                          try {
                                            setContentItemsState(items => items.filter(i => i.id !== item.id));
                                            await apiRequest("DELETE", `/api/content/${item.id}`);
                                            queryClient.invalidateQueries({ queryKey: ["admin", "content"] });
                                            toast({
                                              title: "Deleted",
                                              description: `${item.title} has been deleted.`,
                                              variant: "destructive",
                                            });
                                          } catch (error) {
                                            toast({
                                              title: "Error",
                                              description: "Failed to delete content.",
                                              variant: "destructive",
                                            });
                                          }
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                                    </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          );
                        })
                        )}
                      </tbody>
                    </table>
                  </div>
              </CardContent>
            </Card>
          ) : filteredContent.length === 0 ? (
            <Card className="border shadow-sm w-full max-w-full overflow-x-hidden">
              <CardContent className="py-12 px-4">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-foreground mb-1">No content yet</p>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    {activeTab === "starred"
                      ? "Star items to see them here."
                      : activeTab === "recent"
                      ? "Content you've updated recently will appear here."
                      : "Add reusable blocks, templates, or knowledge base items to get started."}
                  </p>
                  {activeTab === "all" && (
                    <Link href="/admin/content/editor">
                      <Button className="theme-gradient-bg text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Content
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full max-w-full overflow-x-hidden">
              {filteredContent.map((item) => {
                const statusConfig = getStatusConfig(item.status);
                return (
                  <Link key={item.id} href={`/admin/content/editor?id=${item.id}`} className="w-full max-w-full">
                    <Card className="border shadow-sm hover:shadow-md transition-all cursor-pointer w-full max-w-full overflow-x-hidden" data-testid={`card-content-${item.id}`}>
                      <CardContent className="p-3 sm:p-4 w-full max-w-full overflow-x-hidden">
                        <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                          <Badge variant="outline" className={`${statusConfig.className} text-[10px] font-medium shrink-0`}>
                            {statusConfig.label}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleStar(item);
                            }}
                          >
                            <Star className={`w-4 h-4 ${item.starred ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
                          </Button>
                        </div>
                        <h3 className="font-medium text-sm mb-1.5 sm:mb-2 line-clamp-2 break-words">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mb-2 sm:mb-3 truncate">{item.category}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                          <span className="truncate">{item.usageCount} uses</span>
                          <span className="truncate shrink-0">{item.lastUpdated}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
        ))}
      </Tabs>
      </div>
    </>
  );
}
