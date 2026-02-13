import { ScrollView as RNScrollView, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import {
  XStack,
  YStack,
  Text,
  useTheme as useTamaguiTheme,
} from "tamagui";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  AnnouncementBanner,
  FilterPill,
  ModeToggle,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { trpc } from "../../lib/trpc";

/** Safely parse AI-returned date/time strings into a Date object */
function parseSafeDate(dateStr?: string, timeStr?: string): Date {
  if (!dateStr) return new Date();
  const cleanTime = (timeStr ?? "").replace(/\s+[A-Z]{2,4}$/, "");
  const parsed = new Date(`${dateStr} ${cleanTime}`);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** Format countdown for upcoming matches */
function formatCountdown(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "STARTED";
  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── MatchCard (follows LiveMatchCard pattern from live.tsx) ─────────
function HomeMatchCard({
  match,
  index,
  onPress,
}: {
  match: any;
  index: number;
  onPress: () => void;
}) {
  const isLive = match.status === "live";
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "cricket";
  const startTime = parseSafeDate(match.date, match.time);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card pressable live={isLive} onPress={onPress} padding="$6" marginBottom="$3">
        {/* Header: tournament badge + status */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
          <Badge variant="role" size="sm">
            {formatBadgeText(tournament)}
          </Badge>
          <Badge variant={isLive ? "live" : "default"} size="sm">
            {isLive ? formatBadgeText("live") : formatCountdown(startTime)}
          </Badge>
        </XStack>

        {/* Teams */}
        <XStack alignItems="center" justifyContent="center" marginBottom="$4">
          <YStack flex={1} alignItems="center" gap={6}>
            <InitialsAvatar name={teamA} playerRole="BAT" ovr={0} size={48} />
            <Text {...textStyles.playerName} numberOfLines={1} textAlign="center">
              {teamA}
            </Text>
          </YStack>

          <YStack alignItems="center" gap={2}>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              {formatUIText("vs")}
            </Text>
            {match.format && (
              <Text fontFamily="$mono" fontSize={9} color="$colorMuted" letterSpacing={0.5}>
                {formatBadgeText(match.format)}
              </Text>
            )}
          </YStack>

          <YStack flex={1} alignItems="center" gap={6}>
            <InitialsAvatar name={teamB} playerRole="BOWL" ovr={0} size={48} />
            <Text {...textStyles.playerName} numberOfLines={1} textAlign="center">
              {teamB}
            </Text>
          </YStack>
        </XStack>

        {/* Score summary */}
        {match.scoreSummary && (
          <YStack alignItems="center" marginBottom="$3">
            <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">
              {match.scoreSummary}
            </Text>
          </YStack>
        )}

        {/* Footer: venue + action */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop="$3"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          <Text {...textStyles.hint} flex={1} numberOfLines={1}>
            {match.venue || match.time || ""}
          </Text>
          <Button onPress={onPress} size="sm" variant={isLive ? "primary" : "secondary"}>
            {isLive ? formatUIText("view match") : formatUIText("view match")}
          </Button>
        </XStack>
      </Card>
    </Animated.View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();

  // ── tRPC queries ──
  const dashboardQuery = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60_000, retry: 1 },
  );

  const [refreshing, setRefreshing] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dashboardQuery.refetch();
    setRefreshing(false);
  }, [dashboardQuery]);

  // ── Full-screen loading state ──
  if (dashboardQuery.isLoading) {
    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        paddingTop={insets.top}
        backgroundColor="$background"
      >
        <EggLoadingSpinner size={48} message={formatUIText("loading matches")} />
      </YStack>
    );
  }

  // ── Full-screen error state ──
  if (dashboardQuery.isError) {
    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        paddingTop={insets.top}
        paddingHorizontal="$8"
        backgroundColor="$background"
        gap="$3"
      >
        <Text fontSize={DesignSystem.emptyState.iconSize}>😵</Text>
        <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" textAlign="center">
          {formatUIText("something went wrong")}
        </Text>
        <Text
          {...textStyles.hint}
          textAlign="center"
          lineHeight={18}
        >
          {formatUIText(dashboardQuery.error?.message ?? "couldn't load cricket data. check your connection.")}
        </Text>
        <Button variant="primary" size="md" marginTop="$3" onPress={onRefresh}>
          {formatUIText("try again")}
        </Button>
      </YStack>
    );
  }

  const matches = dashboardQuery.data?.matches ?? [];
  const tournaments = dashboardQuery.data?.tournaments ?? [];

  /** Count matches per tournament name */
  const tournamentMatchCounts: Record<string, number> = {};
  for (const m of matches) {
    const name = (m as any).tournamentName ?? "";
    tournamentMatchCounts[name] = (tournamentMatchCounts[name] ?? 0) + 1;
  }

  /** Filter matches by selected tournament */
  const filteredMatches = selectedTournament
    ? matches.filter((m: any) => (m.tournamentName ?? "") === selectedTournament)
    : matches;

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background">
      {/* ── Header ── */}
      <Animated.View entering={FadeIn.delay(0)}>
        <XStack
          justifyContent="space-between"
          alignItems="flex-start"
          paddingHorizontal="$5"
          paddingVertical="$4"
        >
          <YStack>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={22}>🥚</Text>
              <Text fontFamily="$mono" fontSize={17} fontWeight="500" color="$color" letterSpacing={-0.5}>
                tami·draft
              </Text>
              <Badge backgroundColor="$colorAccentLight" color="$colorAccent" size="sm" fontWeight="600">
                🏏 CRICKET
              </Badge>
            </XStack>
            <Text {...textStyles.hint} marginTop={3} marginLeft={30}>
              {formatUIText("fantasy cricket companion")}
            </Text>
          </YStack>

          <ModeToggle mode={mode} onToggle={toggleMode} />
        </XStack>
      </Animated.View>

      {/* ── Announcement Banner ── */}
      <AnnouncementBanner />

      {/* ── Tournament Filter Strip ── */}
      {tournaments.length > 0 && (
        <RNScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 6, paddingBottom: 14, paddingTop: 10 }}
        >
          <FilterPill active={selectedTournament === null} onPress={() => setSelectedTournament(null)}>
            <Text
              fontFamily="$body"
              fontSize={12}
              fontWeight="500"
              color={selectedTournament === null ? "$background" : "$colorSecondary"}
            >
              {formatUIText("🏏 all")}
            </Text>
          </FilterPill>
          {tournaments.map((t: any) => (
            <FilterPill
              key={t.id}
              active={selectedTournament === t.name}
              onPress={() =>
                setSelectedTournament(
                  selectedTournament === t.name ? null : t.name,
                )
              }
            >
              <Text
                fontFamily="$body"
                fontSize={12}
                fontWeight="500"
                color={selectedTournament === t.name ? "$background" : "$colorSecondary"}
                numberOfLines={1}
              >
                {formatUIText(`🏆 ${t.name}`)}
              </Text>
            </FilterPill>
          ))}
        </RNScrollView>
      )}

      {/* ── Matches List ── */}
      <RNScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accentBackground?.val}
          />
        }
        contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 120 }}
      >
        {/* Inline error banner */}
        {dashboardQuery.isError && (
          <Card marginBottom="$3" padding="$4">
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontFamily="$body" fontSize={13} color="$colorMuted">
                {formatUIText("couldn't refresh matches")}
              </Text>
              <Button size="sm" variant="secondary" onPress={() => dashboardQuery.refetch()}>
                {formatUIText("retry")}
              </Button>
            </XStack>
          </Card>
        )}

        {/* Selected tournament card */}
        {selectedTournament && (() => {
          const t = tournaments.find((t: any) => t.name === selectedTournament);
          if (!t) return null;
          return (
            <Animated.View entering={FadeInDown.delay(0).springify()}>
              <Card
                pressable
                onPress={() => router.push(`/tournament/${encodeURIComponent(t.name)}`)}
                padding="$4"
                marginBottom="$4"
                borderWidth={2}
                borderColor="$accentBackground"
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1} gap="$1">
                    <Text {...textStyles.playerName} fontSize={14}>
                      {(t as any).name}
                    </Text>
                    <XStack alignItems="center" gap="$2">
                      <Badge variant="role" size="sm">
                        {formatBadgeText((t as any).category)}
                      </Badge>
                      <Text {...textStyles.hint}>
                        {tournamentMatchCounts[(t as any).name] ?? 0}{" "}
                        {formatUIText("matches")}
                      </Text>
                    </XStack>
                  </YStack>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => router.push(`/tournament/${encodeURIComponent(t.name)}`)}
                  >
                    {formatUIText("details")}
                  </Button>
                </XStack>
              </Card>
            </Animated.View>
          );
        })()}

        {dashboardQuery.isLoading ? (
          <YStack alignItems="center" paddingVertical="$10">
            <EggLoadingSpinner size={40} message={formatUIText("loading matches")} />
          </YStack>
        ) : filteredMatches.length > 0 ? (
          <>
            {filteredMatches.map((m: any, i: number) => (
              <HomeMatchCard
                key={m.id}
                match={m}
                index={i}
                onPress={() => {
                  router.push(`/match/${encodeURIComponent(m.id)}`);
                }}
              />
            ))}
            {/* Data source footer */}
            {dashboardQuery.data?.lastFetched && (
              <Text {...textStyles.hint} textAlign="center" marginTop="$2">
                {formatUIText(`last updated: ${new Date(dashboardQuery.data.lastFetched).toLocaleTimeString()}`)}
              </Text>
            )}
          </>
        ) : (
          <Animated.View entering={FadeIn.delay(80)}>
            <YStack alignItems="center" gap="$3" paddingVertical="$10">
              <Text fontSize={DesignSystem.emptyState.iconSize}>🏏</Text>
              <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                {formatUIText(selectedTournament ? "no matches in this tournament" : "no matches right now")}
              </Text>
              <Text
                {...textStyles.hint}
                textAlign="center"
                lineHeight={18}
              >
                {formatUIText(selectedTournament ? "try selecting a different tournament" : "check back soon for upcoming fixtures")}
              </Text>
            </YStack>
          </Animated.View>
        )}
      </RNScrollView>
    </YStack>
  );
}
