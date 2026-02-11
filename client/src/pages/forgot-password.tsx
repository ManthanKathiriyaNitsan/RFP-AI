import { useState } from "react";
import { useLocation } from "wouter";
import { Brain, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";
import { forgotPassword, isValidEmail } from "@/api/auth";
import { parseApiError } from "@/lib/utils";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { primaryLogoUrl } = useBranding();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    setEmailError("");
    if (!trimmed) {
      setEmailError("Email is required.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword({ email: trimmed });
      setSubmitted(true);
      toast({
        title: "Check your email",
        description: "If an account exists for this email, you will receive a password reset link.",
      });
    } catch (err) {
      const { message, isNetworkError } = parseApiError(err);
      toast({
        title: isNetworkError ? "Cannot reach server" : "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh items-center justify-center hero-gradient px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {primaryLogoUrl ? (
            <img src={primaryLogoUrl} alt="Logo" className="w-16 h-16 mx-auto rounded-xl object-contain bg-muted mb-4" />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
              <Brain className="w-8 h-8 text-primary-foreground" />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">RFP AI</h1>
          <p className="text-muted-foreground">Intelligent Proposal Management</p>
        </div>

        <Card className="glass-card shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl sm:text-2xl theme-gradient-text">
              Forgot password
            </CardTitle>
            <CardDescription>
              Enter your email and we’ll send you a link to reset your password.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {submitted ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  If an account exists for <strong className="text-foreground">{email}</strong>, you will receive a password reset link.
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => navigate("/auth")}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    required
                    autoComplete="email"
                    className={emailError ? "border-destructive" : ""}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "email-error" : undefined}
                  />
                  {emailError && (
                    <p id="email-error" className="text-sm text-destructive" role="alert">
                      {emailError}
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={() => navigate("/auth")}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
