import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../providers/AuthProvider";
import { trpc } from "../lib/trpc";

export default function RootIndex() {
  const { user, isLoading } = useAuth();

  // Only fetch profile + prefs when user is authenticated
  const profileQuery = trpc.auth.getProfile.useQuery(undefined, {
    enabled: !!user,
  });
  const prefsQuery = trpc.auth.getPreferences.useQuery(undefined, {
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  // Wait for profile + prefs to load before deciding where to route
  if (profileQuery.isLoading || prefsQuery.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If user hasn't confirmed age/terms, send through onboarding.
  // Also check if preferences are missing (but only if the query succeeded —
  // don't force onboarding on network/DB errors).
  // NOTE: If profile data is null/undefined (new user), treat as needing onboarding.
  const needsOnboarding =
    (profileQuery.isSuccess && !profileQuery.data?.ageConfirmed) ||
    (prefsQuery.isSuccess && !prefsQuery.data?.sports?.length);
  if (needsOnboarding) {
    return <Redirect href="/auth/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
