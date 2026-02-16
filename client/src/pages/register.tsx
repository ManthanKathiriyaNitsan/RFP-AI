import { useState, useCallback, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Brain, Eye, EyeOff, Mail, Lock, User, Sparkles, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";
import { register as registerApi, isValidEmail, PASSWORD_MIN_LENGTH } from "@/api/auth";

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { primaryLogoUrl } = useBranding();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirm?: string }>({});

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    const email = formData.email.trim();
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;

    const next: typeof errors = {};
    if (!name) next.name = "Name is required.";
    if (!email) next.email = "Email is required.";
    else if (!isValidEmail(email)) next.email = "Please enter a valid email address.";
    if (!password) next.password = "Password is required.";
    else if (password.length < PASSWORD_MIN_LENGTH)
      next.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    if (password !== confirmPassword) next.confirm = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const response = await registerApi({ name, email, password });
      toast({
        title: "Check your email",
        description: response.message || "Please check your email to verify your account and complete registration.",
      });
      // Navigate to a verification pending page or show success message
      navigate(`/verify-email-pending?email=${encodeURIComponent(email)}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Registration failed";
      const statusMatch = msg.match(/^(\d{3}):\s*/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : null;
      let description = msg;
      if (status === 409) description = "An account with this email already exists. Try signing in.";
      else if (status === 422) description = "Please check your details and try again.";
      else if (status !== null && status >= 500) description = "Something went wrong on the server. Please try again.";
      toast({
        title: "Registration failed",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [formData, navigate, toast]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, name: e.target.value }));
      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
    },
    [errors.name]
  );

  const handleEmailChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, email: e.target.value }));
      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
    },
    [errors.email]
  );

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, password: e.target.value }));
      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
    },
    [errors.password]
  );

  const handleConfirmPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }));
      if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: undefined }));
    },
    [errors.confirm]
  );

  const toggleShowPassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const toggleShowConfirm = useCallback(() => {
    setShowConfirm((prev) => !prev);
  }, []);

  const leftPanelStyle = useMemo(
    () => ({
      background: "linear-gradient(180deg, var(--primary) 0%, var(--primary-shade) 50%, var(--primary) 100%)",
    }),
    []
  );

  return (
    <div className="flex h-dvh min-h-0 font-sans bg-[#fafafa] dark:bg-gray-950 flex-col lg:flex-row overflow-hidden">
      {/* Left panel – promotional content (form on right) */}
      <div
        className="order-2 lg:order-1 hidden lg:flex flex-1 flex-col justify-center px-8 xl:px-12 py-8 xl:py-10 min-h-0 shrink-0 overflow-auto"
        style={leftPanelStyle}
      >
        <div className="max-w-md xl:max-w-lg">
          <h2 className="text-2xl xl:text-3xl font-bold text-white leading-tight mb-6 xl:mb-8">
            Smarter proposals & AI for your RFPs
          </h2>
          <ul className="space-y-4">
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

      {/* Right panel – form (compact so no scroll) */}
      <div className="order-1 lg:order-2 flex flex-1 flex-col justify-center items-center min-h-0 overflow-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 lg:py-6 w-full min-w-0 lg:max-w-[52rem] xl:max-w-[58rem]">
        <div className="w-full max-w-[min(100%,22rem)] sm:max-w-[26rem] md:max-w-[30rem] lg:max-w-[34rem] xl:max-w-[36rem] mx-auto my-auto">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 md:p-7 lg:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-5 sm:mb-6">
              {primaryLogoUrl ? (
                <img src={primaryLogoUrl} alt="RFP AI" className="h-10 w-10 rounded-lg object-contain" />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary">
                  <Brain className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              <span className="text-xl font-bold text-gray-900 dark:text-gray-100">RFP AI</span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-[1.75rem] font-bold text-gray-900 dark:text-gray-100 mb-1">
              Create account
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 sm:mb-5">
              Sign up to manage your proposals and collaborate with your team.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={handleNameChange}
                    required
                    autoComplete="name"
                    className={`h-10 sm:h-11 pl-10 pr-4 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-offset-0 text-sm ${errors.name ? "border-destructive" : "border-gray-200 dark:border-gray-700"}`}
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
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
                    onChange={handleEmailChange}
                    required
                    autoComplete="email"
                    className={`h-10 sm:h-11 pl-10 pr-4 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-offset-0 text-sm ${errors.email ? "border-destructive" : "border-gray-200 dark:border-gray-700"}`}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
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
                    onChange={handlePasswordChange}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="new-password"
                    className={`h-10 sm:h-11 pl-10 pr-11 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-offset-0 text-sm ${errors.password ? "border-destructive" : "border-gray-200 dark:border-gray-700"}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                    onClick={toggleShowPassword}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password ? (
                  <p className="text-sm text-destructive" role="alert">{errors.password}</p>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">At least {PASSWORD_MIN_LENGTH} characters.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleConfirmPasswordChange}
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    autoComplete="new-password"
                    className={`h-10 sm:h-11 pl-10 pr-11 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-offset-0 text-sm ${errors.confirm ? "border-destructive" : "border-gray-200 dark:border-gray-700"}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-10 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                    onClick={toggleShowConfirm}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.confirm && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.confirm}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-10 sm:h-11 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95"
                disabled={loading}
              >
                {loading ? "Creating account…" : "Create account"}
              </Button>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Already have an account?{" "}
                <Link href="/auth">
                  <span className="font-medium cursor-pointer hover:underline text-primary">
                    Sign in
                  </span>
                </Link>
              </p>
            </form>
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">© 2026 RFP-AI. Enterprise AI Platform.</p>
        </div>
      </div>
    </div>
  );
}
