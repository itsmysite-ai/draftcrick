import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  BackButton,
  InitialsAvatar,
  ModeToggle,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";
import { useTheme } from "../../providers/ThemeProvider";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export default function PredictionLeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const { user } = useAuth();

  const standingsQuery = trpc.prediction.getStandings.useQuery(
    { leagueId: NIL_UUID, tournamentId: "global" },
    { retry: false },
  );
  const standings = standingsQuery.data ?? [];
  const isLoading = standingsQuery.isLoading;

  return (
    <YStack flex={1} backgroundColor="$background" testID="prediction-leaderboard">
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
              {formatUIText("prediction leaderboard")}
            </Text>
          </XStack>
          <ModeToggle mode={mode} onToggle={toggleMode} />
        </XStack>

        {/* Legend */}
        <Card padding="$3" marginBottom="$4">
          <XStack justifyContent="space-around">
            <YStack alignItems="center">
              <Text fontSize={20}>🔥</Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText("streak")}
              </Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize={20}>🎯</Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText("accuracy")}
              </Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize={20}>⭐</Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText("points")}
              </Text>
            </YStack>
          </XStack>
        </Card>

        {/* Standings List */}
        {isLoading ? (
          <EggLoadingSpinner />
        ) : standings.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text {...textStyles.hint} marginTop="$3">
              {formatUIText("no prediction standings yet — start predicting to climb the ranks!")}
            </Text>
          </YStack>
        ) : (
          standings.map((entry: any, i: number) => {
            const isCurrentUser = entry.userId === (user as any)?.uid;
            return (
              <Animated.View key={entry.userId ?? i} entering={FadeInDown.delay(i * 30).springify()}>
                <Card
                  padding="$3"
                  marginBottom="$2"
                  borderColor={isCurrentUser ? "$accentBackground" : "$borderColor"}
                  testID={`standing-${i}`}
                >
                  <XStack alignItems="center" gap="$3">
                    {/* Rank */}
                    <Text
                      fontFamily="$mono"
                      fontWeight="700"
                      fontSize={16}
                      color="$accentBackground"
                      width={28}
                      textAlign="center"
                    >
                      #{i + 1}
                    </Text>

                    <InitialsAvatar
                      name={entry.userId?.slice(0, 8) ?? "?"}
                      playerRole="BAT"
                      ovr={0}
                      size={32}
                    />

                    <YStack flex={1}>
                      <Text fontFamily="$mono" fontSize={13} color="$color">
                        {entry.userId?.slice(0, 12) ?? "—"}
                        {isCurrentUser ? " (you)" : ""}
                      </Text>
                      <XStack gap="$2" marginTop="$1">
                        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                          🎯 {entry.accuracyPct ?? 0}%
                        </Text>
                        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                          {entry.correctPredictions ?? 0}/{entry.totalPredictions ?? 0}
                        </Text>
                      </XStack>
                    </YStack>

                    {/* Streak */}
                    {(entry.currentStreak ?? 0) > 0 && (
                      <Badge variant="subtle">
                        🔥 {entry.currentStreak}
                      </Badge>
                    )}

                    {/* Points */}
                    <Text fontFamily="$mono" fontWeight="700" fontSize={15} color="$accentBackground">
                      {entry.totalPoints ?? 0}
                    </Text>
                  </XStack>
                </Card>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
