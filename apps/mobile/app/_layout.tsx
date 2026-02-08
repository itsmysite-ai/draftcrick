import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "../providers/AuthProvider";
import { ComfortModeProvider } from "../providers/ComfortModeProvider";
import { trpc, getTRPCClient } from "../lib/trpc";

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

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ComfortModeProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: "#0A1628" },
                headerTintColor: "#FFFFFF",
                headerTitleStyle: { fontWeight: "700" },
                contentStyle: { backgroundColor: "#0A1628" },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="(comfort-tabs)"
                options={{ headerShown: false }}
              />
              <Stack.Screen name="auth/login" options={{ title: "Sign In" }} />
              <Stack.Screen
                name="auth/register"
                options={{ title: "Sign Up" }}
              />
              <Stack.Screen
                name="auth/onboarding"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="contest/[id]"
                options={{ title: "Contest" }}
              />
              <Stack.Screen
                name="match/[id]"
                options={{ title: "Match Center" }}
              />
              <Stack.Screen
                name="team/create"
                options={{ title: "Build Team" }}
              />
              <Stack.Screen
                name="player/[id]"
                options={{ title: "Player" }}
              />
              <Stack.Screen
                name="guru/index"
                options={{ title: "Cricket Guru" }}
              />
              <Stack.Screen
                name="wallet/index"
                options={{ title: "Wallet" }}
              />
              <Stack.Screen
                name="league/index"
                options={{ title: "My Leagues" }}
              />
              <Stack.Screen
                name="league/create"
                options={{ title: "Create League" }}
              />
              <Stack.Screen
                name="league/join"
                options={{ title: "Join League" }}
              />
              <Stack.Screen
                name="league/[id]"
                options={{ title: "League" }}
              />
              <Stack.Screen
                name="league/[id]/trades"
                options={{ title: "Trades" }}
              />
              <Stack.Screen
                name="league/[id]/settings"
                options={{ title: "League Settings" }}
              />
              <Stack.Screen
                name="draft/[id]"
                options={{ title: "Draft Room", headerShown: false }}
              />
              <Stack.Screen
                name="auction/[id]"
                options={{ title: "Auction Room", headerShown: false }}
              />
            </Stack>
          </ComfortModeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
