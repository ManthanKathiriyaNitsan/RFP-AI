import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfirm } from "@/hooks/use-confirm";
import { usePrompt } from "@/hooks/use-prompt";
import { fetchAdminContent, fetchAdminUsersList } from "@/api/admin-data";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { folderIconUrl } from "@/assets/folder-icon-url";
import { 
  Search, 
  Plus, 
  FolderOpen,
  FileText,
  Star,
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
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTablePagination } from "@/components/shared/data-table-pagination";

import type { LucideIcon } from "lucide-react";

/** Short, readable label for MIME / category name (e.g. "application/pdf" → "PDF") */
function contentCategoryLabel(name: string): string {
  if (!name) return "Other";
  const lower = name.toLowerCase();
  if (lower === "application/pdf") return "PDF";
  if (lower.includes("word") || lower.includes("document") || lower.includes("openxmlformats")) return "Word";
  if (lower === "text/plain") return "Plain text";
  if (lower.includes("sheet") || lower.includes("excel")) return "Spreadsheet";
  if (lower.includes("image")) return "Image";
  const parts = name.split("/");
  return parts.length > 1 ? parts[1].split(".").slice(0, 1).join(".") : name;
}

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
  type ContentCategory = { id: number; name: string; color: string; count: number; icon: import("lucide-react").LucideIcon };
  const contentCategories: ContentCategory[] = contentCategoriesRaw.map((c: { id?: number; name?: string; color?: string; count?: number; icon?: string; [k: string]: unknown }) => ({
    id: c.id ?? 0,
    name: (c.name as string) ?? "",
    color: (c.color as string) ?? "",
    count: (c.count as number) ?? 0,
    icon: CONTENT_ICON_MAP[c.icon as string] ?? FileText,
  }));
  const [contentItemsState, setContentItemsState] = useState(data?.contentItems ?? []);
  useEffect(() => {
    if (data?.contentItems != null) setContentItemsState(data.contentItems);
  }, [data?.contentItems]);

  const adminContentItems = useMemo(() => {
    return contentItemsState.filter(item => 
      item.authorRole === "admin" || item.authorRole === "super_admin" || !item.authorRole
    );
  }, [contentItemsState]);

  const [folderSearch, setFolderSearch] = useState("");
  const [folderSort, setFolderSort] = useState<"a-z" | "z-a">("a-z");
  const [folderViewMode, setFolderViewMode] = useState<"grid" | "list">("grid");
  const [contentPage, setContentPage] = useState(1);
  const [contentPageSize, setContentPageSize] = useState(10);
  const contentCreators = useMemo(() => {
    const byName = new Map<string, number>();
    // Only show folders for admin content
    for (const item of adminContentItems) {
      const name = (item.createdBy ?? item.author ?? "—").trim() || "—";
      byName.set(name, (byName.get(name) ?? 0) + 1);
    }
    return Array.from(byName.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [adminContentItems]);

  const filteredContentCreators = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    let list = q
      ? contentCreators.filter((c) => c.name.toLowerCase().includes(q))
      : [...contentCreators];
    list = [...list].sort((a, b) =>
      folderSort === "a-z"
        ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        : b.name.localeCompare(a.name, undefined, { sensitivity: "base" })
    );
    return list;
  }, [contentCreators, folderSearch, folderSort]);

  const { toast } = useToast();
  const { user, currentRole } = useAuth();
  const isSuperAdmin = (currentRole ?? "").toLowerCase() === "super_admin";
  const [selectedCreatorName, setSelectedCreatorName] = useState<string | null>(null);

  // Base list for counts: when super admin has a creator selected, only that creator's content
  const baseList = useMemo(() => {
    if (isSuperAdmin && selectedCreatorName != null && selectedCreatorName.trim() !== "") {
      return adminContentItems.filter(
        (item) => (item.createdBy ?? item.author ?? "—").trim() === selectedCreatorName
      );
    }
    // For super admin, show all content (customer + admin) when no creator is selected
    // For regular admin, show all content
    return contentItemsState;
  }, [contentItemsState, adminContentItems, isSuperAdmin, selectedCreatorName]);

  // Real per-category counts from baseList (so "items" reflects actual visible scope)
  const categoryCountsFromBase = useMemo(() => {
    const map = new Map<string, number>();
    const norm = (s: string) => (s ?? "").trim().toLowerCase();
    for (const item of baseList) {
      const cat = norm(item.category ?? "");
      const key = cat || "uncategorized";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [baseList]);
  const { data: allUsersRaw = [] } = useQuery({
    queryKey: ["/api/v1/users"],
    queryFn: fetchAdminUsersList,
    enabled: isSuperAdmin,
  });
  type UserRow = { id: number; email?: string; first_name?: string; last_name?: string; firstName?: string; lastName?: string; role?: string };
  const allUsers = allUsersRaw as UserRow[];
  const normalizeForMatch = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const getUserByCreatorName = (creatorName: string): UserRow | null => {
    const key = normalizeForMatch(creatorName);
    if (!key) return null;
    return allUsers.find((u) => {
      const first = (u.firstName ?? u.first_name ?? "").trim();
      const last = (u.lastName ?? u.last_name ?? "").trim();
      const nameFirstLast = [first, last].filter(Boolean).join(" ");
      const nameLastFirst = [last, first].filter(Boolean).join(" ");
      const displayNorm = normalizeForMatch(nameFirstLast);
      const displayNormReversed = normalizeForMatch(nameLastFirst);
      const emailNorm = normalizeForMatch(u.email ?? "");
      return displayNorm === key || displayNormReversed === key || emailNorm === key;
    }) ?? null;
  };
  const roleLabel = (role: string | undefined) => {
    const r = (role || "").toLowerCase();
    if (r === "admin") return "Admin";
    if (r === "super_admin") return "Super Admin";
    if (r === "collaborator") return "Collaborator";
    return "Customer";
  };
  const { confirm, ConfirmDialog } = useConfirm();
  const { prompt, PromptDialog } = usePrompt();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const creatorName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "Admin"
    : "Admin";

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

  const toggleStar = async (item: { id: number; title: string; starred: boolean; source?: string; proposalId?: number }) => {
    if (item.source === "proposal" || item.proposalId != null) return; // Proposals can't be starred
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
  }
  
  // Filter by search term (guard: title, category, tags may be missing)
  const term = (searchTerm || "").trim();
  const termLower = term.toLowerCase();
  const isCategoryFilter = term.length > 0 && contentCategories.some((c) => (c.name || "").trim().toLowerCase() === termLower);
  if (term.length > 0) {
    if (isCategoryFilter) {
      // Clicked a category card: show only items in that exact category
      filteredContent = filteredContent.filter(
        (item) => (item.category ?? "").trim().toLowerCase() === termLower
      );
    } else {
      // Typed in search box: substring match on title, category, tags
      filteredContent = filteredContent.filter(
        (item) =>
          (item.title || "").toLowerCase().includes(termLower) ||
          (item.category || "").toLowerCase().includes(termLower) ||
          (item.tags || []).some((tag: string) => String(tag).toLowerCase().includes(termLower))
      );
    }
  }

  // Super admin: when a creator is selected, show only their content
  if (isSuperAdmin && selectedCreatorName != null) {
    filteredContent = filteredContent.filter(
      (item) => (item.createdBy ?? item.author ?? "—").trim() === selectedCreatorName
    );
  }

  const paginatedContent = filteredContent.slice(
    (contentPage - 1) * contentPageSize,
    contentPage * contentPageSize
  );
  useEffect(() => {
    setContentPage(1);
  }, [searchTerm, activeTab]);

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  // Super Admin: folder view – select a creator to see their content
  if (isSuperAdmin && selectedCreatorName == null) {
    return (
      <>
        <ConfirmDialog />
        {PromptDialog}
        <div className="space-y-6 sm:space-y-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-content-title">Content Library</h1>
            <p className="text-muted-foreground text-sm mt-1">View and manage admin content.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-full">
            <Card className="border shadow-sm overflow-hidden rounded-xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <p className="text-lg font-bold tabular-nums">{contentCreators.length}</p>
                <p className="text-xs text-muted-foreground">Creators</p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm overflow-hidden rounded-xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                  <FileText className="h-4 w-4" />
                </div>
                <p className="text-lg font-bold tabular-nums">{adminContentItems.length}</p>
                <p className="text-xs text-muted-foreground">Content items</p>
              </CardContent>
            </Card>
          </div>
          {/* Admin Content Section */}
          <div className="space-y-3">
      
            {contentCreators.length > 0 && (
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
                  <Button variant={folderViewMode === "grid" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setFolderViewMode("grid")} title="Grid view">
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button variant={folderViewMode === "list" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setFolderViewMode("list")} title="List view">
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            {contentCreators.length === 0 ? (
              <Card className="border shadow-sm overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FolderOpen className="w-10 h-10 text-muted-foreground mb-3" />
                    <h3 className="text-base font-semibold mb-1">No admin content yet</h3>
                    <p className="text-sm text-muted-foreground">Content created by admins will appear here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : filteredContentCreators.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No creators match your search.</p>
            ) : folderViewMode === "list" ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <ul className="divide-y divide-border">
                  {filteredContentCreators.map(({ name, count }) => {
                    const u = getUserByCreatorName(name);
                    const role = u ? roleLabel(u.role) : "Creator";
                    return (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => setSelectedCreatorName(name)}
                          className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          data-testid={`folder-creator-${name.replace(/\s+/g, "-")}`}
                        >
                          <img src={folderIconUrl} alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground truncate">{name}</p>
                            {u?.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{role}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{count} item{count !== 1 ? "s" : ""}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <TooltipProvider>
                <div className="flex flex-wrap gap-2 sm:gap-2">
                  {filteredContentCreators.map(({ name, count }) => (
                    <Tooltip key={name}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSelectedCreatorName(name)}
                          className="flex flex-col items-center gap-2 w-24 sm:w-28 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg p-2 transition-colors hover:bg-muted/50"
                          data-testid={`folder-creator-${name.replace(/\s+/g, "-")}`}
                        >
                          <img
                            src={folderIconUrl}
                            alt=""
                            className="w-12 h-12 sm:w-14 sm:h-14 object-contain group-hover:scale-105 transition-transform"
                          />
                          <span className="text-sm font-medium text-foreground text-center line-clamp-2 break-words w-full">
                            {name}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p className="font-medium">{name}</p>
                        {(() => {
                          const u = getUserByCreatorName(name);
                          const role = u ? roleLabel(u.role) : "Creator";
                          return (
                            <>
                              <p className="text-muted-foreground text-xs mt-0.5">
                                <span className="font-medium text-foreground/90">Role:</span> {role}
                              </p>
                              {u?.email && (
                                <p className="text-muted-foreground text-xs mt-0.5">
                                  <span className="font-medium text-foreground/90">Email:</span> {u.email}
                                </p>
                              )}
                              <p className="text-muted-foreground text-xs mt-0.5">{count} item{count !== 1 ? "s" : ""}</p>
                            </>
                          );
                        })()}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ConfirmDialog />
      {PromptDialog}
      <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          {isSuperAdmin && selectedCreatorName != null && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedCreatorName(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              All creators
            </Button>
          )}
          <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-content-title">
            {isSuperAdmin && selectedCreatorName != null ? `Content Library · ${selectedCreatorName}` : "Content Library"}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 break-words">
            {isSuperAdmin && selectedCreatorName != null
              ? `Content added by ${selectedCreatorName}.`
              : "Manage reusable content blocks, templates, and knowledge base."}
          </p>
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

      <div className="flex flex-wrap gap-2 w-full max-w-full overflow-x-hidden">
        {/* All – show everything; no category filter */}
        <Card
          className={`border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group shrink-0 ${!searchTerm ? "border-primary/40 ring-1 ring-primary/20" : "border-border/80 hover:border-primary/20"}`}
          data-testid="card-category-all"
          onClick={() => {
            setSearchTerm("");
            if (searchTerm) toast({ title: "Showing all", description: "All content types." });
          }}
        >
          <CardContent className="px-3 py-2 sm:px-3.5 sm:py-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Grid3X3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">All</p>
                <p className="text-[10px] text-muted-foreground">{baseList.length} items</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Category filters – from API so new content types appear automatically; hide "Other" / Uncategorized to avoid showing all data when clicked */}
        {contentCategories
          .filter((category) => {
            const label = contentCategoryLabel(category.name);
            const nameLower = (category.name ?? "").trim().toLowerCase();
            return label !== "Other" && nameLower !== "" && nameLower !== "uncategorized";
          })
          .map((category) => {
          const iconColor = category.color.includes("purple")
            ? "text-primary"
            : category.color.includes("blue")
              ? "text-blue-500"
              : category.color.includes("emerald")
                ? "text-emerald-500"
                : category.color.includes("amber")
                  ? "text-amber-500"
                  : "text-red-500";
          const bgColor = category.color.includes("purple")
            ? "bg-primary/10"
            : category.color.includes("blue")
              ? "bg-blue-500/10"
              : category.color.includes("emerald")
                ? "bg-emerald-500/10"
                : category.color.includes("amber")
                  ? "bg-amber-500/10"
                  : "bg-red-500/10";
          const label = contentCategoryLabel(category.name);
          const isActive = searchTerm === category.name;
          return (
            <Card
              key={category.id}
              className={`border rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group shrink-0 ${isActive ? "border-primary/40 ring-1 ring-primary/20" : "border-border/80 hover:border-primary/20"}`}
              data-testid={`card-category-${category.id}`}
              onClick={() => {
                setSearchTerm(category.name);
                toast({ title: "Filtered", description: `Showing ${label}.` });
              }}
            >
              <CardContent className="px-3 py-2 sm:px-3.5 sm:py-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgColor} ${iconColor} group-hover:scale-105 transition-transform`}>
                    <category.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate" title={category.name}>
                      {label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {(() => {
                        const norm = (s: string) => (s ?? "").trim().toLowerCase();
                        const key = norm(category.name) || "uncategorized";
                        const count = categoryCountsFromBase.get(key) ?? 0;
                        return `${count} ${count === 1 ? "item" : "items"}`;
                      })()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4 w-full max-w-full overflow-x-hidden">
          <div className="w-full sm:flex-shrink-0 overflow-x-auto overflow-y-hidden -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible">
            <TabsList className="bg-muted/50 inline-flex">
              <TabsTrigger value="all" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap shrink-0">
                All Content <Badge variant="secondary" className="ml-2 text-[10px] text-primary-foreground">{baseList.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="starred" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap shrink-0">
                <Star className="w-3 h-3 mr-1" /> Starred <Badge variant="secondary" className="ml-2 text-[10px] text-primary-foreground">{baseList.filter(i => i.starred).length}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto sm:flex-shrink-0 min-w-0">
            <div className="search-box flex-1 sm:flex-initial min-w-0 sm:min-w-[200px] w-full sm:w-64">
              <Search className="search-box-icon" />
              <Input
                placeholder="Search content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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

        {(["all", "starred"] as const).map((tabValue) => (
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
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created by</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Updated</th>
                          <th className="text-right py-3 px-4 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContent.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 px-4">
                              <div className="flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                                  <FileText className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <p className="font-medium text-foreground mb-1">No content yet</p>
                                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                                  {activeTab === "starred"
                                    ? "Star items to see them here."
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
                        paginatedContent.map((item) => {
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
                                    disabled={(item as { source?: string }).source === "proposal"}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStar(item);
                                    }}
                                    title={(item as { source?: string }).source === "proposal" ? "Proposals can't be starred" : (item.starred ? "Unstar" : "Star")}
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
                                <span className="text-sm truncate block">{item.createdBy ?? item.author ?? "—"}</span>
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
                                    {(item as { source?: string; proposalId?: number }).source === "proposal" && (item as { proposalId?: number }).proposalId != null ? (
                                      <DropdownMenuItem asChild>
                                        <Link href={`/admin/proposals/${(item as { proposalId: number }).proposalId}`} className="flex items-center">
                                          <FileText className="w-4 h-4 mr-2" /> View proposal
                                        </Link>
                                      </DropdownMenuItem>
                                    ) : (
                                      <>
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
                                                author: creatorName,
                                                createdBy: creatorName,
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
                                      </>
                                    )}
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
              {paginatedContent.map((item) => {
                const statusConfig = getStatusConfig(item.status);
                const isProposal = (item as { source?: string; proposalId?: number }).source === "proposal" && (item as { proposalId?: number }).proposalId != null;
                const href = isProposal ? `/admin/proposals/${(item as { proposalId: number }).proposalId}` : `/admin/content/editor?id=${item.id}`;
                return (
                  <Link key={item.id} href={href} className="w-full max-w-full">
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
                            disabled={isProposal}
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
          {filteredContent.length > 0 && (
            <DataTablePagination
              totalItems={filteredContent.length}
              page={contentPage}
              pageSize={contentPageSize}
              onPageChange={setContentPage}
              onPageSizeChange={setContentPageSize}
              itemLabel="items"
            />
          )}
        </TabsContent>
        ))}
      </Tabs>
      </div>
    </>
  );
}
