import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { fetchAdminCredits, allocateAdminCredits, fetchAdminUsersList, assignPlanToCustomer } from "@/api/admin-data";
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
  Filter,
  Search
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
  const [assignPlanOpen, setAssignPlanOpen] = useState(false);
  const [assignPlanPackage, setAssignPlanPackage] = useState<{ id: string; name: string; credits: number; price: number } | null>(null);
  const [assignPlanUserId, setAssignPlanUserId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { prompt, PromptDialog } = usePrompt();
  const { data, isError, error, refetch } = useQuery({
    queryKey: ["admin", "credits"],
    queryFn: fetchAdminCredits,
  });
  const { data: usersList = [] } = useQuery({
    queryKey: ["/api/v1/users"],
    queryFn: fetchAdminUsersList,
    enabled: allocateOpen || assignPlanOpen,
  });
  const allocateMutation = useMutation({
    mutationFn: ({ userId, amount }: { userId: number; amount: number }) =>
      allocateAdminCredits(userId, amount),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "credits"] });
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

  const handleAssignPlan = async () => {
    if (!assignPlanPackage || !assignPlanUserId) {
      toast({ title: "Select user", description: "Choose a user to assign this plan to.", variant: "destructive" });
      return;
    }
    setAssigning(true);
    try {
      const ok = await assignPlanToCustomer(Number(assignPlanUserId), String(assignPlanPackage.id));
      if (ok) {
        queryClient.invalidateQueries({ queryKey: ["admin", "credits"] });
        setAssignPlanOpen(false);
        setAssignPlanPackage(null);
        setAssignPlanUserId("");
        toast({ title: "Plan assigned", description: `${assignPlanPackage.name} assigned to selected user.` });
      } else {
        toast({ title: "Failed to assign plan", description: "The server could not assign this plan. Check that the plan exists in Billing.", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAssigning(false);
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
      <PromptDialog />
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate / Share Credits</DialogTitle>
            <DialogDescription>Select a user and enter amount (positive to add credits, negative to deduct).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>User</Label>
              <Select value={allocateUserId} onValueChange={setAllocateUserId}>
                <SelectTrigger>
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocateOpen(false)}>Cancel</Button>
            <Button onClick={handleAllocateSubmit} disabled={allocateMutation.isPending || !allocateUserId || !allocateAmount.trim()}>
              {allocateMutation.isPending ? "Allocating…" : "Allocate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignPlanOpen} onOpenChange={(open) => { setAssignPlanOpen(open); if (!open) setAssignPlanPackage(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Plan</DialogTitle>
            <DialogDescription>
              {assignPlanPackage
                ? `Assign "${assignPlanPackage.name}" ($${assignPlanPackage.price}${assignPlanPackage.credits > 0 ? "/mo" : ""}) to a user.`
                : "Select a user to assign the plan to."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>User</Label>
              <Select value={assignPlanUserId} onValueChange={setAssignPlanUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {usersList.map((u: { id: number; email?: string; first_name?: string; last_name?: string }) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {(u.first_name || u.last_name) ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : u.email || `User ${u.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignPlanOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignPlan} disabled={assigning || !assignPlanUserId}>
              {assigning ? "Assigning…" : "Assign Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-credits-title">Credit Management</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">Manage AI credits and allocations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="rounded-xl bg-primary/10 p-3 sm:p-4 mb-3 sm:mb-4">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <Badge variant="outline" className={`${softBadgeClasses.primary} text-[10px] sm:text-xs shrink-0`}>Active</Badge>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-primary mt-3">{remainingCredits.toLocaleString()}</p>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Available Credits</p>
            <div className="mt-2 sm:mt-3">
              <Progress value={(usedCredits / totalCredits) * 100} className="h-2" />
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{usedCredits.toLocaleString()} of {totalCredits.toLocaleString()} used</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald dark:text-emerald" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-emerald dark:text-emerald">+12.5%</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Efficiency Improvement</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">vs. last month</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm sm:col-span-2 md:col-span-1">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-amber dark:text-amber" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">2,500</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Bonus Credits</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">Expires Jan 31, 2026</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="packages" className="w-full">
        <TabsList className="bg-muted/50 overflow-x-auto overflow-y-hidden w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsTrigger value="packages" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <span className="hidden sm:inline">Credit Packages</span>
            <span className="sm:hidden">Packages</span>
          </TabsTrigger>
          <TabsTrigger value="allocations" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <span className="hidden sm:inline">User Allocations</span>
            <span className="sm:hidden">Allocations</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-background text-xs sm:text-sm">
            <span className="hidden sm:inline">Transaction History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-4 sm:mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {creditPackages.map((pkg) => (
              <Card 
                key={pkg.id} 
                className={`border shadow-sm relative overflow-hidden ${pkg.popular ? 'ring-2 ring-primary' : ''}`}
                data-testid={`card-package-${pkg.id}`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-2 sm:px-3 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                )}
                <CardContent className="p-4 sm:p-5">
                  <h3 className="font-semibold text-base sm:text-lg">{pkg.name}</h3>
                  <div className="mt-3 sm:mt-4 mb-4 sm:mb-6">
                    <span className="text-2xl sm:text-3xl font-bold">${pkg.price}</span>
                    {pkg.credits > 0 && <span className="text-xs sm:text-sm text-muted-foreground">/mo</span>}
                  </div>
                  <div className="space-y-2 mb-4 sm:mb-6">
                    <p className="text-xs sm:text-sm">
                      {pkg.credits > 0 ? `${pkg.credits.toLocaleString()} credits` : 'Unlimited credits'}
                    </p>
                    {pkg.perCredit > 0 && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground">${pkg.perCredit} per credit</p>
                    )}
                  </div>
                  <Button 
                    className={`w-full text-xs sm:text-sm ${pkg.popular ? 'theme-gradient-bg text-white' : ''}`}
                    variant={pkg.popular ? "default" : "outline"}
                    onClick={() => {
                      setAssignPlanPackage(pkg);
                      setAssignPlanUserId("");
                      setAssignPlanOpen(true);
                    }}
                  >
                    Select Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="allocations" className="mt-4 sm:mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm sm:text-base">User Credit Allocations</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Manage credit distribution across team members</CardDescription>
                </div>
                <Button 
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => setAllocateOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Allocate Credits
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3 sm:space-y-4">
                {userAllocations.map((user) => (
                  <div key={user.id} className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3 sm:gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors`} data-testid={`row-allocation-${user.id}`}>
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarFallback className="theme-gradient-bg text-white text-xs sm:text-sm font-semibold">
                          {user.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">{user.name}</p>
                        <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-2 mt-1`}>
                          <Progress value={user.allocated ? Math.min(100, (user.used / user.allocated) * 100) : 0} className={`h-1.5 ${isMobile ? 'w-full' : 'flex-1'}`} />
                          <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                            {user.remaining} remaining
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`flex ${isMobile ? 'items-center justify-between' : 'flex-col text-right'} gap-1 sm:gap-0`}>
                      <div>
                        <p className="text-xs sm:text-sm font-semibold">{user.used.toLocaleString()}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">of {user.allocated.toLocaleString()}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className={`${isMobile ? 'w-auto' : ''} text-xs sm:text-sm`}
                        onClick={async () => {
                          const newAmountStr = await prompt({
                            title: "Update Allocation",
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

        <TabsContent value="history" className="mt-4 sm:mt-6">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-sm sm:text-base">Transaction History</CardTitle>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-9 w-full sm:w-48 text-sm sm:text-base" data-testid="input-search-transactions" />
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="shrink-0"
                    onClick={async () => {
                      const filterType = await prompt({
                        title: "Filter Transactions",
                        description: "Filter by:\n1. Type (purchase/usage/allocation/refund)\n2. Date Range\n3. User",
                        placeholder: "Enter option (1-3) or leave empty",
                      });
                      if (filterType === "1") {
                        const type = await prompt({
                          title: "Filter by Type",
                          description: "Enter transaction type",
                          placeholder: "purchase/usage/allocation/refund",
                        });
                        if (type) {
                          toast({
                            title: "Filter applied",
                            description: `Filtering transactions by type: ${type}`,
                          });
                        }
                      } else if (filterType) {
                        toast({
                          title: "Filter option",
                          description: "This filter option will be available in the next update.",
                        });
                      }
                    }}
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      const dataStr = JSON.stringify(transactions, null, 2);
                      const dataBlob = new Blob([dataStr], { type: "application/json" });
                      const url = URL.createObjectURL(dataBlob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `transactions_${new Date().toISOString().split('T')[0]}.json`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                      toast({
                        title: "Exported",
                        description: "Transaction history has been exported.",
                      });
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3 sm:gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors`} data-testid={`row-transaction-${tx.id}`}>
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        {getTransactionIcon(tx.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs sm:text-sm truncate">{tx.description}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{tx.user} • {tx.date}</p>
                      </div>
                    </div>
                    <div className={`font-semibold text-xs sm:text-sm ${tx.amount > 0 ? 'text-emerald dark:text-emerald' : 'text-foreground'} ${isMobile ? 'self-end' : ''}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
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
