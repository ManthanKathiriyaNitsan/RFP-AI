import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, FileText, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";

const GLOBAL_SEARCH_PATH = "/api/v1/customer/global-search";

export interface GlobalSearchItem {
  id: string | number;
  title: string;
  href?: string;
  type?: string;
  [key: string]: unknown;
}

async function fetchGlobalSearch(query: string): Promise<GlobalSearchItem[]> {
  if (!query.trim()) return [];
  const url = getApiUrl(`${GLOBAL_SEARCH_PATH}?q=${encodeURIComponent(query.trim())}`);
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { credentials: "include", headers });
  if (!res.ok) return [];
  const data = await res.json();
  if (Array.isArray(data)) return data as GlobalSearchItem[];
  return (data as { items?: GlobalSearchItem[] }).items ?? [];
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<GlobalSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const runSearch = useCallback(async () => {
    if (!query.trim()) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchGlobalSearch(query);
      setItems(result);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

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
    const href = item.href ?? (typeof item.id === "number" ? `/rfp/${item.id}` : "#");
    setOpen(false);
    setQuery("");
    setItems([]);
    if (href.startsWith("/")) navigate(href);
    else if (href !== "#") window.location.href = href;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="sr-only">Search</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 px-4 pb-3 border-b">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search proposals..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
            autoFocus
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}
          {!loading && query.trim() && items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
          )}
          {!loading && items.length > 0 && (
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={String(item.id)}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                    onClick={() => handleSelect(item)}
                  >
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{item.title}</span>
                    {item.type && (
                      <span className="text-xs text-muted-foreground shrink-0">{item.type}</span>
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
