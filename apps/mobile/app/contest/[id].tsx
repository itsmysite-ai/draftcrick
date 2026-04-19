import { SafeBackButton } from "../../components/SafeBackButton";
import { Fireworks } from "../../components/Fireworks";
import { ScrollView, RefreshControl, Share as RNShare, Clipboard } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback, useEffect, useRef } from "react";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, withDelay } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  BackButton,
  InitialsAvatar,
  StatLabel,
  AnnouncementBanner,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
  DraftPlayLogo,
  ScoringRulesCard,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useNavigationStore } from "../../lib/navigation-store";

import { useAuth } from "../../providers/AuthProvider";
import { HeaderControls } from "../../components/HeaderControls";
import { LivePredictionFeed } from "../../components/LivePredictionFeed";

// ── Countdown helper ─────────────────────────────────────────────
function formatCountdownFull(targetDate: string | Date): string {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate;
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return "starting now";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ── Confetti Particle ────────────────────────────────────────────
function ConfettiParticle({ delay, color, startX }: { delay: number; color: string; startX: number }) {
  const y = useSharedValue(-20);
  const x = useSharedValue(startX);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(delay, withTiming(400, { duration: 2000, easing: Easing.out(Easing.quad) }));
    x.value = withDelay(delay, withTiming(startX + (Math.random() - 0.5) * 100, { duration: 2000 }));
    opacity.value = withDelay(delay + 1200, withTiming(0, { duration: 800 }));
    rotate.value = withDelay(delay, withRepeat(withTiming(360, { duration: 1000 }), 3, false));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute" as const,
    top: y.value,
    left: x.value,
    opacity: opacity.value,
    transform: [{ rotate: `${rotate.value}deg` }],
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: color,
  }));

  return <Animated.View style={style} />;
}

const CONFETTI_COLORS = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98FB98"];

export default function ContestDetailScreen() {
  const { id, section } = useLocalSearchParams<{ id: string; section?: string }>();
  const router = useRouter();
  const theme = useTamaguiTheme();

  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [countdown, setCountdown] = useState("");
  const celebrationShown = useRef(false);

  const contest = trpc.contest.getById.useQuery({ id: id! }, { enabled: !!id, refetchInterval: 30_000 });
  const c = contest.data as any;
  const contestLeagueId = c?.leagueId;
  const leagueQuery = trpc.league.getById.useQuery({ id: contestLeagueId! }, { enabled: !!contestLeagueId, staleTime: Infinity });
  const isAuctionLeague = (leagueQuery.data as any)?.format === "auction" || (leagueQuery.data as any)?.format === "draft";
  const teamBuilderRoute = isAuctionLeague ? "/team/pick-xi" : "/team/create";
  const isLiveMatch = c?.status === "live" || c?.match?.status === "live";
  const standings = trpc.contest.getStandings.useQuery({ contestId: id! }, { enabled: !!id, refetchInterval: isLiveMatch ? 5_000 : undefined });
  const myContests = trpc.contest.myContests.useQuery(undefined, { retry: false });
  const myPosition = trpc.contest.myPosition.useQuery({ contestId: id! }, { enabled: !!id && !!user, refetchInterval: isLiveMatch ? 5_000 : undefined });
  const myTeam = trpc.team.getByContest.useQuery({ contestId: id! }, { enabled: !!id && !!user, refetchInterval: isLiveMatch ? 5_000 : undefined });
  const myAllTeams = trpc.team.myTeams.useQuery(undefined, { enabled: !!user, retry: false });
  const swapMutation = trpc.team.swapTeam.useMutation({
    onSuccess: () => {
      contest.refetch(); myTeam.refetch(); myContests.refetch(); myAllTeams.refetch(); standings.refetch();
      setShowSwap(false);
    },
  });
  const [showSwap, setShowSwap] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "predictions">(section === "predictions" ? "predictions" : "overview");

  // Fetch expanded team's player details on demand
  const expandedTeamQuery = trpc.team.getTeamDetails.useQuery(
    { teamId: expandedTeamId! },
    { enabled: !!expandedTeamId, staleTime: 10_000 },
  );

  // Track if user just arrived from team creation
  const [justJoined, setJustJoined] = useState(false);
  const justJoinedChecked = useRef(false);
  useEffect(() => {
    if (justJoinedChecked.current) return;
    if (!contest.data || myContests.isLoading || myPosition.isLoading || myTeam.isLoading) return;
    justJoinedChecked.current = true;
    // Detect "just joined" by checking sessionStorage flag set by team builder
    try {
      const flag = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("draftplay_just_joined") : null;
      if (flag === id) {
        setJustJoined(true);
        sessionStorage.removeItem("draftplay_just_joined");
        // Force refetch all data so the team shows immediately
        contest.refetch();
        myTeam.refetch();
        myContests.refetch();
        myPosition.refetch();
        standings.refetch();
      }
    } catch {}
  }, [contest.data, myContests.isLoading, myPosition.isLoading, myTeam.isLoading, id]);

  // Score flash animation when prediction points update
  const scoreFlash = useSharedValue(1);
  const scoreFlashStyle = useAnimatedStyle(() => ({
    opacity: scoreFlash.value,
    transform: [{ scale: scoreFlash.value < 1 ? 1.08 : 1 }],
  }));
  const prevPointsRef = useRef<number | null>(null);

  const handlePredictionScoreUpdate = useCallback(() => {
    // Refetch all score-related data
    standings.refetch();
    myPosition.refetch();
    myTeam.refetch();
    myContests.refetch();
    // Trigger flash animation
    scoreFlash.value = withSequence(
      withTiming(0.3, { duration: 150 }),
      withTiming(1.2, { duration: 200 }),
      withTiming(0.5, { duration: 150 }),
      withTiming(1, { duration: 200 }),
    );
  }, [standings, myPosition, myTeam, myContests, scoreFlash]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([contest.refetch(), standings.refetch(), myContests.refetch(), myPosition.refetch(), myTeam.refetch(), myAllTeams.refetch()]);
    setRefreshing(false);
  }, [contest, standings, myContests, myPosition, myTeam, myAllTeams]);

  const match = c?.match;

  // Other teams for this match the user can swap to
  const swappableTeams = (myAllTeams.data ?? []).filter(
    (t: any) => t.matchId === match?.id && t.contestId !== id
  );

  // Countdown timer for pre-match (#3)
  useEffect(() => {
    if (!match?.startTime || c?.status !== "open") return;
    const update = () => setCountdown(formatCountdownFull(match.startTime));
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [match?.startTime, c?.status]);

  // Post-settlement celebration trigger (#7)
  const isSettled = c?.status === "settled";
  const prizeWon = (() => {
    if (!isSettled || !myPosition?.data) return 0;
    const dist = c?.prizeDistribution as Array<{ rank: number; amount: number }> | null;
    if (!dist || !Array.isArray(dist)) return 0;
    const entry = dist.find((p) => p.rank === myPosition.data!.rank);
    return entry?.amount ?? 0;
  })();

  useEffect(() => {
    if (isSettled && prizeWon > 0 && !celebrationShown.current) {
      celebrationShown.current = true;
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 8000);
    }
  }, [isSettled, prizeWon]);

  // Wait for all essential data before rendering — prevents flash of incomplete UI
  const essentialLoading = contest.isLoading || (!!user && (myContests.isLoading || myPosition.isLoading || myTeam.isLoading));
  if (essentialLoading) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <EggLoadingSpinner size={48} message={formatUIText("loading contest")} />
    </YStack>
  );
  if (!c) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
      <Text {...textStyles.hint}>{formatUIText("contest not found")}</Text>
    </YStack>
  );

  const isOpen = c.status === "open";
  const isLive = c.status === "live";
  const isSettling = c.status === "settling";
  const standingsData = standings.data ?? [];
  const hasJoined = (myContests.data ?? []).some((mc: any) => mc.contestId === id || mc.contest?.id === id)
    || (standingsData.length > 0 && standingsData.some((s: any) => s.userId === (user as any)?.id));
  const currentUserId = (user as any)?.id ?? null;
  const isH2H = c.maxEntries === 2 || c.contestType === "h2h";

  // Score breakdown data (#2)
  const teamPlayers = myTeam.data?.playerDetails ?? [];
  const captain = teamPlayers.find((p: any) => p.isCaptain);
  const viceCaptain = teamPlayers.find((p: any) => p.isViceCaptain);
  const basePoints = teamPlayers.reduce((sum: number, p: any) => sum + (p.fantasyPoints ?? 0), 0);
  const captainBonus = captain ? (captain.fantasyPoints ?? 0) : 0; // extra 1x
  const vcBonus = viceCaptain ? (viceCaptain.fantasyPoints ?? 0) * 0.5 : 0; // extra 0.5x
  const hasScores = (isLive || isSettled) && basePoints > 0;

  /** Build structured points breakdown for a player (receipt-style) */
  interface BreakdownRow { label: string; pts: number | null; isHeader?: boolean; isDivider?: boolean; isBold?: boolean }
  const buildBreakdown = (p: any): BreakdownRow[] => {
    const rows: BreakdownRow[] = [];
    const runs = p.runs ?? 0;
    const ballsFaced = p.ballsFaced ?? 0;
    const fours = p.fours ?? 0;
    const sixes = p.sixes ?? 0;
    const wickets = p.wickets ?? 0;
    const overs = p.oversBowled ?? 0;
    const conceded = p.runsConceded ?? 0;
    const maidens = p.maidens ?? 0;
    const catches = p.catches ?? 0;
    const stumpings = p.stumpings ?? 0;
    const runOuts = p.runOuts ?? 0;

    // Batting
    if (runs > 0 || ballsFaced > 0) {
      rows.push({ label: "batting", pts: null, isHeader: true });
      rows.push({ label: `${runs} runs`, pts: runs });
      if (fours > 0) rows.push({ label: `${fours} fours (boundary bonus)`, pts: fours });
      if (sixes > 0) rows.push({ label: `${sixes} sixes (six bonus)`, pts: sixes * 2 });
      if (runs >= 100) rows.push({ label: "century milestone", pts: 50 });
      else if (runs >= 50) rows.push({ label: "half-century milestone", pts: 20 });
      if (runs === 0 && ballsFaced > 0) rows.push({ label: "duck penalty", pts: -5 });
      if (ballsFaced >= 10) {
        const sr = (runs / ballsFaced) * 100;
        if (sr >= 200) rows.push({ label: `SR ${sr.toFixed(1)} bonus`, pts: 10 });
        else if (sr >= 175) rows.push({ label: `SR ${sr.toFixed(1)} bonus`, pts: 6 });
        else if (sr >= 150) rows.push({ label: `SR ${sr.toFixed(1)} bonus`, pts: 4 });
        else rows.push({ label: `SR ${sr.toFixed(1)}`, pts: null });
      }
    }

    // Bowling
    if (wickets > 0 || overs > 0) {
      rows.push({ label: "bowling", pts: null, isHeader: true });
      if (wickets > 0) rows.push({ label: `${wickets} wicket${wickets > 1 ? "s" : ""}`, pts: wickets * 25 });
      if (maidens > 0) rows.push({ label: `${maidens} maiden${maidens > 1 ? "s" : ""}`, pts: maidens * 15 });
      if (wickets >= 5) rows.push({ label: "5-wicket haul bonus", pts: 30 });
      else if (wickets >= 3) rows.push({ label: "3-wicket haul bonus", pts: 15 });
      if (overs >= 2) {
        const er = conceded / overs;
        if (er <= 4) rows.push({ label: `ER ${er.toFixed(1)} bonus`, pts: 10 });
        else if (er <= 5) rows.push({ label: `ER ${er.toFixed(1)} bonus`, pts: 6 });
        else if (er <= 6) rows.push({ label: `ER ${er.toFixed(1)} bonus`, pts: 4 });
        else rows.push({ label: `${overs} ov, ${conceded} conc, ER ${er.toFixed(1)}`, pts: null });
      } else if (overs > 0) {
        const er = conceded / overs;
        rows.push({ label: `${overs} ov, ${conceded} conc, ER ${er.toFixed(1)}`, pts: null });
      }
    }

    // Fielding
    if (catches > 0 || stumpings > 0 || runOuts > 0) {
      rows.push({ label: "fielding", pts: null, isHeader: true });
      if (catches > 0) rows.push({ label: `${catches} catch${catches > 1 ? "es" : ""}`, pts: catches * 10 });
      if (stumpings > 0) rows.push({ label: `${stumpings} stumping${stumpings > 1 ? "s" : ""}`, pts: stumpings * 15 });
      if (runOuts > 0) rows.push({ label: `${runOuts} run out${runOuts > 1 ? "s" : ""}`, pts: runOuts * 15 });
    }

    // Totals
    const basePts = p.fantasyPoints ?? 0;
    const multiplierVal = p.isCaptain ? 2 : p.isViceCaptain ? 1.5 : 1;
    rows.push({ label: "", pts: null, isDivider: true });
    rows.push({ label: "base total", pts: basePts, isBold: true });
    if (multiplierVal > 1) {
      const label = p.isCaptain ? "captain (2x)" : "vice-captain (1.5x)";
      rows.push({ label, pts: basePts * (multiplierVal - 1), isBold: false });
      rows.push({ label: "total", pts: basePts * multiplierVal, isBold: true });
    }

    return rows;
  };

  const shareResult = () => {
    const text = `I finished #${myPosition.data?.rank} in "${c.name}" on DraftPlay${prizeWon > 0 ? ` and won ${prizeWon} PC!` : "!"}`;
    try {
      RNShare.share({ message: text });
    } catch {
      // Clipboard fallback
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Fireworks celebration overlay — outside ScrollView for full-screen coverage */}
      {isSettled && (prizeWon > 0 || myPosition?.data?.rank === 1) && <Fireworks />}

    <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />} testID="contest-detail-screen">
      {/* Header */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <SafeBackButton />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("contest")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      {/* Contest Header */}
      <YStack padding="$5">
        <XStack justifyContent="space-between" alignItems="flex-start" marginBottom="$1" gap="$2">
          <Text testID="contest-name" fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5} flex={1} numberOfLines={2} ellipsizeMode="tail">
            {c.name}
          </Text>
          <Badge testID="contest-status-badge" variant={isLive ? "live" : "role"} size="sm">
            {formatBadgeText(c.status ?? "open")}
          </Badge>
        </XStack>
        {/* Tappable match link — navigate to match center */}
        {match && (
          <YStack gap="$1">
            <XStack justifyContent="space-between" alignItems="center">
              <XStack
                alignItems="center"
                gap="$2"
                onPress={() => router.push(`/match/${match.externalId ?? match.id}`)}
                cursor="pointer"
                flex={1}
              >
                <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$accentBackground">
                  {formatTeamName(match.teamHome)} {formatUIText("vs")} {formatTeamName(match.teamAway)}
                </Text>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">→</Text>
              </XStack>
            </XStack>
            <Text fontFamily="$mono" fontSize={11} fontWeight="500" color="$colorMuted">
              {match.tournament ?? formatUIText("cricket")}
            </Text>
            {/* Live score summary */}
            {(isLive || isSettled || isSettling) && match.scoreSummary ? (
              <XStack
                marginTop="$2"
                padding="$3"
                backgroundColor="$backgroundSurface"
                borderRadius="$3"
                borderLeftWidth={3}
                borderLeftColor="$accentBackground"
                onPress={() => router.push(`/match/${match.externalId ?? match.id}`)}
                cursor="pointer"
              >
                <Text fontFamily="$mono" fontWeight="600" fontSize={12} color="$color" flex={1}>
                  {match.scoreSummary}
                </Text>
              </XStack>
            ) : null}
            {match.result && (
              <Text fontFamily="$body" fontWeight="700" fontSize={11} color="$accentBackground" marginTop="$1">
                {match.result}
              </Text>
            )}
            {match.tossWinner && (
              <XStack alignItems="center" gap={8} marginTop={4} alignSelf="flex-start">
                <Text fontFamily="$mono" fontSize={9} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                  toss
                </Text>
                <YStack width={3} height={3} borderRadius={1.5} backgroundColor="$colorMuted" opacity={0.5} />
                <Text fontFamily="$body" fontSize={11} fontWeight="600" color="$color">
                  {match.tossWinner}
                </Text>
                <Text fontFamily="$mono" fontSize={10} fontWeight="500" color="$colorAccent">
                  elected to {match.tossDecision}
                </Text>
              </XStack>
            )}
          </YStack>
        )}
      </YStack>

      {/* Pre-Match Countdown (#3) — only show when match is truly upcoming */}
      {isOpen && match?.status !== "completed" && match?.status !== "live" && match?.startTime && countdown && (
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <Card marginHorizontal="$4" marginBottom="$4" padding="$4" borderColor="$colorAccentLight" borderWidth={1}>
            <XStack justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                  {formatBadgeText("match starts in")}
                </Text>
                <Text fontFamily="$mono" fontWeight="800" fontSize={24} color="$accentBackground" marginTop={2}>
                  {countdown}
                </Text>
              </YStack>
              {hasJoined && (
                <Badge variant="role" size="sm">{formatBadgeText("joined")}</Badge>
              )}
            </XStack>
          </Card>
        </Animated.View>
      )}

      {/* Playing XI Announced Banner — shown when confirmed XI available and contest still open */}
      {isOpen && hasJoined && match?.playingXiHome && (match.playingXiHome as any[]).length > 0 && (() => {
        const confirmedNames = new Set([
          ...((match.playingXiHome as any[]) ?? []).map((p: any) => p.name?.toLowerCase()),
          ...((match.playingXiAway as any[]) ?? []).map((p: any) => p.name?.toLowerCase()),
        ]);
        const benchInTeam = teamPlayers.filter((p: any) => {
          const name = p.name?.toLowerCase();
          return name && !confirmedNames.has(name);
        });
        const hasBenchRisk = benchInTeam.length > 0;
        return (
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <Card
              marginHorizontal="$4"
              marginBottom="$4"
              padding="$4"
              borderColor={hasBenchRisk ? "$error" : "$accentBackground"}
              borderWidth={2}
            >
              <XStack alignItems="center" gap="$2" marginBottom={hasBenchRisk ? 8 : 0}>
                <Text fontSize={16}>{hasBenchRisk ? "⚠️" : "✅"}</Text>
                <YStack flex={1}>
                  <Text fontFamily="$mono" fontWeight="700" fontSize={13} color={hasBenchRisk ? "$error" : "$accentBackground"}>
                    {formatUIText("playing xi announced")}
                  </Text>
                  {hasBenchRisk ? (
                    <Text fontFamily="$body" fontSize={12} color="$color">
                      {formatUIText(`${benchInTeam.length} of your players ${benchInTeam.length === 1 ? "is" : "are"} on the bench — edit your team!`)}
                    </Text>
                  ) : (
                    <Text fontFamily="$body" fontSize={12} color="$colorMuted">
                      {formatUIText("all your players are in the playing xi")}
                    </Text>
                  )}
                </YStack>
              </XStack>
              {hasBenchRisk && (
                <YStack gap="$1" marginBottom="$2">
                  {benchInTeam.map((p: any) => (
                    <XStack key={p.playerId || p.name} alignItems="center" gap="$2">
                      <Badge variant="warning" size="sm">{formatBadgeText("bench")}</Badge>
                      <Text fontFamily="$body" fontSize={12} color="$color">{p.name}</Text>
                    </XStack>
                  ))}
                </YStack>
              )}
              {hasBenchRisk && (
                <Button variant="primary" size="md" onPress={() => {
                  if (match) {
                    useNavigationStore.getState().setMatchContext({ matchId: match.id, contestId: c.id, teamA: match.teamHome, teamB: match.teamAway, format: match.format, venue: match.venue, tournament: match.tournament, editTeamId: myTeam.data?.id });
                    router.push(teamBuilderRoute as any);
                  }
                }}>
                  {formatUIText("edit team now")}
                </Button>
              )}
            </Card>
          </Animated.View>
        );
      })()}

      {/* Just Joined Success Banner */}
      {justJoined && hasJoined && (
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <Card marginHorizontal="$4" marginBottom="$4" padding="$5" borderColor="$accentBackground" borderWidth={2} alignItems="center">
            <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$accentBackground" marginBottom="$1">
              {formatUIText("you're in!")}
            </Text>
            <Text fontFamily="$body" fontSize={13} color="$color" textAlign="center" marginBottom="$2">
              {formatUIText(`your team has been entered into "${c.name}"`)}
            </Text>
            {myTeam.data && (
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginBottom="$3">
                team: {myTeam.data.name}
              </Text>
            )}

            <YStack gap="$2" width="100%">
              {/* H2H: share challenge link */}
              {isH2H && c.currentEntries < c.maxEntries && (
                <Button variant="primary" size="md" onPress={() => {
                  const link = `https://app.draftplay.ai/contest/${c.id}`;
                  RNShare.share({ message: `I challenged you to a Head-to-Head fantasy duel on DraftPlay! Join here: ${link}` });
                }} testID="success-share-btn">
                  {formatUIText("share challenge with friend")}
                </Button>
              )}
              {/* League contest: share with league members */}
              {!isH2H && c.currentEntries < c.maxEntries && (
                <Button variant="primary" size="md" onPress={() => {
                  const link = `https://app.draftplay.ai/contest/${c.id}`;
                  const teamName = myTeam.data?.name ? ` with "${myTeam.data.name}"` : "";
                  RNShare.share({ message: `I've created my team${teamName} for "${c.name}" on DraftPlay — create yours and let's compete! ${link}` });
                }} testID="success-invite-btn">
                  {formatUIText("share with league members")}
                </Button>
              )}
              <Button variant="secondary" size="sm" onPress={() => {
                if (match) {
                  useNavigationStore.getState().setMatchContext({ matchId: match.id, contestId: c.id, teamA: match.teamHome, teamB: match.teamAway, format: match.format, venue: match.venue, tournament: match.tournament, editTeamId: myTeam.data?.id });
                  router.push(teamBuilderRoute as any);
                }
              }} testID="success-edit-team-btn">
                {formatUIText("edit team")}
              </Button>
              <Button variant="secondary" size="sm" onPress={() => setJustJoined(false)} testID="success-dismiss-btn">
                {formatUIText("view contest details")}
              </Button>
            </YStack>
          </Card>
        </Animated.View>
      )}

      <AnnouncementBanner context={
        isOpen && match?.startTime ? { matchInfo: `${formatTeamName(match.teamHome)} vs ${formatTeamName(match.teamAway)} — ${countdown}` } :
        isLive ? { matchInfo: `${formatTeamName(match?.teamHome ?? "")} vs ${formatTeamName(match?.teamAway ?? "")} is live!` } :
        undefined
      } />

      {/* Tab Bar — shown when predictions are available */}
      {hasJoined && match && (isLive || isSettling || isSettled) && (
        <XStack
          marginHorizontal="$4"
          marginBottom="$3"
          backgroundColor="$backgroundSurface"
          borderRadius={DesignSystem.radius.lg}
          padding={3}
          gap={3}
        >
          {(["overview", "predictions"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <XStack
                key={tab}
                flex={1}
                justifyContent="center"
                alignItems="center"
                gap="$1"
                paddingVertical="$2"
                borderRadius={DesignSystem.radius.md}
                backgroundColor={isActive ? "$accentBackground" : "transparent"}
                cursor="pointer"
                pressStyle={{ opacity: 0.8 }}
                onPress={() => setActiveTab(tab)}
                testID={`tab-${tab}`}
              >
                <Text
                  fontFamily="$mono"
                  fontWeight={isActive ? "700" : "500"}
                  fontSize={DesignSystem.fontSize.md}
                  color={isActive ? "$accentColor" : "$colorSecondary"}
                >
                  {formatUIText(tab)}
                </Text>
                {tab === "predictions" && isLive && !isActive && (
                  <YStack
                    width={6}
                    height={6}
                    borderRadius={3}
                    backgroundColor="#30A46C"
                  />
                )}
              </XStack>
            );
          })}
        </XStack>
      )}

      {/* ── OVERVIEW TAB CONTENT ── */}
      {/* Show overview content when: no tabs (pre-match/no predictions), or overview tab active */}
      {(activeTab === "overview" || !(hasJoined && match && (isLive || isSettling || isSettled))) && (<>

      {/* Scoring Rules — show during onboarding (open contests) */}
      {isOpen && (
        <YStack marginHorizontal="$4" marginBottom="$4">
          <ScoringRulesCard format={match?.format} testID="contest-scoring-rules" />
        </YStack>
      )}

      {/* Post-Settlement Celebration Banner (#7) */}
      {isSettled && hasJoined && prizeWon > 0 && (
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <Card marginHorizontal="$4" marginBottom="$4" padding="$5" borderColor="$colorCricket" borderWidth={2} alignItems="center">
            <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$colorCricket" marginBottom="$1">
              {formatUIText("you won!")}
            </Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={28} color="$accentBackground" marginBottom="$2">
              {prizeWon.toLocaleString()} PC
            </Text>
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginBottom="$3">
              #{myPosition.data?.rank} of {myPosition.data?.totalEntries}
            </Text>
            <Button variant="secondary" size="sm" onPress={shareResult}>
              {formatUIText("share result")}
            </Button>
          </Card>
        </Animated.View>
      )}

      {/* Compact Your Summary — rank + C/VC impact merged */}
      {hasJoined && myPosition.data && (
        <Animated.View entering={FadeInDown.delay(0).springify()}>
          <Card
            marginHorizontal="$4"
            marginBottom="$4"
            padding="$4"
            borderWidth={2}
            borderColor="$accentBackground"
            testID="user-result-card"
          >
            <XStack justifyContent="space-between" alignItems="center">
              <YStack gap={2}>
                <XStack alignItems="baseline" gap="$2">
                  <Text fontFamily="$mono" fontWeight="800" fontSize={22} color="$accentBackground">
                    #{myPosition.data.rank}
                  </Text>
                  <Badge variant="role" size="sm">
                    {formatBadgeText(`top ${myPosition.data.percentile.toFixed(0)}%`)}
                  </Badge>
                </XStack>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  of {myPosition.data.totalEntries} entries
                </Text>
              </YStack>
              <Animated.View style={[scoreFlashStyle, { alignItems: "flex-end", gap: 2 }]}>
                <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$color">
                  {myTeam.data ? myTeam.data.totalPoints.toFixed(1) : "—"} {formatUIText("pts")}
                </Text>
                {myTeam.data && (() => {
                  const predPts = Number((myTeam.data as any).predictionPoints ?? 0);
                  const matchPts = myTeam.data.totalPoints - predPts;
                  if (predPts !== 0) {
                    return (
                      <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                        {formatUIText(`match ${matchPts.toFixed(1)} + predictions ${predPts >= 0 ? "+" : ""}${predPts.toFixed(1)}`)}
                      </Text>
                    );
                  }
                  return null;
                })()}
                {isSettled && prizeWon > 0 && (
                  <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">
                    won {prizeWon.toLocaleString()} PC
                  </Text>
                )}
              </Animated.View>
            </XStack>

            {/* Captain/VC Impact — inline */}
            {hasScores && captain && (
              <YStack marginTop="$3" paddingTop="$2" borderTopWidth={1} borderTopColor="$borderColor" gap={4}>
                <XStack justifyContent="space-between">
                  <XStack alignItems="center" gap="$1">
                    <Badge variant="live" size="sm">C</Badge>
                    <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{captain.name}</Text>
                  </XStack>
                  <Text fontFamily="$mono" fontWeight="700" fontSize={12} color={(captain.fantasyPoints ?? 0) > 0 ? "$accentBackground" : "$error"}>
                    {((captain.fantasyPoints ?? 0) * 2).toFixed(1)} {formatUIText("pts")}
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted"> +{(captain.fantasyPoints ?? 0).toFixed(1)} (2x)</Text>
                  </Text>
                </XStack>
                {viceCaptain && (
                  <XStack justifyContent="space-between">
                    <XStack alignItems="center" gap="$1">
                      <Badge variant="role" size="sm">VC</Badge>
                      <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{viceCaptain.name}</Text>
                    </XStack>
                    <Text fontFamily="$mono" fontWeight="700" fontSize={12} color={(viceCaptain.fantasyPoints ?? 0) > 0 ? "$accentBackground" : "$error"}>
                      {((viceCaptain.fantasyPoints ?? 0) * 1.5).toFixed(1)} {formatUIText("pts")}
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted"> +{vcBonus.toFixed(1)} (1.5x)</Text>
                    </Text>
                  </XStack>
                )}
                <XStack justifyContent="space-between">
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{formatUIText("base points")}</Text>
                  <Text fontFamily="$mono" fontWeight="600" fontSize={10} color="$color">{basePoints.toFixed(1)} <Text fontSize={9} color="$colorMuted">+ {(captainBonus + vcBonus).toFixed(1)} c/vc</Text></Text>
                </XStack>
              </YStack>
            )}
          </Card>
        </Animated.View>
      )}

      {/* Status-Aware Action Section */}
      <YStack paddingHorizontal="$4" marginBottom="$4">
        {isOpen && match?.status !== "completed" && match?.status !== "live" && (
          !match?.draftEnabled ? (
            <Card padding="$3" alignItems="center" borderColor="$borderColor" borderWidth={1}>
              <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorMuted">
                {formatUIText("draft not open yet — check back closer to match time")}
              </Text>
            </Card>
          ) : hasJoined ? (
            isH2H && c.currentEntries < c.maxEntries ? (
              <Card padding="$4" alignItems="center" borderColor="$colorAccent" borderWidth={1} gap="$2">
                <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$color">
                  {formatUIText("waiting for opponent")}
                </Text>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {formatUIText("share this challenge with a friend")}
                </Text>
                <XStack gap="$2" marginTop="$1">
                  <Button variant="primary" size="md" flex={1} onPress={() => {
                    const link = `draftplay://contest/${c.id}`;
                    RNShare.share({ message: `I challenged you to a Head-to-Head fantasy duel on DraftPlay! Join here: ${link}` });
                  }} testID="share-challenge-btn">
                    {formatUIText("share challenge")}
                  </Button>
                  <Button variant="secondary" size="md" onPress={() => {
                    Clipboard.setString(`draftplay://contest/${c.id}`);
                  }} testID="copy-link-btn">
                    {formatUIText("copy link")}
                  </Button>
                </XStack>
              </Card>
            ) : (
              <YStack gap="$3">
                {/* Edit team — always visible when joined and contest is open */}
                <Button variant="primary" size="lg" onPress={() => { if (match) { useNavigationStore.getState().setMatchContext({ matchId: match.id, contestId: c.id, teamA: match.teamHome, teamB: match.teamAway, format: match.format, venue: match.venue, tournament: match.tournament, editTeamId: myTeam.data?.id }); router.push(teamBuilderRoute as any); } }} testID="edit-team-btn">
                  {formatUIText("edit team")}
                </Button>
                {/* Swap teams — temporarily disabled. Revisit when we have
                    clearer UX around swapping between multi-team entries.
                {swappableTeams.length > 0 && (
                  <Button variant="secondary" size="md" onPress={() => setShowSwap(!showSwap)} testID="swap-team-btn">
                    {formatUIText(showSwap ? "cancel swap" : "swap with another team")}
                  </Button>
                )}
                */}
                {/* Invite friends when spots available */}
                {c.currentEntries < c.maxEntries && (
                  <Card padding="$3" alignItems="center" borderColor="$borderColor" borderWidth={1} gap="$2">
                    <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorMuted">
                      {c.maxEntries >= 10000
                        ? formatUIText("open contest — invite friends")
                        : formatUIText(`${c.maxEntries - c.currentEntries} spots left — invite friends`)}
                    </Text>
                    <XStack gap="$2">
                      <Button variant="secondary" size="sm" flex={1} onPress={() => {
                        const link = `https://app.draftplay.ai/contest/${c.id}`;
                        RNShare.share({ message: `Join my fantasy contest "${c.name}" on DraftPlay! ${link}` });
                      }} testID="share-contest-btn">
                        {formatUIText("invite friends")}
                      </Button>
                      <Button variant="secondary" size="sm" onPress={() => {
                        Clipboard.setString(`https://app.draftplay.ai/contest/${c.id}`);
                      }} testID="copy-contest-link-btn">
                        {formatUIText("copy link")}
                      </Button>
                    </XStack>
                  </Card>
                )}
              </YStack>
            )
          ) : (
            <Button variant="primary" size="lg" onPress={() => { if (match) { useNavigationStore.getState().setMatchContext({ matchId: match.id, contestId: c.id, teamA: match.teamHome, teamB: match.teamAway, format: match.format, venue: match.venue, tournament: match.tournament }); router.push(teamBuilderRoute as any); } }} testID="join-contest-btn">
              {c.entryFee === 0 ? formatUIText("join free") : `${formatUIText("join")} ${c.entryFee} PC`}
            </Button>
          )
        )}
        {isLive && (
          <XStack justifyContent="center" marginBottom="$1">
            <Badge variant="live" size="sm">{formatBadgeText("match in progress")}</Badge>
          </XStack>
        )}
        {isSettling && (
          <Card padding="$3" alignItems="center">
            <EggLoadingSpinner size={20} message={formatUIText("results being calculated...")} />
          </Card>
        )}
        {isSettled && (
          <Card padding="$3" alignItems="center" borderColor="$colorCricket" borderWidth={1}>
            <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorCricket">
              {formatUIText("match completed · results final")}
            </Text>
          </Card>
        )}
        {(match?.status === "completed" && !isSettled && !isSettling && !isLive) && (
          <Card padding="$3" alignItems="center" borderColor="$colorAccent" borderWidth={1}>
            <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorAccent">
              {formatUIText("match completed")}
            </Text>
          </Card>
        )}
      </YStack>

      {/* Swap Team Picker — temporarily disabled. Revisit UX later.
      {showSwap && swappableTeams.length > 0 && (
        <Animated.View entering={FadeInDown.springify()}>
          <YStack paddingHorizontal="$4" marginBottom="$4" gap="$2">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
              {formatUIText("pick a team to use in this contest")}
            </Text>
            {swappableTeams.map((team: any) => (
              <Card
                key={team.id}
                pressable
                padding="$3"
                borderColor="$borderColor"
                borderWidth={1}
                onPress={() => swapMutation.mutate({ contestId: id!, newTeamId: team.id })}
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1} gap={2}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                      {team.name}
                    </Text>
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                      {Number(team.creditsUsed).toFixed(1)} {formatUIText("credits")} · {Array.isArray(team.players) ? team.players.length : 0} {formatUIText("players")}
                    </Text>
                  </YStack>
                  <Button variant="primary" size="sm" disabled={swapMutation.isPending} onPress={() => swapMutation.mutate({ contestId: id!, newTeamId: team.id })}>
                    {swapMutation.isPending ? formatUIText("swapping...") : formatUIText("use this team")}
                  </Button>
                </XStack>
              </Card>
            ))}
          </YStack>
        </Animated.View>
      )}
      */}

      {/* Prize Distribution */}
      {c.prizePool > 0 && c.prizeDistribution && Array.isArray(c.prizeDistribution) && (c.prizeDistribution as Array<{ rank: number; amount: number }>).length > 0 && (
        <YStack paddingHorizontal="$4" marginBottom="$6">
          <Text {...textStyles.sectionHeader} marginBottom="$3">
            {formatUIText("prize distribution")}
          </Text>
          {(c.prizeDistribution as Array<{ rank: number; amount: number }>).map((prize, i) => (
            <Card key={i} marginBottom="$1" padding="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">
                  #{prize.rank}
                </Text>
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color">
                  {prize.amount.toLocaleString()} PC
                </Text>
              </XStack>
            </Card>
          ))}
        </YStack>
      )}

      {/* H2H Visual Duel (#5) — replaces standard leaderboard for 2-player contests */}
      {isH2H && standingsData.length === 2 ? (
        <YStack paddingHorizontal="$4" marginBottom="$6">
          <Text {...textStyles.sectionHeader} marginBottom="$3">
            {formatUIText("head to head")}
          </Text>
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <Card padding="$4">
              {/* Side-by-side duel */}
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                {standingsData.map((entry: any, idx: number) => {
                  const rawN = entry.displayName || entry.username || `Player ${entry.rank}`;
                  const name = rawN.includes("@") ? rawN.split("@")[0]! : rawN;
                  const isMe = currentUserId && entry.userId === currentUserId;
                  const isWinner = isSettled && entry.rank === 1;
                  return (
                    <YStack key={entry.userId} flex={1} alignItems="center" gap={4}>
                      <InitialsAvatar name={name} playerRole="BAT" ovr={0} size={42} hideBadge />
                      <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" numberOfLines={1} textAlign="center">
                        {name}
                      </Text>
                      {isMe && <Badge variant="live" size="sm">{formatBadgeText("you")}</Badge>}
                      <Text fontFamily="$mono" fontWeight="800" fontSize={22} color={isWinner ? "$colorCricket" : "$color"} marginTop="$1">
                        {entry.totalPoints.toFixed(1)}
                      </Text>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{formatUIText("pts")}</Text>
                      {isWinner && (
                        <Badge variant="live" size="sm">{formatBadgeText("winner")}</Badge>
                      )}
                    </YStack>
                  );
                })}
              </XStack>

              {/* Comparison bar */}
              {(() => {
                const totalPts = standingsData[0].totalPoints + standingsData[1].totalPoints;
                const pct1 = totalPts > 0 ? (standingsData[0].totalPoints / totalPts) * 100 : 50;
                return (
                  <YStack>
                    <XStack height={8} borderRadius={4} overflow="hidden" backgroundColor="$borderColor">
                      <YStack height={8} backgroundColor="$accentBackground" borderRadius={4} width={`${pct1}%` as any} />
                      <YStack flex={1} height={8} backgroundColor="$colorCricket" />
                    </XStack>
                    <XStack justifyContent="space-between" marginTop={4}>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{pct1.toFixed(0)}%</Text>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{(100 - pct1).toFixed(0)}%</Text>
                    </XStack>
                  </YStack>
                );
              })()}
            </Card>
          </Animated.View>
        </YStack>
      ) : (
        /* Interactive Leaderboard — tap to expand any team's players */
        <YStack paddingHorizontal="$4" marginBottom="$4">
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
            <Text {...textStyles.sectionHeader}>
              {formatUIText("leaderboard")}
            </Text>
            {standingsData.length > 0 && (
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{standingsData.length} {formatUIText("entries")}</Text>
            )}
          </XStack>
          {standings.isLoading ? (
            <EggLoadingSpinner size={32} message={formatUIText("loading standings")} />
          ) : standingsData.length > 0 ? (
            standingsData.map((entry: any, i: number) => {
              const rawName = entry.displayName || entry.username || `Player ${entry.rank}`;
              const displayName = rawName.includes("@") ? rawName.split("@")[0]! : rawName;
              const isCurrentUser = currentUserId && entry.userId === currentUserId;
              const isTeamExpanded = expandedTeamId === entry.teamId;
              const expandedPlayers = isTeamExpanded ? (expandedTeamQuery.data?.playerDetails ?? []) : [];
              const isLoadingTeam = isTeamExpanded && expandedTeamQuery.isLoading;

              return (
                <Animated.View key={entry.userId} entering={FadeInDown.delay(i * 30).springify()}>
                  <Card
                    testID={`contest-leaderboard-entry-${entry.rank}`}
                    marginBottom="$1"
                    padding="$3"
                    pressable
                    onPress={() => {
                      // Block expanding other users' teams while contest is open
                      if (!isTeamExpanded && isOpen && !isCurrentUser) return;
                      if (isTeamExpanded) {
                        setExpandedTeamId(null);
                        setExpandedPlayerId(null);
                      } else {
                        setExpandedTeamId(entry.teamId);
                        setExpandedPlayerId(null);
                      }
                    }}
                    cursor="pointer"
                    borderColor={isTeamExpanded ? "$accentBackground" : isCurrentUser ? "$accentBackground" : i < 3 ? "$colorCricketLight" : "$borderColor"}
                    borderWidth={isTeamExpanded || isCurrentUser ? 2 : 1}
                    backgroundColor={isCurrentUser ? "$backgroundSurfaceAlt" : undefined}
                  >
                    {/* Row header: rank, avatar, name, team name, points */}
                    <XStack alignItems="center">
                      <YStack width={32} alignItems="center">
                        <Text fontFamily="$mono" fontWeight="800" fontSize={isCurrentUser ? 16 : 14} color={i === 0 ? "$colorCricket" : i === 1 ? "$colorSecondary" : i === 2 ? "$colorHatch" : "$color"}>
                          #{entry.rank}
                        </Text>
                      </YStack>
                      <XStack alignItems="center" gap="$2" flex={1} marginLeft="$2">
                        <InitialsAvatar name={displayName} playerRole="BAT" ovr={`#${entry.rank}`} size={28} />
                        <YStack flex={1}>
                          <Text {...textStyles.playerName} fontWeight={isCurrentUser ? "700" : "600"}>
                            {displayName}
                          </Text>
                          <XStack alignItems="center" gap="$1" marginTop={1}>
                            {isCurrentUser && <Badge variant="live" size="sm">{formatBadgeText("you")}</Badge>}
                            {entry.teamName && (
                              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" numberOfLines={1}>
                                {entry.teamName}
                              </Text>
                            )}
                          </XStack>
                        </YStack>
                      </XStack>
                      <YStack alignItems="flex-end">
                        <StatLabel label={formatUIText("pts")} value={entry.totalPoints.toFixed(1)} />
                        {(!isOpen || isCurrentUser) && (
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{isTeamExpanded ? "▲" : "▼"}</Text>
                        )}
                      </YStack>
                    </XStack>

                    {/* Expanded team players */}
                    {isTeamExpanded && (
                      <YStack marginTop="$2" paddingTop="$2" borderTopWidth={1} borderTopColor="$borderColor">
                        {isLoadingTeam ? (
                          <EggLoadingSpinner size={20} message={formatUIText("loading team")} />
                        ) : expandedPlayers.length > 0 ? (
                          expandedPlayers.map((p: any, pi: number) => {
                            const multiplier = p.isCaptain ? "2x" : p.isViceCaptain ? "1.5x" : "";
                            const isPlayerExpanded = expandedPlayerId === p.id;
                            const breakdown = hasScores && isPlayerExpanded ? buildBreakdown(p) : [];
                            return (
                              <YStack key={p.id || pi}>
                                <XStack
                                  alignItems="center"
                                  paddingVertical="$2"
                                  cursor={hasScores ? "pointer" : undefined}
                                  pressStyle={hasScores ? { opacity: 0.7 } : undefined}
                                  onPress={hasScores ? (e: any) => {
                                    e?.stopPropagation?.();
                                    setExpandedPlayerId(isPlayerExpanded ? null : p.id);
                                  } : undefined}
                                >
                                  <InitialsAvatar name={p.name} playerRole={p.role?.toUpperCase()} ovr={hasScores ? (p.fantasyPoints ?? 0).toFixed(0) : 0} size={24} hideBadge={!hasScores} imageUrl={p.photoUrl} />
                                  <YStack flex={1} marginLeft="$2">
                                    <XStack alignItems="center" gap="$1">
                                      <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{p.name}</Text>
                                      {p.isCaptain && <Badge variant="live" size="sm">C</Badge>}
                                      {p.isViceCaptain && <Badge variant="role" size="sm">VC</Badge>}
                                    </XStack>
                                    <XStack alignItems="center" gap="$1">
                                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{p.team}</Text>
                                      <Badge variant="default" size="sm">{formatBadgeText(p.role)}</Badge>
                                    </XStack>
                                  </YStack>
                                  <YStack alignItems="flex-end">
                                    <Text fontFamily="$mono" fontWeight="700" fontSize={13} color={(p.contribution ?? p.fantasyPoints ?? 0) > 0 ? "$accentBackground" : "$error"}>
                                      {(p.contribution ?? p.fantasyPoints ?? 0).toFixed(1)}
                                    </Text>
                                    {multiplier ? (
                                      <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{(p.fantasyPoints ?? 0).toFixed(1)} {multiplier}</Text>
                                    ) : null}
                                  </YStack>
                                </XStack>
                                {/* Player points breakdown */}
                                {isPlayerExpanded && breakdown.length > 0 && (
                                  <YStack marginBottom="$2" paddingHorizontal="$2" paddingVertical="$2" backgroundColor="$backgroundSurface" borderRadius={DesignSystem.radius.sm} gap={2}>
                                    {breakdown.map((row, bi) => {
                                      if (row.isDivider) return <YStack key={bi} height={1} backgroundColor="$borderColor" marginVertical={3} />;
                                      if (row.isHeader) return (
                                        <Text key={bi} fontFamily="$mono" fontSize={9} fontWeight="700" color="$colorMuted" letterSpacing={0.8} marginTop={bi > 0 ? 6 : 0}>
                                          {formatBadgeText(row.label)}
                                        </Text>
                                      );
                                      return (
                                        <XStack key={bi} justifyContent="space-between" alignItems="center" paddingLeft="$2">
                                          <Text fontFamily="$mono" fontSize={10} color={row.isBold ? "$color" : "$colorSecondary"} fontWeight={row.isBold ? "700" : "400"}>{row.label}</Text>
                                          {row.pts != null && (
                                            <Text fontFamily="$mono" fontSize={10} fontWeight={row.isBold ? "700" : "600"} color={row.pts < 0 ? "$error" : row.isBold ? "$accentBackground" : "$color"}>
                                              {row.pts > 0 ? `+${row.pts.toFixed(1)}` : row.pts < 0 ? row.pts.toFixed(1) : "0.0"}
                                            </Text>
                                          )}
                                        </XStack>
                                      );
                                    })}
                                  </YStack>
                                )}
                              </YStack>
                            );
                          })
                        ) : (
                          <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{formatUIText("no player data available")}</Text>
                        )}
                      </YStack>
                    )}
                  </Card>
                </Animated.View>
              );
            })
          ) : (
            <Card padding="$6" alignItems="center">
              <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
              <Text {...textStyles.hint} textAlign="center">
                {isOpen ? formatUIText("leaderboard will appear once the match starts") : formatUIText("no entries yet")}
              </Text>
            </Card>
          )}
        </YStack>
      )}

      {/* Stats Grid — below leaderboard */}
      {isLive || isSettling ? (
        <XStack paddingHorizontal="$4" marginBottom="$3" gap="$3" flexWrap="wrap">
          {[
            c.prizePool > 0 ? `${c.prizePool.toLocaleString()} PC prize` : null,
            c.entryFee === 0 ? "free entry" : `${c.entryFee} PC entry`,
            `${c.currentEntries} ${c.currentEntries === 1 ? "entry" : "entries"}`,
            c.contestType,
          ].filter(Boolean).map((tag, i) => (
            <Badge key={i} variant="default" size="sm">{formatBadgeText(tag!)}</Badge>
          ))}
        </XStack>
      ) : (
        <XStack flexWrap="wrap" padding="$4" gap="$3">
          {[
            { label: formatUIText("prize pool"), value: c.prizePool > 0 ? `${c.prizePool.toLocaleString()} PC` : formatBadgeText("glory"), tid: "contest-prize-pool" },
            { label: formatUIText("entry fee"), value: c.entryFee === 0 ? formatBadgeText("free") : `${c.entryFee} PC`, tid: "contest-entry-fee" },
            { label: formatUIText("spots"), value: c.maxEntries >= 10000 ? `${c.currentEntries}` : `${c.currentEntries}/${c.maxEntries}`, tid: "contest-spots" },
            { label: formatUIText("type"), value: formatBadgeText(c.contestType ?? ""), tid: "contest-type" },
          ].map((item) => (
            <Card key={item.label} testID={item.tid} flex={1} minWidth="45%" padding="$3">
              <Text {...textStyles.hint}>{item.label}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color" marginTop="$1">
                {item.value}
              </Text>
            </Card>
          ))}
        </XStack>
      )}

      {/* Progress Bar — skipped for unlimited contests (bar and
          "spots left" are meaningless when the cap is 100k) */}
      {!isLive && !isSettling && c.maxEntries < 10000 && (
        <YStack paddingHorizontal="$4" marginBottom="$4">
          <YStack height={6} backgroundColor="$borderColor" borderRadius={3}>
            <YStack height={6} backgroundColor="$accentBackground" borderRadius={3} width={`${Math.min(100, (c.currentEntries / c.maxEntries) * 100)}%` as any} />
          </YStack>
          <Text fontFamily="$mono" fontSize={12} color="$colorMuted" marginTop="$1" textAlign="center">
            {isSettled
              ? `${c.currentEntries} ${formatUIText("entries")}`
              : `${c.maxEntries - c.currentEntries} ${formatUIText("spots left")}`}
          </Text>
        </YStack>
      )}

      {/* Pre-match team lineup preview */}
      {isOpen && hasJoined && teamPlayers.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <YStack paddingHorizontal="$4" marginBottom="$6">
            <Text {...textStyles.sectionHeader} marginBottom="$3">
              {formatUIText("your team")}
            </Text>
            <Card padding="$3">
              <XStack flexWrap="wrap" gap="$2">
                {teamPlayers.map((p: any, i: number) => (
                  <XStack key={p.id || i} alignItems="center" gap={4} minWidth="45%" paddingVertical={2}>
                    <InitialsAvatar name={p.name} playerRole={p.role?.toUpperCase()} ovr={0} size={22} hideBadge imageUrl={p.photoUrl} />
                    <Text fontFamily="$body" fontSize={11} color="$color" numberOfLines={1} flex={1}>
                      {p.name}
                    </Text>
                    {p.isCaptain && <Badge variant="live" size="sm">C</Badge>}
                    {p.isViceCaptain && <Badge variant="role" size="sm">VC</Badge>}
                  </XStack>
                ))}
              </XStack>
            </Card>
          </YStack>
        </Animated.View>
      )}

      </>)}

      {/* ── PREDICTIONS TAB CONTENT ── */}
      {activeTab === "predictions" && hasJoined && match && (isLive || isSettling || isSettled) && (
        <YStack paddingHorizontal="$4" marginBottom="$6">
          <LivePredictionFeed
            contestId={id!}
            matchId={match.id ?? c.matchId}
            isLive={isLive}
            currentUserId={currentUserId}
            onScoreUpdate={handlePredictionScoreUpdate}
            matchContext={{
              teamA: match.teamHome ?? undefined,
              teamB: match.teamAway ?? undefined,
              format: match.format ?? "T20",
              score: match.scoreSummary ?? undefined,
            }}
          />
        </YStack>
      )}
    </ScrollView>
    </YStack>
  );
}
