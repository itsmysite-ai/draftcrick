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
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
          animation: "slide_from_right",
          animationDuration: 220,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/register" />
        <Stack.Screen name="auth/onboarding" />
        <Stack.Screen name="contest/[id]" />
        <Stack.Screen name="match/[id]" />
        <Stack.Screen name="team/create" />
        <Stack.Screen name="player/[id]" />
        <Stack.Screen name="guru/index" />
        <Stack.Screen name="wallet/index" />
        <Stack.Screen name="league/index" />
        <Stack.Screen name="league/create" />
        <Stack.Screen name="league/join" />
        <Stack.Screen name="league/[id]" />
        <Stack.Screen name="league/[id]/trades" />
        <Stack.Screen name="league/[id]/settings" />
        <Stack.Screen name="draft/[id]" />
        <Stack.Screen name="auction/[id]" />
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
