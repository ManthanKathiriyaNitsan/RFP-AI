import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { createNotification } from "@/api/notifications";
import { fetchAdminCredits, allocateAdminCredits, fetchAdminUsersList, createCreditsOrder, confirmStripePayment, fetchAdminCreditsActivity } from "@/api/admin-data";
import { authStorage } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { folderIconUrl } from "@/assets/folder-icon-url";
import { 
  CreditCard, 
  Plus, 
  History,
  TrendingUp,
  Users,
  Gift,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeft,
  Download,
  Search,
  ShoppingCart,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Grid3X3,
  List,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function AdminCredits() {
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionPage, setTransactionPage] = useState(1);
  const TRANSACTION_PAGE_SIZE = 15;
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocateUserId, setAllocateUserId] = useState<string>("");
  const [allocateAmount, setAllocateAmount] = useState("");
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    const id = p.get("adminId");
    return id != null && /^\d+$/.test(id) ? parseInt(id, 10) : null;
  });
  const [selectedRecipientId, setSelectedRecipientId] = useState<number | null>(null);
  const [folderSearch, setFolderSearch] = useState("");
  const [folderSort, setFolderSort] = useState<"a-z" | "z-a">("a-z");
  const [folderViewMode, setFolderViewMode] = useState<"grid" | "list">("grid");
  const [activityPurchasePage, setActivityPurchasePage] = useState(1);
  const [activityAllocationPage, setActivityAllocationPage] = useState(1);
  const [, setLocation] = useLocation();
  const ACTIVITY_PAGE_SIZE = 15;
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
    refetchInterval: 10_000,
  });
  const hasSessionIdInUrl = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("session_id") != null;
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "credits"],
    queryFn: fetchAdminCredits,
    enabled: !isSuperAdmin || hasSessionIdInUrl,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
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
      queryClient.invalidateQueries({ queryKey: ["admin", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["collaborator", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "credits", "usage"] });
      queryClient.invalidateQueries({ queryKey: ["collaborator", "credits", "usage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setAllocateOpen(false);
      setAllocateUserId("");
      setAllocateAmount("");
      const desc = `User now has ${result.newCredits} credits (${result.amount >= 0 ? "+" : ""}${result.amount}).`;
      toast({ title: "Credits allocated", description: desc });
      createNotification({ title: "Credits allocated", message: desc, type: "credit_allocated", link: "/admin/credits" }).catch(() => {}).finally(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
    },
    onError: (err: Error) => {
      toast({ title: "Failed to allocate credits", description: err.message, variant: "destructive" });
    },
  });
  const creditPackages = data?.creditPackages ?? [];
  const transactions = data?.transactions ?? [];
  const searchLower = searchTerm.trim().toLowerCase();
  const filteredTransactions = searchLower
    ? transactions.filter(
        (tx) =>
          (tx.description ?? "").toLowerCase().includes(searchLower) ||
          (tx.user ?? "").toLowerCase().includes(searchLower) ||
          (tx.date ?? "").toLowerCase().includes(searchLower) ||
          String(tx.amount ?? "").includes(searchTerm.trim())
      )
    : transactions;
  const transactionTotalPages = Math.max(1, Math.ceil(filteredTransactions.length / TRANSACTION_PAGE_SIZE));
  const effectivePage = Math.min(transactionPage, transactionTotalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (effectivePage - 1) * TRANSACTION_PAGE_SIZE,
    effectivePage * TRANSACTION_PAGE_SIZE
  );
  const userAllocations = data?.userAllocations ?? [];
  const totalCredits = data?.totalCredits ?? 25000;
  const usedCredits = data?.usedCredits ?? 18750;
  const remainingCredits = data?.remainingCredits ?? totalCredits - usedCredits;

  // After redirect from Stripe Checkout, confirm payment and add credits (all roles including super_admin)
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    let cancelled = false;
    const runConfirm = async () => {
      const token = authStorage.getAccessToken();
      if (!token) {
        toast({
          title: "Please log in again",
          description: "Your session may have expired. Log in and return to this page to complete payment.",
          variant: "destructive",
        });
        return;
      }
      try {
        const result = await confirmStripePayment(sessionId);
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["admin", "credits"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "credits", "activity"] });
        queryClient.invalidateQueries({ queryKey: ["admin", "sidebar"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        const url = new URL(window.location.href);
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url.pathname + url.search);
        if (result.alreadyProcessed) {
          toast({ title: "Payment already applied", description: "Credits were added previously." });
          createNotification({ title: "Payment already applied", message: "Credits were added previously.", type: "credit_added", link: "/admin/credits" }).catch(() => {}).finally(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
        } else {
          const msg = `${result.credits.toLocaleString()} credits added to your account.`;
          toast({ title: "Payment successful", description: msg });
          createNotification({ title: "Payment successful", message: msg, type: "credit_purchase", link: "/admin/credits" }).catch(() => {}).finally(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
        }
      } catch (e) {
        if (!cancelled) {
          toast({ title: "Payment confirmation failed", description: (e as Error).message, variant: "destructive" });
          const url = new URL(window.location.href);
          url.searchParams.delete("session_id");
          window.history.replaceState({}, "", url.pathname + url.search);
        }
      }
    };
    const t = setTimeout(() => {
      runConfirm();
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [queryClient, toast]);

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
    const userId = authStorage.getAuth().user?.id ?? 0;
    if (!pkg.id || (Number(pkg.price) || 0) <= 0) {
      toast({ title: "Invalid package", description: "This plan has no price. Set a price in Admin → Billing.", variant: "destructive" });
      return;
    }
    setPurchasingPackageId(pkg.id);
    try {
      const { url } = await createCreditsOrder(pkg.id, {
        amount: Number(pkg.price) || 0,
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

  // Super-admin: credit activity with overall analytics, folder view per admin, drill-down to collaborators/customers
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

    const formatPurchaseDesc = (d: string | null) => {
      if (!d) return "Purchase";
      const stripeMatch = d.match(/Stripe (cs_\w+)/);
      if (stripeMatch) return `Stripe ${stripeMatch[1].slice(0, 20)}…`;
      return d.length > 50 ? d.slice(0, 50) + "…" : d;
    };

    const analytics = useMemo(() => {
      const totalCreditsPurchased = purchasesByAdmin.reduce((s, r) => s + r.totalCredits, 0);
      const totalPurchaseTx = purchasesByAdmin.reduce((s, r) => s + r.count, 0);
      const totalAllocationTx = allocationsByAdmin.reduce((s, r) => s + r.allocations.length, 0);
      const adminIdsFromPurchases = new Set(purchasesByAdmin.map((r) => r.adminId));
      const adminIdsFromAllocations = new Set(allocationsByAdmin.map((r) => r.adminId));
      const allAdminIds = new Set([...adminIdsFromPurchases, ...adminIdsFromAllocations]);
      const adminList = Array.from(allAdminIds).map((adminId) => {
        const purchaseRow = purchasesByAdmin.find((r) => r.adminId === adminId);
        const allocationRow = allocationsByAdmin.find((r) => r.adminId === adminId);
        const adminName = purchaseRow?.adminName ?? allocationRow?.adminName ?? `Admin #${adminId}`;
        const purchaseCount = purchaseRow?.count ?? 0;
        const allocationCount = allocationRow?.allocations.length ?? 0;
        const totalPurchased = purchaseRow?.totalCredits ?? 0;
        return { adminId, adminName, purchaseCount, allocationCount, totalPurchased };
      });
      return {
        totalCreditsPurchased,
        totalPurchaseTx,
        totalAllocationTx,
        adminsCount: adminList.length,
        adminList,
      };
    }, [purchasesByAdmin, allocationsByAdmin]);

    const filteredAdminList = useMemo(() => {
      const q = folderSearch.trim().toLowerCase();
      let list = q
        ? analytics.adminList.filter((a) => a.adminName.toLowerCase().includes(q))
        : [...analytics.adminList];
      list = [...list].sort((a, b) =>
        folderSort === "a-z"
          ? a.adminName.localeCompare(b.adminName, undefined, { sensitivity: "base" })
          : b.adminName.localeCompare(a.adminName, undefined, { sensitivity: "base" })
      );
      return list;
    }, [analytics.adminList, folderSearch, folderSort]);

    const handleSelectAdmin = (adminId: number) => {
      setSelectedAdminId(adminId);
      setSelectedRecipientId(null);
      setActivityPurchasePage(1);
      setActivityAllocationPage(1);
      setLocation(`/admin/credits?adminId=${adminId}`);
    };

    const handleBackToAdmins = () => {
      setSelectedAdminId(null);
      setSelectedRecipientId(null);
      setLocation("/admin/credits");
    };

    const selectedAdmin = selectedAdminId != null ? analytics.adminList.find((a) => a.adminId === selectedAdminId) : null;
    const selectedPurchaseRow = selectedAdminId != null ? purchasesByAdmin.find((r) => r.adminId === selectedAdminId) : null;
    const selectedAllocationRow = selectedAdminId != null ? allocationsByAdmin.find((r) => r.adminId === selectedAdminId) : null;

    const allocationsByRecipient = useMemo(() => {
      if (!selectedAllocationRow) return [];
      const byTarget = new Map<number, { targetUserId: number; targetUserName: string; targetUserRole?: string; allocations: { amount: number; date: string }[] }>();
      for (const a of selectedAllocationRow.allocations) {
        if (!byTarget.has(a.targetUserId)) {
          byTarget.set(a.targetUserId, {
            targetUserId: a.targetUserId,
            targetUserName: a.targetUserName,
            targetUserRole: a.targetUserRole,
            allocations: [],
          });
        }
        byTarget.get(a.targetUserId)!.allocations.push({ amount: a.amount, date: a.date });
      }
      return Array.from(byTarget.values());
    }, [selectedAllocationRow]);

    if (selectedAdminId != null && selectedAdmin) {
      return (
        <div className="space-y-6 sm:space-y-8">
          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2 text-muted-foreground hover:text-foreground"
              onClick={handleBackToAdmins}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              All admins
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-credits-title">
              Credit activity · {selectedAdmin.adminName}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">Purchases and allocations for this admin.</p>
          </div>

          <Card className="border shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">Credits purchased</CardTitle>
                  <CardDescription className="mt-1 text-sm">Payment flow for this admin.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              {!selectedPurchaseRow || selectedPurchaseRow.transactions.length === 0 ? (
                <div className="py-10 text-center rounded-xl border border-dashed border-border bg-muted/20">
                  <ShoppingCart className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-foreground">No purchase records</p>
                </div>
              ) : (
                <>
                  <ul className="space-y-2">
                    {selectedPurchaseRow.transactions
                      .slice((activityPurchasePage - 1) * ACTIVITY_PAGE_SIZE, activityPurchasePage * ACTIVITY_PAGE_SIZE)
                      .map((tx, i) => (
                        <li key={(activityPurchasePage - 1) * ACTIVITY_PAGE_SIZE + i} className="flex flex-wrap items-center gap-2 text-sm py-2 px-3 rounded-lg bg-muted/50">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{tx.amount.toLocaleString()}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-muted-foreground truncate">{formatPurchaseDesc(tx.description)}</span>
                          <span className="text-muted-foreground text-xs shrink-0 ml-auto">{tx.date ? new Date(tx.date).toLocaleDateString() : ""}</span>
                        </li>
                      ))}
                  </ul>
                  {selectedPurchaseRow.transactions.length > ACTIVITY_PAGE_SIZE && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Showing {(activityPurchasePage - 1) * ACTIVITY_PAGE_SIZE + 1}–{Math.min(activityPurchasePage * ACTIVITY_PAGE_SIZE, selectedPurchaseRow.transactions.length)} of {selectedPurchaseRow.transactions.length}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activityPurchasePage <= 1}
                          onClick={() => setActivityPurchasePage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activityPurchasePage >= Math.ceil(selectedPurchaseRow.transactions.length / ACTIVITY_PAGE_SIZE)}
                          onClick={() => setActivityPurchasePage((p) => p + 1)}
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-muted/20">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                  <UserPlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base sm:text-lg font-semibold tracking-tight">Credits allocated to collaborators & customers</CardTitle>
                  <CardDescription className="mt-1 text-sm">Click a recipient to see their transactions.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              {allocationsByRecipient.length === 0 ? (
                <div className="py-10 text-center rounded-xl border border-dashed border-border bg-muted/20">
                  <UserPlus className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-foreground">No allocation records</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {allocationsByRecipient
                      .slice((activityAllocationPage - 1) * ACTIVITY_PAGE_SIZE, activityAllocationPage * ACTIVITY_PAGE_SIZE)
                      .map((rec) => {
                        const isExpanded = selectedRecipientId === rec.targetUserId;
                        const netTotal = rec.allocations.reduce((s, a) => s + a.amount, 0);
                        return (
                          <div key={rec.targetUserId} className="rounded-xl border border-border bg-card overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setSelectedRecipientId(isExpanded ? null : rec.targetUserId)}
                              className="w-full flex flex-wrap items-center gap-2 sm:gap-3 text-left p-4 hover:bg-muted/20 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              <span className="font-medium text-foreground">{rec.targetUserName}</span>
                              {rec.targetUserRole && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium capitalize">
                                  {rec.targetUserRole.replace(/_/g, " ")}
                                </Badge>
                              )}
                              <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 ml-auto">
                                {netTotal >= 0 ? "+" : ""}{netTotal.toLocaleString()} total · {rec.allocations.length} transaction{rec.allocations.length !== 1 ? "s" : ""}
                              </span>
                            </button>
                            {isExpanded && (
                              <ul className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
                                {rec.allocations.map((a, i) => (
                                  <li key={i} className="flex flex-wrap items-center gap-2 text-sm py-2 px-3 rounded-lg bg-background">
                                    <span className={`font-semibold tabular-nums ${a.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                      {a.amount >= 0 ? "+" : ""}{a.amount.toLocaleString()}
                                    </span>
                                    <span className="text-muted-foreground text-xs shrink-0 ml-auto">{a.date ? new Date(a.date).toLocaleDateString() : ""}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {allocationsByRecipient.length > ACTIVITY_PAGE_SIZE && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Showing {(activityAllocationPage - 1) * ACTIVITY_PAGE_SIZE + 1}–{Math.min(activityAllocationPage * ACTIVITY_PAGE_SIZE, allocationsByRecipient.length)} of {allocationsByRecipient.length} recipients
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activityAllocationPage <= 1}
                          onClick={() => setActivityAllocationPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={activityAllocationPage >= Math.ceil(allocationsByRecipient.length / ACTIVITY_PAGE_SIZE)}
                          onClick={() => setActivityAllocationPage((p) => p + 1)}
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-credits-title">Credit activity</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">See which admins bought credits and how much they allocated to customers and collaborators.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full max-w-full">
          <Card className="border shadow-sm overflow-hidden rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold tabular-nums">{analytics.totalCreditsPurchased.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total credits purchased</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm overflow-hidden rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold tabular-nums">{analytics.totalPurchaseTx.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Purchase transactions</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm overflow-hidden rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <UserPlus className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold tabular-nums">{analytics.totalAllocationTx.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Allocation transactions</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm overflow-hidden rounded-xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold tabular-nums">{analytics.adminsCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Admins with activity</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Select an admin</h2>
          <p className="text-muted-foreground text-sm mb-4">Click an admin to view their purchases and allocations to collaborators and customers.</p>
          {analytics.adminList.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:gap-4 mb-4">
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
              <div className="flex items-center border rounded-lg overflow-hidden shrink-0 ml-auto">
                <Button variant={folderViewMode === "grid" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setFolderViewMode("grid")} title="Grid view">
                  <Grid3X3 className="w-4 h-4" />
                </Button>
                <Button variant={folderViewMode === "list" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setFolderViewMode("list")} title="List view">
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          {analytics.adminList.length === 0 ? (
            <Card className="border shadow-sm overflow-hidden rounded-2xl">
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">No admin activity yet</p>
                <p className="text-sm text-muted-foreground mt-1">Purchase and allocation data will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <TooltipProvider>
              <div className="flex flex-wrap gap-2">
                {filteredAdminList.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No admins match your search.</p>
                ) : (
                filteredAdminList.map((admin) => (
                  <Tooltip key={admin.adminId}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleSelectAdmin(admin.adminId)}
                        className="flex flex-col items-center gap-2 w-24 sm:w-28 group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg p-2 transition-colors hover:bg-muted/50"
                        data-testid={`folder-admin-${admin.adminId}`}
                      >
                        <img
                          src={folderIconUrl}
                          alt=""
                          className="w-12 h-12 sm:w-14 sm:h-14 object-contain group-hover:scale-105 transition-transform"
                        />
                        <span className="text-sm font-medium text-foreground text-center line-clamp-2 break-words w-full">
                          {admin.adminName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {admin.purchaseCount} purchase{admin.purchaseCount !== 1 ? "s" : ""}
                          {admin.allocationCount > 0 && ` · ${admin.allocationCount} allocation${admin.allocationCount !== 1 ? "s" : ""}`}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="font-medium">{admin.adminName}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {admin.totalPurchased.toLocaleString()} credits purchased · {admin.allocationCount} allocation{admin.allocationCount !== 1 ? "s" : ""}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
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
                  {(usersList as { id: number; email?: string; first_name?: string; last_name?: string; firstName?: string; lastName?: string; credits?: number }[]).map((u) => {
                    const name = [u.first_name ?? u.firstName, u.last_name ?? u.lastName].filter(Boolean).join(" ") || u.email || `User ${u.id}`;
                    const credits = Number(u.credits) || 0;
                    return (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {name}{u.email ? ` (${u.email})` : ""} — {credits.toLocaleString()} credits
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
        <Card className="border shadow-md overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <CreditCard className="h-6 w-6" />
              </div>
              <Badge variant="outline" className={`${softBadgeClasses.primary} text-[10px] sm:text-xs shrink-0`}>Active</Badge>
            </div>
            <p className="text-3xl sm:text-4xl font-bold mt-4 tracking-tight">{remainingCredits.toLocaleString()}</p>
            <p className="text-sm font-medium text-muted-foreground mt-1">Available Credits</p>
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
                {(() => {
                  const allocations = userAllocations.filter((u) => u.id !== 0);
                  if (allocations.length === 0) {
                    return (
                      <div className="py-10 text-center rounded-xl border border-dashed border-border bg-muted/20">
                        <Users className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-sm font-medium text-foreground">No user allocations yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Allocate credits to customers and collaborators above.</p>
                      </div>
                    );
                  }
                  return allocations.map((user) => {
                  // Allocated = total they have; use remaining when backend sends 0 so display is always correct
                  const allocated = Math.max(Number(user.allocated) || 0, Number(user.remaining) || 0);
                  const used = Math.max(0, Number(user.used) || 0);
                  const remaining = Number(user.remaining) ?? allocated - used;
                  return (
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
                            value={allocated ? Math.min(100, (used / allocated) * 100) : 0}
                            className="h-2 flex-1 max-w-[200px] rounded-full"
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{remaining.toLocaleString()} remaining</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-6">
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{allocated.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">allocated</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{used.toLocaleString()} used</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg shrink-0"
                        onClick={async () => {
                          const newAmountStr = await prompt({
                            title: "Update allocation",
                            description: `Enter new credit allocation for ${user.name} (current: ${allocated})`,
                            placeholder: "e.g. 1500",
                            type: "number",
                          });
                          const newAmount = newAmountStr ? parseInt(newAmountStr, 10) : NaN;
                          if (!isNaN(newAmount) && newAmount >= 0) {
                            const delta = newAmount - allocated;
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
                  );
                  });
                })()}
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
                  <div className="search-box flex-1 sm:flex-initial w-full sm:w-48">
                    <Search className="search-box-icon" />
                    <Input
                      placeholder="Search…"
                      data-testid="input-search-transactions"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setTransactionPage(1);
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 rounded-lg"
                    onClick={() => {
                      const dataStr = JSON.stringify(filteredTransactions, null, 2);
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
                {paginatedTransactions.map((tx) => (
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
              {filteredTransactions.length > TRANSACTION_PAGE_SIZE && (
                <div className="mt-4 pt-4 border-t flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {(effectivePage - 1) * TRANSACTION_PAGE_SIZE + 1}–{Math.min(effectivePage * TRANSACTION_PAGE_SIZE, filteredTransactions.length)} of {filteredTransactions.length} transactions
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={effectivePage <= 1}
                      onClick={() => setTransactionPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {effectivePage} of {transactionTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={effectivePage >= transactionTotalPages}
                      onClick={() => setTransactionPage((p) => Math.min(transactionTotalPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
