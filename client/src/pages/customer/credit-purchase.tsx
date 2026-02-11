import { useEffect, useState } from "react";
import { Coins, Loader2, Check, ExternalLink } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { fetchCreditPlans, purchaseCredits, validateCoupon, type CreditPlan } from "@/api/customer-data";
import { Separator } from "@/components/ui/separator";

export default function MyCredits() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Purchase state
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponDiscount, setCouponDiscount] = useState<number | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchCreditPlans();
        setPlans(data);
      } catch (err) {
        console.error("Failed to load plans:", err);
        toast({
          title: "Error",
          description: "Could not load credit plans. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [toast]);

  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    setCouponError(null);
    setCouponDiscount(null);
    try {
      const res = await validateCoupon(couponCode);
      if (res.valid) {
        setCouponDiscount(res.discountPercent);
        toast({
          title: "Coupon applied!",
          description: `You get ${res.discountPercent}% off your purchase.`,
        });
      } else {
        setCouponError("Invalid coupon code");
      }
    } catch (err) {
      console.error(err);
      setCouponError("Invalid coupon code");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handlePurchase = async (plan: CreditPlan) => {
    setPurchasingPlanId(plan.id);
    try {
      const res = await purchaseCredits(plan.id, couponDiscount ? couponCode : undefined);

      updateUser({ credits: res.credits });
      queryClient.invalidateQueries({ queryKey: ["customer", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "credits", "usage"] });
      queryClient.invalidateQueries({ queryKey: ["collaborator", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });

      toast({
        title: "Purchase successful!",
        description: `Added ${plan.credits} credits to your account.`,
      });
      // Clear coupon after purchase
      setCouponCode("");
      setCouponDiscount(null);
    } catch (err) {
      console.error(err);
      toast({
        title: "Purchase failed",
        description: "Could not complete purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPurchasingPlanId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Purchase Credits</h1>
        <p className="text-muted-foreground mt-2">
          Top up your account to generate more AI proposals and content.
        </p>
      </div>

      {/* Current Balance Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-medium text-foreground">Current Balance</h3>
            <p className="text-sm text-muted-foreground">
              You have <span className="font-bold text-primary text-xl mx-1">{user?.credits || 0}</span> credits available.
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Coins className="h-6 w-6 text-primary" />
          </div>
        </CardContent>
      </Card>

      {/* Coupon Section */}
      <div className="flex flex-col sm:flex-row gap-4 items-end max-w-md">
        <div className="grid w-full gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="coupon" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Apply Coupon
            </label>
            {couponDiscount && (
              <Badge variant="secondary" className="text-green-600 bg-green-50 hover:bg-green-100 border-green-200">
                {couponDiscount}% Saved
              </Badge>
            )}
          </div>
          <div className="flex w-full max-w-sm items-center space-x-2">
            <Input
              id="coupon"
              placeholder="Enter code (e.g. SAVE10)"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              disabled={!!couponDiscount}
            />
            {couponDiscount ? (
              <Button variant="ghost" onClick={() => { setCouponDiscount(null); setCouponCode(""); }}>Clear</Button>
            ) : (
              <Button type="button" variant="outline" onClick={handleValidateCoupon} disabled={!couponCode || isValidatingCoupon}>
                {isValidatingCoupon && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply
              </Button>
            )}
          </div>
          {couponError && <span className="text-xs text-destructive">{couponError}</span>}
        </div>
      </div>

      <Separator />

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {plans.map((plan) => {
          const discount = couponDiscount || 0;
          const originalPrice = plan.price;
          const finalPrice = discount > 0 ? originalPrice * (1 - discount / 100) : originalPrice;

          return (
            <Card key={plan.id} className={`flex flex-col relative ${plan.popular ? 'border-primary shadow-md' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground px-3">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ${Math.ceil(finalPrice)}
                  </span>
                  {discount > 0 && (
                    <span className="text-sm text-muted-foreground line-through ml-2">
                      ${originalPrice}
                    </span>
                  )}
                  <span className="text-muted-foreground ml-1">/ pack</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 flex-1">
                <div className="flex items-center justify-center p-4 bg-secondary/50 rounded-lg">
                  <Coins className="mr-2 h-5 w-5 text-primary" />
                  <span className="font-semibold text-lg">{plan.credits.toLocaleString()} Credits</span>
                </div>
                <div className="space-y-2 text-sm">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start">
                      <Check className="mr-2 h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handlePurchase(plan)}
                  disabled={!!purchasingPlanId}
                >
                  {purchasingPlanId === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {purchasingPlanId === plan.id ? "Purchasing..." : "Purchase"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
