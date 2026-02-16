import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { Brain, ArrowLeft, Mail, Lock, ShieldCheck, Sparkles, FileText, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";
import { sendOTP, verifyOTP, resetPasswordWithOTP, isValidEmail, PASSWORD_MIN_LENGTH } from "@/api/auth";
import { parseApiError } from "@/lib/utils";

type Step = "email" | "otp" | "password" | "success";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { primaryLogoUrl } = useBranding();

  const [timeRemaining, setTimeRemaining] = useState(600);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (step === "otp" && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeRemaining]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const handleSendOTP = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      await sendOTP({ email: trimmed });
      setStep("otp");
      setTimeRemaining(600);
      setCanResend(false);
      toast({
        title: "Code sent",
        description: "If an account exists for this email, you will receive a verification code.",
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
  }, [email, toast]);

  const handleVerifyOTP = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedOtp = otp.trim();
    setOtpError("");
    if (!trimmedOtp) {
      setOtpError("Verification code is required.");
      return;
    }
    if (trimmedOtp.length !== 6) {
      setOtpError("Verification code must be 6 digits.");
      return;
    }
    setLoading(true);
    try {
      await verifyOTP({ email, otpCode: trimmedOtp });
      setStep("password");
      toast({
        title: "Code verified",
        description: "Please set your new password.",
      });
    } catch (err) {
      const { message } = parseApiError(err);
      setOtpError(message);
      toast({
        title: "Verification failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [email, otp, toast]);

  const handleResetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    if (!newPassword) {
      setPasswordError("Password is required.");
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setPasswordError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithOTP({ email, otpCode: otp, newPassword });
      setStep("success");
      toast({
        title: "Password reset successful",
        description: "You can now sign in with your new password.",
      });
    } catch (err) {
      const { message } = parseApiError(err);
      toast({
        title: "Reset failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [email, newPassword, confirmPassword, otp, toast]);

  const handleResendOTP = useCallback(async () => {
    setCanResend(false);
    setOtp("");
    setOtpError("");
    await handleSendOTP();
  }, [handleSendOTP]);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (emailError) setEmailError("");
  }, [emailError]);

  const handleOtpChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(value);
    if (otpError) setOtpError("");
  }, [otpError]);

  const handleNewPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value);
    if (passwordError) setPasswordError("");
  }, [passwordError]);

  const handleConfirmPasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (passwordError) setPasswordError("");
  }, [passwordError]);

  const handleChangeEmail = useCallback(() => {
    setStep("email");
    setOtp("");
    setOtpError("");
  }, []);

  const handleGoToSignIn = useCallback(() => {
    navigate("/auth");
  }, [navigate]);

  const stepTitle = useMemo(
    () =>
      step === "email"
        ? "Forgot password"
        : step === "otp"
          ? "Verify code"
          : step === "password"
            ? "Set new password"
            : "Success!",
    [step]
  );

  const stepDescription = useMemo(
    () =>
      step === "email"
        ? "Enter your email to receive a verification code."
        : step === "otp"
          ? "Enter the 6-digit code sent to your email."
          : step === "password"
            ? "Choose a strong password for your account."
            : "Your password has been reset successfully.",
    [step]
  );

  const rightPanelStyle = useMemo(
    () => ({
      background: "linear-gradient(180deg, var(--primary) 0%, var(--primary-shade) 50%, var(--primary) 100%)",
    }),
    []
  );

  return (
    <div className="flex min-h-dvh font-sans bg-[#fafafa] dark:bg-gray-950 flex-col lg:flex-row">
      {/* Left panel – form (same layout as login) */}
      <div className="flex flex-1 flex-col justify-center items-center px-4 sm:px-8 md:px-12 lg:px-16 xl:px-20 py-8 sm:py-12 w-full min-w-0 lg:max-w-[52rem] xl:max-w-[58rem]">
        <div className="w-full max-w-[min(100%,22rem)] sm:max-w-[26rem] md:max-w-[30rem] lg:max-w-[34rem] xl:max-w-[36rem] mx-auto">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 md:p-10 lg:p-12 shadow-sm">
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
              {stepTitle}
            </h1>
            <p className="text-[15px] sm:text-base text-gray-500 dark:text-gray-400 mb-6 sm:mb-8">
              {stepDescription}
            </p>

            {step === "email" && (
              <form onSubmit={handleSendOTP} className="space-y-5 sm:space-y-6">
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
                      value={email}
                      onChange={handleEmailChange}
                      required
                      autoComplete="email"
                      className={`h-11 sm:h-12 pl-10 pr-4 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-offset-0 text-base ${emailError ? "border-destructive" : "border-gray-200 dark:border-gray-700"}`}
                      aria-invalid={!!emailError}
                      aria-describedby={emailError ? "email-error" : undefined}
                    />
                  </div>
                  {emailError && (
                    <p id="email-error" className="text-sm text-destructive" role="alert">
                      {emailError}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-[15px] sm:text-base hover:opacity-95"
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Send verification code"}
                </Button>
                <Link href="/auth">
                  <span className="inline-flex items-center gap-2 text-sm cursor-pointer hover:underline font-medium mt-4 block text-primary">
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </span>
                </Link>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleVerifyOTP} className="space-y-5 sm:space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Verification Code
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={handleOtpChange}
                    required
                    maxLength={6}
                    className={`h-11 sm:h-12 text-center text-xl tracking-widest rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus-visible:ring-2 focus-visible:ring-offset-0 ${otpError ? "border-destructive" : "border-gray-200 dark:border-gray-700"}`}
                    aria-invalid={!!otpError}
                    aria-describedby={otpError ? "otp-error" : undefined}
                  />
                  {otpError && (
                    <p id="otp-error" className="text-sm text-destructive" role="alert">
                      {otpError}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {timeRemaining > 0 ? (
                      <>Code expires in {formatTime(timeRemaining)}</>
                    ) : (
                      <span className="text-destructive">Code has expired</span>
                    )}
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-[15px] sm:text-base hover:opacity-95"
                  disabled={loading || timeRemaining === 0}
                >
                  {loading ? "Verifying…" : "Verify code"}
                </Button>
                {canResend && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 sm:h-12 rounded-lg border-gray-200 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-300"
                    onClick={handleResendOTP}
                    disabled={loading}
                  >
                    Resend code
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                  onClick={handleChangeEmail}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Change email
                </Button>
              </form>
            )}

            {step === "password" && (
              <form onSubmit={handleResetPassword} className="space-y-5 sm:space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    New Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={handleNewPasswordChange}
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                      className={`h-11 sm:h-12 pl-10 pr-4 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-offset-0 text-base ${passwordError ? "border-destructive" : "border-gray-200 dark:border-gray-700"}`}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      required
                      minLength={PASSWORD_MIN_LENGTH}
                      className={`h-11 sm:h-12 pl-10 pr-4 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-offset-0 text-base ${passwordError ? "border-destructive" : "border-gray-200 dark:border-gray-700"}`}
                    />
                  </div>
                  {passwordError && (
                    <p className="text-sm text-destructive" role="alert">
                      {passwordError}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Password must be at least {PASSWORD_MIN_LENGTH} characters.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 sm:h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-[15px] sm:text-base hover:opacity-95"
                  disabled={loading}
                >
                  {loading ? "Resetting…" : "Reset password"}
                </Button>
              </form>
            )}

            {step === "success" && (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30">
                    <ShieldCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-[15px] text-gray-500 dark:text-gray-400 text-center">
                  Your password has been reset successfully. You can now sign in with your new password.
                </p>
                <Button
                  className="w-full h-11 sm:h-12 rounded-lg bg-primary text-primary-foreground font-semibold text-[15px] sm:text-base hover:opacity-95"
                  onClick={handleGoToSignIn}
                >
                  Go to sign in
                </Button>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">© 2026 RFP-AI. Enterprise AI Platform.</p>
        </div>
      </div>

      {/* Right panel – promotional; uses admin-chosen theme */}
      <div
        className="hidden lg:flex flex-1 flex-col justify-center px-10 xl:px-16 py-12 xl:py-16 min-h-0 lg:min-h-dvh shrink-0"
        style={rightPanelStyle}
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
