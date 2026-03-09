import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  BackButton,
  Button,
  ModeToggle,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useNavigationStore } from "../../lib/navigation-store";
import { useTheme } from "../../providers/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const QUESTION_TYPE_ICONS: Record<string, string> = {
  match_winner: "🏏",
  victory_margin: "📊",
  top_scorer: "🏃",
  top_wicket_taker: "🎳",
  century_scored: "💯",
  first_innings_total: "📈",
  player_performance: "⭐",
  sixes_count: "6️⃣",
  custom_yes_no: "❓",
  custom_range: "🔢",
  custom_multi_choice: "📋",
};

export default function PredictionsHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const { user } = useAuth();
  const setMatchContext = useNavigationStore((s) => s.setMatchContext);

  const dashboardQuery = trpc.sports.dashboard.useQuery(undefined, {
    staleTime: 60 * 60_000,
  });

  const streaksQuery = trpc.prediction.getStreaks.useQuery(
    { leagueId: NIL_UUID, tournamentId: "global" },
    { enabled: !!user, retry: false },
  );

  const matches = dashboardQuery.data?.matches ?? [];
  const upcomingMatches = matches.filter(
    (m: any) => m.status === "upcoming" || m.status === "live"
  );

  if (dashboardQuery.isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <EggLoadingSpinner />
        <Text {...textStyles.hint} marginTop="$3">{formatUIText("loading predictions...")}</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background" testID="predictions-hub">
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>
        {/* Header */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop={insets.top + 8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <BackButton onPress={() => router.back()} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">
              {formatUIText("predictions")}
            </Text>
          </XStack>
          <ModeToggle mode={mode} onToggle={toggleMode} />
        </XStack>

        {/* Stats Banner */}
        <Card padding="$4" marginBottom="$4">
          <XStack justifyContent="space-around">
            <YStack alignItems="center">
              <Text fontSize={24}>🔥</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$accentBackground">
                {streaksQuery.data?.currentStreak ?? 0}
              </Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText("streak")}
              </Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize={24}>🎯</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color">
                {streaksQuery.data?.correctPredictions ?? 0}
              </Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText("correct")}
              </Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize={24}>⭐</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color">
                {streaksQuery.data?.totalPoints ?? 0}
              </Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText("points")}
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Leaderboard Link */}
        <Button
          variant="secondary"
          size="md"
          marginBottom="$4"
          onPress={() => router.push("/predictions/leaderboard" as any)}
          testID="leaderboard-btn"
        >
          {formatUIText("view leaderboard")}
        </Button>

        {/* Upcoming Matches */}
        <Text {...textStyles.sectionHeader} marginBottom="$2">
          {formatUIText("predict upcoming matches")}
        </Text>

        {upcomingMatches.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text {...textStyles.hint} marginTop="$3">
              {formatUIText("no upcoming matches with predictions available")}
            </Text>
          </YStack>
        ) : (
          upcomingMatches.map((match: any, i: number) => (
            <Animated.View key={match.id} entering={FadeInDown.delay(i * 30).springify()}>
              <Card
                pressable
                padding="$4"
                marginBottom="$2"
                onPress={() => {
                  setMatchContext({
                    matchId: match.id,
                    teamA: match.teamA,
                    teamB: match.teamB,
                  });
                  router.push(`/predictions/${match.id}` as any);
                }}
                testID={`predict-match-${i}`}
              >
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={24}>🏏</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                      {match.teamA} {formatUIText("vs")} {match.teamB}
                    </Text>
                    <XStack gap="$2" marginTop="$1">
                      <Badge variant="subtle">{formatBadgeText(match.format ?? "T20")}</Badge>
                      <Badge variant={match.status === "live" ? "success" : "default"}>
                        {formatBadgeText(match.status)}
                      </Badge>
                    </XStack>
                    {match.tournament && (
                      <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginTop="$1">
                        {match.tournament}
                      </Text>
                    )}
                  </YStack>
                  <Text fontFamily="$mono" fontSize={20} color="$colorMuted">›</Text>
                </XStack>
              </Card>
            </Animated.View>
          ))
        )}

        {/* Completed Matches — View Results */}
        {matches.filter((m: any) => m.status === "completed").length > 0 && (
          <YStack marginTop="$4">
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("recent results")}
            </Text>
            {matches
              .filter((m: any) => m.status === "completed")
              .slice(0, 5)
              .map((match: any, i: number) => (
                <Animated.View key={match.id} entering={FadeInDown.delay(i * 20).springify()}>
                  <Card
                    pressable
                    padding="$3"
                    marginBottom="$2"
                    onPress={() => {
                      setMatchContext({ matchId: match.id });
                      router.push(`/predictions/results/${match.id}` as any);
                    }}
                    testID={`result-match-${i}`}
                  >
                    <XStack alignItems="center" gap="$3">
                      <Text fontSize={20}>📊</Text>
                      <YStack flex={1}>
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                          {match.teamA} {formatUIText("vs")} {match.teamB}
                        </Text>
                        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                          {formatUIText("view results")}
                        </Text>
                      </YStack>
                      <Text fontFamily="$mono" fontSize={18} color="$colorMuted">›</Text>
                    </XStack>
                  </Card>
                </Animated.View>
              ))}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
