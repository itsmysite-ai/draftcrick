import { useEffect } from "react";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../providers/AuthProvider";

/**
 * Redirects to login if not authenticated.
 * After login, the user is sent back to the original page (with query params).
 * Returns true if authenticated, false if redirecting.
 */
export function useRequireAuth(): boolean {
  const { user, isLoading } = useAuth();
  const router = useRouter();
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
      router.replace("/auth/login");
    }
  }, [user, isLoading, pathname]);

  return !!user;
}
