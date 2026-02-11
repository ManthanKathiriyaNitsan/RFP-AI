/**
 * Auth API – login is handled by useAuth; this module is for forgot/reset password.
 * Use these functions so the frontend contract is clear for backend implementation.
 */
import { getApiUrl } from "@/lib/api";
import { API_PATHS } from "@/lib/api-paths";

// --- Request/response types (backend contract) ---

export interface ForgotPasswordRequest {
  email: string;
}

/** Backend may return 200 with empty body or { message?: string }. */
export interface ForgotPasswordResponse {
  message?: string;
}

export interface ResetPasswordRequest {
  /** Token from the reset link query (e.g. ?token=... or ?reset_token=...) */
  token: string;
  newPassword: string;
}

/** Success may be empty or { message?: string }. Errors: 400/401/422 with { detail?: string | array }. */
export interface ResetPasswordResponse {
  message?: string;
}

// --- Validation (frontend-only, so flow works 100% before backend exists) ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test((email || "").trim());
}

export const PASSWORD_MIN_LENGTH = 6;

export function isValidNewPassword(password: string): boolean {
  return typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH;
}

// --- API calls ---

/**
 * Request a password reset link for the given email.
 * POST /api/v1/auth/forgot-password
 * Body: { email: string }
 * Success: 200 (any body). Frontend shows "check your email" either way for security.
 */
export async function forgotPassword(payload: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
  const email = (payload.email || "").trim();
  if (!email) throw new Error("Email is required.");
  const res = await fetch(getApiUrl(API_PATHS.auth.forgotPassword), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });
  const text = await res.text();
  let data: ForgotPasswordResponse & { detail?: string; message?: string } = {};
  try {
    if (text) data = JSON.parse(text) as ForgotPasswordResponse & { detail?: string; message?: string };
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const msg = data.detail ?? data.message ?? text ?? res.statusText;
    throw new Error(`${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  return data;
}

/**
 * Set a new password using the token from the reset link.
 * POST /api/v1/auth/reset-password
 * Body: { token: string, newPassword: string }
 * Success: 200. Error: 400/401/422 with detail/message.
 */
export async function resetPassword(payload: ResetPasswordRequest): Promise<ResetPasswordResponse> {
  const { token, newPassword } = payload;
  if (!(token && token.trim())) throw new Error("Reset token is required. Use the link from your email.");
  if (!isValidNewPassword(newPassword)) throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  const res = await fetch(getApiUrl(API_PATHS.auth.resetPassword), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token.trim(), newPassword }),
    credentials: "include",
  });
  const text = await res.text();
  let data: ResetPasswordResponse & { detail?: unknown; message?: string } = {};
  try {
    if (text) data = JSON.parse(text) as ResetPasswordResponse & { detail?: unknown; message?: string };
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const detail = data.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? (detail as { msg?: string }[]).map((d) => d.msg ?? "").join(" ").trim() || res.statusText
          : data.message ?? text ?? res.statusText;
    throw new Error(`${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  return data;
}
