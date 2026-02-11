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

/** Threshold below which we show a "credits low" warning (on load or after generation). */
export const LOW_CREDIT_WARNING_THRESHOLD = 100;

/** Credit levels at which we show an alert (browser + website notification). Each threshold fires once per session when credits is at or below it. */
export const CREDIT_ALERT_THRESHOLDS = [100, 50, 25, 20, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

const LOW_CREDITS_TOAST_SESSION_PREFIX = "low-credits-toast-shown-";
const CREDIT_THRESHOLD_NOTIFIED_PREFIX = "credit-threshold-notified-";

/** True if we already showed the low-credits toast this session for this role. */
export function hasShownLowCreditsToastThisSession(role: "admin" | "customer" | "collaborator"): boolean {
  try {
    return sessionStorage.getItem(LOW_CREDITS_TOAST_SESSION_PREFIX + role) === "1";
  } catch {
    return false;
  }
}

/** Mark that we showed the low-credits toast this session for this role. */
export function setLowCreditsToastShownThisSession(role: "admin" | "customer" | "collaborator"): void {
  try {
    sessionStorage.setItem(LOW_CREDITS_TOAST_SESSION_PREFIX + role, "1");
  } catch {
    // ignore
  }
}

/** Which credit thresholds we have already shown an alert for this session (per role). */
export function getCreditThresholdsNotifiedThisSession(role: "admin" | "customer" | "collaborator"): number[] {
  try {
    const raw = sessionStorage.getItem(CREDIT_THRESHOLD_NOTIFIED_PREFIX + role);
    if (!raw) return [];
    return raw.split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n));
  } catch {
    return [];
  }
}

/** Mark that we showed the threshold alert for this role so we don't repeat. */
export function markCreditThresholdNotifiedThisSession(role: "admin" | "customer" | "collaborator", threshold: number): void {
  try {
    const notified = getCreditThresholdsNotifiedThisSession(role);
    if (notified.includes(threshold)) return;
    sessionStorage.setItem(CREDIT_THRESHOLD_NOTIFIED_PREFIX + role, [...notified, threshold].sort((a, b) => b - a).join(","));
  } catch {
    // ignore
  }
}

/**
 * Returns toast/notification options for a "credits at threshold" alert.
 * Used when credits is at or below a specific level (100, 50, 25, 20, 15, 10, 9, 8, etc.).
 */
export function getCreditThresholdAlertOptions(
  threshold: number,
  creditsRemaining: number,
  options: { isAdmin: boolean; creditsHref?: string }
): { title: string; description: string; variant: "destructive"; actionHref: string } {
  const href = options.creditsHref ?? (options.isAdmin ? "/admin/credits" : "/rfp-projects");
  return {
    title: "Credits alert",
    description: `You have ${creditsRemaining} credit(s) left (at ${threshold} or below). ${options.isAdmin ? "Consider topping up." : "Contact your admin for more credits."}`,
    variant: "destructive",
    actionHref: href,
  };
}

/**
 * Returns the threshold we should alert for now (smallest threshold >= credits that we haven't notified yet), or null.
 */
export function getCreditThresholdToAlert(
  credits: number,
  role: "admin" | "customer" | "collaborator"
): number | null {
  if (credits < 0) return null;
  const notified = new Set(getCreditThresholdsNotifiedThisSession(role));
  const ascending = [...CREDIT_ALERT_THRESHOLDS].sort((a, b) => a - b);
  for (const t of ascending) {
    if (t >= credits && !notified.has(t)) return t;
  }
  return null;
}

/**
 * Returns toast options for a "credits low" warning (on load or after generate), or null if balance is above threshold.
 * Use creditsRemaining from sidebar/user or from generate response.
 */
export function getLowCreditsToastOptions(
  creditsRemaining: number | null | undefined,
  options: { isAdmin: boolean; creditsHref?: string; actionLabel?: string }
): { title: string; description: string; variant: "destructive"; actionHref: string; actionLabel: string } | null {
  if (creditsRemaining == null || creditsRemaining > LOW_CREDIT_WARNING_THRESHOLD) return null;
  const href = options.creditsHref ?? (options.isAdmin ? "/admin/credits" : "/rfp-projects");
  const actionLabel = options.actionLabel ?? (options.isAdmin ? "Buy credits" : "Go to Dashboard");
  return {
    title: "Credits low",
    description: `You have ${creditsRemaining} credit(s) left. ${options.isAdmin ? "Consider topping up." : "Contact your admin for more credits."}`,
    variant: "destructive",
    actionHref: href,
    actionLabel,
  };
}

/**
 * Returns toast options for "out of credits" (0 or less). Used for repeated notifications every 10s.
 * Returns null when credits > 0.
 */
export function getOutOfCreditsToastOptions(
  creditsRemaining: number | null | undefined,
  options: { isAdmin: boolean; creditsHref?: string; actionLabel?: string }
): { title: string; description: string; variant: "destructive"; actionHref: string; actionLabel: string } | null {
  if (creditsRemaining == null || creditsRemaining > 0) return null;
  const href = options.creditsHref ?? (options.isAdmin ? "/admin/credits" : "/rfp-projects");
  const actionLabel = options.actionLabel ?? (options.isAdmin ? "Buy credits" : "Go to Dashboard");
  return {
    title: "Out of credits",
    description: options.isAdmin ? "You have no credits left. Buy credits to continue." : "You have no credits left. Contact your admin for more credits.",
    variant: "destructive",
    actionHref: href,
    actionLabel,
  };
}

const CREDIT_ALERT_TAG = "credit-alert";

/**
 * Show a browser (system) notification. Requests permission if not yet set.
 * No-op if Notification API is unavailable or permission is denied.
 * Options: requireInteraction (stays until dismissed), tag (replaces same-tag notifications).
 */
export function showBrowserNotification(
  title: string,
  body: string,
  options?: { requireInteraction?: boolean; tag?: string }
): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const n = window.Notification;
  const opts: NotificationOptions = {
    body: body || title,
    tag: options?.tag ?? undefined,
    requireInteraction: options?.requireInteraction ?? false,
  };
  const show = () => {
    try {
      new n(title, opts);
    } catch {
      // ignore
    }
  };
  if (n.permission === "granted") {
    show();
    return;
  }
  if (n.permission === "default") {
    n.requestPermission().then((permission) => {
      if (permission === "granted") show();
    }).catch(() => {});
  }
}

/**
 * Show a browser notification for credit alerts (low / running out / out of credits).
 * Uses alert-style: stays until dismissed (requireInteraction), tagged so credit alerts are grouped.
 */
export function showCreditAlertBrowserNotification(title: string, body: string): void {
  showBrowserNotification(`Alert: ${title}`, body || title, {
    requireInteraction: true,
    tag: CREDIT_ALERT_TAG,
  });
}

/** Minimum deduction amount to show the "credits used" toast (e.g. every 5 credits). */
export const CREDITS_DEDUCTED_TOAST_THRESHOLD = 5;

/**
 * Returns toast options for "credits deducted" notification when balance drops by at least threshold.
 * Shows real credit numbers. Returns null when deducted < CREDITS_DEDUCTED_TOAST_THRESHOLD.
 */
export function getCreditsDeductedToastOptions(
  deducted: number,
  creditsRemaining: number,
  options: { isAdmin: boolean; creditsHref?: string; actionLabel?: string }
): { title: string; description: string; variant: "destructive"; actionHref: string; actionLabel: string } | null {
  if (deducted < CREDITS_DEDUCTED_TOAST_THRESHOLD) return null;
  const href = options.creditsHref ?? (options.isAdmin ? "/admin/credits" : "/rfp-projects");
  const actionLabel = options.actionLabel ?? (options.isAdmin ? "Manage credits" : "Go to Dashboard");
  return {
    title: "Credits used",
    description: `${deducted} credit(s) used. ${creditsRemaining} available.`,
    variant: "destructive",
    actionHref: href,
    actionLabel,
  };
}
