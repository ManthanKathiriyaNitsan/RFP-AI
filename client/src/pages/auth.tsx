import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Brain, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";

export default function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const { primaryLogoUrl } = useBranding();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(formData.email, formData.password);

      const userRole = (user.role || "").toLowerCase();

      // Yield so React commits auth state and storage; then navigate so the next page sees the token
      await new Promise((r) => setTimeout(r, 0));

      if (userRole === "admin") {
        navigate("/admin");
      } else if (userRole === "collaborator") {
        navigate("/collaborator");
      } else {
        navigate("/dashboard");
      }

      toast({
        title: "Welcome back!",
        description: "You've been logged in successfully.",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Authentication failed";
      const statusMatch = msg.match(/^(\d{3}):\s*/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : null;

      const isNetworkError =
        error instanceof TypeError ||
        /failed to fetch|load failed|networkerror|connection refused|network error/i.test(msg);

      let title = "Error";
      let description = msg;

      if (status === 401) {
        title = "Login failed";
        description = "Invalid email or password. Try again or contact your administrator to reset your password.";
      } else if (status === 422) {
        title = "Invalid input";
        description = "Please check your details and try again.";
      } else if (status !== null && status >= 500) {
        title = "Server error";
        description = "Something went wrong on the server. Please try again in a moment.";
      } else if (isNetworkError) {
        title = "Cannot reach server";
        description =
          "Make sure the RFP-AI backend is running. If the frontend and backend are on different machines, set VITE_API_BASE_URL in client/.env to the backend URL. Run the backend with --host 0.0.0.0 if you connect from another device.";
      } else if (
        msg.includes("valid JSON") ||
        msg.includes("Invalid login response")
      ) {
        title = "Unexpected response";
        description =
          "The server returned an unexpected response. Check that the backend is running and VITE_API_BASE_URL in client/.env points to it.";
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh items-center justify-center hero-gradient px-4 py-8 sm:py-12">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
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
              Welcome back
            </CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <Link href="/forgot-password" className="inline-block">
                  <Button type="button" variant="link" className="h-auto p-0 text-sm text-primary hover:underline">
                    Forgot password?
                  </Button>
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
