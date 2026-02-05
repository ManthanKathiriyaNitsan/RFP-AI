import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

const API_UNAVAILABLE_EVENT = "api-unavailable";
const API_OK_EVENT = "api-ok";

export interface ApiStatusContextType {
  apiUnavailable: boolean;
  dismiss: () => void;
  retry: () => void;
}

const ApiStatusContext = createContext<ApiStatusContextType | null>(null);

export function ApiStatusProvider({ children }: { children: ReactNode }) {
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onUnavailable = () => {
      setApiUnavailable(true);
      setDismissed(false);
    };
    const onOk = () => {
      setApiUnavailable(false);
      setDismissed(false);
    };
    window.addEventListener(API_UNAVAILABLE_EVENT, onUnavailable);
    window.addEventListener(API_OK_EVENT, onOk);
    return () => {
      window.removeEventListener(API_UNAVAILABLE_EVENT, onUnavailable);
      window.removeEventListener(API_OK_EVENT, onOk);
    };
  }, []);

  const dismiss = useCallback(() => setDismissed(true), []);
  const retry = useCallback(() => {
    setDismissed(true);
    setApiUnavailable(false);
    window.dispatchEvent(new CustomEvent(API_OK_EVENT));
  }, []);

  const showBanner = apiUnavailable && !dismissed;

  return (
    <ApiStatusContext.Provider
      value={{
        apiUnavailable: showBanner,
        dismiss,
        retry,
      }}
    >
      {children}
    </ApiStatusContext.Provider>
  );
}

export function useApiStatus() {
  const ctx = useContext(ApiStatusContext);
  return ctx;
}

/** Call from outside React (e.g. queryClient) when API/network failure is detected */
export function notifyApiUnavailable() {
  window.dispatchEvent(new CustomEvent(API_UNAVAILABLE_EVENT));
}

/** Call when API is back (e.g. after a successful refetch) */
export function notifyApiOk() {
  window.dispatchEvent(new CustomEvent(API_OK_EVENT));
}
