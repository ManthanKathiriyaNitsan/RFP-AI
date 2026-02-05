import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface QueryErrorStateProps {
  /** User-visible message override; defaults to a generic message or error.message */
  message?: string;
  /** Refetch function from useQuery */
  refetch: () => void;
  /** Raw error from useQuery (used for default message) */
  error?: Error | null;
  /** Optional class for the wrapper */
  className?: string;
}

const NETWORK_LIKE = /fetch|network|connection|failed to fetch/i;

function getMessage(error: Error | null | undefined, override?: string): string {
  if (override) return override;
  if (!error?.message) return "Something went wrong. Please try again.";
  if (NETWORK_LIKE.test(error.message)) {
    return "Unable to connect. Please check your network and try again.";
  }
  if (error.message.startsWith("500") || error.message.startsWith("502") || error.message.startsWith("503")) {
    return "The server is temporarily unavailable. Please try again in a moment.";
  }
  return error.message.length > 120 ? "Something went wrong. Please try again." : error.message;
}

export function QueryErrorState({ message, refetch, error, className }: QueryErrorStateProps) {
  const displayMessage = getMessage(error, message);

  return (
    <div className={className}>
      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium">Unable to load</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{displayMessage}</p>
        </CardHeader>
        <CardContent>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
