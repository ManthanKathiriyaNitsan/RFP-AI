import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchBranding, DEFAULT_COLOR_PRESETS, type BrandingData, type BrandingColorPreset } from "@/api/admin-data";
import { useOrganizationId } from "@/hooks/use-organization-id";
import { useAuth } from "@/hooks/use-auth";
import { useAdminSelectedOrgId } from "@/contexts/AdminSelectedOrgContext";

function isAdminPanelRole(role: string): boolean {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "super_admin";
}

const BRANDING_CSS_VARS = [
  "--primary",
  "--primary-shade",
  "--ring",
  "--sidebar-accent",
  "--secondary",
  "--primary-foreground",
  "--theme-gradient",
  "--theme-gradient-r",
] as const;

const DEFAULT_BRANDING: BrandingData = {
  primaryLogoUrl: null,
  faviconUrl: null,
  colorTheme: "Teal",
  colorPresets: [],
};

/** Convert hex color to HSL string (e.g. "252, 87%, 58%") for use in hsl(var). Exported for theme preview in Settings. */
export function hexToHsl(hex: string): string {
  const h = hex.replace(/^#/, "");
  if (h.length !== 6 && h.length !== 3) return "252, 87%, 58%";
  let r: number, g: number, b: number;
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16) / 255;
    g = parseInt(h[1] + h[1], 16) / 255;
    b = parseInt(h[2] + h[2], 16) / 255;
  } else {
    r = parseInt(h.slice(0, 2), 16) / 255;
    g = parseInt(h.slice(2, 4), 16) / 255;
    b = parseInt(h.slice(4, 6), 16) / 255;
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }
  let hue = 0;
  if (max !== min) {
    switch (max) {
      case r:
        hue = ((g - b) / (max - min)) % 6;
        break;
      case g:
        hue = (b - r) / (max - min) + 2;
        break;
      default:
        hue = (r - g) / (max - min) + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const H = Math.round(hue);
  const S = Math.round(s * 100);
  const L = Math.round(l * 100);
  return `${H}, ${S}%, ${L}%`;
}

interface BrandingContextValue extends BrandingData {
  isLoading: boolean;
  /** Refetch branding. Pass organizationId to apply that org's theme site-wide (e.g. after saving in Settings). */
  refetch: (organizationId?: number | string) => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({
  children,
  organizationId: organizationIdProp,
}: {
  children: React.ReactNode;
  /** When set (e.g. in admin), fetch branding for this org. Otherwise use current user's org (customer/collaborator) or first org. */
  organizationId?: number | string;
}) {
  const { user, currentRole } = useAuth();
  const { organizationId: userOrgId } = useOrganizationId();
  const adminSelectedOrgId = useAdminSelectedOrgId();
  const effectiveOrgId: number | string | undefined =
    organizationIdProp ??
    (isAdminPanelRole(currentRole ?? "") ? (adminSelectedOrgId ?? undefined) : undefined) ??
    (userOrgId ?? undefined);

  const [data, setData] = useState<BrandingData>(DEFAULT_BRANDING);
  const [isLoading, setIsLoading] = useState(true);
  const faviconEl = useRef<HTMLLinkElement | null>(null);

  const refetch = useCallback(async (overrideOrgId?: number | string) => {
    setIsLoading(true);
    try {
      const orgId = overrideOrgId ?? effectiveOrgId;
      const next = await fetchBranding(orgId);
      setData(next);
    } catch {
      setData(DEFAULT_BRANDING);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveOrgId]);

  // When logged out: fetch default org branding so login/register/forgot-password use admin-chosen theme.
  // When logged in: fetch org branding for current user/admin context.
  // If fetch fails when logged out, keep previous branding so theme does not flash back to default.
  useEffect(() => {
    if (!user) {
      setIsLoading(true);
      fetchBranding(undefined)
        .then((next) => setData(next))
        .catch(() => {
          // Keep current data so theme (e.g. Rose) persists on login page after logout; do not reset to default
        })
        .finally(() => setIsLoading(false));
    } else {
      refetch();
    }
  }, [user, refetch]);

  // Apply color theme (CSS variables) site-wide (including login/register/forgot-password when logged out).
  useEffect(() => {
    const root = document.documentElement;

    const themeName = (data.colorTheme || "").trim();
    const preset: BrandingColorPreset | undefined =
      data.colorPresets.find((p) => p.name.toLowerCase() === themeName.toLowerCase()) ??
      DEFAULT_COLOR_PRESETS.find((p) => p.name.toLowerCase() === themeName.toLowerCase()) ??
      data.colorPresets[0] ??
      DEFAULT_COLOR_PRESETS[0];

    if (preset) {
      const primaryHsl = hexToHsl(preset.primary);
      const secondaryHsl = hexToHsl(preset.secondary);
      const setVar = (name: string, value: string) => {
        root.style.setProperty(name, value, "important");
      };
      setVar("--primary", `hsl(${primaryHsl})`);
      setVar("--primary-shade", `hsl(${secondaryHsl})`);
      setVar("--ring", `hsl(${primaryHsl})`);
      setVar("--sidebar-accent", `hsl(${primaryHsl})`);
      setVar("--secondary", `hsl(${secondaryHsl})`);
      setVar("--primary-foreground", "hsl(210, 20%, 98%)");
      setVar("--theme-gradient", `linear-gradient(135deg, hsl(${primaryHsl}) 0%, hsl(${secondaryHsl}) 100%)`);
      setVar("--theme-gradient-r", `linear-gradient(90deg, hsl(${primaryHsl}) 0%, hsl(${secondaryHsl}) 100%)`);
    } else {
      BRANDING_CSS_VARS.forEach((name) => root.style.removeProperty(name));
    }

    // Favicon
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-branding]');
    if (data.faviconUrl) {
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.setAttribute("data-branding", "true");
        document.head.appendChild(link);
      }
      link.href = data.faviconUrl;
      faviconEl.current = link;
    } else if (link) {
      link.remove();
      faviconEl.current = null;
    }
  }, [data.colorTheme, data.colorPresets, data.faviconUrl]);

  const value: BrandingContextValue = {
    ...data,
    isLoading,
    refetch,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    return {
      primaryLogoUrl: null,
      faviconUrl: null,
      colorTheme: "Teal",
      colorPresets: [],
      isLoading: false,
      refetch: async (_orgId?: number | string) => {},
    };
  }
  return ctx;
}
