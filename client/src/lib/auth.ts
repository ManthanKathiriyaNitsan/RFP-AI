import type { User } from "@shared/schema";

export interface AuthState {
  user: User | null;
  currentRole: string;
  access_token?: string | null;
  refresh_token?: string | null;
  /** When the access token expires (ms since epoch). Used for proactive refresh. */
  access_token_expires_at?: number | null;
}

export const authStorage = {
  getAuth(): AuthState {
    const stored = localStorage.getItem("auth");
    if (stored) {
      try {
        const auth = JSON.parse(stored) as AuthState;
        // Normalize role to lowercase so redirects work regardless of API casing
        if (auth.currentRole && auth.currentRole !== auth.currentRole.toLowerCase()) {
          auth.currentRole = auth.currentRole.toLowerCase();
        }
        return auth;
      } catch (e) {
        localStorage.removeItem("auth");
      }
    }
    return { user: null, currentRole: "customer" };
  },

  setAuth(auth: AuthState): void {
    localStorage.setItem("auth", JSON.stringify(auth));
  },

  clearAuth(): void {
    localStorage.removeItem("auth");
  },

  /** Returns current access token for API Authorization header. */
  getAccessToken(): string | null {
    return this.getAuth().access_token ?? null;
  },

  /** Returns current refresh token for token refresh. */
  getRefreshToken(): string | null {
    return this.getAuth().refresh_token ?? null;
  },

  /**
   * Update stored auth from a refresh response (used when access token expires).
   * Call this after POST /api/v1/auth/refresh so subsequent requests use the new token.
   */
  updateFromRefresh(data: {
    access_token: string;
    refresh_token: string;
    /** Access token TTL in seconds (from backend). Used to set access_token_expires_at. */
    expires_in?: number;
    user: {
      id: number;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      company?: string | null;
      jobTitle?: string | null;
      bio?: string | null;
      credits: number;
      avatar?: string | null;
      createdAt: string;
      updatedAt: string;
    };
  }): void {
    const u = data.user;
    const user: User = {
      id: u.id,
      username: u.username,
      email: u.email,
      password: "",
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role as User["role"],
      company: u.company ?? null,
      jobTitle: u.jobTitle ?? null,
      bio: u.bio ?? null,
      credits: u.credits ?? 0,
      avatar: u.avatar ?? null,
      createdAt: new Date(u.createdAt),
      updatedAt: new Date(u.updatedAt),
    };
    // Backend refresh endpoint may not send expires_in; use 15 min (900s) to match backend default.
    const expiresInSeconds = data.expires_in ?? 900;
    const access_token_expires_at = Date.now() + expiresInSeconds * 1000;
    this.setAuth({
      user,
      currentRole: (data.user.role || "customer").toLowerCase(),
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      access_token_expires_at: access_token_expires_at ?? null,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth-refreshed"));
    }
  },
};
