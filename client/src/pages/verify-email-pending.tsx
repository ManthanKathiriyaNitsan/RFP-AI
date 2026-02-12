import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";
import { resendVerification } from "@/api/auth";

export default function VerifyEmailPending() {
  const [location] = useLocation();
  const { toast } = useToast();
  const { primaryLogoUrl } = useBranding();
  const [loading, setLoading] = useState(false);
  
  const email = new URLSearchParams(location.split("?")[1] || "").get("email") || "";

  const handleResend = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Email address not found. Please register again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await resendVerification({ email });
      toast({
        title: "Email sent",
        description: "If an unverified account exists, you will receive a new verification email.",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to resend email";
      toast({
        title: "Failed to resend",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh min-h-0 items-center justify-center bg-gradient-to-b from-teal-50 to-white px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {primaryLogoUrl ? (
            <img src={primaryLogoUrl} alt="Logo" className="h-12 mx-auto mb-4" />
          ) : (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">R</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">RFP AI</h1>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-teal-600" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-900 mb-3">
            Verify Your Email
          </h2>
          
          <p className="text-center text-gray-600 mb-6">
            We've sent a verification link to:
          </p>
          
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-6">
            <p className="text-center text-teal-900 font-medium break-all">{email}</p>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Click the link in the email to verify your account and start using RFP AI.
            </p>

            <p className="text-sm text-gray-600 text-center">
              The verification link will expire in 24 hours.
            </p>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 text-center mb-3">
                Didn't receive the email?
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Resend Verification Email
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/auth">
              <Button variant="ghost" className="text-sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 RFP AI. Intelligent Proposal Management.
        </p>
      </div>
    </div>
  );
}
