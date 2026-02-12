import * as React from "react";
import hotToast, { type ToastOptions, type DefaultToastOptions } from "react-hot-toast";

/** Duration only; style/iconTheme come from HotToaster in App (theme-aware). */
const TOAST_OPTIONS: DefaultToastOptions = {
  duration: 4500,
};

type ToastParams = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
};

function toast(params: ToastParams) {
  const { title, description, variant = "default" } = params;
  const titleStr = typeof title === "string" ? title : title != null ? String(title) : "";
  const descStr = typeof description === "string" ? description : description != null ? String(description) : "";
  const message = descStr || titleStr || "Notification";
  const opts: ToastOptions = { ...TOAST_OPTIONS };

  if (titleStr && descStr) {
    const fullMessage = `${titleStr} — ${descStr}`;
    if (variant === "destructive") return hotToast.error(fullMessage, opts);
    return hotToast.success(fullMessage, opts);
  }

  if (variant === "destructive") {
    return hotToast.error(message, opts);
  }
  return hotToast.success(message, opts);
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string) => (toastId ? hotToast.dismiss(toastId) : hotToast.dismiss()),
    toasts: [] as unknown[],
  };
}

export { useToast, toast };
