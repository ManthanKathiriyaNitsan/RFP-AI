import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import {
  fetchAdminBillingPlans,
  createAdminBillingPlan,
  updateAdminBillingPlan,
  deleteAdminBillingPlan,
  assignPlanToCustomer,
  fetchAdminUsersList,
  fetchAdminInvoices,
  fetchAdminApiQuota,
  updateAdminApiQuota,
  type BillingPlanItem,
} from "@/api/admin-data";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  FileText,
  Users,
  Gauge,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

export default function AdminSubscriptionBilling() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const { data: plansData, isError, error, refetch } = useQuery({ queryKey: ["admin", "billing-plans"], queryFn: fetchAdminBillingPlans });
  const { data: invoicesData } = useQuery({ queryKey: ["admin", "billing-invoices"], queryFn: fetchAdminInvoices });
  const { data: apiUsersRaw = [] } = useQuery({
    queryKey: ["admin", "users-list"],
    queryFn: fetchAdminUsersList,
  });
  const apiUsers = apiUsersRaw.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: (u as { firstName?: string; first_name?: string }).firstName ?? (u as { first_name?: string }).first_name,
    lastName: (u as { lastName?: string; last_name?: string }).lastName ?? (u as { last_name?: string }).last_name,
  }));
  const { data: quotaData } = useQuery({ queryKey: ["admin", "api-quota"], queryFn: fetchAdminApiQuota });

  const plans = plansData?.plans ?? [];
  const invoices = invoicesData?.invoices ?? [];
  const limitPerMonth = quotaData?.limitPerMonth ?? 10000;
  const usedThisMonth = quotaData?.usedThisMonth ?? 0;

  useEffect(() => {
    if (quotaData?.limitPerMonth != null) setQuotaLimit(quotaData.limitPerMonth);
  }, [quotaData?.limitPerMonth]);

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BillingPlanItem | null>(null);
  const [planName, setPlanName] = useState("");
  const [planPrice, setPlanPrice] = useState(0);
  const [planInterval, setPlanInterval] = useState<"month" | "year">("month");
  const [planCredits, setPlanCredits] = useState<number | "">("");
  const [planApiQuota, setPlanApiQuota] = useState<number | "">("");
  const [planPopular, setPlanPopular] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const [assignUserId, setAssignUserId] = useState<string>("");
  const [assignPlanId, setAssignPlanId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const [quotaLimit, setQuotaLimit] = useState(limitPerMonth);
  const [savingQuota, setSavingQuota] = useState(false);

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanName("");
    setPlanPrice(99);
    setPlanInterval("month");
    setPlanCredits(10000);
    setPlanApiQuota(5000);
    setPlanPopular(false);
    setPlanDialogOpen(true);
  };

  const openEditPlan = (p: BillingPlanItem) => {
    setEditingPlan(p);
    setPlanName(p.name);
    setPlanPrice(p.price);
    setPlanInterval(p.interval);
    setPlanCredits(p.creditsIncluded ?? "");
    setPlanApiQuota(p.apiQuotaPerMonth ?? "");
    setPlanPopular(p.popular ?? false);
    setPlanDialogOpen(true);
  };

  const handleSavePlan = async () => {
    const name = planName.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSavingPlan(true);
    const payload = {
      name,
      price: planPrice,
      interval: planInterval,
      creditsIncluded: planCredits === "" ? undefined : Number(planCredits),
      apiQuotaPerMonth: planApiQuota === "" ? undefined : Number(planApiQuota),
      popular: planPopular,
    };
    if (editingPlan) {
      const updated = await updateAdminBillingPlan(editingPlan.id, payload);
      setSavingPlan(false);
      if (updated) {
        qc.invalidateQueries({ queryKey: ["admin", "billing-plans"] });
        setPlanDialogOpen(false);
        toast({ title: "Plan updated", description: name });
      } else {
        toast({ title: "Failed to update plan", variant: "destructive" });
      }
    } else {
      const created = await createAdminBillingPlan(payload);
      setSavingPlan(false);
      if (created) {
        qc.invalidateQueries({ queryKey: ["admin", "billing-plans"] });
        setPlanDialogOpen(false);
        toast({ title: "Plan created", description: name });
      } else {
        toast({ title: "Failed to create plan", variant: "destructive" });
      }
    }
  };

  const handleDeletePlan = async (p: BillingPlanItem) => {
    const ok = await confirm({ title: "Delete plan?", description: `Remove "${p.name}"? Customers on this plan will need to be reassigned.` });
    if (!ok) return;
    const deleted = await deleteAdminBillingPlan(p.id);
    if (deleted) {
      qc.invalidateQueries({ queryKey: ["admin", "billing-plans"] });
      toast({ title: "Plan deleted", variant: "destructive" });
    } else {
      toast({ title: "Failed to delete plan", variant: "destructive" });
    }
  };

  const handleAssign = async () => {
    const userId = assignUserId ? parseInt(assignUserId, 10) : NaN;
    if (!assignPlanId || Number.isNaN(userId)) {
      toast({ title: "Select a user and a plan", variant: "destructive" });
      return;
    }
    setAssigning(true);
    const result = await assignPlanToCustomer(userId, assignPlanId);
    setAssigning(false);
    if (result.success) {
      toast({
        title: "Plan assigned",
        description: result.message ?? "Customer now has the plan's credits and API quota.",
      });
      setAssignUserId("");
      setAssignPlanId("");
      qc.invalidateQueries({ queryKey: ["admin", "billing-plans"] });
      qc.invalidateQueries({ queryKey: ["admin", "credits"] });
      qc.invalidateQueries({ queryKey: ["admin", "users-list"] });
      qc.invalidateQueries({ queryKey: ["/api/v1/users"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } else {
      toast({ title: "Failed to assign plan", description: result.message, variant: "destructive" });
    }
  };

  const handleSaveQuota = async () => {
    setSavingQuota(true);
    const updated = await updateAdminApiQuota({ limitPerMonth: quotaLimit });
    setSavingQuota(false);
    if (updated) {
      qc.invalidateQueries({ queryKey: ["admin", "api-quota"] });
      toast({ title: "API quota updated", description: `Limit set to ${quotaLimit.toLocaleString()}/month.` });
    } else {
      toast({ title: "Failed to update quota", variant: "destructive" });
    }
  };

  const userName = (u: { id?: number; firstName?: string; lastName?: string; email?: string }) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || `User ${u.id ?? ""}`;

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Subscription & Billing</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1">
          Create plans, assign to customers, view invoices, and set API quota.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Plans
              </CardTitle>
              <CardDescription>Create and edit subscription plans. Set credits and API quota per plan.</CardDescription>
            </div>
            <Button onClick={openCreatePlan}>
              <Plus className="w-4 h-4 mr-2" />
              Create plan
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No plans yet. Create one to get started.</p>
          ) : (
            <div className="space-y-3">
              {plans.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-border">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {p.name}
                      {p.popular && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-primary/15 text-primary">Most popular</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ${p.price}/{p.interval}
                      {p.creditsIncluded != null && ` • ${p.creditsIncluded.toLocaleString()} credits`}
                      {p.apiQuotaPerMonth != null && ` • ${p.apiQuotaPerMonth.toLocaleString()} API calls/mo`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEditPlan(p)}>
                      <Pencil className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeletePlan(p)}>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Assign plan to customer
          </CardTitle>
          <CardDescription>Assign a subscription plan to a user. They will get the plan&apos;s credits and API quota.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Select value={assignUserId} onValueChange={setAssignUserId}>
            <SelectTrigger className="w-full sm:max-w-[240px]">
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              {apiUsers.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {userName(u)} {u.email ? `(${u.email})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignPlanId} onValueChange={setAssignPlanId}>
            <SelectTrigger className="w-full sm:max-w-[200px]">
              <SelectValue placeholder="Select plan" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} (${p.price}/{p.interval})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAssign} disabled={assigning || !assignUserId || !assignPlanId}>
            {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Assign plan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Invoices
          </CardTitle>
          <CardDescription>Recent invoices. Download for records.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No invoices yet.</p>
          ) : (
            <ul className="space-y-2">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm">{inv.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.planName} • {inv.currency} {inv.amount} • {inv.status} • Due {inv.dueDate}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toast({ title: "Download", description: "Invoice PDF would be generated by backend." })}>
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            API quota
          </CardTitle>
          <CardDescription>Global API request limit per month. Used for rate limiting and billing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-2xl font-bold">{usedThisMonth.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Used this month</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{limitPerMonth.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Limit per month</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Limit per month</Label>
              <Input
                type="number"
                min={0}
                value={quotaLimit}
                onChange={(e) => setQuotaLimit(Number(e.target.value) || 0)}
                className="w-32"
              />
            </div>
            <Button onClick={handleSaveQuota} disabled={savingQuota}>
              {savingQuota ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Edit plan" : "Create plan"}</DialogTitle>
            <DialogDescription>Set name, price, interval, credits included, and API quota.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name</Label>
              <Input className="mt-1.5" value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Professional" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price ($)</Label>
                <Input type="number" min={0} className="mt-1.5" value={planPrice || ""} onChange={(e) => setPlanPrice(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label>Interval</Label>
                <Select value={planInterval} onValueChange={(v) => setPlanInterval(v as "month" | "year")}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Credits included (optional)</Label>
              <Input type="number" min={0} className="mt-1.5" value={planCredits === "" ? "" : planCredits} onChange={(e) => setPlanCredits(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 10000" />
            </div>
            <div>
              <Label>API quota per month (optional)</Label>
              <Input type="number" min={0} className="mt-1.5" value={planApiQuota === "" ? "" : planApiQuota} onChange={(e) => setPlanApiQuota(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 5000" />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="plan-popular" checked={planPopular} onCheckedChange={(v) => setPlanPopular(v === true)} />
              <Label htmlFor="plan-popular" className="text-sm font-normal cursor-pointer">Mark as most popular (shown to customers and in admin credits)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePlan} disabled={savingPlan}>
              {savingPlan ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editingPlan ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
