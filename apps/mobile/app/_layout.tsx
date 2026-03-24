import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ActivityIndicator, View, Platform } from "react-native";
// Sentry — no-op stub (install @sentry/react-native to enable)
const Sentry = {
  init: (..._args: unknown[]) => {},
  captureException: (..._args: unknown[]) => {},
  wrap: (component: any) => component,
};
import { AuthProvider, useAuth } from "../providers/AuthProvider";
import { NotificationProvider } from "../providers/NotificationProvider";
import { ThemeProvider, useTheme } from "../providers/ThemeProvider";
import { trpc, getTRPCClient } from "../lib/trpc";
import { ColorsLight, FontFamily } from "../lib/design";
import { WebLayoutWrapper } from "../components/chat/WebChatSidebar";
import { initializeRevenueCat, identifyUser } from "../services/iap";
// Initialize Sentry for crash reporting (no-op until @sentry/react-native is installed)
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
  });
}

/** Initialize RevenueCat and identify user when auth state is ready */
function RevenueCatInit() {
  const { user } = useAuth();

  useEffect(() => {
    initializeRevenueCat();
  }, []);

  useEffect(() => {
    if (user?.uid) {
      identifyUser(user.uid);
    }
  }, [user?.uid]);

  return null;
}

/** Syncs user preferences from the API into ThemeProvider on mount */
function PreferenceSyncer() {
  const { setAvailableSports, setSport, sport } = useTheme();
  const { user, setUser } = useAuth();
  const isLoggedIn = !!user;
  const { data: prefs } = trpc.auth.getPreferences.useQuery(undefined, {
    staleTime: 60_000 * 5, // 5 min cache
    enabled: isLoggedIn,
  });

  useEffect(() => {
    if (prefs?.sports && prefs.sports.length > 0) {
      const sports = prefs.sports as ("cricket" | "f1")[];
      setAvailableSports(sports);
      if (!sports.includes(sport as any)) {
        setSport(sports[0]);
      }
    }
    // Sync DB display name into auth user
    if (prefs?.displayName && user && user.displayName !== prefs.displayName) {
      setUser({ ...user, displayName: prefs.displayName, username: prefs.username ?? user.username });
    }
  }, [prefs]);

  return null;
}

function InnerLayout() {
  const { t, mode } = useTheme();

  return (
    <>
      <RevenueCatInit />
      <PreferenceSyncer />
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
        <Stack.Screen name="subscription/index" />
        <Stack.Screen name="notifications/inbox" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/sports" />
        <Stack.Screen name="settings/location" />
        <Stack.Screen name="team/rate" />
        <Stack.Screen name="predictions/index" />
        <Stack.Screen name="predictions/[matchId]" />
        <Stack.Screen name="predictions/leaderboard" />
        <Stack.Screen name="predictions/results/[matchId]" />
        <Stack.Screen name="tournament/[id]" />
        <Stack.Screen name="tournament-league/[id]" />
        <Stack.Screen name="tournament-league/create" />
        <Stack.Screen name="tournament-league/submit-team" />
      </Stack>
    </>
  );
}

function RootLayout() {
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
          DMSans_400Regular: require("@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf"),
          DMSans_500Medium: require("@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf"),
          DMSans_600SemiBold: require("@expo-google-fonts/dm-sans/600SemiBold/DMSans_600SemiBold.ttf"),
          DMSans_700Bold: require("@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf"),
          DMMono_400Regular: require("@expo-google-fonts/dm-mono/400Regular/DMMono_400Regular.ttf"),
          DMMono_500Medium: require("@expo-google-fonts/dm-mono/500Medium/DMMono_500Medium.ttf"),
          // F1 fonts — Titillium Web (F1 official body font) + Space Mono
          TitilliumWeb_400Regular: require("@expo-google-fonts/titillium-web/400Regular/TitilliumWeb_400Regular.ttf"),
          TitilliumWeb_400Regular_Italic: require("@expo-google-fonts/titillium-web/400Regular_Italic/TitilliumWeb_400Regular_Italic.ttf"),
          TitilliumWeb_600SemiBold: require("@expo-google-fonts/titillium-web/600SemiBold/TitilliumWeb_600SemiBold.ttf"),
          TitilliumWeb_600SemiBold_Italic: require("@expo-google-fonts/titillium-web/600SemiBold_Italic/TitilliumWeb_600SemiBold_Italic.ttf"),
          TitilliumWeb_700Bold: require("@expo-google-fonts/titillium-web/700Bold/TitilliumWeb_700Bold.ttf"),
          TitilliumWeb_700Bold_Italic: require("@expo-google-fonts/titillium-web/700Bold_Italic/TitilliumWeb_700Bold_Italic.ttf"),
          TitilliumWeb_900Black: require("@expo-google-fonts/titillium-web/900Black/TitilliumWeb_900Black.ttf"),
          SpaceMono_400Regular: require("@expo-google-fonts/space-mono/400Regular/SpaceMono_400Regular.ttf"),
          SpaceMono_400Regular_Italic: require("@expo-google-fonts/space-mono/400Regular_Italic/SpaceMono_400Regular_Italic.ttf"),
          SpaceMono_700Bold: require("@expo-google-fonts/space-mono/700Bold/SpaceMono_700Bold.ttf"),
          SpaceMono_700Bold_Italic: require("@expo-google-fonts/space-mono/700Bold_Italic/SpaceMono_700Bold_Italic.ttf"),
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
          <NotificationProvider>
            <ThemeProvider>
              <WebLayoutWrapper>
                <InnerLayout />
              </WebLayoutWrapper>
            </ThemeProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// Wrap with Sentry error boundary for crash reporting
export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
