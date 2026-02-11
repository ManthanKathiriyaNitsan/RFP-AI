import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, Plus, Archive, Trash2, Users, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";
import { fetchAdminOrganizations } from "@/api/admin-data";

type Organization = {
  id: number;
  name: string;
  customerIds: number[];
  archived: boolean;
  settings?: Record<string, unknown>;
};

export default function AdminOrganizations() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [localOrgs, setLocalOrgs] = useState<Organization[]>([]);
  const [nextId, setNextId] = useState(100);

  const { data: apiOrgs = [], isError, error, refetch } = useQuery({
    queryKey: ["admin", "organizations"],
    queryFn: fetchAdminOrganizations,
  });
  const organizations: Organization[] = [
    ...(Array.isArray(apiOrgs) ? apiOrgs : []),
    ...localOrgs,
  ].filter(Boolean);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: "Enter a name", variant: "destructive" });
      return;
    }
    try {
      const token = authStorage.getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(getApiUrl("/api/v1/admin/organizations"), {
        method: "POST",
        headers,
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
        setNewName("");
        setCreateOpen(false);
        toast({ title: "Organization created", description: name });
      } else {
        const body = await res.json().catch(() => ({}));
        const detail = body?.detail ?? body?.message;
        if (res.status === 503 && detail) {
          toast({ title: "Database schema update required", description: String(detail), variant: "destructive" });
        } else {
          const id = nextId;
          setNextId((n) => n + 1);
          setLocalOrgs((prev) => [...prev, { id, name, customerIds: [], archived: false }]);
          toast({ title: "Organization added", description: "Backend not connected; added locally." });
        }
        setNewName("");
        setCreateOpen(false);
      }
    } catch {
      const id = nextId;
      setNextId((n) => n + 1);
      setLocalOrgs((prev) => [...prev, { id, name, customerIds: [], archived: false }]);
      setNewName("");
      setCreateOpen(false);
      toast({ title: "Organization added", description: "Backend not connected; added locally." });
    }
  };

  const handleArchive = (org: Organization) => {
    if (org.archived) {
      toast({ title: "Already archived" });
      return;
    }
    if (localOrgs.some((o) => o.id === org.id)) {
      setLocalOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, archived: true } : o)));
      toast({ title: "Archived", description: org.name });
    } else {
      toast({ title: "Archive", description: "Connect backend to persist archive." });
    }
  };

  const handleDelete = (org: Organization) => {
    if (localOrgs.some((o) => o.id === org.id)) {
      setLocalOrgs((prev) => prev.filter((o) => o.id !== org.id));
      toast({ title: "Deleted", description: org.name, variant: "destructive" });
    } else {
      toast({ title: "Delete", description: "Connect backend to persist delete." });
    }
  };

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create organizations, assign customers, and manage organization-level settings.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create organization
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All organizations</CardTitle>
          <CardDescription>Assign customers to organizations from Users & Teams when backend is connected.</CardDescription>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No organizations yet. Create one to get started.</p>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <Link href={`/admin/organizations/${org.id}`} className="font-medium hover:underline">
                        {org.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {org.customerIds?.length ?? 0} customer{(org.customerIds?.length ?? 0) !== 1 ? "s" : ""} assigned
                        </span>
                        {org.archived && <Badge variant="secondary">Archived</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/admin/organizations/${org.id}`}>
                      <Button variant="outline" size="sm">
                        <Settings className="w-4 h-4 mr-1" />
                        Settings
                      </Button>
                    </Link>
                    {!org.archived && (
                      <Button variant="outline" size="sm" onClick={() => handleArchive(org)}>
                        <Archive className="w-4 h-4 mr-1" />
                        Archive
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(org)}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>Add a new organization. You can assign customers to it from Users & Teams.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
