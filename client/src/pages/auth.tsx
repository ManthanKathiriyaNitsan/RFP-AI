import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Brain, Eye, EyeOff, Mail, Lock, Sparkles, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="flex min-h-dvh font-sans bg-[#fafafa] dark:bg-gray-950 flex-col lg:flex-row">
      {/* Left panel – login form (wider and responsive) */}
      <div className="flex flex-1 flex-col justify-center items-center px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20 py-8 sm:py-12 w-full min-w-0 lg:max-w-[52rem] xl:max-w-[58rem]">
        <div className="w-full max-w-[min(100%,22rem)] sm:max-w-[26rem] md:max-w-[30rem] lg:max-w-[34rem] xl:max-w-[36rem] mx-auto">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 md:p-10 lg:p-12 shadow-sm">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8 sm:mb-10">
            {primaryLogoUrl ? (
              <img src={primaryLogoUrl} alt="RFP AI" className="h-10 w-10 rounded-lg object-contain" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                <Brain className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">RFP AI</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-[2rem] font-bold text-gray-900 dark:text-gray-100 mb-2">
            Welcome Back!
          </h1>
          <p className="text-[15px] sm:text-base text-gray-500 dark:text-gray-400 mb-6 sm:mb-8">
            Sign in to access your dashboard and continue managing your proposals.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  required
                  className="h-11 sm:h-12 pl-10 pr-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-offset-0 text-base"
                  style={{ borderColor: undefined }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                  required
                  className="h-11 sm:h-12 pl-10 pr-11 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-offset-0 text-base"
                  style={{ borderColor: undefined }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full w-10 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex justify-end pt-0.5">
                <Link href="/forgot-password">
                  <span className="text-sm cursor-pointer hover:underline font-medium text-primary">
                    Forgot Password?
                  </span>
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 sm:h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-[15px] sm:text-base hover:opacity-95"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2">
              Don&apos;t have an account?{" "}
              <Link href="/register">
                <span className="font-medium cursor-pointer hover:underline text-primary">
                  Create account
                </span>
              </Link>
            </p>
          </form>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">© 2026 RFP-AI. Enterprise AI Platform.</p>
        </div>
      </div>

      {/* Right panel – promotional; uses admin-chosen theme */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-center px-10 xl:px-16 py-12 xl:py-16 min-h-0 lg:min-h-dvh shrink-0 bg-primary"
        style={{
          background: "linear-gradient(180deg, var(--primary) 0%, var(--primary-shade) 50%, var(--primary) 100%)",
        }}
      >
        <div className="max-w-md xl:max-w-lg">
          <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-12">
            Smarter proposals & AI for your RFPs
          </h2>

          <ul className="space-y-6">
            <li className="flex items-start gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">AI-powered responses</p>
                <p className="text-sm text-white/80">Generate and refine answers with intelligent suggestions.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">One place for every RFP</p>
                <p className="text-sm text-white/80">Manage projects, knowledge base, and exports in one dashboard.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">Collaborate with your team</p>
                <p className="text-sm text-white/80">Invite collaborators and control access from a single place.</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
