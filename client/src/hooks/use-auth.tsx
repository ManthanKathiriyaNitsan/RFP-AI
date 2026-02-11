import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { authStorage, type AuthState } from "@/lib/auth";
import { apiRequest, queryClient, tryRefreshToken } from "@/lib/queryClient";
import { fetchMyOrganizationId } from "@/api/me";
import { fetchCustomerSidebar } from "@/api/customer-data";
import { fetchCollaboratorSidebar } from "@/api/collaborator-data";
import { fetchBranding } from "@/api/admin-data";
import type { User } from "@shared/schema";

/** Wait for session API (full response). */
async function waitForSessionApi(): Promise<void> {
  const hasRefresh = !!authStorage.getRefreshToken();
  if (hasRefresh) {
    await tryRefreshToken();
    return;
  }
  const hasAccess = !!authStorage.getAccessToken();
  if (hasAccess) {
    await fetchMyOrganizationId();
  }
}

/** Wait for the main layout API for the user's role so first paint has data. */
async function waitForLayoutApi(role: string): Promise<void> {
  const r = (role || "customer").toLowerCase();
  try {
    if (r === "customer") {
      await fetchCustomerSidebar();
    } else if (r === "collaborator") {
      await fetchCollaboratorSidebar();
    } else if (r === "admin") {
      await fetchBranding();
    }
  } catch {
    // Still hide loader when API errors (e.g. 403, network) so user can see the app.
  }
}

/** Refresh access token this many ms before it expires. */
const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000;
/** How often to check whether to refresh (ms). */
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000;

/** Backend auth response (camelCase from FastAPI). */
interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
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
}

function apiUserToUser(u: TokenResponse["user"]): User {
  return {
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
}

interface AuthContextType extends AuthState {
  /** True while app is validating session (API not yet responded). Show global loader when true. */
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  switchRole: (role: string) => void;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

/** Default value when useAuth is used outside AuthProvider (e.g. 404 route or router timing). */
const DEFAULT_AUTH_CONTEXT: AuthContextType = {
  user: null,
  currentRole: "customer",
  access_token: null,
  refresh_token: null,
  access_token_expires_at: null,
  isInitializing: false,
  login: () => Promise.reject(new Error("Not within AuthProvider")),
  logout: () => {},
  switchRole: () => {},
  updateUser: () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const initialAuth = authStorage.getAuth();
  const [auth, setAuth] = useState<AuthState>(() => initialAuth);
  const [isInitializing, setIsInitializing] = useState<boolean>(() => !!initialAuth.access_token);
  const initRan = useRef(false);

  useEffect(() => {
    authStorage.setAuth(auth);
  }, [auth]);

  useEffect(() => {
    const onRefreshed = () => setAuth(authStorage.getAuth());
    window.addEventListener("auth-refreshed", onRefreshed);
    return () => window.removeEventListener("auth-refreshed", onRefreshed);
  }, []);

  // Keep full-page loader until session API and role layout API have completed (full response), then show app.
  useEffect(() => {
    if (!isInitializing || initRan.current) return;
    initRan.current = true;
    (async () => {
      await waitForSessionApi();
      const authAfterSession = authStorage.getAuth();
      setAuth(authAfterSession);
      const role = (authAfterSession.user?.role ?? authAfterSession.currentRole ?? "customer").toLowerCase();
      await waitForLayoutApi(role);
      setAuth(authStorage.getAuth());
      setIsInitializing(false);
    })();
  }, [isInitializing]);

  // Proactive refresh: refresh access token shortly before it expires (e.g. 15 min TTL).
  useEffect(() => {
    if (!auth.user || !auth.access_token) return;
    const id = setInterval(() => {
      const stored = authStorage.getAuth();
      const expiresAt = stored.access_token_expires_at;
      if (expiresAt != null && Date.now() >= expiresAt - REFRESH_BEFORE_EXPIRY_MS) {
        tryRefreshToken();
      }
    }, REFRESH_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [auth.user, auth.access_token]);

  const login = async (email: string, password: string): Promise<User> => {
    let res: Response;
    try {
      res = await apiRequest("POST", "/api/v1/auth/login", { email, password });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Unable to connect|network|fetch|connection/i.test(msg)) {
        throw new Error("Cannot connect to server. Please check your connection and try again.");
      }
      throw e;
    }
    const text = await res.text();
    let data: TokenResponse;
    try {
      data = text ? (JSON.parse(text) as TokenResponse) : ({} as TokenResponse);
    } catch {
      throw new Error("Login response was not valid JSON. The backend may have returned an error page. Ensure the RFP-AI backend is running and, if the frontend is on a different host, set VITE_API_BASE_URL in client/.env to the backend URL (e.g. http://localhost:8000).");
    }
    if (!data?.access_token || !data?.user) {
      throw new Error("Invalid login response from server. Ensure the RFP-AI backend is running and reachable.");
    }
    const user = apiUserToUser(data.user);
    const expiresInMs = (data.expires_in ?? 15 * 60) * 1000;
    const newAuth: AuthState = {
      user,
      currentRole: (data.user.role || "customer").toLowerCase(),
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      access_token_expires_at: Date.now() + expiresInMs,
    };
    setAuth(newAuth);
    // Persist immediately so the next request (e.g. GET /api/v1/proposals) has the token
    authStorage.setAuth(newAuth);
    // Defer invalidation so storage is committed and any pending renders see the new auth before refetches run
    queueMicrotask(() => queryClient.invalidateQueries());
    return user;
  };

  const logout = () => {
    setAuth({ user: null, currentRole: "customer" });
    authStorage.clearAuth();
  };

  const switchRole = (role: string) => {
    setAuth(prev => ({ ...prev, currentRole: role }));
  };

  const updateUser = (updates: Partial<User>) => {
    if (auth.user) {
      setAuth(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, ...updates } : null,
      }));
    }
  };

  return (
    <AuthContext.Provider value={{
      ...auth,
      isInitializing,
      login,
      logout,
      switchRole,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context ?? DEFAULT_AUTH_CONTEXT;
}
