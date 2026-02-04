import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchMyOrganizationId } from "@/api/me";

/** Current user's organization id (for branding). Fetched when user is logged in so customers and collaborators see their org's theme. */
export function useOrganizationId(): { organizationId: number | null; isLoading: boolean } {
  const { user } = useAuth();
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setOrganizationId(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchMyOrganizationId()
      .then((id) => {
        if (!cancelled) setOrganizationId(id);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { organizationId, isLoading };
}
