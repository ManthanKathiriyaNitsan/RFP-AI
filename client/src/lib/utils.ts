import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Parse API error thrown by apiRequest (e.g. "422: {\"detail\":[...]}") into a user-friendly message and optional field errors. */
export function parseApiError(error: unknown): {
  message: string;
  fieldErrors?: Record<string, string>;
  isUnauthorized?: boolean;
  isNetworkError?: boolean;
} {
  const msg = error instanceof Error ? error.message : String(error);
  const fieldErrors: Record<string, string> = {};
  let message = msg;
  let isUnauthorized = false;
  let isNetworkError =
    /NetworkError|Failed to fetch|Load failed|network request failed/i.test(msg);

  // Server returned HTML (e.g. index.html or error page) instead of JSON — API route not hit
  if (/is not valid JSON|<!DOCTYPE|<html/i.test(msg)) {
    message =
      "The server returned a page instead of API data. Run the app with 'npm run dev' from the RFPSuite project root and open the URL it prints (e.g. http://localhost:5000). Do not open from a separate Vite server.";
    return {
      message,
      fieldErrors: undefined,
      isUnauthorized: false,
      isNetworkError: false,
    };
  }

  const statusMatch = msg.match(/^(\d+):\s*([\s\S]+)$/);
  if (statusMatch) {
    const [, statusStr, body] = statusMatch;
    const status = parseInt(statusStr!, 10);
    if (status === 401) {
      isUnauthorized = true;
      message = "Your session has expired or you are not logged in. Please log in again.";
    } else {
      try {
        const data = JSON.parse(body) as { detail?: unknown; message?: string };
        const detail = data.detail;
        if (Array.isArray(detail)) {
          const messages: string[] = [];
          for (const item of detail) {
            const d = item as { loc?: (string | number)[]; msg?: string };
            const loc = d.loc;
            const msgText = d.msg ?? "Invalid value";
            if (Array.isArray(loc) && loc.length >= 2 && loc[0] === "body" && typeof loc[1] === "string") {
              fieldErrors[loc[1]] = msgText;
            }
            messages.push(msgText);
          }
          message = messages.length > 0 ? messages.join(" ") : message;
        } else if (typeof detail === "string") {
          message = detail;
        } else if (typeof data.message === "string" && data.message.trim()) {
          message = data.message;
        }
      } catch {
        // keep message as-is
      }
    }
  } else if (!isNetworkError) {
    // Raw JSON body without status prefix (e.g. {"detail":"Not authenticated"})
    try {
      const data = JSON.parse(msg) as { detail?: unknown };
      if (typeof data.detail === "string" && /not authenticated|unauthorized|invalid.*token/i.test(data.detail)) {
        isUnauthorized = true;
        message = "Your session has expired or you are not logged in. Please log in again.";
      }
    } catch {
      // not JSON, keep message
    }
  } else {
    message =
      "Cannot reach the server. Please check your connection and that the API backend is running (and that VITE_API_BASE_URL points to it if you use a separate backend).";
  }

  return {
    message: message.length > 200 ? message.slice(0, 200) + "…" : message,
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
    isUnauthorized,
    isNetworkError,
  };
}
