import { Redirect } from "expo-router";
import { useComfortMode } from "../providers/ComfortModeProvider";

/**
 * Root index — redirects to the correct tab group based on comfort mode.
 * Standard mode (default): 5-tab nav (Home, Contests, Live, Social, Profile)
 * Comfort mode: 3-tab nav (Home, My Team, Help)
 */
export default function RootIndex() {
  const { enabled } = useComfortMode();

  if (enabled) {
    return <Redirect href="/(comfort-tabs)" />;
  }

  return <Redirect href="/(tabs)" />;
}
