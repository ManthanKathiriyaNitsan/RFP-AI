import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Brain, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";
import { getApiUrl } from "@/lib/api";
import { API_PATHS } from "@/lib/api-paths";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { primaryLogoUrl } = useBranding();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") ?? "";
    setToken(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      toast({ title: "Missing reset link", description: "Use the link from your password reset email.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please re-enter your new password.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(API_PATHS.auth.resetPassword), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), newPassword: password }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data.detail ?? res.statusText) || "Request failed";
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
      setSuccess(true);
      toast({ title: "Password reset", description: "You can now sign in with your new password." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex h-dvh items-center justify-center hero-gradient px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <Card className="glass-card shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="theme-gradient-text">Password reset</CardTitle>
              <CardDescription>Your password has been updated. Sign in with your new password.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full gap-2" onClick={() => navigate("/auth")}>
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-dvh items-center justify-center hero-gradient px-4 py-8 sm:py-12">
        <div className="w-full max-w-md">
          <Card className="glass-card shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="theme-gradient-text">Invalid reset link</CardTitle>
              <CardDescription>This page requires a valid reset link from your email. Request a new one from the sign-in page.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/forgot-password">
                <Button variant="outline" className="w-full gap-2">
                  Forgot password
                </Button>
              </Link>
              <Button variant="ghost" className="w-full gap-2 mt-2" onClick={() => navigate("/auth")}>
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
          <p className="text-muted-foreground">Set a new password</p>
        </div>

        <Card className="glass-card shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl sm:text-2xl theme-gradient-text">Reset password</CardTitle>
            <CardDescription>Enter your new password below.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword((p) => !p)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Resetting…" : "Reset password"}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
