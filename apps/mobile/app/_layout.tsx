import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider } from "../providers/AuthProvider";
import { ThemeProvider, useTheme } from "../providers/ThemeProvider";
import { trpc, getTRPCClient } from "../lib/trpc";
import { ColorsLight, FontFamily } from "../lib/design";

function InnerLayout() {
  const { t, mode } = useTheme();

  return (
    <>
      <StatusBar style={mode === "light" ? "dark" : "light"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { fontWeight: "700", fontFamily: FontFamily.heading },
          contentStyle: { backgroundColor: t.bg },
          animation: "slide_from_right",
          animationDuration: 220,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
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
    </>
  );
}

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
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        const Font = require("expo-font");
        await Font.loadAsync({
          DMSans_400Regular: require("@expo-google-fonts/dm-sans/DMSans_400Regular.ttf"),
          DMSans_500Medium: require("@expo-google-fonts/dm-sans/DMSans_500Medium.ttf"),
          DMSans_600SemiBold: require("@expo-google-fonts/dm-sans/DMSans_600SemiBold.ttf"),
          DMSans_700Bold: require("@expo-google-fonts/dm-sans/DMSans_700Bold.ttf"),
          DMMono_400Regular: require("@expo-google-fonts/dm-mono/DMMono_400Regular.ttf"),
          DMMono_500Medium: require("@expo-google-fonts/dm-mono/DMMono_500Medium.ttf"),
        });
      } catch (e) {
        console.warn("Font loading failed, using system fonts:", e);
      } finally {
        setFontsReady(true);
      }
    }
    loadFonts();
  }, []);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: ColorsLight.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={ColorsLight.accent} size="large" />
      </View>
    );
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider>
            <InnerLayout />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
