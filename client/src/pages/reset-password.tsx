import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Brain, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";
import { resetPassword, isValidNewPassword, PASSWORD_MIN_LENGTH } from "@/api/auth";
import { parseApiError } from "@/lib/utils";

/** Read reset token from URL; backend may send ?token=... or ?reset_token=... or ?key=... */
function getResetTokenFromUrl(): string {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  return (params.get("token") ?? params.get("reset_token") ?? params.get("key") ?? "").trim();
}

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { primaryLogoUrl } = useBranding();

  useEffect(() => {
    setToken(getResetTokenFromUrl());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setConfirmError("");
    if (!token) {
      toast({ title: "Missing reset link", description: "Use the link from your password reset email.", variant: "destructive" });
      return;
    }
    if (!isValidNewPassword(password)) {
      setPasswordError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ token, newPassword: password });
      setSuccess(true);
      toast({ title: "Password reset", description: "You can now sign in with your new password." });
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
                    placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="new-password"
                    className={`pr-10 ${passwordError ? "border-destructive" : ""}`}
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "password-error" : undefined}
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
                {passwordError && (
                  <p id="password-error" className="text-sm text-destructive" role="alert">
                    {passwordError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (confirmError) setConfirmError("");
                    }}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="new-password"
                    className={`pr-10 ${confirmError ? "border-destructive" : ""}`}
                    aria-invalid={!!confirmError}
                    aria-describedby={confirmError ? "confirm-error" : undefined}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {confirmError && (
                  <p id="confirm-error" className="text-sm text-destructive" role="alert">
                    {confirmError}
                  </p>
                )}
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
