import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Search, FileText, Loader2, LayoutDashboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { fetchProposals, fetchMyCollaborations } from "@/api/proposals";
import type { Proposal } from "@/api/proposals";

const GLOBAL_SEARCH_PATH = "/api/v1/customer/global-search";

export interface GlobalSearchItem {
  id: string | number;
  title: string;
  href?: string;
  type?: string;
  [key: string]: unknown;
}

interface PageConfig {
  id: string;
  label: string;
  href: string;
  keywords?: string;
}

/** Default pages when API is customer-only or fails. Filter by role so we don't show forbidden links. */
function getDefaultPages(role: string): PageConfig[] {
  const r = (role || "customer").toLowerCase();
  const all: PageConfig[] = [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", keywords: "home dashboard" },
    { id: "rfp-projects", label: "RFP Projects", href: "/rfp-projects", keywords: "rfp projects list" },
    { id: "proposals-new", label: "New Proposal", href: "/proposals/new", keywords: "new proposal create" },
    { id: "credits", label: "Credits", href: "/credits", keywords: "credits purchase" },
    { id: "knowledge-base", label: "Knowledge Base", href: "/knowledge-base", keywords: "knowledge base docs" },
    { id: "collaborators", label: "Collaborators", href: "/collaborators", keywords: "collaborators team" },
    { id: "account-settings", label: "Account Settings", href: "/account-settings", keywords: "account settings profile" },
    { id: "ai-chat", label: "AI Chat", href: "/ai-chat", keywords: "ai chat" },
    { id: "collaborator", label: "Assigned RFPs", href: "/collaborator", keywords: "collaborator assigned" },
    { id: "collaborator-analytics", label: "My Analytics", href: "/collaborator/analytics", keywords: "analytics collaborator" },
    { id: "admin", label: "Admin Dashboard", href: "/admin", keywords: "admin" },
    { id: "admin-analytics", label: "Analytics", href: "/admin/analytics", keywords: "analytics" },
    { id: "admin-users", label: "Users", href: "/admin/users", keywords: "users" },
    { id: "admin-proposals", label: "Proposals", href: "/admin/proposals", keywords: "proposals" },
  ];
  if (r === "admin") {
    return all.filter((p) => p.href.startsWith("/admin") || p.id === "account-settings" || p.id === "ai-chat");
  }
  if (r === "collaborator") {
    return all.filter((p) => p.href.startsWith("/collaborator") || p.id === "account-settings" || p.id === "ai-chat");
  }
  return all.filter((p) => !p.href.startsWith("/admin") && !p.href.startsWith("/collaborator"));
}

function matchQuery(text: string, q: string): boolean {
  if (!q.trim()) return false;
  const lower = q.trim().toLowerCase();
  return text.toLowerCase().includes(lower);
}

async function fetchPagesConfig(): Promise<PageConfig[]> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  try {
    const res = await fetch(getApiUrl(GLOBAL_SEARCH_PATH), { credentials: "include", headers });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = (data as { pages?: PageConfig[] }).pages;
    return Array.isArray(pages) ? pages : [];
  } catch {
    return [];
  }
}

function getProposalHref(proposalId: number, role: string): string {
  const r = (role || "customer").toLowerCase();
  if (r === "admin") return `/admin/proposals/${proposalId}`;
  if (r === "collaborator") return `/collaborator/rfp/${proposalId}`;
  return `/rfp/${proposalId}`;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GlobalSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { user, currentRole } = useAuth();
  const role = (currentRole || user?.role || "customer").toLowerCase();

  /** Predefined suggestions: role-only pages shown when search is empty. */
  const predefinedSuggestions = useMemo<GlobalSearchItem[]>(() => {
    return getDefaultPages(role).map((p) => ({
      id: p.id,
      title: p.label,
      href: p.href,
      type: "Page",
    }));
  }, [role]);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const [pagesConfig, proposalsList] = await Promise.all([
        fetchPagesConfig(),
        role === "collaborator"
          ? fetchMyCollaborations(user?.id).then((list) => list.map((item) => item.proposal))
          : fetchProposals().then((list) => list as Proposal[]),
      ]);

      const pages: PageConfig[] =
        pagesConfig.length > 0 ? pagesConfig : getDefaultPages(role);
      const pageItems: GlobalSearchItem[] = pages
        .filter(
          (p) =>
            matchQuery(p.label, q) || (p.keywords && matchQuery(p.keywords, q))
        )
        .map((p) => ({
          id: p.id,
          title: p.label,
          href: p.href,
          type: "Page",
        }));

      const proposalItems: GlobalSearchItem[] = (proposalsList || [])
        .filter((p: { title?: string | null }) => matchQuery((p.title ?? "").trim() || "Untitled", q))
        .map((p: { id: number; title?: string | null }) => ({
          id: `proposal-${p.id}`,
          title: (p.title ?? "").trim() || "Untitled",
          href: getProposalHref(p.id, role),
          type: "Proposal",
        }));

      setItems([...pageItems, ...proposalItems]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query, role, user?.id]);

  useEffect(() => {
    const t = setTimeout(runSearch, 200);
    return () => clearTimeout(t);
  }, [runSearch]);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("open-global-search", openHandler);
    return () => window.removeEventListener("open-global-search", openHandler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = (item: GlobalSearchItem) => {
    const href =
      item.href ??
      (typeof item.id === "number" ? getProposalHref(item.id, role) : "#");
    setOpen(false);
    setQuery("");
    setItems([]);
    if (href.startsWith("/")) navigate(href);
    else if (href !== "#") window.location.href = href;
  };

  const hasQuery = query.trim().length > 0;
  const displayItems = hasQuery ? items : predefinedSuggestions;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="sr-only">Search</DialogTitle>
        </DialogHeader>
        <div className="search-box mx-4 mb-3">
          <Search className="search-box-icon" />
          <Input
            placeholder="Search pages and proposals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9 bg-transparent"
            autoFocus
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          {!loading && hasQuery && items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </p>
          )}
          {!loading && displayItems.length > 0 && (
            <ul className="space-y-0.5">
              {!hasQuery && (
                <li key="suggestions-header" className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Suggestions
                </li>
              )}
              {displayItems.map((item) => (
                <li key={String(item.id)}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                    onClick={() => handleSelect(item)}
                  >
                    {item.type === "Proposal" ? (
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <LayoutDashboard className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate">{item.title}</span>
                    {item.type && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {item.type}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
