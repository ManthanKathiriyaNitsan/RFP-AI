import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/api";
import { authStorage } from "@/lib/auth";
import { notifyApiUnavailable } from "@/contexts/ApiStatusContext";

const NETWORK_ERROR_MESSAGE = "Unable to connect. Please check your network and try again.";

function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError && (e.message === "Failed to fetch" || e.message === "Load failed")) return true;
  if (e instanceof Error && /fetch|network|connection/i.test(e.message)) return true;
  return false;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status >= 500) notifyApiUnavailable();
    const text = (await res.text()) || res.statusText;
    // 429 = rate limited; show a clear message
    if (res.status === 429) {
      throw new Error("429: Too many attempts. Please wait a minute and try again.");
    }
    // Include status so parseApiError can show a user-friendly message (e.g. 401 -> "Please log in again")
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
}

function getAuthHeaders(): Record<string, string> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/** Refresh response shape (backend returns expires_in in seconds). */
export type RefreshResponse = Parameters<typeof authStorage.updateFromRefresh>[0] & {
  expires_in?: number;
};

/** On 401 or proactively, try refresh token and update storage; returns true if refreshed. */
export async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return false;
  try {
    const url = getApiUrl("/api/v1/auth/refresh");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      credentials: "include",
    });
    if (!res.ok) {
      if (res.status === 401) authStorage.clearAuth();
      return false;
    }
    const data = (await res.json()) as RefreshResponse;
    authStorage.updateFromRefresh(data);
    return true;
  } catch {
    return false;
  }
}

export type ApiRequestOptions = {
  /** When true, do not send Authorization header (e.g. bootstrap first admin). */
  skipAuth?: boolean;
};

/**
 * Make an API request using the global base URL. Path is relative (e.g. /api/v1/auth/login).
 * Authorization Bearer is added automatically when user is logged in (unless options.skipAuth).
 * On 401, attempts token refresh once and retries the request (when not skipAuth).
 */
export async function apiRequest(
  method: string,
  path: string,
  data?: unknown | undefined,
  retriedOrOptions: boolean | ApiRequestOptions = false,
): Promise<Response> {
  const retried = typeof retriedOrOptions === "boolean" ? retriedOrOptions : false;
  const options: ApiRequestOptions = typeof retriedOrOptions === "object" ? retriedOrOptions : {};
  const url = getApiUrl(path);
  const headers: Record<string, string> = {
    ...(options.skipAuth ? {} : getAuthHeaders()),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    if (!options.skipAuth && res.status === 401 && !retried && (await tryRefreshToken())) {
      return apiRequest(method, path, data, true);
    }
    await throwIfResNotOk(res);
    return res;
  } catch (e) {
    if (isNetworkError(e)) {
      notifyApiUnavailable();
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw e;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      let path = queryKey[0] as string;
      if (queryKey.length > 1 && queryKey[1] && typeof queryKey[1] === "object") {
        const params = new URLSearchParams();
        const queryParams = queryKey[1] as Record<string, unknown>;
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
        if (params.toString()) path += `?${params.toString()}`;
      }
      const url = getApiUrl(path);
      const doFetch = (headers?: Record<string, string>) =>
        fetch(url, {
          credentials: "include",
          headers: headers ?? getAuthHeaders(),
        });
      let res = await doFetch();
      if (res.status === 401 && (await tryRefreshToken())) {
        res = await doFetch(getAuthHeaders());
      }
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }
      await throwIfResNotOk(res);
      return await res.json();
    } catch (e) {
      if (isNetworkError(e)) {
        notifyApiUnavailable();
        throw new Error(NETWORK_ERROR_MESSAGE);
      }
      throw e;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
