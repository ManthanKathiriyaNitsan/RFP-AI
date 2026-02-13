import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchAdminOptions,
  fetchAdminUsersList,
  addProposalCategory,
  updateProposalCategory,
  deleteProposalCategory,
  addIndustry,
  updateIndustry,
  deleteIndustry,
  type OptionItem,
} from "@/api/admin-data";
import { Tag, Building2, Plus, Pencil, Trash2, Loader2, ArrowLeft, FolderOpen, Search, Grid3X3, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AdminFolder = { id: number; name: string; email?: string; role?: string };

export default function AdminProposalOptions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { currentRole } = useAuth();
  const isSuperAdmin = (currentRole ?? "").toLowerCase() === "super_admin";
  const [selectedAdmin, setSelectedAdmin] = useState<AdminFolder | null>(null);
  const [folderSearch, setFolderSearch] = useState("");
  const [folderSort, setFolderSort] = useState<"a-z" | "z-a">("a-z");
  const [folderViewMode, setFolderViewMode] = useState<"grid" | "list">("grid");

  const { data: usersRaw = [] } = useQuery({
    queryKey: ["/api/v1/users"],
    queryFn: fetchAdminUsersList,
    enabled: isSuperAdmin,
  });
  const adminFolders = useMemo(() => {
    const list = Array.isArray(usersRaw) ? usersRaw : [];
    type U = { id: number; email?: string; first_name?: string; last_name?: string; firstName?: string; lastName?: string; role?: string };
    return list
      .filter((u: U) => {
        const r = (u.role ?? "").toLowerCase();
        return r === "admin" || r === "super_admin";
      })
      .map((u: U) => {
        const first = (u.firstName ?? u.first_name ?? "").trim();
        const last = (u.lastName ?? u.last_name ?? "").trim();
        const name = [first, last].filter(Boolean).join(" ") || (u.email ?? "") || `Admin ${u.id}`;
        return { id: u.id, name, email: u.email, role: u.role };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [usersRaw]);

  const filteredAdminFolders = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    let list = adminFolders;
    if (q) {
      list = list.filter((a) => a.name.toLowerCase().includes(q) || (a.email ?? "").toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      const c = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      return folderSort === "z-a" ? -c : c;
    });
    return list;
  }, [adminFolders, folderSearch, folderSort]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const categories = data?.proposalCategories ?? [];
  const industries = data?.industries ?? [];

  const [categoryDialog, setCategoryDialog] = useState<"add" | { edit: OptionItem } | null>(null);
  const [industryDialog, setIndustryDialog] = useState<"add" | { edit: OptionItem } | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  const openAddCategory = () => {
    setNewLabel("");
    setNewValue("");
    setCategoryDialog("add");
  };
  const openEditCategory = (item: OptionItem) => {
    setNewLabel(item.label);
    setNewValue(item.value);
    setCategoryDialog({ edit: item });
  };
  const openAddIndustry = () => {
    setNewLabel("");
    setNewValue("");
    setIndustryDialog("add");
  };
  const openEditIndustry = (item: OptionItem) => {
    setNewLabel(item.label);
    setNewValue(item.value);
    setIndustryDialog({ edit: item });
  };

  const handleSaveCategory = async () => {
    const label = newLabel.trim();
    const value = (categoryDialog === "add" ? newValue.trim().toLowerCase().replace(/\s+/g, "-") : (categoryDialog as { edit: OptionItem }).edit.value) || label.toLowerCase().replace(/\s+/g, "-");
    if (!label) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    if (categoryDialog === "add" && !value) {
      toast({ title: "Value required", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (categoryDialog === "add") {
      const added = await addProposalCategory({ value, label });
      setSaving(false);
      if (added) {
        qc.invalidateQueries({ queryKey: ["admin", "options"] });
        qc.invalidateQueries({ queryKey: ["proposal-options"] });
        setCategoryDialog(null);
        toast({ title: "Category added", description: label });
      } else {
        toast({ title: "Failed to add category", variant: "destructive" });
      }
    } else {
      const edited = categoryDialog as { edit: OptionItem };
      const updated = await updateProposalCategory(edited.edit.value, label);
      setSaving(false);
      if (updated) {
        qc.invalidateQueries({ queryKey: ["admin", "options"] });
        qc.invalidateQueries({ queryKey: ["proposal-options"] });
        setCategoryDialog(null);
        toast({ title: "Category updated", description: label });
      } else {
        toast({ title: "Failed to update category", variant: "destructive" });
      }
    }
  };

  const handleDeleteCategory = async (item: OptionItem) => {
    const ok = await confirm({ title: "Delete category?", description: `Remove "${item.label}"? Proposals using it will keep the value but it won't appear in the dropdown.` });
    if (!ok) return;
    const deleted = await deleteProposalCategory(item.value);
    if (deleted) {
      qc.invalidateQueries({ queryKey: ["admin", "options"] });
      qc.invalidateQueries({ queryKey: ["proposal-options"] });
      toast({ title: "Category removed", variant: "destructive" });
    } else {
      toast({ title: "Failed to delete category", variant: "destructive" });
    }
  };

  const handleSaveIndustry = async () => {
    const label = newLabel.trim();
    const value = (industryDialog === "add" ? newValue.trim().toLowerCase().replace(/\s+/g, "-") : (industryDialog as { edit: OptionItem }).edit.value) || label.toLowerCase().replace(/\s+/g, "-");
    if (!label) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    if (industryDialog === "add" && !value) {
      toast({ title: "Value required", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (industryDialog === "add") {
      const added = await addIndustry({ value, label });
      setSaving(false);
      if (added) {
        qc.invalidateQueries({ queryKey: ["admin", "options"] });
        qc.invalidateQueries({ queryKey: ["proposal-options"] });
        setIndustryDialog(null);
        toast({ title: "Industry added", description: label });
      } else {
        toast({ title: "Failed to add industry", variant: "destructive" });
      }
    } else {
      const edited = industryDialog as { edit: OptionItem };
      const updated = await updateIndustry(edited.edit.value, label);
      setSaving(false);
      if (updated) {
        qc.invalidateQueries({ queryKey: ["admin", "options"] });
        qc.invalidateQueries({ queryKey: ["proposal-options"] });
        setIndustryDialog(null);
        toast({ title: "Industry updated", description: label });
      } else {
        toast({ title: "Failed to update industry", variant: "destructive" });
      }
    }
  };

  const handleDeleteIndustry = async (item: OptionItem) => {
    const ok = await confirm({ title: "Delete industry?", description: `Remove "${item.label}"? Proposals using it will keep the value but it won't appear in the dropdown.` });
    if (!ok) return;
    const deleted = await deleteIndustry(item.value);
    if (deleted) {
      qc.invalidateQueries({ queryKey: ["admin", "options"] });
      qc.invalidateQueries({ queryKey: ["proposal-options"] });
      toast({ title: "Industry removed", variant: "destructive" });
    } else {
      toast({ title: "Failed to delete industry", variant: "destructive" });
    }
  };

  // Super admin: folder view – same layout as Proposals page (title, subtitle, folders only, no card)
  if (isSuperAdmin && selectedAdmin == null) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <ConfirmDialog />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-proposal-options-title">Proposal Options</h1>
          <p className="text-muted-foreground text-sm mt-1">Select an admin to manage categories and industries for proposal forms.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-full">
          <Card className="border shadow-sm overflow-hidden rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <FolderOpen className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold tabular-nums">{adminFolders.length}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm overflow-hidden rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <Tag className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold tabular-nums">{categories.length}</p>
              <p className="text-xs text-muted-foreground">Categories</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm overflow-hidden rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <Building2 className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold tabular-nums">{industries.length}</p>
              <p className="text-xs text-muted-foreground">Industries</p>
            </CardContent>
          </Card>
        </div>
        {adminFolders.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search admins..."
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
              <Button
                variant={folderViewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="rounded-none h-9 w-9"
                onClick={() => setFolderViewMode("grid")}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={folderViewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="rounded-none h-9 w-9"
                onClick={() => setFolderViewMode("list")}
                title="List view"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
        {adminFolders.length === 0 ? (
          <Card className="border shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No admins found</h3>
                <p className="text-muted-foreground">There are no admin users yet.</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredAdminFolders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No admins match your search.</p>
        ) : folderViewMode === "list" ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <ul className="divide-y divide-border">
              {filteredAdminFolders.map((admin) => (
                <li key={admin.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedAdmin(admin)}
                    className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    data-testid={`folder-admin-${admin.id}`}
                  >
                    <img src="/icons8-folder-48.png" alt="" className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">{admin.name}</p>
                      {admin.email && <p className="text-xs text-muted-foreground truncate">{admin.email}</p>}
                    </div>
                    {admin.role && <span className="text-xs text-muted-foreground shrink-0">{admin.role}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 sm:gap-2">
            {filteredAdminFolders.map((admin) => (
              <button
                key={admin.id}
                type="button"
                onClick={() => setSelectedAdmin(admin)}
                className="flex flex-col items-center gap-2 w-24 sm:w-28 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg p-2 transition-colors hover:bg-muted/50"
                data-testid={`folder-admin-${admin.id}`}
              >
                <img
                  src="/icons8-folder-48.png"
                  alt=""
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain group-hover:scale-105 transition-transform"
                />
                <span className="text-sm font-medium text-foreground text-center line-clamp-2 break-words w-full">
                  {admin.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ConfirmDialog />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          {isSuperAdmin && selectedAdmin != null && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => setSelectedAdmin(null)}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              All admins
            </Button>
          )}
          <h1 className="text-xl sm:text-2xl font-bold">
            {isSuperAdmin && selectedAdmin != null ? `Proposal Options · ${selectedAdmin.name}` : "Proposal Options"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isSuperAdmin && selectedAdmin != null
              ? "Manage categories and industries for this admin."
              : "Manage Category and Industry options used in proposal and RFP forms. These appear in the dropdowns when creating or editing proposals."}
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Tag className="w-4 h-4 shrink-0" />
              Categories
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">Options for the &quot;Category&quot; field (e.g. Technology, Healthcare).</CardDescription>
          </div>
          <Button size="sm" onClick={openAddCategory} className="w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4 mr-1.5" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2 sm:pt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Loading…
            </p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No categories yet. Add one to show in the proposal form.</p>
          ) : (
            <ul className="space-y-2">
              {categories.map((item) => (
                <li
                  key={item.value}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 px-3 sm:px-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-baseline gap-2 min-w-0 flex-1">
                    <span className="font-medium text-foreground truncate">{item.label}</span>
                    <span className="text-xs text-muted-foreground font-mono shrink-0 tabular-nums">{item.value}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 ml-auto sm:ml-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEditCategory(item)} aria-label="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" onClick={() => handleDeleteCategory(item)} aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-2 sm:pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Building2 className="w-4 h-4 shrink-0" />
              Industries
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">Options for the &quot;Industry&quot; field (e.g. Financial Services, Retail).</CardDescription>
          </div>
          <Button size="sm" onClick={openAddIndustry} className="w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4 mr-1.5" />
            Add
          </Button>
        </CardHeader>
        <CardContent className="p-4 sm:p-5 pt-2 sm:pt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2 py-4">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Loading…
            </p>
          ) : industries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No industries yet. Add one to show in the proposal form.</p>
          ) : (
            <ul className="space-y-2">
              {industries.map((item) => (
                <li
                  key={item.value}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 px-3 sm:px-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-baseline gap-2 min-w-0 flex-1">
                    <span className="font-medium text-foreground truncate">{item.label}</span>
                    <span className="text-xs text-muted-foreground font-mono shrink-0 tabular-nums">{item.value}</span>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 ml-auto sm:ml-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEditIndustry(item)} aria-label="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" onClick={() => handleDeleteIndustry(item)} aria-label="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Category add/edit dialog */}
      <Dialog open={categoryDialog !== null} onOpenChange={(open) => !open && setCategoryDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDialog === "add" ? "Add category" : "Edit category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Label (display text)</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Technology" className="mt-1.5" />
            </div>
            {categoryDialog === "add" && (
              <div>
                <Label>Value (internal, lowercase, no spaces)</Label>
                <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="e.g. technology" className="mt-1.5 font-mono text-sm" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(null)}>Cancel</Button>
            <Button onClick={handleSaveCategory} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Industry add/edit dialog */}
      <Dialog open={industryDialog !== null} onOpenChange={(open) => !open && setIndustryDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{industryDialog === "add" ? "Add industry" : "Edit industry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Label (display text)</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Financial Services" className="mt-1.5" />
            </div>
            {industryDialog === "add" && (
              <div>
                <Label>Value (internal, lowercase, no spaces)</Label>
                <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="e.g. finance" className="mt-1.5 font-mono text-sm" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIndustryDialog(null)}>Cancel</Button>
            <Button onClick={handleSaveIndustry} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
