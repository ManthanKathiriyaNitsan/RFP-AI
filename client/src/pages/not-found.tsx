import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { CopyrightFooter } from "@/components/shared/copyright-footer";

export default function NotFound() {
  const { user, currentRole } = useAuth();

  const homeRoute = useMemo(() => {
    if (!user) return "/auth";
    if (currentRole === "admin") return "/admin";
    if (currentRole === "collaborator") return "/collaborator";
    return "/dashboard";
  }, [user, currentRole]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 w-full flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2 sm:gap-3 mb-4">
              <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 text-destructive" />
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                404 Page Not Found
              </h1>
            </div>

            <p className="mt-2 sm:mt-4 text-xs sm:text-sm text-muted-foreground mb-5 sm:mb-6">
              The page you're looking for doesn't exist or has been moved.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Link href={homeRoute} className="flex-1">
                <Button className="w-full text-xs sm:text-sm">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Home
                </Button>
              </Link>
              {user && (
                <Link href="/account-settings" className="flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    className="w-full text-xs sm:text-sm"
                  >
                    Account Settings
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <CopyrightFooter />
    </div>
  );
}
