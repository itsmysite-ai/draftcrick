import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  SpaceGrotesk_700Bold,
  SpaceGrotesk_800ExtraBold,
} from "@expo-google-fonts/space-grotesk";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "../providers/AuthProvider";
import { ComfortModeProvider } from "../providers/ComfortModeProvider";
import { trpc, getTRPCClient } from "../lib/trpc";
import { Colors } from "../lib/design";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );
  const [trpcClient] = useState(() => getTRPCClient());

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_700Bold,
    SpaceGrotesk_800ExtraBold,
  });

  if (fontsLoaded) {
    SplashScreen.hideAsync();
  }

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ComfortModeProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: Colors.bg },
                headerTintColor: Colors.text,
                headerTitleStyle: { fontWeight: "700", fontFamily: "SpaceGrotesk_700Bold" },
                contentStyle: { backgroundColor: Colors.bg },
                animation: "slide_from_right",
                animationDuration: 220,
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
              <Stack.Screen
                name="(comfort-tabs)"
                options={{ headerShown: false, animation: "fade" }}
              />
              <Stack.Screen name="auth/login" options={{ title: "Sign In" }} />
              <Stack.Screen name="auth/register" options={{ title: "Sign Up" }} />
              <Stack.Screen name="auth/onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="contest/[id]" options={{ title: "Contest" }} />
              <Stack.Screen name="match/[id]" options={{ title: "Match Center" }} />
              <Stack.Screen name="team/create" options={{ title: "Build Team" }} />
              <Stack.Screen name="player/[id]" options={{ title: "Player" }} />
              <Stack.Screen name="guru/index" options={{ title: "Cricket Guru" }} />
              <Stack.Screen name="wallet/index" options={{ title: "Wallet" }} />
              <Stack.Screen name="league/index" options={{ title: "My Leagues" }} />
              <Stack.Screen name="league/create" options={{ title: "Create League" }} />
              <Stack.Screen name="league/join" options={{ title: "Join League" }} />
              <Stack.Screen name="league/[id]" options={{ title: "League" }} />
              <Stack.Screen name="league/[id]/trades" options={{ title: "Trades" }} />
              <Stack.Screen name="league/[id]/settings" options={{ title: "League Settings" }} />
              <Stack.Screen name="draft/[id]" options={{ title: "Draft Room", headerShown: false }} />
              <Stack.Screen name="auction/[id]" options={{ title: "Auction Room", headerShown: false }} />
            </Stack>
          </ComfortModeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
