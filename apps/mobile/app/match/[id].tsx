import { ScrollView as RNScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  BackButton,
  InitialsAvatar,
  ModeToggle,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

/** Safely parse AI-returned date/time strings into a Date object */
function parseSafeDate(dateStr?: string, timeStr?: string): Date {
  if (!dateStr) return new Date();
  const cleanTime = (timeStr ?? "").replace(/\s+[A-Z]{2,4}$/, "");
  const parsed = new Date(`${dateStr} ${cleanTime}`);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// Phase 3 placeholder sections
const PHASE3_SECTIONS = [
  { title: "ai match preview", emoji: "🤖", description: "ai-generated match analysis and key battles" },
  { title: "captain & vc picks", emoji: "👑", description: "data-driven captain and vice-captain recommendations" },
  { title: "player projections", emoji: "📊", description: "fantasy point projections for every player" },
  { title: "differentials", emoji: "💎", description: "low-ownership high-upside picks" },
  { title: "head to head", emoji: "⚔️", description: "historical stats between these two teams" },
] as const;

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = decodeURIComponent(id ?? "");
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const insets = useSafeAreaInsets();

  // Reuse dashboard data to find the match
  const dashboardQuery = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60_000, retry: 1 },
  );

  if (dashboardQuery.isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" paddingTop={insets.top} backgroundColor="$background">
        <EggLoadingSpinner size={48} message={formatUIText("loading match")} />
      </YStack>
    );
  }

  const match = (dashboardQuery.data?.matches ?? []).find((m: any) => m.id === matchId) as any;

  if (!match) {
    return (
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingHorizontal="$4"
          paddingTop={8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <BackButton onPress={() => router.back()} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
              {formatUIText("match center")}
            </Text>
          </XStack>
          <ModeToggle mode={mode} onToggle={toggleMode} />
        </XStack>
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
          <Text fontSize={DesignSystem.emptyState.iconSize}>🏏</Text>
          <Text {...textStyles.playerName}>{formatUIText("match not found")}</Text>
          <Text {...textStyles.hint}>{formatUIText("this match may no longer be available")}</Text>
          <Button variant="primary" size="md" marginTop="$3" onPress={() => router.back()}>
            {formatUIText("go back")}
          </Button>
        </YStack>
      </YStack>
    );
  }

  const isLive = match.status === "live";
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "";
  const startTime = parseSafeDate(match.date, match.time);
  const timeStr = startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = startTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background">
      {/* ── Header Bar ── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("match center")}
          </Text>
        </XStack>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      <RNScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 120 }}
      >
        {/* ── Match Header ── */}
        <Animated.View entering={FadeIn.delay(0)}>
          <YStack alignItems="center" paddingBottom="$5">
            {/* Tournament + Status */}
            <XStack alignItems="center" gap="$2" marginBottom="$4">
              {tournament ? (
                <Badge variant="role" size="sm">
                  {formatBadgeText(tournament)}
                </Badge>
              ) : null}
              <Badge variant={isLive ? "live" : "default"} size="sm">
                {isLive ? formatBadgeText("live") : formatBadgeText(match.status ?? "upcoming")}
              </Badge>
              {match.format && (
                <Badge variant="default" size="sm">
                  {formatBadgeText(match.format)}
                </Badge>
              )}
            </XStack>

            {/* Teams */}
            <XStack alignItems="center" gap="$6" marginBottom="$4">
              <YStack alignItems="center" flex={1}>
                <InitialsAvatar name={teamA} playerRole="BAT" ovr={0} size={52} />
                <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" marginTop="$2" textAlign="center">
                  {teamA}
                </Text>
              </YStack>

              <Text fontFamily="$mono" fontSize={12} color="$colorMuted">
                {formatUIText("vs")}
              </Text>

              <YStack alignItems="center" flex={1}>
                <InitialsAvatar name={teamB} playerRole="BOWL" ovr={0} size={52} />
                <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" marginTop="$2" textAlign="center">
                  {teamB}
                </Text>
              </YStack>
            </XStack>

            {/* Score */}
            {match.scoreSummary && (
              <Text fontFamily="$mono" fontWeight="700" fontSize={15} color="$colorCricket" marginBottom="$2">
                {match.scoreSummary}
              </Text>
            )}

            {/* Date/Time + Venue */}
            <Text fontFamily="$mono" fontSize={13} fontWeight="600" color="$colorCricket">
              {isLive ? formatUIText("in progress") : `${dateStr} at ${timeStr}`}
            </Text>
            {match.venue && (
              <Text {...textStyles.hint} marginTop="$1">
                {match.venue}
              </Text>
            )}
          </YStack>
        </Animated.View>

        {/* ── Tournament Link ── */}
        {tournament && (
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <Card
              pressable
              onPress={() => router.push(`/tournament/${encodeURIComponent(tournament)}`)}
              padding="$4"
              marginBottom="$5"
            >
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$2">
                  <Text fontSize={16}>🏆</Text>
                  <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                    {tournament}
                  </Text>
                </XStack>
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push(`/tournament/${encodeURIComponent(tournament)}`)}
                >
                  {formatUIText("view tournament")}
                </Button>
              </XStack>
            </Card>
          </Animated.View>
        )}

        {/* ── Phase 3 Placeholder Sections ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <XStack alignItems="center" gap="$2" marginBottom="$3">
            <Text fontSize={14}>🚀</Text>
            <Text {...textStyles.sectionHeader}>
              {formatUIText("coming in phase 3")}
            </Text>
          </XStack>
        </Animated.View>

        {PHASE3_SECTIONS.map((section, i) => (
          <Animated.View key={section.title} entering={FadeInDown.delay(150 + i * 50).springify()}>
            <Card padding="$4" marginBottom="$3" opacity={0.6}>
              <XStack alignItems="center" gap="$3">
                <Text fontSize={24}>{section.emoji}</Text>
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                    {formatUIText(section.title)}
                  </Text>
                  <Text {...textStyles.hint} marginTop={2}>
                    {formatUIText(section.description)}
                  </Text>
                </YStack>
              </XStack>
            </Card>
          </Animated.View>
        ))}
      </RNScrollView>
    </YStack>
  );
}
