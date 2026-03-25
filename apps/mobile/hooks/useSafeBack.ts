import { useRouter } from "expo-router";
import { useCallback } from "react";

/**
 * Safe back navigation — goes back if there's history,
 * otherwise goes to home. Prevents dead-end pages when
 * users land directly from external links.
 */
export function useSafeBack() {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [router]);
}
