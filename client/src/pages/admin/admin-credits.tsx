import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchAdminCredits, allocateAdminCredits, fetchAdminUsersList, createCreditsOrder, confirmStripePayment, fetchAdminCreditsActivity } from "@/api/admin-data";
import { authStorage } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  CreditCard, 
  Plus, 
  History,
  TrendingUp,
  Users,
  Gift,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Search,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { softBadgeClasses } from "@/lib/badge-classes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrompt } from "@/hooks/use-prompt";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminCredits() {
  const [searchTerm, setSearchTerm] = useState("");
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateUserId, setAllocateUserId] = useState<string>("");
  const [allocateAmount, setAllocateAmount] = useState("");
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { currentRole } = useAuth();
  const isSuperAdmin = (currentRole || "").toLowerCase() === "super_admin";
  const { prompt, PromptDialog } = usePrompt();
  const { data: activityData, isError: activityError, error: activityErr, refetch: refetchActivity } = useQuery({
    queryKey: ["admin", "credits", "activity"],
    queryFn: fetchAdminCreditsActivity,
    enabled: isSuperAdmin,
  });
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "credits"],
    queryFn: fetchAdminCredits,
    enabled: !isSuperAdmin,
  });
  const { data: usersList = [] } = useQuery({
    queryKey: ["/api/v1/users"],
    queryFn: fetchAdminUsersList,
    enabled: allocateOpen && !isSuperAdmin,
  });
  const allocateMutation = useMutation({
    mutationFn: ({ userId, amount }: { userId: number; amount: number }) =>
      allocateAdminCredits(userId, amount, undefined, authStorage.getAuth().user?.id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "credits"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "credits", "activity"] });
      setAllocateOpen(false);
      setAllocateUserId("");
      setAllocateAmount("");
      toast({
        title: "Credits allocated",
        description: `User now has ${result.newCredits} credits (${result.amount >= 0 ? "+" : ""}${result.amount}).`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to allocate credits", description: err.message, variant: "destructive" });
    },
  });
  const creditPackages = data?.creditPackages ?? [];
  const transactions = data?.transactions ?? [];
  const userAllocations = data?.userAllocations ?? [];
  const totalCredits = data?.totalCredits ?? 25000;
  const usedCredits = data?.usedCredits ?? 18750;
  const remainingCredits = data?.remainingCredits ?? totalCredits - usedCredits;

  // After redirect from Stripe Checkout, confirm payment and add credits
  useEffect(() => {
    if (isSuperAdmin) return;
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await confirmStripePayment(sessionId);
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["admin", "credits"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "credits", "activity"] });
        const url = new URL(window.location.href);
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.pathname + url.search);
        if (result.alreadyProcessed) {
          toast({ title: "Payment already applied", description: "Credits were added previously." });
        } else {
          toast({ title: "Payment successful", description: `${result.credits.toLocaleString()} credits in your account.` });
        }
      } catch (e) {
        if (!cancelled) {
          toast({ title: "Payment confirmation failed", description: (e as Error).message, variant: "destructive" });
          const url = new URL(window.location.href);
          url.searchParams.delete("session_id");
          window.history.replaceState({}, "", url.pathname + url.search);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isSuperAdmin, queryClient, toast]);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "purchase":
        return <Plus className="w-4 h-4 text-emerald dark:text-emerald" />;
      case "usage":
        return <ArrowUpRight className="w-4 h-4 text-red dark:text-red" />;
      case "allocation":
        return <Users className="w-4 h-4 text-blue dark:text-blue" />;
      case "refund":
        return <ArrowDownLeft className="w-4 h-4 text-amber dark:text-amber" />;
      default:
        return <History className="w-4 h-4" />;
    }
  };

  const handleAllocateSubmit = () => {
    const userId = allocateUserId ? Number(allocateUserId) : 0;
    const amount = allocateAmount.trim() ? parseInt(allocateAmount, 10) : NaN;
    if (!userId || isNaN(amount)) {
      toast({ title: "Invalid input", description: "Select a user and enter an amount (positive to add, negative to deduct).", variant: "destructive" });
      return;
    }
    allocateMutation.mutate({ userId, amount });
  };

  const handleBuyPackage = async (pkg: { id: string; name: string; credits: number; price: number }) => {
    const userId = authStorage.getAuth().user?.id;
    if (userId == null) {
      toast({ title: "Sign in required", description: "You must be signed in to buy credits.", variant: "destructive" });
      return;
    }
    setPurchasingPackageId(pkg.id);
    try {
      const { url } = await createCreditsOrder(pkg.id, {
        amount: pkg.price,
        currency: "USD",
        credits: pkg.credits > 0 ? pkg.credits : 0,
        userId,
      });
      if (url) {
        window.location.href = url;
        return;
      }
      toast({ title: "Payment unavailable", description: "Could not start checkout.", variant: "destructive" });
    } catch (e) {
      toast({ title: "Could not start payment", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPurchasingPackageId(null);
    }
  };

  // Super-admin: only credit activity (who bought, who allocated how much to whom)
  if (isSuperAdmin) {
    if (activityError) {
      return (
        <div className="p-4">
          <QueryErrorState refetch={refetchActivity} error={activityErr} />
        </div>
      );
    }
    const purchasesByAdmin = activityData?.purchasesByAdmin ?? [];
    const allocationsByAdmin = activityData?.allocationsByAdmin ?? [];
    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-credits-title">Credit activity</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">See which admins bought credits and how much they allocated to customers and collaborators.</p>
        </div>

        <Card className="border shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Credits purchased by admin
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Total credits each admin has bought (payment flow).</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {purchasesByAdmin.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchase records yet.</p>
            ) : (
              <div className="space-y-4">
                {purchasesByAdmin.map((row) => (
                  <div key={row.adminId} className="rounded-lg border p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{row.adminName}</p>
                      <Badge variant="secondary">{row.totalCredits.toLocaleString()} credits total</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{row.count} purchase(s)</p>
                    <ul className="text-sm space-y-1">
                      {row.transactions.slice(0, 5).map((tx, i) => (
                        <li key={i}>+{tx.amount.toLocaleString()} — {tx.description || "Purchase"} — {tx.date ? new Date(tx.date).toLocaleDateString() : ""}</li>
                      ))}
                      {row.transactions.length > 5 && <li className="text-muted-foreground">+{row.transactions.length - 5} more</li>}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Credits allocated by admin
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">How much each admin gave to customers and collaborators.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {allocationsByAdmin.length === 0 ? (
              <p className="text-sm text-muted-foreground">No allocation records yet. Allocations made via this server will appear here.</p>
            ) : (
              <div className="space-y-4">
                {allocationsByAdmin.map((row) => (
                  <div key={row.adminId} className="rounded-lg border p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{row.adminName}</p>
                      <span className="text-xs text-muted-foreground">{row.allocations.length} allocation(s)</span>
                    </div>
                    <ul className="text-sm space-y-1">
                      {row.allocations.map((a, i) => (
                        <li key={i}>
                          → <span className="font-medium">{a.targetUserName}</span>: {a.amount >= 0 ? "+" : ""}{a.amount.toLocaleString()} credits ({a.date ? new Date(a.date).toLocaleDateString() : ""})
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
    <div className="space-y-6 sm:space-y-8">
      <PromptDialog />
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">Allocate credits</DialogTitle>
            <DialogDescription>Select a user and enter amount (positive to add, negative to deduct).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>User</Label>
              <Select value={allocateUserId} onValueChange={setAllocateUserId}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {(usersList as { id: number; email?: string; first_name?: string; last_name?: string; firstName?: string; lastName?: string }[]).map((u) => {
                    const name = [u.first_name ?? u.firstName, u.last_name ?? u.lastName].filter(Boolean).join(" ") || u.email || `User ${u.id}`;
                    return (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {name}{u.email ? ` (${u.email})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Amount</Label>
              <Input
                type="number"
                placeholder="e.g. 500 or -100"
                value={allocateAmount}
                onChange={(e) => setAllocateAmount(e.target.value)}
                className="rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateOpen(false)} className="rounded-lg">Cancel</Button>
            <Button onClick={handleAllocateSubmit} disabled={allocateMutation.isPending || !allocateUserId || !allocateAmount.trim()} className="rounded-lg">
              {allocateMutation.isPending ? "Allocating…" : "Allocate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-credits-title">Credit Management</h1>
              <p className="text-muted-foreground text-sm mt-1">Manage AI credits, allocations, and usage across your team.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        <Card className="border-0 shadow-lg shadow-primary/5 bg-gradient-to-br from-primary/8 to-primary/5 overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-0.5">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <CreditCard className="h-6 w-6" />
              </div>
              <Badge variant="outline" className={`${softBadgeClasses.primary} text-[10px] sm:text-xs shrink-0`}>Active</Badge>
            </div>
            <p className="text-3xl sm:text-4xl font-bold mt-4 tracking-tight">{remainingCredits.toLocaleString()}</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">Available Credits</p>
            <div className="mt-4 space-y-1.5">
              <Progress value={(usedCredits / totalCredits) * 100} className="h-2.5 rounded-full" />
              <p className="text-xs text-muted-foreground">{usedCredits.toLocaleString()} of {totalCredits.toLocaleString()} used</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-md overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardContent className="p-5 sm:p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <p className="text-3xl sm:text-4xl font-bold mt-4 text-emerald-600 dark:text-emerald-400">+12.5%</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">Efficiency improvement</p>
            <p className="text-xs text-muted-foreground mt-2">vs. last month</p>
          </CardContent>
        </Card>

        <Card className="border shadow-md overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1">
          <CardContent className="p-5 sm:p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Gift className="h-6 w-6" />
            </div>
            <p className="text-3xl sm:text-4xl font-bold mt-4">2,500</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">Bonus Credits</p>
            <p className="text-xs text-muted-foreground mt-2">Expires Jan 31, 2026</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="packages" className="w-full">
        <TabsList className="h-12 p-1 rounded-xl bg-muted/60 overflow-x-auto overflow-y-hidden w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0 gap-1">
          <TabsTrigger
            value="packages"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm font-medium px-4 transition-all"
          >
            <span className="hidden sm:inline">Credit Packages</span>
            <span className="sm:hidden">Packages</span>
          </TabsTrigger>
          <TabsTrigger
            value="allocations"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm font-medium px-4 transition-all"
          >
            <span className="hidden sm:inline">User Allocations</span>
            <span className="sm:hidden">Allocations</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm font-medium px-4 transition-all"
          >
            <span className="hidden sm:inline">Transaction History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-6 sm:mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {creditPackages.map((pkg) => (
              <Card
                key={pkg.id}
                className={`relative overflow-hidden rounded-2xl border transition-all hover:shadow-lg hover:-translate-y-0.5 ${pkg.popular ? "ring-2 ring-primary shadow-md shadow-primary/10" : "shadow-sm"}`}
                data-testid={`card-package-${pkg.id}`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-bl-xl">
                    Popular
                  </div>
                )}
                <CardContent className="p-5 sm:p-6">
                  <h3 className="font-semibold text-lg">{pkg.name}</h3>
                  <div className="mt-4 mb-5">
                    <span className="text-2xl sm:text-3xl font-bold">${pkg.price}</span>
                    {pkg.credits > 0 && <span className="text-sm text-muted-foreground">/mo</span>}
                  </div>
                  <div className="space-y-1.5 mb-6">
                    <p className="text-sm">
                      {pkg.credits > 0 ? `${pkg.credits.toLocaleString()} credits` : "Unlimited credits"}
                    </p>
                    {pkg.perCredit > 0 && (
                      <p className="text-xs text-muted-foreground">${pkg.perCredit} per credit</p>
                    )}
                  </div>
                  <Button
                    className={`w-full rounded-lg text-sm font-medium ${pkg.popular ? "theme-gradient-bg text-white shadow-md" : ""}`}
                    variant={pkg.popular ? "default" : "outline"}
                    onClick={() => handleBuyPackage(pkg)}
                    disabled={purchasingPackageId != null || pkg.credits <= 0}
                  >
                    {purchasingPackageId === pkg.id ? "Opening payment…" : pkg.credits > 0 ? "Buy credits" : "Contact sales"}
                  </Button>
                  {pkg.credits > 0 && (
                    <p className="text-[10px] text-muted-foreground text-center mt-1.5">Secure payment by Stripe</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="allocations" className="mt-6 sm:mt-8">
          <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <CardHeader className="p-6 sm:p-8 bg-muted/30 border-b">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">User credit allocations</CardTitle>
                    <CardDescription className="text-sm mt-0.5">Manage credit distribution across team members. Assign credits to customers and collaborators.</CardDescription>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full sm:w-auto rounded-lg font-medium shadow-sm"
                  onClick={() => setAllocateOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Allocate credits
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {userAllocations.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40 hover:border-primary/20"
                    data-testid={`row-allocation-${user.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar className="h-11 w-11 shrink-0 rounded-xl border-2 border-background shadow-sm">
                        <AvatarFallback className="rounded-xl theme-gradient-bg text-white text-sm font-semibold">
                          {user.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="font-semibold text-sm truncate">{user.name}</p>
                        <div className="flex items-center gap-3">
                          <Progress
                            value={user.allocated ? Math.min(100, (user.used / user.allocated) * 100) : 0}
                            className="h-2 flex-1 max-w-[200px] rounded-full"
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{user.remaining} remaining</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{user.used.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">of {user.allocated.toLocaleString()}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg shrink-0"
                        onClick={async () => {
                          const newAmountStr = await prompt({
                            title: "Update allocation",
                            description: `Enter new credit allocation for ${user.name} (current: ${user.allocated})`,
                            placeholder: "e.g. 1500",
                            type: "number",
                          });
                          const newAmount = newAmountStr ? parseInt(newAmountStr, 10) : NaN;
                          if (!isNaN(newAmount) && newAmount >= 0) {
                            const delta = newAmount - user.allocated;
                            if (delta !== 0) {
                              allocateMutation.mutate({ userId: user.id, amount: delta });
                            }
                          }
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6 sm:mt-8">
          <Card className="rounded-2xl border shadow-sm overflow-hidden">
            <CardHeader className="p-6 sm:p-8 bg-muted/30 border-b">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <History className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base sm:text-lg">Transaction history</CardTitle>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search…" className="pl-9 w-full sm:w-48 rounded-lg" data-testid="input-search-transactions" />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-lg"
                    onClick={() => {
                      const dataStr = JSON.stringify(transactions, null, 2);
                      const dataBlob = new Blob([dataStr], { type: "application/json" });
                      const url = URL.createObjectURL(dataBlob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `transactions_${new Date().toISOString().split("T")[0]}.json`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                      toast({ title: "Exported", description: "Transaction history has been exported." });
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40"
                    data-testid={`row-transaction-${tx.id}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground truncate">{tx.user} • {tx.date}</p>
                      </div>
                    </div>
                    <div className={`text-sm font-semibold tabular-nums ${tx.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
