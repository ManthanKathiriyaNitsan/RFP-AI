import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "admin_selected_org_id";
const EVENT_NAME = "admin_selected_org_changed";

/** Org id can be number (stub) or string (e.g. UUID from Python backend). */
type AdminSelectedOrgId = number | string | null;

type AdminSelectedOrgContextValue = {
  adminSelectedOrgId: AdminSelectedOrgId;
  setAdminSelectedOrgId: (id: AdminSelectedOrgId) => void;
};

const AdminSelectedOrgContext = createContext<AdminSelectedOrgContextValue | null>(null);

function readStored(): AdminSelectedOrgId {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    const n = parseInt(s, 10);
    return String(n) === s ? n : s;
  } catch {
    return null;
  }
}

export function AdminSelectedOrgProvider({ children }: { children: React.ReactNode }) {
  const [adminSelectedOrgId, setState] = useState<AdminSelectedOrgId>(readStored);

  const setAdminSelectedOrgId = useCallback((id: AdminSelectedOrgId) => {
    setState(id);
    try {
      if (id != null) {
        localStorage.setItem(STORAGE_KEY, String(id));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { orgId: id } }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const handle = (e: Event) => {
      const d = (e as CustomEvent<{ orgId: AdminSelectedOrgId }>).detail;
      if (d && (typeof d.orgId === "number" || typeof d.orgId === "string")) setState(d.orgId);
      else if (d && d.orgId === null) setState(null);
      else setState(readStored());
    };
    window.addEventListener(EVENT_NAME, handle);
    return () => window.removeEventListener(EVENT_NAME, handle);
  }, []);

  return (
    <AdminSelectedOrgContext.Provider value={{ adminSelectedOrgId, setAdminSelectedOrgId }}>
      {children}
    </AdminSelectedOrgContext.Provider>
  );
}

export function useAdminSelectedOrgId(): AdminSelectedOrgId {
  const ctx = useContext(AdminSelectedOrgContext);
  return ctx?.adminSelectedOrgId ?? null;
}

export function useAdminSelectedOrg(): AdminSelectedOrgContextValue {
  const ctx = useContext(AdminSelectedOrgContext);
  const noop = useCallback((_id: AdminSelectedOrgId) => {}, []);
  return ctx ?? { adminSelectedOrgId: null, setAdminSelectedOrgId: noop };
}
