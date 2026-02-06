import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchAdminTerms, fetchAdminOptions } from "@/api/admin-data";
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Users,
  Shield,
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { softBadgeClasses } from "@/lib/badge-classes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Term {
  id: number;
  title: string;
  content: string;
  version: string;
  status: "active" | "draft" | "archived";
  type: "terms_of_service" | "privacy_policy" | "user_agreement" | "data_processing";
  createdAt: string;
  updatedAt: string;
  requiresAcceptance: boolean;
}

export default function AdminUsersTerms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: termsData, isError, error, refetch } = useQuery({
    queryKey: ["admin", "terms"],
    queryFn: fetchAdminTerms,
  });
  const [terms, setTerms] = useState<Term[]>([]);
  useEffect(() => {
    if (Array.isArray(termsData) && termsData.length) setTerms(termsData as Term[]);
  }, [termsData]);
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const termTypes = optionsData?.termTypes ?? [
    { value: "terms_of_service", label: "Terms of Service" },
    { value: "privacy_policy", label: "Privacy Policy" },
    { value: "user_agreement", label: "User Agreement" },
    { value: "data_processing", label: "Data Processing Agreement" },
  ];
  const [selectedTerm, setSelectedTerm] = useState<Term | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingTerm, setViewingTerm] = useState<Term | null>(null);
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "terms_of_service" as Term["type"],
    requiresAcceptance: true,
  });

  const getStatusConfig = (status: Term["status"]) => {
    switch (status) {
      case "active":
        return { label: "Active", icon: CheckCircle, className: softBadgeClasses.success };
      case "draft":
        return { label: "Draft", icon: Clock, className: softBadgeClasses.warning };
      case "archived":
        return { label: "Archived", icon: XCircle, className: softBadgeClasses.archived };
    }
  };

  const getTypeLabel = (type: Term["type"]) => {
    switch (type) {
      case "terms_of_service":
        return "Terms of Service";
      case "privacy_policy":
        return "Privacy Policy";
      case "user_agreement":
        return "User Agreement";
      case "data_processing":
        return "Data Processing Agreement";
    }
  };

  const handleCreate = () => {
    const newTerm: Term = {
      id: terms.length + 1,
      title: formData.title,
      content: formData.content,
      version: "1.0",
      status: "draft",
      type: formData.type,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      requiresAcceptance: formData.requiresAcceptance,
    };
    setTerms([...terms, newTerm]);
    setIsCreateDialogOpen(false);
    setFormData({ title: "", content: "", type: "terms_of_service", requiresAcceptance: true });
    toast({
      title: "Term created",
      description: `${formData.title} has been created successfully.`,
    });
  };

  const handleEdit = (term: Term) => {
    setSelectedTerm(term);
    setFormData({
      title: term.title,
      content: term.content,
      type: term.type,
      requiresAcceptance: term.requiresAcceptance,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTerm) return;
    
    const updatedTerms = terms.map(t => 
      t.id === selectedTerm.id 
        ? {
            ...t,
            title: formData.title,
            content: formData.content,
            type: formData.type,
            requiresAcceptance: formData.requiresAcceptance,
            version: t.status === "active" ? `${parseFloat(t.version) + 0.1}`.slice(0, 3) : t.version,
            updatedAt: new Date().toISOString().split('T')[0],
          }
        : t
    );
    setTerms(updatedTerms);
    setIsEditDialogOpen(false);
    setSelectedTerm(null);
    toast({
      title: "Term updated",
      description: `${formData.title} has been updated successfully.`,
    });
  };

  const { confirm, ConfirmDialog } = useConfirm();

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "Delete Term",
      description: "Are you sure you want to delete this term? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (confirmed) {
      setTerms(terms.filter(t => t.id !== id));
      toast({
        title: "Term deleted",
        description: "The term has been deleted successfully.",
        variant: "destructive",
      });
    }
  };

  const handlePublish = (term: Term) => {
    const updatedTerms = terms.map(t => 
      t.id === term.id 
        ? { ...t, status: "active" as const, updatedAt: new Date().toISOString().split('T')[0] }
        : t.type === term.type && t.status === "active"
        ? { ...t, status: "archived" as const }
        : t
    );
    setTerms(updatedTerms);
    toast({
      title: "Term published",
      description: `${term.title} is now active.`,
    });
  };

  const handleArchive = (term: Term) => {
    const updatedTerms = terms.map(t => 
      t.id === term.id 
        ? { ...t, status: "archived" as const, updatedAt: new Date().toISOString().split('T')[0] }
        : t
    );
    setTerms(updatedTerms);
    toast({
      title: "Term archived",
      description: `${term.title} has been archived.`,
    });
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
      <ConfirmDialog />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Terms & Policies</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Manage terms of service, privacy policies, and user agreements
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="theme-gradient-bg text-white w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Create New Term
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-base">Create New Term</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Create a new terms document for your users
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-xs sm:text-sm">Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Terms of Service"
                  className="text-sm sm:text-base mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Type</Label>
                <Select value={formData.type} onValueChange={(v: Term["type"]) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {termTypes.map((opt: { value: string; label: string }) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter the full text of the terms..."
                  className="min-h-[200px] sm:min-h-[300px] text-sm sm:text-base mt-1.5"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="requires-acceptance" className="text-xs sm:text-sm">Requires User Acceptance</Label>
                <Switch
                  id="requires-acceptance"
                  checked={formData.requiresAcceptance}
                  onCheckedChange={(checked) => setFormData({ ...formData, requiresAcceptance: checked })}
                  className="shrink-0"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="w-full sm:w-auto text-xs sm:text-sm">
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formData.title || !formData.content} className="w-full sm:w-auto text-xs sm:text-sm">
                Create Term
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="terms" className="w-full">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 flex justify-start sm:px-0">
          <TabsList className="bg-muted/50 overflow-y-hidden inline-flex w-max min-w-full sm:w-auto justify-start">
            <TabsTrigger value="terms" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" /> <span className="hidden sm:inline">Terms & Policies</span><span className="sm:hidden">Terms</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-background text-xs sm:text-sm whitespace-nowrap">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 shrink-0" /> <span className="hidden sm:inline">User Management</span><span className="sm:hidden">Users</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="terms" className="mt-4 sm:mt-6">
          <div className="space-y-3 sm:space-y-4">
            {terms.map((term) => {
              const statusConfig = getStatusConfig(term.status);
              const StatusIcon = statusConfig.icon;
              return (
                <Card key={term.id} className="border shadow-sm">
                  <CardContent className="p-4 sm:p-6">
                    <div className={`flex ${isMobile ? 'flex-col' : 'items-start justify-between'} gap-4`}>
                      <div className="flex-1 min-w-0">
                        <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2 sm:gap-3 mb-2 flex-wrap`}>
                          <h3 className="font-semibold text-base sm:text-lg">{term.title}</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={`${statusConfig.className} text-[10px] sm:text-xs`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] sm:text-xs">{getTypeLabel(term.type)}</Badge>
                            <Badge variant="outline" className="text-[10px] sm:text-xs">v{term.version}</Badge>
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">
                          {term.content}
                        </p>
                        <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground`}>
                          <span>Created: {term.createdAt}</span>
                          {!isMobile && <span>•</span>}
                          <span>Updated: {term.updatedAt}</span>
                          {term.requiresAcceptance && (
                            <>
                              {!isMobile && <span>•</span>}
                              <Badge variant="outline" className="text-[10px]">
                                <Shield className="w-3 h-3 mr-1" />
                                Requires Acceptance
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`flex ${isMobile ? 'flex-wrap' : 'items-center'} gap-2 shrink-0`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs sm:text-sm"
                          onClick={() => {
                            setViewingTerm(term);
                            setIsViewDialogOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1 sm:mr-2" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs sm:text-sm"
                          onClick={() => handleEdit(term)}
                        >
                          <Edit className="w-4 h-4 mr-1 sm:mr-2" />
                          Edit
                        </Button>
                        {term.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs sm:text-sm"
                            onClick={() => handlePublish(term)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1 sm:mr-2" />
                            Publish
                          </Button>
                        )}
                        {term.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs sm:text-sm"
                            onClick={() => handleArchive(term)}
                          >
                            Archive
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive text-xs sm:text-sm"
                          onClick={() => handleDelete(term.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-4 sm:mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-sm sm:text-base">User Acceptance Tracking</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Monitor which users have accepted the current terms and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3 sm:space-y-4">
                {terms
                  .filter(t => t.status === "active" && t.requiresAcceptance)
                  .map((term) => (
                    <div key={term.id} className="p-3 sm:p-4 border rounded-lg">
                      <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-3 mb-3`}>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm sm:text-base">{term.title}</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">Version {term.version}</p>
                        </div>
                        <Badge className="text-[10px] sm:text-xs shrink-0">1,234 accepted</Badge>
                      </div>
                      <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2`}>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1 sm:flex-initial text-xs sm:text-sm"
                          onClick={() => {
                            toast({
                              title: "View Acceptances",
                              description: `Showing users who have accepted ${term.title} version ${term.version}`,
                            });
                          }}
                        >
                          View Acceptances
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1 sm:flex-initial text-xs sm:text-sm"
                          onClick={() => {
                            toast({
                              title: "Reminder sent",
                              description: `Reminder emails sent to users who haven't accepted ${term.title}`,
                            });
                          }}
                        >
                          Send Reminder
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base">{viewingTerm?.title || "View Term"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {viewingTerm && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {(() => {
                    const statusConfig = getStatusConfig(viewingTerm.status);
                    const StatusIcon = statusConfig.icon;
                    return (
                      <Badge variant="outline" className={`${statusConfig.className} text-[10px] sm:text-xs`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    );
                  })()}
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">{getTypeLabel(viewingTerm.type)}</Badge>
                  <Badge variant="outline" className="text-[10px] sm:text-xs">v{viewingTerm.version}</Badge>
                  {viewingTerm.requiresAcceptance && (
                    <Badge variant="outline" className="text-[10px]">
                      <Shield className="w-3 h-3 mr-1" />
                      Requires Acceptance
                    </Badge>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {viewingTerm && (
              <div className="space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm font-semibold mb-2 block">Content</Label>
                  <div className="p-3 sm:p-4 border rounded-lg bg-muted/30 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed">
                        {viewingTerm.content}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <Label className="text-[10px] sm:text-xs text-muted-foreground">Created</Label>
                    <p className="font-medium">{viewingTerm.createdAt}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] sm:text-xs text-muted-foreground">Last Updated</Label>
                    <p className="font-medium">{viewingTerm.updatedAt}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setIsViewDialogOpen(false);
              setViewingTerm(null);
            }} className="w-full sm:w-auto text-xs sm:text-sm">
              Close
            </Button>
            {viewingTerm && (
              <Button onClick={() => {
                setIsViewDialogOpen(false);
                handleEdit(viewingTerm);
              }} className="w-full sm:w-auto text-xs sm:text-sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base">Edit Term</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update the term document
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs sm:text-sm">Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="text-sm sm:text-base mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Type</Label>
              <Select value={formData.type} onValueChange={(v: Term["type"]) => setFormData({ ...formData, type: v })}>
                <SelectTrigger className="mt-1.5 text-sm sm:text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {termTypes.map((opt: { value: string; label: string }) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Content</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="min-h-[200px] sm:min-h-[300px] text-sm sm:text-base mt-1.5"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="edit-requires-acceptance" className="text-xs sm:text-sm">Requires User Acceptance</Label>
              <Switch
                id="edit-requires-acceptance"
                checked={formData.requiresAcceptance}
                onCheckedChange={(checked) => setFormData({ ...formData, requiresAcceptance: checked })}
                className="shrink-0"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="w-full sm:w-auto text-xs sm:text-sm">
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!formData.title || !formData.content} className="w-full sm:w-auto text-xs sm:text-sm">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
