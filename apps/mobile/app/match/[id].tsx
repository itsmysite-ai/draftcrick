import { ScrollView as RNScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  BackButton,
  InitialsAvatar,
  EggLoadingSpinner,
  FDRBadge,
  CricketBallIcon,
  CricketBatIcon,
  Paywall,
  TierBadge,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useNavigationStore } from "../../lib/navigation-store";
import { useSport } from "../../providers/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";
import { usePaywall } from "../../hooks/usePaywall";
import { HeaderControls } from "../../components/HeaderControls";

/** Safely parse AI-returned date/time strings into a Date object */
function parseSafeDate(dateStr?: string, timeStr?: string): Date {
  if (!dateStr) return new Date();
  const cleanTime = (timeStr ?? "").replace(/\s+[A-Z]{2,4}$/, "");
  const parsed = new Date(`${dateStr} ${cleanTime}`);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Parse "India 253/7 (20 ov) vs England 246/7 (20 ov)" into per-team scores with overs.
 */
function parseTeamScores(scoreSummary: string | null | undefined) {
  if (!scoreSummary) return { scoreA: null, scoreB: null, oversA: null, oversB: null };
  const parts = scoreSummary.split(/\s+vs\s+/i);
  const extract = (part: string) => {
    const scoreMatch = part.match(/(\d+\/\d+)/);
    const oversMatch = part.match(/\(([^)]+)\)/);
    return {
      score: scoreMatch ? scoreMatch[1] : null,
      overs: oversMatch ? oversMatch[1] : null,
    };
  };
  const a = parts[0] ? extract(parts[0]) : { score: null, overs: null };
  const b = parts[1] ? extract(parts[1]) : { score: null, overs: null };
  return { scoreA: a.score, scoreB: b.score, oversA: a.overs, oversB: b.overs };
}

/**
 * Determine bat/bowl role for each team from toss info.
 * Returns "bat" or "bowl" for teamA (teamB is the opposite).
 */
function getTeamRole(tossWinner: string | null, tossDecision: string | null, teamA: string): "bat" | "bowl" | null {
  if (!tossWinner || !tossDecision) return null;
  const winnerChoseBat = tossDecision.toLowerCase().includes("bat");
  const teamAWonToss = tossWinner.toLowerCase().includes(teamA.toLowerCase().slice(0, 4));
  if (teamAWonToss) return winnerChoseBat ? "bat" : "bowl";
  return winnerChoseBat ? "bowl" : "bat";
}

/** Check if teamA won from result string like "India won by 7 runs" */
function didTeamAWin(result: string | null, teamA: string): boolean | null {
  if (!result) return null;
  const r = result.toLowerCase();
  if (r.includes("no result") || r.includes("tied") || r.includes("draw")) return null;
  return r.includes(teamA.toLowerCase().slice(0, 4));
}

function formatCountdown(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "NOW";
  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Contest Option Card ────────────────────────────────────────────
function ContestOption({
  title,
  subtitle,
  prize,
  entry,
  spots,
  highlight,
  onPress,
  testID,
}: {
  title: string;
  subtitle: string;
  prize: string;
  entry: string;
  spots: string;
  highlight?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Card
      pressable
      onPress={onPress}
      padding={0}
      overflow="hidden"
      marginBottom="$3"
      borderWidth={highlight ? 2 : 1}
      borderColor={highlight ? "$colorAccent" : "$borderColor"}
      testID={testID}
    >
      <XStack
        justifyContent="space-between"
        alignItems="center"
        padding="$4"
        paddingBottom="$3"
      >
        <YStack flex={1} gap={2}>
          <XStack alignItems="center" gap="$2">
            <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
              {formatUIText(title)}
            </Text>
            {highlight && (
              <Badge variant="live" size="sm">{formatBadgeText("popular")}</Badge>
            )}
          </XStack>
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {formatUIText(subtitle)}
          </Text>
        </YStack>
        <Button variant="primary" size="sm" onPress={onPress}>
          {formatUIText(entry === "free" ? "join free" : `${entry} PC`)}
        </Button>
      </XStack>

      {/* Prize + Spots strip */}
      <XStack
        backgroundColor="$backgroundSurfaceAlt"
        paddingVertical="$2"
        paddingHorizontal="$4"
        justifyContent="space-between"
        alignItems="center"
        borderTopWidth={1}
        borderTopColor="$borderColor"
      >
        <XStack alignItems="center" gap="$2">
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {formatUIText("prize")}
          </Text>
          <Text fontFamily="$mono" fontSize={11} fontWeight="700" color="$colorAccent">
            {prize}
          </Text>
        </XStack>
        <XStack alignItems="center" gap="$2">
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {formatUIText("spots")}
          </Text>
          <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$color">
            {spots}
          </Text>
        </XStack>
      </XStack>
    </Card>
  );
}

// ─── Main ───────────────────────────────────────────────────────────
export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = decodeURIComponent(id ?? "");
  const router = useRouter();
  const theme = useTamaguiTheme();

  const { sport } = useSport();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Reuse dashboard data to find the match
  const dashboardQuery = trpc.sports.dashboard.useQuery(
    { sport },
    { staleTime: 60 * 60_000, retry: 1 },
  );

  // DB match for toss/score enrichment
  const dbLive = trpc.match.live.useQuery(undefined, {
    refetchInterval: 10_000,
    retry: false,
  });

  const [showProjections, setShowProjections] = useState(false);
  const [showH2H, setShowH2H] = useState(false);
  const [showCaptainPicks, setShowCaptainPicks] = useState(false);
  const [showDifferentials, setShowDifferentials] = useState(false);
  const [showPlayingXI, setShowPlayingXI] = useState(false);
  const [showPitchWeather, setShowPitchWeather] = useState(false);
  const [showPlayerStats, setShowPlayerStats] = useState(false);
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const [showValueTracker, setShowValueTracker] = useState(false);
  const [showStatTopFives, setShowStatTopFives] = useState(false);
  const [statsSortBy, setStatsSortBy] = useState("avgFantasyPoints");
  const setMatchContext = useNavigationStore((s) => s.setMatchContext);
  const { gate, gateFeature, hasAccess, canAccess, paywallProps } = usePaywall();

  // Build match from dashboard + DB data (no hooks below, just computation)
  const dbMatches = dbLive.data ?? [];
  const match = useMemo(() => {
    if (dashboardQuery.isLoading) return undefined; // still loading
    const dbLookup = new Map<string, any>();
    for (const m of dbMatches) {
      const key = [m.teamHome, m.teamAway].map((t: string) => t.toLowerCase().trim()).sort().join("|");
      dbLookup.set(key, m);
    }
    const rawMatch = (dashboardQuery.data?.matches ?? []).find((m: any) => m.id === matchId) as any;
    const dbMatchDirect = !rawMatch ? dbMatches.find((m: any) => m.id === matchId || m.externalId === matchId) : null;

    if (rawMatch) {
      const key = [rawMatch.teamA || "", rawMatch.teamB || ""].map((t: string) => t.toLowerCase().trim()).sort().join("|");
      const db = dbLookup.get(key);
      return {
        ...rawMatch,
        tossWinner: rawMatch.tossWinner || db?.tossWinner || null,
        tossDecision: rawMatch.tossDecision || db?.tossDecision || null,
        scoreSummary: rawMatch.scoreSummary || db?.scoreSummary || null,
        result: rawMatch.result || db?.result || null,
      };
    }
    if (dbMatchDirect) {
      return {
        id: dbMatchDirect.id,
        teamA: dbMatchDirect.teamHome,
        teamB: dbMatchDirect.teamAway,
        tournamentName: dbMatchDirect.tournament,
        format: dbMatchDirect.format?.toUpperCase() || "T20",
        venue: dbMatchDirect.venue,
        status: dbMatchDirect.status,
        date: new Date(dbMatchDirect.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: new Date(dbMatchDirect.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        scoreSummary: dbMatchDirect.scoreSummary || null,
        result: dbMatchDirect.result || null,
        tossWinner: dbMatchDirect.tossWinner || null,
        tossDecision: dbMatchDirect.tossDecision || null,
        sport,
      };
    }
    return null;
  }, [dashboardQuery.isLoading, dashboardQuery.data, dbMatches, matchId]);

  // Derived match fields (safe defaults when match is null)
  const isLive = match?.status === "live";
  const isCompleted = match?.status === "completed";
  const teamA = formatTeamName(match?.teamA || match?.teamHome || "TBA");
  const teamB = formatTeamName(match?.teamB || match?.teamAway || "TBA");
  const tournament = match?.tournamentName || match?.tournament || "";
  const format = match?.format || "T20";
  const venue = match?.venue || null;
  const startTime = parseSafeDate(match?.date, match?.time);
  const timeStr = startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = startTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const scoreData = parseTeamScores(match?.scoreSummary);
  const scoreA = scoreData.scoreA;
  const scoreB = scoreData.scoreB;
  const oversA = scoreData.oversA;
  const oversB = scoreData.oversB;
  const teamARole = getTeamRole(match?.tossWinner, match?.tossDecision, teamA);
  const teamAWon = didTeamAWin(match?.result, teamA);

  // FDR query
  const fdrQuery = trpc.analytics.getFixtureDifficulty.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown" },
    { staleTime: 60 * 60_000, retry: 1, enabled: !!match },
  );

  // Player + Projections queries (for AI tools section)
  const playersQuery = trpc.player.getByMatch.useQuery(
    { matchId: matchId! },
    { enabled: !!match, staleTime: 60 * 60_000 },
  );

  const playerList = useMemo(() => {
    const list = (playersQuery.data as any)?.players ?? playersQuery.data ?? [];
    if (!Array.isArray(list)) return [];
    return list
      .map((ps: any) => {
        const p = ps.player ?? ps;
        return p?.id ? { id: p.id, name: p.name, role: p.role, team: p.team } : null;
      })
      .filter(Boolean) as { id: string; name: string; role: string; team: string }[];
  }, [playersQuery.data]);

  const projectionsQuery = trpc.analytics.getPlayerProjections.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown", players: playerList },
    { enabled: showProjections && !!match, staleTime: 60 * 60_000, retry: 1 },
  );

  const topProjections = useMemo(() => {
    const players = projectionsQuery.data?.players;
    if (!players || !Array.isArray(players)) return [];
    return [...players]
      .sort((a: any, b: any) => (b.projectedPoints ?? 0) - (a.projectedPoints ?? 0))
      .slice(0, 5);
  }, [projectionsQuery.data]);

  // Lazy-loaded AI feature queries (only fetch when user taps)
  const h2hQuery = trpc.analytics.getHeadToHead.useQuery(
    { teamA, teamB, format, venue },
    { enabled: showH2H && !!match, staleTime: 6 * 60 * 60_000, retry: 1 },
  );
  const captainPicksQuery = trpc.analytics.getCaptainPicks.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown", players: playerList.map((p: any) => ({ name: p.name, role: p.role, team: p.team })) },
    { enabled: showCaptainPicks && !!match, staleTime: 2 * 60 * 60_000, retry: 1 },
  );
  const differentialsQuery = trpc.analytics.getDifferentials.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown", players: playerList.map((p: any) => ({ name: p.name, role: p.role, team: p.team })) },
    { enabled: showDifferentials && !!match, staleTime: 2 * 60 * 60_000, retry: 1 },
  );
  const playingXIQuery = trpc.analytics.getPlayingXI.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown" },
    { enabled: showPlayingXI && !!match, staleTime: 60 * 60_000, retry: 1 },
  );
  const pitchWeatherQuery = trpc.analytics.getPitchWeather.useQuery(
    { matchId, teamA, teamB, format, venue },
    { enabled: showPitchWeather && !!match, staleTime: 60 * 60_000, retry: 1 },
  );

  // Resolve DB match UUID for contest queries
  const dbMatchUuid = useMemo(() => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId);
    if (isUuid) return matchId;
    // Find from dbMatches by externalId or team name matching
    const byExternal = dbMatches.find((m: any) => m.externalId === matchId);
    if (byExternal) return byExternal.id;
    // Team name matching
    if (match) {
      const key = [match.teamA || match.teamHome || "", match.teamB || match.teamAway || ""]
        .map((t: string) => t.toLowerCase().trim()).sort().join("|");
      for (const m of dbMatches) {
        const mKey = [m.teamHome, m.teamAway].map((t: string) => t.toLowerCase().trim()).sort().join("|");
        if (mKey === key) return m.id;
      }
    }
    return null;
  }, [matchId, dbMatches, match]);

  // Fetch real contests from DB
  const contestsQuery = trpc.contest.listByMatch.useQuery(
    { matchId: dbMatchUuid! },
    { enabled: !!dbMatchUuid, staleTime: 60_000 },
  );
  const matchStarted = isLive || isCompleted;
  const myContestsQuery = trpc.contest.myContests.useQuery(undefined, {
    enabled: !!user && matchStarted,
    retry: false,
  });
  const allDbContests = contestsQuery.data ?? [];
  // Once match starts, only show contests user joined
  const myContestIds = new Set(
    (myContestsQuery.data ?? []).map((mc: any) => mc.contestId ?? mc.contest?.id).filter(Boolean)
  );
  const dbContests = matchStarted && user
    ? allDbContests.filter((c: any) => myContestIds.has(c.id))
    : allDbContests;

  // New analytics feature queries (lazy-loaded, after dbMatchUuid)
  const playerStatsQuery = trpc.analytics.getPlayerStats.useQuery(
    { teamA, teamB, tournament: tournament || "unknown", sortBy: statsSortBy, sortDir: "desc" },
    { enabled: showPlayerStats && !!match, staleTime: 30 * 60_000, retry: 1 },
  );
  const pointsBreakdownQuery = trpc.analytics.getPointsBreakdown.useQuery(
    { matchId: dbMatchUuid ?? "", format },
    { enabled: showPointsBreakdown && !!dbMatchUuid && isCompleted, staleTime: 60 * 60_000, retry: 1 },
  );
  const valueTrackerQuery = trpc.analytics.getValueTracker.useQuery(
    { matchId: dbMatchUuid ?? matchId, teamA, teamB },
    { enabled: showValueTracker && !!match, staleTime: 30 * 60_000, retry: 1 },
  );
  const statTopFivesQuery = trpc.analytics.getStatTopFives.useQuery(
    { tournament: tournament || "unknown" },
    { enabled: showStatTopFives && !!tournament, staleTime: 60 * 60_000, retry: 1 },
  );

  const goToTeamCreate = () => {
    setMatchContext({ matchId, teamA, teamB, format, venue: venue || undefined, tournament: tournament || undefined });
    router.push("/team/create");
  };

  const goToGuru = () => {
    setMatchContext({ matchId, teamA, teamB });
    router.push("/guru");
  };

  // ── Early returns (after all hooks) ──
  if (dashboardQuery.isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" paddingTop={insets.top} backgroundColor="$background">
        <EggLoadingSpinner size={48} message={formatUIText("loading match")} />
      </YStack>
    );
  }

  if (!match) {
    return (
      <YStack flex={1} backgroundColor="$background" paddingTop={insets.top} testID="match-detail-screen">
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
          <HeaderControls />
        </XStack>
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
          <CricketBatIcon size={DesignSystem.emptyState.iconSize} />
          <Text {...textStyles.playerName}>{formatUIText("match not found")}</Text>
          <Text {...textStyles.hint}>{formatUIText("this match may no longer be available")}</Text>
          <Button variant="primary" size="md" marginTop="$3" onPress={() => router.back()}>
            {formatUIText("go back")}
          </Button>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="match-detail-screen">
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
        <HeaderControls />
      </XStack>

      <RNScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 120 }}
      >
        {/* ── Match Header (compact) ── */}
        <Animated.View entering={FadeIn.delay(0)}>
          <Card padding="$4" marginBottom="$4" testID="match-header-card">
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              {tournament ? (
                <Badge variant="role" size="sm">
                  {formatBadgeText(tournament)}
                </Badge>
              ) : null}
              <Badge variant={isLive ? "live" : "default"} size="sm">
                {isLive ? formatBadgeText("live") : formatCountdown(startTime)}
              </Badge>
              {match.format && (
                <Badge variant="default" size="sm">
                  {formatBadgeText(match.format)}
                </Badge>
              )}
            </XStack>

            {/* Teams row — scores + overs under name, contextual badge */}
            <XStack alignItems="center" justifyContent="center" gap="$4">
              <YStack alignItems="center" flex={1}>
                <InitialsAvatar
                  name={teamA}
                  playerRole="BAT"
                  ovr={0}
                  size={48}
                  hideBadge={isCompleted ? teamAWon !== true : !teamARole}
                  badgeContent={
                    isCompleted && teamAWon === true
                      ? <Text fontSize={10} lineHeight={14}>🏆</Text>
                      : isLive && teamARole
                        ? (teamARole === "bat" ? <CricketBatIcon size={14} /> : <CricketBallIcon size={10} />)
                        : undefined
                  }
                />
                <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" marginTop="$1" textAlign="center" numberOfLines={1}>
                  {teamA}
                </Text>
                {scoreA && (
                  <YStack alignItems="center" marginTop={4} gap={1}>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={15} color="$color">
                      {scoreA}
                    </Text>
                    {oversA && (
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                        ({oversA})
                      </Text>
                    )}
                  </YStack>
                )}
                {fdrQuery.data?.teamA && !isCompleted && !scoreA && (
                  <XStack marginTop={4}>
                    <FDRBadge fdr={fdrQuery.data.teamA.overallFdr} size="sm" showLabel testID="fdr-badge-team-a" />
                  </XStack>
                )}
              </YStack>

              <YStack alignItems="center" gap={2}>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  {formatUIText("vs")}
                </Text>
              </YStack>

              <YStack alignItems="center" flex={1}>
                <InitialsAvatar
                  name={teamB}
                  playerRole="BOWL"
                  ovr={0}
                  size={48}
                  hideBadge={isCompleted ? teamAWon !== false : !teamARole}
                  badgeContent={
                    isCompleted && teamAWon === false
                      ? <Text fontSize={10} lineHeight={14}>🏆</Text>
                      : isLive && teamARole
                        ? (teamARole === "bat" ? <CricketBallIcon size={10} /> : <CricketBatIcon size={14} />)
                        : undefined
                  }
                />
                <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" marginTop="$1" textAlign="center" numberOfLines={1}>
                  {teamB}
                </Text>
                {scoreB && (
                  <YStack alignItems="center" marginTop={4} gap={1}>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={15} color="$color">
                      {scoreB}
                    </Text>
                    {oversB && (
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                        ({oversB})
                      </Text>
                    )}
                  </YStack>
                )}
                {fdrQuery.data?.teamB && !isCompleted && !scoreB && (
                  <XStack marginTop={4}>
                    <FDRBadge fdr={fdrQuery.data.teamB.overallFdr} size="sm" showLabel testID="fdr-badge-team-b" />
                  </XStack>
                )}
              </YStack>
            </XStack>

            {/* Result */}
            {match.result && (
              <Text fontFamily="$body" fontWeight="700" fontSize={12} color="$accentBackground" textAlign="center" marginTop="$2">
                {match.result}
              </Text>
            )}

            {/* Toss — smaller when score is showing */}
            {match.tossWinner && (
              <XStack alignSelf="center" alignItems="center" gap={match.scoreSummary ? 6 : 8} marginTop="$2" opacity={match.scoreSummary ? 0.6 : 1}>
                <Text fontFamily="$mono" fontSize={match.scoreSummary ? 9 : 10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                  toss
                </Text>
                <YStack width={match.scoreSummary ? 2.5 : 3} height={match.scoreSummary ? 2.5 : 3} borderRadius={1.5} backgroundColor="$colorMuted" opacity={0.5} />
                <Text fontFamily="$body" fontSize={match.scoreSummary ? 10 : 12} fontWeight="600" color="$color">
                  {match.tossWinner}
                </Text>
                <Text fontFamily="$mono" fontSize={match.scoreSummary ? 9 : 11} fontWeight="500" color="$colorAccent">
                  elected to {match.tossDecision}
                </Text>
              </XStack>
            )}

            {/* Date + Venue */}
            <YStack alignItems="center" marginTop="$3" gap={2}>
              <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorCricket">
                {isLive ? formatUIText("in progress") : `${dateStr} · ${timeStr}`}
              </Text>
              {venue && (
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted" numberOfLines={1}>
                  {venue}
                </Text>
              )}
            </YStack>
          </Card>
        </Animated.View>

        {/* ── Primary CTA — Create Team (hidden once match starts) ── */}
        {!isCompleted && !isLive && (
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            <Button
              variant="primary"
              size="lg"
              marginBottom="$5"
              onPress={() => goToTeamCreate()}
              testID="primary-create-team-btn"
            >
              {formatUIText("create your team")}
            </Button>
          </Animated.View>
        )}

        {/* ── Contests Section ── */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <XStack alignItems="center" gap="$2" marginBottom="$3">
            <Text fontSize={14}>🏟️</Text>
            <Text {...textStyles.sectionHeader}>
              {formatUIText(matchStarted ? "your contests" : "choose a contest")}
            </Text>
          </XStack>

          {dbContests.length > 0 ? (
            dbContests.map((contest: any, i: number) => (
              <ContestOption
                key={contest.id}
                title={contest.name}
                subtitle={`${contest.contestType} · ${contest.currentEntries}/${contest.maxEntries} joined`}
                prize={contest.prizePool > 0 ? `${contest.prizePool.toLocaleString()} PC` : "glory"}
                entry={contest.entryFee === 0 ? "free" : String(contest.entryFee)}
                spots={`${contest.maxEntries - contest.currentEntries}`}
                highlight={i === 0}
                onPress={() => router.push(`/contest/${contest.id}`)}
                testID={`contest-${i}`}
              />
            ))
          ) : contestsQuery.isLoading ? (
            <Card padding="$4" marginBottom="$3" alignItems="center">
              <EggLoadingSpinner size={24} message={formatUIText("loading contests")} />
            </Card>
          ) : (
            <Card padding="$4" marginBottom="$3" alignItems="center">
              <Text {...textStyles.hint} textAlign="center">
                {formatUIText(matchStarted ? "you didn't join any contests for this match" : "no contests available for this match")}
              </Text>
            </Card>
          )}
        </Animated.View>

        {/* ── FDR / AI Tools — only for upcoming matches (before match starts) ── */}
        {!matchStarted && (
          <>
            {/* ── FDR Breakdown (decision support) ── */}
            {fdrQuery.data && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <XStack alignItems="center" gap="$2" marginTop="$2" marginBottom="$3">
                  <Text fontSize={14}>📊</Text>
                  <Text {...textStyles.sectionHeader}>{formatUIText("fixture difficulty")}</Text>
                </XStack>
                <Card padding="$4" marginBottom="$5" testID="fdr-card">
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted" textAlign="center" marginBottom="$3">
                    {formatUIText("lower fdr = easier fixture for your fantasy picks")}
                  </Text>
                  <XStack justifyContent="space-around">
                    {[
                      { label: teamA, data: fdrQuery.data.teamA },
                      { label: teamB, data: fdrQuery.data.teamB },
                    ].map((t) => (
                      <YStack key={t.label} alignItems="center" gap="$2">
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">{t.label}</Text>
                        <FDRBadge fdr={t.data.overallFdr} size="lg" showLabel />
                        {hasAccess("pro") ? (
                          <XStack gap="$3" marginTop="$1">
                            <YStack alignItems="center">
                              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("bat")}</Text>
                              <FDRBadge fdr={t.data.battingFdr} size="sm" />
                            </YStack>
                            <YStack alignItems="center">
                              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("bowl")}</Text>
                              <FDRBadge fdr={t.data.bowlingFdr} size="sm" />
                            </YStack>
                          </XStack>
                        ) : (
                          <XStack marginTop="$1" alignItems="center" gap="$1">
                            <TierBadge tier="pro" size="sm" />
                            <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("bat/bowl split")}</Text>
                          </XStack>
                        )}
                      </YStack>
                    ))}
                  </XStack>
                  <Button
                    variant="secondary"
                    size="sm"
                    marginTop="$4"
                    onPress={() => goToTeamCreate()}
                  >
                    {formatUIText("use insights to build team")}
                  </Button>
                </Card>
              </Animated.View>
            )}

            {/* ── AI Tools — upsell after primary CTA ── */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Text fontSize={14}>🤖</Text>
                <Text {...textStyles.sectionHeader}>{formatUIText("ai tools")}</Text>
              </XStack>

              <Card
                pressable
                padding="$4"
                marginBottom="$3"
                onPress={() => goToGuru()}
                testID="guru-card"
              >
                <XStack alignItems="center" gap="$3">
                  <DraftPlayLogo size={24} />
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("cricket guru")}
                    </Text>
                    <Text {...textStyles.hint} marginTop={2}>
                      {formatUIText("ask ai about this match, players & strategy")}
                    </Text>
                  </YStack>
                  <Text fontSize={14} color="$colorMuted">→</Text>
                </XStack>
              </Card>

              {!showProjections ? (
                <Card pressable padding="$4" marginBottom="$3" testID="projections-card" onPress={() => {
                  if (gateFeature("hasProjectedPoints", "pro", "Projected Points", "AI-powered player point projections for smarter picks")) return;
                  setShowProjections(true);
                }}>
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize={16}>📈</Text>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" flex={1}>
                      {formatUIText("projected points")}
                    </Text>
                    {!canAccess("hasProjectedPoints") ? (
                      <TierBadge tier="pro" size="sm" />
                    ) : (
                      <Text fontFamily="$body" fontSize={12} color="$accentBackground" fontWeight="600">
                        {formatUIText("tap to load →")}
                      </Text>
                    )}
                  </XStack>
                </Card>
              ) : (
                <Card padding="$4" marginBottom="$3" testID="projections-card">
                  <XStack alignItems="center" gap="$2" marginBottom="$3">
                    <Text fontSize={16}>📈</Text>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" flex={1}>
                      {formatUIText("projected points")}
                    </Text>
                    {projectionsQuery.isLoading && (
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("generating...")}</Text>
                    )}
                  </XStack>

                  {projectionsQuery.isLoading || projectionsQuery.isFetching ? (
                    <YStack alignItems="center" paddingVertical="$3">
                      <EggLoadingSpinner size={24} message={formatUIText("analyzing players via ai")} />
                    </YStack>
                  ) : projectionsQuery.isError ? (
                    <YStack alignItems="center" paddingVertical="$2">
                      <Text {...textStyles.hint} textAlign="center">
                        {formatUIText("failed to load projections. tap to retry.")}
                      </Text>
                      <Card pressable padding="$2" marginTop="$2" onPress={() => projectionsQuery.refetch()}>
                        <Text fontFamily="$body" fontSize={12} color="$accentBackground" textAlign="center" fontWeight="600">
                          {formatUIText("retry")}
                        </Text>
                      </Card>
                    </YStack>
                  ) : topProjections.length > 0 ? (
                    <YStack gap="$1">
                      {topProjections.map((p: any, i: number) => (
                        <XStack key={p.playerId || i} alignItems="center" paddingVertical="$1" gap="$2">
                          <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={16} textAlign="center">
                            {p.captainRank <= 3 ? "👑" : `#${p.captainRank}`}
                          </Text>
                          <Text fontFamily="$body" fontSize={12} color="$color" flex={1} numberOfLines={1}>
                            {p.playerName}
                          </Text>
                          <Badge variant="role" size="sm">{formatBadgeText(p.role)}</Badge>
                          <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$accentBackground" width={40} textAlign="right">
                            {Number(p.projectedPoints).toFixed(1)}
                          </Text>
                          {canAccess("hasConfidence") ? (
                            <Text fontFamily="$mono" fontSize={9} color="$colorMuted" width={50} textAlign="right">
                              ({Math.round(Number(p.confidenceLow))}-{Math.round(Number(p.confidenceHigh))})
                            </Text>
                          ) : (
                            <TierBadge tier="elite" size="sm" />
                          )}
                        </XStack>
                      ))}
                      <Card pressable padding="$2" marginTop="$2" onPress={() => goToTeamCreate()}>
                        <Text fontFamily="$body" fontSize={12} color="$accentBackground" textAlign="center" fontWeight="600">
                          {formatUIText("view all & build team →")}
                        </Text>
                      </Card>
                    </YStack>
                  ) : (
                    <YStack alignItems="center" paddingVertical="$2">
                      <Text {...textStyles.hint} textAlign="center">
                        {formatUIText("no projections available yet")}
                      </Text>
                      <Card pressable padding="$2" marginTop="$2" onPress={() => projectionsQuery.refetch()}>
                        <Text fontFamily="$body" fontSize={12} color="$accentBackground" textAlign="center" fontWeight="600">
                          {formatUIText("retry →")}
                        </Text>
                      </Card>
                    </YStack>
                  )}
                </Card>
              )}
            </Animated.View>

            {/* ── AI Insights ── */}
            <Animated.View entering={FadeInDown.delay(250).springify()}>
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Text fontSize={14}>🔮</Text>
                <Text {...textStyles.sectionHeader}>{formatUIText("ai insights")}</Text>
              </XStack>

              {/* Head to Head — free by default, admin-togglable */}
              {canAccess("hasHeadToHead") && (<>
              <Card pressable padding="$4" marginBottom="$3" onPress={() => setShowH2H(!showH2H)}>
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={20}>⚔️</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("head to head stats")}
                    </Text>
                    <Text {...textStyles.hint} marginTop={2}>
                      {formatUIText("historical record between these two teams")}
                    </Text>
                  </YStack>
                  <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showH2H ? "▲" : "▼"}</Text>
                </XStack>
              </Card>
              {showH2H && (
                <Animated.View entering={FadeInDown.springify()}>
                  <Card padding="$4" marginBottom="$3" marginTop={-8}>
                    {h2hQuery.isLoading ? (
                      <EggLoadingSpinner size={24} message={formatUIText("loading h2h")} />
                    ) : h2hQuery.data ? (
                      <YStack gap="$2">
                        <XStack justifyContent="space-around">
                          <YStack alignItems="center">
                            <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$accentBackground">{(h2hQuery.data as any).overall?.teamAWins ?? 0}</Text>
                            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{teamA} wins</Text>
                          </YStack>
                          <YStack alignItems="center">
                            <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$colorMuted">{(h2hQuery.data as any).overall?.draws ?? 0}</Text>
                            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">draws</Text>
                          </YStack>
                          <YStack alignItems="center">
                            <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$colorCricket">{(h2hQuery.data as any).overall?.teamBWins ?? 0}</Text>
                            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{teamB} wins</Text>
                          </YStack>
                        </XStack>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted" textAlign="center">
                          {format}: {(h2hQuery.data as any).inFormat?.teamAWins ?? 0}-{(h2hQuery.data as any).inFormat?.teamBWins ?? 0} ({(h2hQuery.data as any).inFormat?.totalMatches ?? 0} matches)
                        </Text>
                        {(h2hQuery.data as any).venueRecord && (
                          <Text fontFamily="$body" fontSize={11} color="$colorSecondary" textAlign="center">
                            {(h2hQuery.data as any).venueRecord}
                          </Text>
                        )}
                        {(h2hQuery.data as any).keyInsight && (
                          <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$accentBackground" textAlign="center" marginTop="$1">
                            {(h2hQuery.data as any).keyInsight}
                          </Text>
                        )}
                      </YStack>
                    ) : (
                      <Text {...textStyles.hint} textAlign="center">{formatUIText("no data available")}</Text>
                    )}
                  </Card>
                </Animated.View>
              )}
              </>)}

              {/* Captain Picks — Pro */}
              <Card pressable padding="$4" marginBottom="$3" onPress={() => {
                if (gateFeature("hasCaptainPicks", "pro", "Captain Picks", "AI-recommended captain & vice-captain choices")) return;
                setShowCaptainPicks(!showCaptainPicks);
              }}>
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={20}>👑</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("captain picks")}
                    </Text>
                    <Text {...textStyles.hint} marginTop={2}>
                      {formatUIText("ai-recommended captain & vice-captain")}
                    </Text>
                  </YStack>
                  {canAccess("hasCaptainPicks") ? (
                    <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showCaptainPicks ? "▲" : "▼"}</Text>
                  ) : (
                    <TierBadge tier="pro" size="sm" />
                  )}
                </XStack>
              </Card>
              {showCaptainPicks && (
                <Animated.View entering={FadeInDown.springify()}>
                  <Card padding="$4" marginBottom="$3" marginTop={-8}>
                    {captainPicksQuery.isLoading ? (
                      <EggLoadingSpinner size={24} message={formatUIText("analyzing picks")} />
                    ) : captainPicksQuery.data ? (
                      <YStack gap="$3">
                        <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>{formatBadgeText("top captain picks (2x)")}</Text>
                        {((captainPicksQuery.data as any).captainPicks ?? []).map((p: any, i: number) => (
                          <XStack key={i} alignItems="center" gap="$2">
                            <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$colorCricket">#{i + 1}</Text>
                            <YStack flex={1}>
                              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">{p.playerName}</Text>
                              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{p.reason}</Text>
                            </YStack>
                            <Badge variant={p.confidence === "high" ? "live" : "default"} size="sm">{p.confidence}</Badge>
                          </XStack>
                        ))}
                        <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5} marginTop="$2">{formatBadgeText("top vice-captain picks (1.5x)")}</Text>
                        {((captainPicksQuery.data as any).viceCaptainPicks ?? []).map((p: any, i: number) => (
                          <XStack key={i} alignItems="center" gap="$2">
                            <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$accentBackground">#{i + 1}</Text>
                            <YStack flex={1}>
                              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">{p.playerName}</Text>
                              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{p.reason}</Text>
                            </YStack>
                          </XStack>
                        ))}
                        {(captainPicksQuery.data as any).summary && (
                          <Text fontFamily="$body" fontSize={11} color="$colorSecondary" marginTop="$1">
                            {(captainPicksQuery.data as any).summary}
                          </Text>
                        )}
                      </YStack>
                    ) : (
                      <Text {...textStyles.hint} textAlign="center">{formatUIText("no picks available")}</Text>
                    )}
                  </Card>
                </Animated.View>
              )}

              {/* Differentials — Pro */}
              <Card pressable padding="$4" marginBottom="$3" onPress={() => {
                if (gateFeature("hasDifferentials", "pro", "Differentials", "Low-ownership high-upside picks for your team")) return;
                setShowDifferentials(!showDifferentials);
              }}>
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={20}>💎</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("differentials")}
                    </Text>
                    <Text {...textStyles.hint} marginTop={2}>
                      {formatUIText("low-ownership high-upside picks")}
                    </Text>
                  </YStack>
                  {canAccess("hasDifferentials") ? (
                    <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showDifferentials ? "▲" : "▼"}</Text>
                  ) : (
                    <TierBadge tier="pro" size="sm" />
                  )}
                </XStack>
              </Card>
              {showDifferentials && (
                <Animated.View entering={FadeInDown.springify()}>
                  <Card padding="$4" marginBottom="$3" marginTop={-8}>
                    {differentialsQuery.isLoading ? (
                      <EggLoadingSpinner size={24} message={formatUIText("finding differentials")} />
                    ) : differentialsQuery.data ? (
                      <YStack gap="$2">
                        {((differentialsQuery.data as any).picks ?? []).map((p: any, i: number) => (
                          <XStack key={i} alignItems="center" gap="$2">
                            <InitialsAvatar name={p.playerName} playerRole={p.role?.toUpperCase()} ovr={0} size={28} />
                            <YStack flex={1}>
                              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">{p.playerName}</Text>
                              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{p.upsideReason}</Text>
                            </YStack>
                            <YStack alignItems="flex-end">
                              <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$accentBackground">{p.projectedPoints} pts</Text>
                              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{p.expectedOwnership}% owned</Text>
                            </YStack>
                          </XStack>
                        ))}
                      </YStack>
                    ) : (
                      <Text {...textStyles.hint} textAlign="center">{formatUIText("no data available")}</Text>
                    )}
                  </Card>
                </Animated.View>
              )}

              {/* Playing XI Prediction — Pro */}
              <Card pressable padding="$4" marginBottom="$3" onPress={() => {
                if (gateFeature("hasPlayingXI", "pro", "Playing XI", "AI-predicted lineup before toss")) return;
                setShowPlayingXI(!showPlayingXI);
              }}>
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={20}>📋</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("playing xi prediction")}
                    </Text>
                    <Text {...textStyles.hint} marginTop={2}>
                      {formatUIText("ai-predicted lineup before toss")}
                    </Text>
                  </YStack>
                  {canAccess("hasPlayingXI") ? (
                    <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showPlayingXI ? "▲" : "▼"}</Text>
                  ) : (
                    <TierBadge tier="pro" size="sm" />
                  )}
                </XStack>
              </Card>
              {showPlayingXI && (
                <Animated.View entering={FadeInDown.springify()}>
                  <Card padding="$4" marginBottom="$3" marginTop={-8}>
                    {playingXIQuery.isLoading ? (
                      <EggLoadingSpinner size={24} message={formatUIText("predicting lineup")} />
                    ) : playingXIQuery.data ? (
                      <YStack gap="$3">
                        {[(playingXIQuery.data as any).teamA, (playingXIQuery.data as any).teamB].map((team: any) => team && (
                          <YStack key={team.teamName} gap="$1">
                            <Text fontFamily="$mono" fontSize={11} fontWeight="700" color="$accentBackground" letterSpacing={0.5}>
                              {formatBadgeText(team.teamName)}
                            </Text>
                            {(team.predictedXI ?? []).map((p: any, i: number) => (
                              <XStack key={i} alignItems="center" gap="$2" paddingVertical={2}>
                                <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={16}>{i + 1}.</Text>
                                <Text fontFamily="$body" fontSize={12} color="$color" flex={1}>{p.name}</Text>
                                <Badge variant="default" size="sm">{formatBadgeText(p.role)}</Badge>
                                <Text fontFamily="$mono" fontSize={10} color={p.confidence >= 80 ? "$colorCricket" : "$colorMuted"}>{p.confidence}%</Text>
                              </XStack>
                            ))}
                          </YStack>
                        ))}
                        {((playingXIQuery.data as any).keyChanges ?? []).length > 0 && (
                          <YStack marginTop="$1">
                            <Text fontFamily="$mono" fontSize={9} color="$colorMuted" letterSpacing={0.5}>{formatBadgeText("key changes")}</Text>
                            {(playingXIQuery.data as any).keyChanges.map((c: string, i: number) => (
                              <Text key={i} fontFamily="$body" fontSize={11} color="$colorSecondary">• {c}</Text>
                            ))}
                          </YStack>
                        )}
                      </YStack>
                    ) : (
                      <Text {...textStyles.hint} textAlign="center">{formatUIText("no prediction available")}</Text>
                    )}
                  </Card>
                </Animated.View>
              )}

              {/* Weather & Pitch — free by default, admin-togglable */}
              {canAccess("hasPitchWeather") && (<>
              <Card pressable padding="$4" marginBottom="$3" onPress={() => setShowPitchWeather(!showPitchWeather)}>
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={20}>🌤️</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("weather & pitch report")}
                    </Text>
                    <Text {...textStyles.hint} marginTop={2}>
                      {formatUIText("conditions that affect your picks")}
                    </Text>
                  </YStack>
                  <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showPitchWeather ? "▲" : "▼"}</Text>
                </XStack>
              </Card>
              {showPitchWeather && (
                <Animated.View entering={FadeInDown.springify()}>
                  <Card padding="$4" marginBottom="$3" marginTop={-8}>
                    {pitchWeatherQuery.isLoading ? (
                      <EggLoadingSpinner size={24} message={formatUIText("checking conditions")} />
                    ) : pitchWeatherQuery.data ? (
                      <YStack gap="$3">
                        <XStack gap="$3">
                          <YStack flex={1} gap="$1">
                            <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>{formatBadgeText("pitch")}</Text>
                            <Text fontFamily="$body" fontWeight="700" fontSize={13} color="$color">{(pitchWeatherQuery.data as any).pitch?.pitchType}</Text>
                            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                              Avg 1st: {(pitchWeatherQuery.data as any).pitch?.avgFirstInningsScore} | 2nd: {(pitchWeatherQuery.data as any).pitch?.avgSecondInningsScore}
                            </Text>
                            <Badge variant="default" size="sm">{(pitchWeatherQuery.data as any).pitch?.paceVsSpinAdvantage}</Badge>
                          </YStack>
                          <YStack flex={1} gap="$1">
                            <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>{formatBadgeText("weather")}</Text>
                            <Text fontFamily="$body" fontWeight="700" fontSize={13} color="$color">{(pitchWeatherQuery.data as any).weather?.conditions}</Text>
                            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                              {(pitchWeatherQuery.data as any).weather?.temperature} · {(pitchWeatherQuery.data as any).weather?.humidity}
                            </Text>
                            {(pitchWeatherQuery.data as any).weather?.dewFactor && (
                              <Text fontFamily="$mono" fontSize={10} color="$colorAccent">{(pitchWeatherQuery.data as any).weather.dewFactor}</Text>
                            )}
                          </YStack>
                        </XStack>
                        {((pitchWeatherQuery.data as any).fantasyTips ?? []).length > 0 && (
                          <YStack marginTop="$1">
                            <Text fontFamily="$mono" fontSize={9} color="$colorMuted" letterSpacing={0.5}>{formatBadgeText("fantasy tips")}</Text>
                            {(pitchWeatherQuery.data as any).fantasyTips.map((tip: string, i: number) => (
                              <Text key={i} fontFamily="$body" fontSize={11} color="$colorSecondary">💡 {tip}</Text>
                            ))}
                          </YStack>
                        )}
                      </YStack>
                    ) : (
                      <Text {...textStyles.hint} textAlign="center">{formatUIText("no data available")}</Text>
                    )}
                  </Card>
                </Animated.View>
              )}
              </>)}
            </Animated.View>
          </>
        )}

        {/* ── Stats & Analytics ── */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <XStack alignItems="center" gap="$2" marginBottom="$3" marginTop="$2">
            <Text fontSize={14}>📊</Text>
            <Text {...textStyles.sectionHeader}>{formatUIText("stats & analytics")}</Text>
          </XStack>

          {/* Player Stats Table — Free (basic) / Pro (advanced), admin-togglable */}
          {canAccess("hasPlayerStats") && (<>
          <Card pressable padding="$4" marginBottom="$3" onPress={() => setShowPlayerStats(!showPlayerStats)}>
            <XStack alignItems="center" gap="$3">
              <Text fontSize={20}>📋</Text>
              <YStack flex={1}>
                <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                  {formatUIText("player stats")}
                </Text>
                <Text {...textStyles.hint} marginTop={2}>
                  {formatUIText("sortable leaderboard for all players")}
                </Text>
              </YStack>
              <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showPlayerStats ? "▲" : "▼"}</Text>
            </XStack>
          </Card>
          {showPlayerStats && (
            <Animated.View entering={FadeInDown.springify()}>
              <Card padding="$4" marginBottom="$3" marginTop={-8}>
                {playerStatsQuery.isLoading ? (
                  <EggLoadingSpinner size={24} message={formatUIText("loading stats")} />
                ) : playerStatsQuery.data && playerStatsQuery.data.length > 0 ? (
                  <YStack gap="$2">
                    {/* Sort buttons */}
                    <XStack gap="$2" flexWrap="wrap" marginBottom="$2">
                      {[
                        { key: "avgFantasyPoints", label: "FPts" },
                        { key: "totalRuns", label: "Runs" },
                        { key: "totalWickets", label: "Wkts" },
                        { key: "strikeRate", label: "SR" },
                        { key: "formAvg", label: "Form" },
                      ].map((opt) => (
                        <Badge
                          key={opt.key}
                          variant={statsSortBy === opt.key ? "live" : "default"}
                          size="sm"
                          pressable
                          onPress={() => setStatsSortBy(opt.key)}
                        >
                          {formatBadgeText(opt.label)}
                        </Badge>
                      ))}
                    </XStack>
                    {/* Player rows */}
                    {playerStatsQuery.data.slice(0, 10).map((p: any, i: number) => (
                      <XStack key={p.playerId || i} alignItems="center" paddingVertical="$1" borderBottomWidth={1} borderBottomColor="$borderColor">
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={20}>{i + 1}</Text>
                        <InitialsAvatar name={p.playerName} playerRole={p.role?.toUpperCase()} ovr={0} size={24} />
                        <YStack flex={1} marginLeft="$2">
                          <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{p.playerName}</Text>
                          <XStack gap="$2">
                            <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{p.team}</Text>
                            <Badge variant="default" size="sm">{formatBadgeText(p.role)}</Badge>
                          </XStack>
                        </YStack>
                        <YStack alignItems="flex-end" minWidth={60}>
                          <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$accentBackground">
                            {statsSortBy === "totalRuns" ? p.totalRuns
                              : statsSortBy === "totalWickets" ? p.totalWickets
                              : statsSortBy === "strikeRate" ? (p.strikeRate ?? "—")
                              : statsSortBy === "formAvg" ? (p.formAvg ?? "—")
                              : p.avgFantasyPoints}
                          </Text>
                          <Text fontFamily="$mono" fontSize={8} color="$colorMuted">
                            {p.matches} {formatUIText("matches")}
                          </Text>
                        </YStack>
                      </XStack>
                    ))}
                  </YStack>
                ) : (
                  <Text {...textStyles.hint} textAlign="center">{formatUIText("no player data available")}</Text>
                )}
              </Card>
            </Animated.View>
          )}
          </>)}

          {/* Player Comparison — Pro */}
          <Card pressable padding="$4" marginBottom="$3" onPress={() => {
            if (gateFeature("hasPlayerCompare", "pro", "Compare Players", "Side-by-side player comparison tool")) return;
            setMatchContext({ matchId, teamA, teamB, format, venue: venue || undefined, tournament: tournament || undefined });
            router.push(`/match/${encodeURIComponent(matchId)}/compare`);
          }}>
            <XStack alignItems="center" gap="$3">
              <Text fontSize={20}>⚖️</Text>
              <YStack flex={1}>
                <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                  {formatUIText("compare players")}
                </Text>
                <Text {...textStyles.hint} marginTop={2}>
                  {formatUIText("side-by-side player comparison")}
                </Text>
              </YStack>
              {!canAccess("hasPlayerCompare") ? (
                <TierBadge tier="pro" />
              ) : (
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted">→</Text>
              )}
            </XStack>
          </Card>

          {/* Team Solver — Elite */}
          <Card pressable padding="$4" marginBottom="$3" onPress={() => {
            if (gateFeature("hasTeamSolver", "elite", "Team Solver", "Auto-pick the optimal 11 within your budget")) return;
            setMatchContext({ matchId, teamA, teamB, format, venue: venue || undefined, tournament: tournament || undefined });
            router.push(`/match/${encodeURIComponent(matchId)}/solver`);
          }}>
            <XStack alignItems="center" gap="$3">
              <Text fontSize={20}>🤖</Text>
              <YStack flex={1}>
                <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                  {formatUIText("team solver")}
                </Text>
                <Text {...textStyles.hint} marginTop={2}>
                  {formatUIText("auto-pick optimal 11 within budget")}
                </Text>
              </YStack>
              {!canAccess("hasTeamSolver") ? (
                <TierBadge tier="elite" />
              ) : (
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted">→</Text>
              )}
            </XStack>
          </Card>

          {/* Points Breakdown — Free (completed matches only), admin-togglable */}
          {isCompleted && canAccess("hasPointsBreakdown") && (
            <>
              <Card pressable padding="$4" marginBottom="$3" onPress={() => setShowPointsBreakdown(!showPointsBreakdown)}>
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={20}>🎯</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("points breakdown")}
                    </Text>
                    <Text {...textStyles.hint} marginTop={2}>
                      {formatUIText("see how each player earned their points")}
                    </Text>
                  </YStack>
                  <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showPointsBreakdown ? "▲" : "▼"}</Text>
                </XStack>
              </Card>
              {showPointsBreakdown && (
                <Animated.View entering={FadeInDown.springify()}>
                  <Card padding="$4" marginBottom="$3" marginTop={-8}>
                    {pointsBreakdownQuery.isLoading ? (
                      <EggLoadingSpinner size={24} message={formatUIText("calculating breakdown")} />
                    ) : pointsBreakdownQuery.data && pointsBreakdownQuery.data.length > 0 ? (
                      <YStack gap="$3">
                        {pointsBreakdownQuery.data.slice(0, 8).map((p: any, i: number) => (
                          <YStack key={p.playerId || i} paddingBottom="$2" borderBottomWidth={1} borderBottomColor="$borderColor">
                            <XStack alignItems="center" gap="$2" marginBottom="$1">
                              <InitialsAvatar name={p.playerName} playerRole={p.role?.toUpperCase()} ovr={0} size={24} />
                              <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" flex={1} numberOfLines={1}>{p.playerName}</Text>
                              <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$accentBackground">{p.totalFantasyPoints}</Text>
                            </XStack>
                            <XStack flexWrap="wrap" gap="$1" paddingLeft={32}>
                              {(p.categories ?? []).map((c: any, ci: number) => (
                                <Badge key={ci} variant={c.points > 0 ? "role" : "default"} size="sm">
                                  {`${c.label}: ${c.stat} (${c.points > 0 ? "+" : ""}${c.points})`}
                                </Badge>
                              ))}
                            </XStack>
                          </YStack>
                        ))}
                      </YStack>
                    ) : (
                      <Text {...textStyles.hint} textAlign="center">{formatUIText("no scoring data available")}</Text>
                    )}
                  </Card>
                </Animated.View>
              )}
            </>
          )}

          {/* Value Tracker — Pro */}
          <Card pressable padding="$4" marginBottom="$3" onPress={() => {
            if (gateFeature("hasValueTracker", "pro", "Value Tracker", "Track player ownership & credit changes")) return;
            setShowValueTracker(!showValueTracker);
          }}>
            <XStack alignItems="center" gap="$3">
              <Text fontSize={20}>📈</Text>
              <YStack flex={1}>
                <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                  {formatUIText("value tracker")}
                </Text>
                <Text {...textStyles.hint} marginTop={2}>
                  {formatUIText("ownership & credit changes")}
                </Text>
              </YStack>
              {!canAccess("hasValueTracker") ? (
                <TierBadge tier="pro" />
              ) : (
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showValueTracker ? "▲" : "▼"}</Text>
              )}
            </XStack>
          </Card>
          {showValueTracker && (
            <Animated.View entering={FadeInDown.springify()}>
              <Card padding="$4" marginBottom="$3" marginTop={-8}>
                {valueTrackerQuery.isLoading ? (
                  <EggLoadingSpinner size={24} message={formatUIText("loading values")} />
                ) : valueTrackerQuery.data && valueTrackerQuery.data.length > 0 ? (
                  <YStack gap="$2">
                    {/* Header row */}
                    <XStack paddingBottom="$1" borderBottomWidth={1} borderBottomColor="$borderColor">
                      <Text fontFamily="$mono" fontSize={9} fontWeight="600" color="$colorMuted" flex={1}>{formatBadgeText("player")}</Text>
                      <Text fontFamily="$mono" fontSize={9} fontWeight="600" color="$colorMuted" width={45} textAlign="right">{formatBadgeText("price")}</Text>
                      <Text fontFamily="$mono" fontSize={9} fontWeight="600" color="$colorMuted" width={45} textAlign="right">{formatBadgeText("own%")}</Text>
                      <Text fontFamily="$mono" fontSize={9} fontWeight="600" color="$colorMuted" width={40} textAlign="right">{formatBadgeText("trend")}</Text>
                    </XStack>
                    {valueTrackerQuery.data.slice(0, 12).map((p: any, i: number) => (
                      <XStack key={p.playerId || i} alignItems="center" paddingVertical={2}>
                        <YStack flex={1}>
                          <Text fontFamily="$body" fontSize={11} color="$color" numberOfLines={1}>{p.playerName}</Text>
                        </YStack>
                        <Text fontFamily="$mono" fontSize={11} color="$color" width={45} textAlign="right">{p.currentPrice}</Text>
                        <Text fontFamily="$mono" fontSize={11} color="$colorMuted" width={45} textAlign="right">{p.ownershipPct.toFixed(1)}%</Text>
                        <Text fontFamily="$mono" fontSize={11} width={40} textAlign="right"
                          color={p.trend === "rising" ? "$colorSuccess" : p.trend === "falling" ? "$colorDanger" : "$colorMuted"}
                        >
                          {p.trend === "rising" ? "▲" : p.trend === "falling" ? "▼" : "—"}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                ) : (
                  <Text {...textStyles.hint} textAlign="center">{formatUIText("no ownership data yet")}</Text>
                )}
              </Card>
            </Animated.View>
          )}

          {/* Stat Top Fives — Free, admin-togglable */}
          {tournament && canAccess("hasStatTopFives") && (
            <>
              <Card pressable padding="$4" marginBottom="$3" onPress={() => setShowStatTopFives(!showStatTopFives)}>
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={20}>🏅</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("stat top fives")}
                    </Text>
                    <Text {...textStyles.hint} marginTop={2}>
                      {formatUIText("tournament leaders in every category")}
                    </Text>
                  </YStack>
                  <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showStatTopFives ? "▲" : "▼"}</Text>
                </XStack>
              </Card>
              {showStatTopFives && (
                <Animated.View entering={FadeInDown.springify()}>
                  <Card padding="$4" marginBottom="$3" marginTop={-8}>
                    {statTopFivesQuery.isLoading ? (
                      <EggLoadingSpinner size={24} message={formatUIText("loading leaderboards")} />
                    ) : statTopFivesQuery.data ? (
                      <YStack gap="$4">
                        {([
                          { key: "topRunScorers", label: "Top Run Scorers", unit: "runs" },
                          { key: "topWicketTakers", label: "Top Wicket Takers", unit: "wkts" },
                          { key: "topFantasyScorers", label: "Top Fantasy Scorers", unit: "pts" },
                          { key: "topSixHitters", label: "Most Sixes", unit: "6s" },
                          { key: "topCatchers", label: "Most Catches", unit: "catches" },
                          { key: "mostConsistent", label: "Most Consistent", unit: "avg pts" },
                        ] as const).map(({ key, label, unit }) => {
                          const entries = (statTopFivesQuery.data as any)?.[key] ?? [];
                          if (entries.length === 0) return null;
                          return (
                            <YStack key={key}>
                              <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5} marginBottom="$1">
                                {formatBadgeText(label)}
                              </Text>
                              {entries.map((e: any, i: number) => (
                                <XStack key={e.playerId || i} alignItems="center" paddingVertical={2} gap="$2">
                                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={16}>{i + 1}.</Text>
                                  <Text fontFamily="$body" fontSize={11} color="$color" flex={1} numberOfLines={1}>{e.playerName}</Text>
                                  <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$accentBackground">{e.value}</Text>
                                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{unit}</Text>
                                </XStack>
                              ))}
                            </YStack>
                          );
                        })}
                      </YStack>
                    ) : (
                      <Text {...textStyles.hint} textAlign="center">{formatUIText("no tournament data available")}</Text>
                    )}
                  </Card>
                </Animated.View>
              )}
            </>
          )}
        </Animated.View>

        {/* ── Tournament link (subtle footer) ── */}
        {tournament && (
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <Card
              pressable
              onPress={() => router.push(`/tournament/${encodeURIComponent(tournament)}`)}
              padding="$3"
              marginTop="$2"
            >
              <XStack justifyContent="space-between" alignItems="center">
                <XStack alignItems="center" gap="$2">
                  <Text fontSize={14}>🏆</Text>
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                    {tournament}
                  </Text>
                </XStack>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {formatUIText("standings →")}
                </Text>
              </XStack>
            </Card>
          </Animated.View>
        )}
      </RNScrollView>
      <Paywall {...paywallProps} />
    </YStack>
  );
}
