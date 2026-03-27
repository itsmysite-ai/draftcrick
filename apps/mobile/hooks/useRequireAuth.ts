import { useEffect } from "react";
import { usePathname } from "expo-router";
import { useAuth } from "../providers/AuthProvider";

/**
 * Checks if user is authenticated. Stores redirect URL for post-login return.
 * Returns true if authenticated, false if not (caller should render a Redirect).
 *
 * IMPORTANT: Do NOT call router.replace() here — it crashes if the root layout
 * hasn't mounted yet. Callers should use <Redirect href="/auth/login" /> instead.
 */
export function useRequireAuth(): boolean {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      // Store full URL (with query params) so login can redirect back
      if (typeof globalThis.sessionStorage !== "undefined") {
        try {
          const w = globalThis as any;
          const fullPath = w.location?.pathname && w.location?.search
            ? w.location.pathname + w.location.search
            : pathname;
          globalThis.sessionStorage.setItem("auth_redirect", fullPath);
        } catch {
          // Native — no window.location
        }
      }
    }
  }, [user, isLoading, pathname]);

  return !isLoading && !!user;
}
