import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../providers/AuthProvider";
import { trpc } from "../lib/trpc";

export default function RootIndex() {
  const { user, isLoading } = useAuth();

  // Only fetch profile when user is authenticated
  const profileQuery = trpc.auth.getProfile.useQuery(undefined, {
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

  // Wait for profile to load before deciding where to route
  if (profileQuery.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If user hasn't confirmed age/terms, send them through onboarding
  if (profileQuery.data && !profileQuery.data.ageConfirmed) {
    return <Redirect href="/auth/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
