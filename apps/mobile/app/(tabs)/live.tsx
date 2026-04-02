import {
  FlatList, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { parseTeamScores, didTeamAWin } from "../../lib/score-utils";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import { trpc } from "../../lib/trpc";
import { useSport } from "../../providers/ThemeProvider";
import { HeaderControls } from "../../components/HeaderControls";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  StatLabel,
  AnnouncementBanner,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
  tokens,
  CricketBatIcon,
  CricketBallIcon,
  DraftPlayLogo,
} from "@draftplay/ui";

// ---------------------------------------------------------------------------
// Safe date parser — handles ISO strings from API and legacy date+time pairs
// ---------------------------------------------------------------------------
function parseSafeDate(dateStr?: string, timeStr?: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes("T") || dateStr.endsWith("Z")) {
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  const cleanTime = (timeStr ?? "").replace(/\s+[A-Z]{2,4}$/, "");
  const parsed = new Date(`${dateStr} ${cleanTime}`);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

// ---------------------------------------------------------------------------
// PulsingDot — animated live indicator (reanimated, needs raw color values)
// ---------------------------------------------------------------------------
function PulsingDot({ size = 6, color }: { size?: number; color?: string }) {
  const dotColor = color ?? tokens.color.error.val;

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <YStack width={size * 2} height={size * 2} alignItems="center" justifyContent="center">
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: dotColor,
          },
          animatedStyle,
        ]}
      />
      <YStack
        width={size}
        height={size}
        borderRadius={size / 2}
        backgroundColor={dotColor}
      />
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// LiveMatchCard
// ---------------------------------------------------------------------------
function LiveMatchCard({
  match,
  index,
  onPress,
  getTeamLogo,
}: {
  match: any;
  index: number;
  onPress: () => void;
  getTeamLogo?: (name: string) => string | undefined;
}) {
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const rawTeamA = match.teamA || match.teamHome || "TBA";
  const rawTeamB = match.teamB || match.teamAway || "TBA";
  const teamA = formatTeamName(rawTeamA);
  const teamB = formatTeamName(rawTeamB);
  const tournament = match.tournamentName || match.tournament || "cricket";
  const { scoreA, scoreB, oversA, oversB } = parseTeamScores(match.scoreSummary, rawTeamA, rawTeamB);
  const teamARole: "bat" | "bowl" | null = null; // Disabled — backlogged
  const teamAWon = didTeamAWin(match.result, rawTeamA);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card pressable live={isLive} onPress={onPress} padding="$6" marginBottom="$3" testID={`live-match-card-${index}`}>
        {/* Header: tournament badge + live/upcoming status */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
          <Badge variant="role" size="sm">
            {formatBadgeText(tournament)}
          </Badge>

          <XStack alignItems="center" gap={5}>
            {isLive && <PulsingDot size={4} />}
            <Badge variant={isLive ? "live" : "default"} size="sm">
              {formatBadgeText(match.status || "upcoming")}
            </Badge>
          </XStack>
        </XStack>

        {/* Teams */}
        <XStack alignItems="center" justifyContent="center" marginBottom="$4">
          {/* Team A */}
          <YStack flex={1} alignItems="center" gap={6}>
            <InitialsAvatar
              name={teamA} playerRole="BAT" ovr={0} size={48}
              imageUrl={getTeamLogo?.(match.teamA || match.teamHome || "")}
              hideBadge={isCompleted ? teamAWon !== true : !isLive || !teamARole}
              badgeContent={
                isCompleted && teamAWon === true
                  ? <Text fontSize={10} lineHeight={14}>🏆</Text>
                  : isLive && teamARole
                    ? (teamARole === "bat" ? <CricketBatIcon size={14} /> : <CricketBallIcon size={10} />)
                    : undefined
              }
            />
            <Text {...textStyles.playerName} numberOfLines={1} textAlign="center">
              {teamA}
            </Text>
            {scoreA && (
              <YStack alignItems="center" gap={1}>
                <Text fontFamily="$mono" fontWeight="800" fontSize={15} color="$color">{scoreA}</Text>
                {oversA && <Text fontFamily="$mono" fontSize={10} color="$colorMuted">({oversA})</Text>}
              </YStack>
            )}
          </YStack>

          {/* VS divider */}
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

          {/* Team B */}
          <YStack flex={1} alignItems="center" gap={6}>
            <InitialsAvatar
              name={teamB} playerRole="BOWL" ovr={0} size={48}
              imageUrl={getTeamLogo?.(match.teamB || match.teamAway || "")}
              hideBadge={isCompleted ? teamAWon !== false : !isLive || !teamARole}
              badgeContent={
                isCompleted && teamAWon === false
                  ? <Text fontSize={10} lineHeight={14}>🏆</Text>
                  : isLive && teamARole
                    ? (teamARole === "bat" ? <CricketBallIcon size={10} /> : <CricketBatIcon size={14} />)
                    : undefined
              }
            />
            <Text {...textStyles.playerName} numberOfLines={1} textAlign="center">
              {teamB}
            </Text>
            {scoreB && (
              <YStack alignItems="center" gap={1}>
                <Text fontFamily="$mono" fontWeight="800" fontSize={15} color="$color">{scoreB}</Text>
                {oversB && <Text fontFamily="$mono" fontSize={10} color="$colorMuted">({oversB})</Text>}
              </YStack>
            )}
          </YStack>
        </XStack>

        {/* Result */}
        {match.result && (
          <Text fontFamily="$body" fontWeight="700" fontSize={11} color="$accentBackground" textAlign="center" marginBottom="$2">
            {match.result}
          </Text>
        )}

        {/* Toss — smaller when score is showing */}
        {match.tossWinner && (
          <XStack alignSelf="center" alignItems="center" gap={6} marginBottom="$2" opacity={match.scoreSummary ? 0.6 : 1}>
            <Text fontFamily="$mono" fontSize={match.scoreSummary ? 8 : 9} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
              toss
            </Text>
            <YStack width={2.5} height={2.5} borderRadius={1.25} backgroundColor="$colorMuted" opacity={0.5} />
            <Text fontFamily="$body" fontSize={match.scoreSummary ? 9 : 11} fontWeight="600" color="$color">
              {match.tossWinner}
            </Text>
            <Text fontFamily="$mono" fontSize={match.scoreSummary ? 8 : 10} fontWeight="500" color="$colorAccent">
              elected to {match.tossDecision}
            </Text>
          </XStack>
        )}

        {/* Footer: venue/time + action button */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop="$3"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          <YStack flex={1} gap={2}>
            <Text {...textStyles.hint}>
              {match.date
                ? parseSafeDate(match.date, match.time).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
                : match.time || match.venue || ""}
            </Text>
            {match.venue && match.date && (
              <Text {...textStyles.hint} fontSize={10} numberOfLines={2}>
                {match.venue}
              </Text>
            )}
          </YStack>

          <Button
            onPress={onPress}
            size="sm"
            variant="primary"
            fontFamily="$mono"
          >
            {isLive ? formatUIText("watch live") : match.draftEnabled ? formatUIText("play") : formatUIText("view match")}
          </Button>
        </XStack>
      </Card>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// LiveScreen (default export)
// ---------------------------------------------------------------------------
export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sport } = useSport();
  const theme = useTamaguiTheme();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch from Gemini sports API (cached 24hr)
  const aiData = trpc.sports.dashboard.useQuery(
    { sport },
    { staleTime: 60 * 60 * 1000, retry: 1 },
  );

  // Also fetch DB live matches (real-time 10s poll)
  const dbLive = trpc.match.live.useQuery(undefined, {
    refetchInterval: 10_000,
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([aiData.refetch(), dbLive.refetch()]);
    setRefreshing(false);
  }, [aiData, dbLive]);

  // Merge data: AI matches (live+upcoming) + DB live matches
  const aiMatches = aiData.data?.matches ?? [];
  const dbMatches = dbLive.data ?? [];

  // Build a lookup from DB matches by normalized team names for toss/score enrichment
  const dbLookup = new Map<string, any>();
  for (const m of dbMatches) {
    const key = [m.teamHome, m.teamAway].map((t: string) => t.toLowerCase().trim()).sort().join("|");
    dbLookup.set(key, m);
  }

  const allMatches =
    aiMatches.length > 0
      ? aiMatches.map((ai: any) => {
          // Enrich AI match with DB toss/score data
          const key = [ai.teamA || "", ai.teamB || ""].map((t: string) => t.toLowerCase().trim()).sort().join("|");
          const db = dbLookup.get(key);
          return {
            ...ai,
            tossWinner: ai.tossWinner || db?.tossWinner || null,
            tossDecision: ai.tossDecision || db?.tossDecision || null,
            scoreSummary: db?.scoreSummary || ai.scoreSummary || null,
            result: ai.result || db?.result || null,
          };
        })
      : dbMatches.map((m: any) => ({
          id: m.id,
          teamA: m.teamHome,
          teamB: m.teamAway,
          tournamentName: m.tournament,
          time: new Date(m.startTime).toISOString(),
          date: new Date(m.startTime).toISOString(),
          status: m.status,
          format: m.format?.toUpperCase() || "T20",
          venue: m.venue,
          sport,
          scoreSummary: m.scoreSummary || null,
          result: m.result || null,
          tossWinner: m.tossWinner || null,
          tossDecision: m.tossDecision || null,
          sourceUrl: null,
        }));

  // Build team logo lookup from tournament teams data
  const teamLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of aiData.data?.tournaments ?? []) {
      for (const team of (t as any).teams ?? []) {
        if (team.logo) {
          map.set(team.name?.toLowerCase(), team.logo);
          if (team.shortName) map.set(team.shortName.toLowerCase(), team.logo);
        }
      }
    }
    return map;
  }, [aiData.data?.tournaments]);

  const getTeamLogo = useCallback((teamName: string) => {
    const key = teamName.toLowerCase();
    return teamLogoMap.get(key) ?? [...teamLogoMap.entries()].find(([k]) => key.includes(k) || k.includes(key))?.[1] ?? undefined;
  }, [teamLogoMap]);

  const sortByDate = (a: any, b: any) => {
    const getTime = (m: any) => {
      if (m.startTime) return new Date(m.startTime).getTime();
      if (m.date) return parseSafeDate(m.date, m.time).getTime();
      return 0;
    };
    return getTime(a) - getTime(b);
  };

  const liveMatches = allMatches.filter((m: any) => m.status === "live").sort(sortByDate);
  const upcomingMatches = allMatches.filter((m: any) => m.status === "upcoming").sort(sortByDate);
  const completedMatches = allMatches.filter((m: any) => m.status === "completed").sort((a: any, b: any) => -sortByDate(a, b));

  // Build list with section headers
  const data: any[] = [];
  if (liveMatches.length > 0) {
    data.push({ _type: "header", label: "live now", key: "h-live" });
    data.push(...liveMatches);
  }
  if (upcomingMatches.length > 0) {
    data.push({ _type: "header", label: "upcoming", key: "h-upcoming" });
    data.push(...upcomingMatches);
  }
  if (completedMatches.length > 0) {
    data.push({ _type: "header", label: "recent results", key: "h-completed" });
    data.push(...completedMatches);
  }

  // Show loading only on initial fetch when we have NO data yet.
  // Once either source returns data, render it immediately.
  const hasData = data.length > 0;
  const isInitialLoad = (aiData.isLoading || aiData.isFetching) && !hasData && dbLive.isLoading;

  if (isInitialLoad) {
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

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="live-screen">
      {/* Header */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$5"
        paddingVertical="$4"
      >
        <XStack alignItems="center" gap="$2">
          <YStack width={4} height={20} borderRadius={2} backgroundColor="$error" />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("matches")}
          </Text>
        </XStack>

        <XStack alignItems="center" gap="$3">
          {liveMatches.length > 0 && (
            <XStack alignItems="center" gap={5}>
              <PulsingDot size={4} />
              <Text fontFamily="$mono" fontSize={10} letterSpacing={1} color="$colorSecondary">
                {formatBadgeText("real-time")}
              </Text>
            </XStack>
          )}
          {liveMatches.length > 0 && (
            <Badge variant="live" size="sm">
              {liveMatches.length}
            </Badge>
          )}
          <HeaderControls />
        </XStack>
      </XStack>

      <AnnouncementBanner />

      {data.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={{ flex: 1 }}>
          <YStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            paddingHorizontal="$8"
            gap="$3"
          >
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color">
              {formatUIText("no matches right now")}
            </Text>
            <Text
              {...textStyles.hint}
              textAlign="center"
              lineHeight={20}
              marginBottom="$3"
            >
              {formatUIText("live scoring and real-time updates appear here during matches")}
            </Text>

            <Card alignSelf="stretch" gap="$3" padding="$6">
              {([
                "real-time scores & ball-by-ball",
                "fantasy point tracking",
                "wicket & milestone alerts",
              ]).map((text, i) => (
                <XStack key={i} alignItems="center" gap="$3">
                  <Text fontFamily="$mono" fontSize={11} color="$colorAccent">
                    &gt;
                  </Text>
                  <Text fontFamily="$body" fontSize={14} color="$colorSecondary">
                    {formatUIText(text)}
                  </Text>
                </XStack>
              ))}
            </Card>
          </YStack>
        </Animated.View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.key ?? i.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accentBackground.val}
            />
          }
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            if (item._type === "header") {
              return (
                <XStack alignItems="center" gap="$2" marginTop={index > 0 ? "$4" : 0} marginBottom="$2">
                  <YStack width={3} height={14} borderRadius={2} backgroundColor={item.label === "live now" ? "$error" : item.label === "recent results" ? "$accentBackground" : "$colorMuted"} />
                  <Text fontFamily="$mono" fontWeight="600" fontSize={12} color="$colorSecondary" letterSpacing={0.5}>
                    {formatUIText(item.label)}
                  </Text>
                </XStack>
              );
            }
            return (
              <LiveMatchCard
                match={item}
                index={index}
                getTeamLogo={getTeamLogo}
                onPress={() => {
                  if (item.id.startsWith("ai-")) {
                    router.push("/(tabs)/contests");
                  } else {
                    router.push(`/match/${item.id}`);
                  }
                }}
              />
            );
          }}
        />
      )}
    </YStack>
  );
}
