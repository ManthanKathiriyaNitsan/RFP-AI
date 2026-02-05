import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApiStatus } from "@/contexts/ApiStatusContext";
import { queryClient } from "@/lib/queryClient";

export function ApiStatusBanner() {
  const status = useApiStatus();
  if (!status?.apiUnavailable) return null;

  const handleRetry = () => {
    queryClient.invalidateQueries();
    status.retry();
  };

  return (
    <div
      className="bg-destructive/10 border-b border-destructive/20 text-destructive px-4 py-2 flex items-center justify-center gap-3 flex-wrap"
      role="alert"
    >
      <AlertCircle className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium">
        We're having trouble connecting. Please check your network and try again.
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1.5 h-8">
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </Button>
        <Button variant="ghost" size="sm" onClick={status.dismiss} className="h-8 px-2" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
