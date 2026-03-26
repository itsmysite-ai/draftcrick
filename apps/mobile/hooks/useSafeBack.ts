import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Platform } from "react-native";

/**
 * Safe back navigation — goes back if there's history,
 * otherwise goes to home. Prevents dead-end pages when
 * users land directly from external links.
 *
 * On web: checks window.history.length as extra guard since
 * router.canGoBack() can return true even with no real history.
 */
export function useSafeBack() {
  const router = useRouter();
  return useCallback(() => {
    try {
      if (Platform.OS === "web") {
        const win = globalThis as any;
        // history.length of 1 or 2 means no real back history
        if (win.history?.length > 2 && router.canGoBack()) {
          router.back();
        } else {
          win.location.href = "/";
        }
      } else {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch {
      // Fallback — always go home
      router.replace("/(tabs)");
    }
  }, [router]);
}
