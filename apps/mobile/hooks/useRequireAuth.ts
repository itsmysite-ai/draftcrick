import { useEffect } from "react";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "../providers/AuthProvider";

/**
 * Redirects to login if not authenticated.
 * After login, the user is sent back to the original page.
 * Returns true if authenticated, false if redirecting.
 */
export function useRequireAuth(): boolean {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      // Store the intended destination so login can redirect back
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("auth_redirect", pathname);
      }
      router.replace("/auth/login");
    }
  }, [user, isLoading, pathname]);

  return !!user;
}
