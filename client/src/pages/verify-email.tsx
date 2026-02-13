import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useBranding } from "@/contexts/BrandingContext";
import { verifyEmail } from "@/api/auth";
import { authStorage } from "@/lib/auth";

export default function VerifyEmail() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { primaryLogoUrl } = useBranding();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");
  
  const token = new URLSearchParams(location.split("?")[1] || "").get("token") || "";

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("Verification token is missing. Please use the link from your email.");
        return;
      }

      try {
        const response = await verifyEmail({ token });
        
        // Store auth tokens
        if (response.accessToken && response.refreshToken) {
          authStorage.setAccessToken(response.accessToken);
          authStorage.setRefreshToken(response.refreshToken);
          if (response.user) {
            authStorage.setUser(response.user);
          }
        }
        
        setStatus("success");
        toast({
          title: "Email verified!",
          description: "Your account has been activated. Redirecting to dashboard...",
        });
        
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate("/customer/dashboard");
        }, 2000);
      } catch (error) {
        setStatus("error");
        const msg = error instanceof Error ? error.message : "Verification failed";
        setErrorMessage(msg.replace(/^\d{3}:\s*/, ""));
        
        toast({
          title: "Verification failed",
          description: msg.replace(/^\d{3}:\s*/, ""),
          variant: "destructive",
        });
      }
    };

    verify();
  }, [token, toast, navigate]);

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
          {status === "verifying" && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Verifying your email...
              </h2>
              <p className="text-gray-600">
                Please wait while we verify your email address.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Email Verified!
              </h2>
              <p className="text-gray-600 mb-6">
                Your account has been successfully activated. You will be redirected to your dashboard shortly.
              </p>
              <Button
                onClick={() => navigate("/customer/dashboard")}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                Go to Dashboard
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Verification Failed
              </h2>
              <p className="text-gray-600 mb-6">
                {errorMessage || "The verification link is invalid or has expired."}
              </p>
              <div className="space-y-3">
                <Link href="/auth">
                  <Button variant="outline" className="w-full">
                    <Mail className="w-4 h-4 mr-2" />
                    Request New Verification Email
                  </Button>
                </Link>
                <Link href="/auth">
                  <Button variant="ghost" className="w-full">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 RFP AI. Intelligent Proposal Management.
        </p>
      </div>
    </div>
  );
}
