/**
 * Auth API – login is handled by useAuth; this module is for register and forgot/reset password.
 * Use these functions so the frontend contract is clear for backend implementation.
 */
import { getApiUrl } from "@/lib/api";
import { API_PATHS } from "@/lib/api-paths";

// --- Request/response types (backend contract) ---

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  message?: string;
  email?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: any;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  message?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

/** Backend may return 200 with empty body or { message?: string }. */
export interface ForgotPasswordResponse {
  message?: string;
}

export interface SendOTPRequest {
  email: string;
}

export interface SendOTPResponse {
  message?: string;
}

export interface VerifyOTPRequest {
  email: string;
  otpCode: string;
}

export interface VerifyOTPResponse {
  message?: string;
}

export interface ResetPasswordWithOTPRequest {
  email: string;
  otpCode: string;
  newPassword: string;
}

export interface ResetPasswordWithOTPResponse {
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
 * Register a new user.
 * POST /api/v1/auth/register
 * Body: { name: string, email: string, password: string }
 * Success: 201 or 200. Error: 400/409/422 with detail/message.
 */
export async function register(payload: RegisterRequest): Promise<RegisterResponse> {
  const name = (payload.name || "").trim();
  const email = (payload.email || "").trim();
  const password = payload.password ?? "";
  if (!name) throw new Error("Name is required.");
  if (!email) throw new Error("Email is required.");
  if (!isValidEmail(email)) throw new Error("Please enter a valid email address.");
  if (!isValidNewPassword(password)) throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  const res = await fetch(getApiUrl(API_PATHS.auth.register), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
    credentials: "include",
  });
  const text = await res.text();
  let data: RegisterResponse & { detail?: string; message?: string } = {};
  try {
    if (text) data = JSON.parse(text) as RegisterResponse & { detail?: string; message?: string };
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
 * Send OTP to email for password reset.
 * POST /api/v1/auth/send-otp
 * Body: { email: string }
 * Success: 200 (any body). Frontend shows "check your email" either way for security.
 */
export async function sendOTP(payload: SendOTPRequest): Promise<SendOTPResponse> {
  const email = (payload.email || "").trim();
  if (!email) throw new Error("Email is required.");
  if (!isValidEmail(email)) throw new Error("Please enter a valid email address.");
  
  const res = await fetch(getApiUrl("/api/v1/auth/send-otp"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });
  
  const text = await res.text();
  let data: SendOTPResponse & { detail?: string; message?: string } = {};
  try {
    if (text) data = JSON.parse(text) as SendOTPResponse & { detail?: string; message?: string };
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
 * Verify OTP code.
 * POST /api/v1/auth/verify-otp
 * Body: { email: string, otpCode: string }
 * Success: 200. Error: 400/401/422 with detail/message.
 */
export async function verifyOTP(payload: VerifyOTPRequest): Promise<VerifyOTPResponse> {
  const email = (payload.email || "").trim();
  const otpCode = (payload.otpCode || "").trim();
  
  if (!email) throw new Error("Email is required.");
  if (!otpCode) throw new Error("Verification code is required.");
  if (otpCode.length !== 6) throw new Error("Verification code must be 6 digits.");
  
  const res = await fetch(getApiUrl("/api/v1/auth/verify-otp"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otpCode }),
    credentials: "include",
  });
  
  const text = await res.text();
  let data: VerifyOTPResponse & { detail?: string; message?: string } = {};
  try {
    if (text) data = JSON.parse(text) as VerifyOTPResponse & { detail?: string; message?: string };
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
 * Reset password using verified OTP.
 * POST /api/v1/auth/reset-password-otp
 * Body: { email: string, otpCode: string, newPassword: string }
 * Success: 200. Error: 400/401/422 with detail/message.
 */
export async function resetPasswordWithOTP(payload: ResetPasswordWithOTPRequest): Promise<ResetPasswordWithOTPResponse> {
  const email = (payload.email || "").trim();
  const otpCode = (payload.otpCode || "").trim();
  const { newPassword } = payload;
  
  if (!email) throw new Error("Email is required.");
  if (!otpCode) throw new Error("Verification code is required.");
  if (otpCode.length !== 6) throw new Error("Verification code must be 6 digits.");
  if (!isValidNewPassword(newPassword)) throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  
  const res = await fetch(getApiUrl("/api/v1/auth/reset-password-otp"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otpCode, newPassword }),
    credentials: "include",
  });
  
  const text = await res.text();
  let data: ResetPasswordWithOTPResponse & { detail?: string; message?: string } = {};
  try {
    if (text) data = JSON.parse(text) as ResetPasswordWithOTPResponse & { detail?: string; message?: string };
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

/**
 * Verify email address using token from verification email.
 * POST /api/v1/auth/verify-email
 * Body: { token: string }
 * Success: 200 with login tokens. Error: 400/401 with detail/message.
 */
export async function verifyEmail(payload: VerifyEmailRequest): Promise<VerifyEmailResponse> {
  const { token } = payload;
  if (!(token && token.trim())) throw new Error("Verification token is required.");
  
  const res = await fetch(getApiUrl("/api/v1/auth/verify-email"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: token.trim() }),
    credentials: "include",
  });
  
  const text = await res.text();
  let data: VerifyEmailResponse & { detail?: string; message?: string } = {} as any;
  try {
    if (text) data = JSON.parse(text) as VerifyEmailResponse & { detail?: string; message?: string };
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
 * Resend email verification link.
 * POST /api/v1/auth/resend-verification
 * Body: { email: string }
 * Success: 200. Does not reveal if email exists for security.
 */
export async function resendVerification(payload: ResendVerificationRequest): Promise<ResendVerificationResponse> {
  const email = (payload.email || "").trim();
  if (!email) throw new Error("Email is required.");
  if (!isValidEmail(email)) throw new Error("Please enter a valid email address.");
  
  const res = await fetch(getApiUrl("/api/v1/auth/resend-verification"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });
  
  const text = await res.text();
  let data: ResendVerificationResponse & { detail?: string; message?: string } = {};
  try {
    if (text) data = JSON.parse(text) as ResendVerificationResponse & { detail?: string; message?: string };
  } catch {
    // non-JSON response
  }
  
  if (!res.ok) {
    const msg = data.detail ?? data.message ?? text ?? res.statusText;
    throw new Error(`${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  
  return data;
}
