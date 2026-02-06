import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, CreditCard, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchCreditPlans, purchaseCredits, type CreditPlanItem } from "@/api/customer-data";

export default function CreditPurchase() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [, navigate] = useLocation();
  const { user, updateUser, currentRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["customer", "credits", "plans"],
    queryFn: fetchCreditPlans,
    staleTime: 5 * 60 * 1000,
  });
  const pricingPlans: CreditPlanItem[] = useMemo(
    () => (Array.isArray(plansData) ? plansData : []),
    [plansData]
  );

  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ plan, amount }: { plan: string; amount: number }) => {
      return purchaseCredits({ plan, amount });
    },
    onSuccess: (data) => {
      updateUser({ credits: data.credits });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Purchase successful!",
        description: `${selectedPlan} plan purchased successfully. Your credits have been added.`,
      });
      // Navigate based on user role
      if (currentRole === 'admin') {
        navigate("/admin");
      } else if (currentRole === 'collaborator') {
        navigate("/collaborator");
      } else {
        navigate("/dashboard");
      }
    },
    onError: () => {
      toast({
        title: "Payment failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    setShowPaymentForm(true);
  };

  const handlePayment = () => {
    const plan = pricingPlans.find(p => p.id === selectedPlan);
    if (!plan) return;

    purchaseMutation.mutate({ plan: plan.name, amount: plan.credits });
  };

  const updatePaymentData = (field: string, value: string) => {
    setPaymentData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Purchase Credits</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Choose a credit package that fits your needs
        </p>
      </div>

      {!showPaymentForm ? (
        <>
          {/* Current Credits */}
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-4`}>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold mb-1">Current Balance</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    You have <span className="font-semibold text-primary">{user?.credits || 0}</span> credits remaining
                  </p>
                </div>
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-light rounded-full flex items-center justify-center shrink-0">
                  <Coins className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Plans (dynamic from super admin – no static fallback) */}
          {plansLoading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Loading plans…
              </CardContent>
            </Card>
          ) : pricingPlans.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Coins className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-foreground">No credit plans available</p>
                <p className="text-xs text-muted-foreground mt-1">Plans are created by your administrator. Please check back later or contact support.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {pricingPlans.map((plan) => {
                const perCredit = plan.credits > 0 ? plan.price / plan.credits : 0;
                return (
                  <Card
                    key={plan.id}
                    className={`border shadow-sm relative overflow-hidden ${plan.popular ? "ring-2 ring-primary" : ""}`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 sm:px-3 py-1 rounded-bl-lg">
                        POPULAR
                      </div>
                    )}
                    <CardContent className="p-4 sm:p-5">
                      <h3 className="font-semibold text-base sm:text-lg">{plan.name}</h3>
                      <div className="mt-3 sm:mt-4 mb-4 sm:mb-6">
                        <span className="text-2xl sm:text-3xl font-bold">${plan.price}</span>
                        {plan.credits > 0 && (
                          <span className="text-xs sm:text-sm text-muted-foreground">/mo</span>
                        )}
                      </div>
                      <div className="space-y-2 mb-4 sm:mb-6">
                        <p className="text-xs sm:text-sm">
                          {plan.credits > 0
                            ? `${plan.credits.toLocaleString()} credits`
                            : "Unlimited credits"}
                        </p>
                        {perCredit > 0 && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            ${perCredit.toFixed(4)} per credit
                          </p>
                        )}
                      </div>
                      <Button
                        className={`w-full text-xs sm:text-sm ${plan.popular ? "theme-gradient-bg text-white border-0 hover:opacity-95" : ""}`}
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => handlePlanSelect(plan.id)}
                      >
                        Select Plan
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Payment Form */
        <Card className="max-w-2xl mx-auto w-full">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowPaymentForm(false)}
                className="p-0 h-8 w-8 sm:h-10 sm:w-10"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Payment Details</span>
              </CardTitle>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
            {/* Order Summary */}
            <div className="bg-muted rounded-lg p-3 sm:p-4">
              <h3 className="font-medium text-sm sm:text-base mb-2">Order Summary</h3>
              {selectedPlan && (
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span>{pricingPlans.find(p => p.id === selectedPlan)?.name} Plan</span>
                  <span className="font-semibold">${pricingPlans.find(p => p.id === selectedPlan)?.price}</span>
                </div>
              )}
            </div>

            {/* Payment Form */}
            <div className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber" className="text-xs sm:text-sm">Card Number</Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={paymentData.cardNumber}
                  onChange={(e) => updatePaymentData("cardNumber", e.target.value)}
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate" className="text-xs sm:text-sm">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    placeholder="MM/YY"
                    value={paymentData.expiryDate}
                    onChange={(e) => updatePaymentData("expiryDate", e.target.value)}
                    className="text-sm sm:text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv" className="text-xs sm:text-sm">CVV</Label>
                  <Input
                    id="cvv"
                    placeholder="123"
                    value={paymentData.cvv}
                    onChange={(e) => updatePaymentData("cvv", e.target.value)}
                    className="text-sm sm:text-base"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cardholderName" className="text-xs sm:text-sm">Cardholder Name</Label>
                <Input
                  id="cardholderName"
                  placeholder="John Doe"
                  value={paymentData.cardholderName}
                  onChange={(e) => updatePaymentData("cardholderName", e.target.value)}
                  className="text-sm sm:text-base"
                />
              </div>
            </div>

            <div className={`flex ${isMobile ? 'flex-col-reverse' : 'justify-between'} gap-2 sm:gap-0 pt-4 sm:pt-6 border-t`}>
              <Button 
                variant="outline" 
                onClick={() => setShowPaymentForm(false)}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePayment}
                disabled={purchaseMutation.isPending}
                className="w-full sm:w-auto text-xs sm:text-sm"
              >
                {purchaseMutation.isPending ? "Processing..." : "Complete Purchase"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
