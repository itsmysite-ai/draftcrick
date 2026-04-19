import { ScrollView as RNScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ScoringRulesCard,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useNavigationStore } from "../../lib/navigation-store";
import { useSport } from "../../providers/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";
import { usePaywall } from "../../hooks/usePaywall";
import { HeaderControls } from "../../components/HeaderControls";
import { StakePickerModal } from "../../components/StakePickerModal";

/** Safely parse date/time into a Date object. Handles ISO strings and legacy "Feb 12, 2026" + "7:30 PM" format. */
function parseSafeDate(dateStr?: string, timeStr?: string): Date {
  if (!dateStr) return new Date();
  // If dateStr is ISO (from updated API), parse directly — timezone is embedded
  if (dateStr.includes("T") || dateStr.endsWith("Z")) {
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  // Legacy: "Feb 12, 2026" + "7:30 PM IST"
  const cleanTime = (timeStr ?? "").replace(/\s+[A-Z]{2,4}$/, "");
  const parsed = new Date(`${dateStr} ${cleanTime}`);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

import { parseTeamScores, didTeamAWin } from "../../lib/score-utils";

// Legacy parseTeamScores — kept but unused (shadowed by import above)
// Score parsing, team role, and win detection imported from ../../lib/score-utils

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
  joined,
  onPlay,
  testID,
}: {
  title: string;
  subtitle: string;
  prize: string;
  entry: string;
  spots: string;
  highlight?: boolean;
  joined?: boolean;
  onPlay?: () => void;
  testID?: string;
}) {
  return (
    <Card
      padding={0}
      overflow="hidden"
      marginBottom="$3"
      borderWidth={highlight ? 2 : joined ? 2 : 1}
      borderColor={highlight ? "$colorAccent" : joined ? "$accentBackground" : "$borderColor"}
      testID={testID}
    >
      <YStack padding="$4" paddingBottom="$3" gap="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" numberOfLines={2} flex={1}>
            {title}
          </Text>
          {joined && (
            <Badge variant="success" size="sm">{formatBadgeText("JOINED")}</Badge>
          )}
        </XStack>
        <XStack alignItems="center" gap="$2">
          {highlight && (
            <Badge variant="live" size="sm">{formatBadgeText("popular")}</Badge>
          )}
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {formatUIText(subtitle)}
          </Text>
          {entry !== "free" && (
            <Badge variant="default" size="sm">{formatUIText(`${entry} pc`)}</Badge>
          )}
        </XStack>
      </YStack>

      {/* Prize + Spots + Play strip */}
      <XStack
        backgroundColor="$backgroundSurfaceAlt"
        paddingVertical="$2"
        paddingHorizontal="$4"
        justifyContent="space-between"
        alignItems="center"
        borderTopWidth={1}
        borderTopColor="$borderColor"
      >
        <XStack alignItems="center" gap="$4">
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
        {onPlay && !joined && (
          <Button variant="primary" size="sm" onPress={onPlay}>
            {formatUIText("play")}
          </Button>
        )}
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
  const { user, isLoading: authLoading } = useAuth();
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

  // Fallback: fetch DB match directly by externalId when match.live doesn't include it
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId);
  const dbMatchDirect = trpc.match.getByExternalId.useQuery(
    { externalId: matchId },
    { enabled: !isUuid && (dbLive.data ?? []).length === 0 && !dbLive.isLoading, staleTime: 30_000 },
  );
  const dbMatchById = trpc.match.getById.useQuery(
    { id: matchId },
    { enabled: isUuid, staleTime: 30_000, refetchInterval: 10_000 },
  );

  // Build team logo lookup from tournament teams data
  const getTeamLogo = useCallback((teamName: string) => {
    const key = teamName.toLowerCase();
    for (const t of dashboardQuery.data?.tournaments ?? []) {
      for (const team of (t as any).teams ?? []) {
        if (!team.logo) continue;
        const n = team.name?.toLowerCase() ?? "";
        const s = team.shortName?.toLowerCase() ?? "";
        if (n === key || s === key || key.includes(n) || n.includes(key)) return team.logo;
      }
    }
    return undefined;
  }, [dashboardQuery.data?.tournaments]);

  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const setMatchContext = useNavigationStore((s) => s.setMatchContext);
  const { hasAccess, canAccess, paywallProps } = usePaywall();

  // Build match from dashboard + DB data (no hooks below, just computation)
  const dbMatches = dbLive.data ?? [];
  // Fallback DB match from direct query (when match.live doesn't include it)
  const fallbackDbMatch = dbMatchDirect.data ?? dbMatchById.data ?? null;
  const match = useMemo(() => {
    if (dashboardQuery.isLoading) return undefined; // still loading
    // Use externalId as primary key (unique per match — handles same-team series correctly)
    const dbByExternalId = new Map<string, any>();
    const dbByTeamKey = new Map<string, any>();
    for (const m of dbMatches) {
      if (m.externalId) dbByExternalId.set(m.externalId, m);
      const key = [m.teamHome, m.teamAway].map((t: string) => t.toLowerCase().trim()).sort().join("|");
      dbByTeamKey.set(key, m);
    }
    const rawMatch = (dashboardQuery.data?.matches ?? []).find((m: any) => m.id === matchId) as any;
    const dbMatchFromList = !rawMatch ? dbMatches.find((m: any) => m.id === matchId || m.externalId === matchId) : null;

    if (rawMatch) {
      // Primary: match by externalId, then exact team key, then fuzzy team match, then direct query fallback
      const db = dbByExternalId.get(rawMatch.id)
        || (() => {
          const key = [rawMatch.teamA || "", rawMatch.teamB || ""].map((t: string) => t.toLowerCase().trim()).sort().join("|");
          return dbByTeamKey.get(key);
        })()
        || (() => {
          // Fuzzy: check if both dashboard team names appear as substrings in DB team names (or vice versa)
          const a = (rawMatch.teamA || "").toLowerCase().trim();
          const b = (rawMatch.teamB || "").toLowerCase().trim();
          return dbMatches.find((m: any) => {
            const h = m.teamHome?.toLowerCase().trim() ?? "";
            const aw = m.teamAway?.toLowerCase().trim() ?? "";
            return (h.includes(a) || a.includes(h)) && (aw.includes(b) || b.includes(aw))
              || (h.includes(b) || b.includes(h)) && (aw.includes(a) || a.includes(aw));
          });
        })()
        || fallbackDbMatch; // Direct DB query fallback
      return {
        ...rawMatch,
        status: db?.status || rawMatch.status,
        tossWinner: rawMatch.tossWinner || db?.tossWinner || null,
        tossDecision: rawMatch.tossDecision || db?.tossDecision || null,
        scoreSummary: db?.scoreSummary || rawMatch.scoreSummary || null,
        result: rawMatch.result || db?.result || null,
        draftEnabled: db?.draftEnabled ?? false,
      };
    }
    if (dbMatchFromList) {
      return {
        id: dbMatchFromList.id,
        teamA: dbMatchFromList.teamHome,
        teamB: dbMatchFromList.teamAway,
        tournamentName: dbMatchFromList.tournament,
        format: dbMatchFromList.format?.toUpperCase() || "T20",
        venue: dbMatchFromList.venue,
        status: dbMatchFromList.status,
        date: new Date(dbMatchFromList.startTime).toISOString(),
        time: new Date(dbMatchFromList.startTime).toISOString(),
        scoreSummary: dbMatchFromList.scoreSummary || null,
        result: dbMatchFromList.result || null,
        tossWinner: dbMatchFromList.tossWinner || null,
        tossDecision: dbMatchFromList.tossDecision || null,
        draftEnabled: dbMatchFromList.draftEnabled ?? false,
        sport,
      };
    }
    // Final fallback: direct DB query result
    if (fallbackDbMatch) {
      return {
        id: fallbackDbMatch.id,
        teamA: (fallbackDbMatch as any).teamHome,
        teamB: (fallbackDbMatch as any).teamAway,
        tournamentName: (fallbackDbMatch as any).tournament,
        format: ((fallbackDbMatch as any).format?.toUpperCase()) || "T20",
        venue: (fallbackDbMatch as any).venue,
        status: (fallbackDbMatch as any).status,
        date: new Date((fallbackDbMatch as any).startTime).toISOString(),
        time: new Date((fallbackDbMatch as any).startTime).toISOString(),
        scoreSummary: (fallbackDbMatch as any).scoreSummary || null,
        result: (fallbackDbMatch as any).result || null,
        tossWinner: (fallbackDbMatch as any).tossWinner || null,
        tossDecision: (fallbackDbMatch as any).tossDecision || null,
        draftEnabled: (fallbackDbMatch as any).draftEnabled ?? false,
        sport,
      };
    }
    return null;
  }, [dashboardQuery.isLoading, dashboardQuery.data, dbMatches, matchId, fallbackDbMatch]);

  // Derived match fields (safe defaults when match is null)
  const isLive = match?.status === "live";
  const isCompleted = match?.status === "completed";
  const rawTeamA = match?.teamA || match?.teamHome || "TBA";
  const rawTeamB = match?.teamB || match?.teamAway || "TBA";
  const teamA = formatTeamName(rawTeamA);
  const teamB = formatTeamName(rawTeamB);
  const tournament = match?.tournamentName || match?.tournament || "";
  const format = match?.format || "T20";
  const venue = match?.venue || null;
  const startTime = parseSafeDate(match?.date, match?.time);
  const timeStr = startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = startTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const scoreData = parseTeamScores(match?.scoreSummary, rawTeamA, rawTeamB);
  const scoreA = scoreData.scoreA;
  const scoreB = scoreData.scoreB;
  const oversA = scoreData.oversA;
  const oversB = scoreData.oversB;
  const teamARole: "bat" | "bowl" | null = null; // Disabled — backlogged
  const teamAWon = didTeamAWin(match?.result, rawTeamA);

  // FDR query
  const fdrQuery = trpc.analytics.getFixtureDifficulty.useQuery(
    { matchId, teamA, teamB, format, venue, tournament: tournament || "unknown" },
    { staleTime: 60 * 60_000, retry: 1, enabled: !!match },
  );


  // Resolve DB match UUID for contest queries
  const dbMatchUuid = useMemo(() => {
    const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId);
    if (isUuidFormat) return matchId;
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
    // Fallback: direct DB query result
    if (fallbackDbMatch) return (fallbackDbMatch as any).id;
    return null;
  }, [matchId, dbMatches, match, fallbackDbMatch]);

  // Fetch real contests from DB
  // Wait for auth before fetching contests so server can filter private ones
  const contestsQuery = trpc.contest.listByMatch.useQuery(
    { matchId: dbMatchUuid! },
    { enabled: !!dbMatchUuid && !authLoading, staleTime: 30_000 },
  );
  const matchStarted = isLive || isCompleted;
  const myContestsQuery = trpc.contest.myContests.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });
  const allDbContests = contestsQuery.data ?? [];
  // Check if user already has a team for this match
  const myTeamsQuery = trpc.team.myTeams.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });
  const myTeamForMatch = useMemo(() => {
    if (!dbMatchUuid || !myTeamsQuery.data) return null;
    return (myTeamsQuery.data as any[]).find((t: any) => t.matchId === dbMatchUuid && t.contestId) ?? null;
  }, [dbMatchUuid, myTeamsQuery.data]);
  // Build set of user's joined contest IDs
  const myContestIds = new Set(
    (myContestsQuery.data ?? []).map((mc: any) => mc.contestId ?? mc.contest?.id).filter(Boolean)
  );
  // Server already filters: public + user's private + user's h2h.
  // After match starts, further filter to only joined contests.
  const dbContests = matchStarted && user
    ? allDbContests.filter((c: any) => myContestIds.has(c.id))
    : allDbContests;

  const pointsBreakdownQuery = trpc.analytics.getPointsBreakdown.useQuery(
    { matchId: dbMatchUuid ?? "", format },
    { enabled: showPointsBreakdown && !!dbMatchUuid && isCompleted, staleTime: 60 * 60_000, retry: 1 },
  );

  // Wallet balance (for H2H stake picker)
  const walletQuery = trpc.wallet.getBalance.useQuery(undefined, { staleTime: 30_000 });

  // H2H Challenge — stake picker modal state
  const [showStakePicker, setShowStakePicker] = useState(false);
  const { setFlowState } = useNavigationStore();

  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const goToTeamCreate = (contestId?: string) => {
    // Use DB UUID so team create can query contests correctly
    const resolvedMatchId = dbMatchUuid || matchId;
    setMatchContext({ matchId: resolvedMatchId, teamA, teamB, format, venue: venue || undefined, tournament: tournament || undefined, ...(contestId ? { contestId } : {}) });
    router.push("/team/create");
  };

  const goToGuru = () => {
    // Use raw team names (not formatTeamName) so "Women" suffix is preserved for AI context
    const rawTeamA = match?.teamA || match?.teamHome || teamA;
    const rawTeamB = match?.teamB || match?.teamAway || teamB;
    setMatchContext({ matchId, teamA: rawTeamA, teamB: rawTeamB, format, venue: venue || undefined, tournament: tournament || undefined });
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
            <BackButton onPress={safeBack} />
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
          <Button variant="primary" size="md" marginTop="$3" onPress={safeBack}>
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
          <BackButton onPress={safeBack} />
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
                  imageUrl={getTeamLogo(match?.teamA || match?.teamHome || "")}
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
                {fdrQuery.data?.teamA && !isCompleted && !scoreA && match?.draftEnabled && (
                  <YStack alignItems="center" marginTop={4} gap={4}>
                    <FDRBadge fdr={fdrQuery.data.teamA.overallFdr} size="sm" showLabel testID="fdr-badge-team-a" />
                    {hasAccess("pro") ? (
                      <XStack gap="$2">
                        <YStack alignItems="center">
                          <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatUIText("bat")}</Text>
                          <FDRBadge fdr={fdrQuery.data.teamA.battingFdr} size="sm" />
                        </YStack>
                        <YStack alignItems="center">
                          <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatUIText("bowl")}</Text>
                          <FDRBadge fdr={fdrQuery.data.teamA.bowlingFdr} size="sm" />
                        </YStack>
                      </XStack>
                    ) : (
                      <XStack alignItems="center" gap="$1">
                        <TierBadge tier="pro" size="sm" />
                        <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatUIText("bat/bowl")}</Text>
                      </XStack>
                    )}
                  </YStack>
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
                  imageUrl={getTeamLogo(match?.teamB || match?.teamAway || "")}
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
                {fdrQuery.data?.teamB && !isCompleted && !scoreB && match?.draftEnabled && (
                  <YStack alignItems="center" marginTop={4} gap={4}>
                    <FDRBadge fdr={fdrQuery.data.teamB.overallFdr} size="sm" showLabel testID="fdr-badge-team-b" />
                    {hasAccess("pro") ? (
                      <XStack gap="$2">
                        <YStack alignItems="center">
                          <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatUIText("bat")}</Text>
                          <FDRBadge fdr={fdrQuery.data.teamB.battingFdr} size="sm" />
                        </YStack>
                        <YStack alignItems="center">
                          <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatUIText("bowl")}</Text>
                          <FDRBadge fdr={fdrQuery.data.teamB.bowlingFdr} size="sm" />
                        </YStack>
                      </XStack>
                    ) : (
                      <XStack alignItems="center" gap="$1">
                        <TierBadge tier="pro" size="sm" />
                        <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatUIText("bat/bowl")}</Text>
                      </XStack>
                    )}
                  </YStack>
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
              {!isLive && (
                <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorCricket">
                  {`${dateStr} · ${timeStr}`}
                </Text>
              )}
              {venue && (
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted" numberOfLines={1}>
                  {venue}
                </Text>
              )}
              {fdrQuery.data && !isCompleted && !scoreA && match?.draftEnabled && (
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted" marginTop={4} opacity={0.6}>
                  {formatUIText("lower fdr = easier fixture")}
                </Text>
              )}
            </YStack>
          </Card>
        </Animated.View>

        {/* ── Primary CTA — Play This Match ── */}
        {!isCompleted && !isLive && (
          <Animated.View entering={FadeInDown.delay(50).springify()}>
            {match?.draftEnabled ? (
              <YStack gap="$2" marginBottom="$5">
                {user && dbMatchUuid && (
                  <Button
                    variant="primary"
                    size="lg"
                    onPress={() => setShowStakePicker(true)}
                    testID="challenge-friend-btn"
                  >
                    {formatUIText("challenge a friend to a duel")}
                  </Button>
                )}
              </YStack>
            ) : (
              <Card padding="$3" marginBottom="$5" alignItems="center" borderColor="$borderColor" borderWidth={1}>
                <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorMuted">
                  {formatUIText(isLive || isCompleted ? "draft closed" : "draft not open yet")}
                </Text>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop={2}>
                  {formatUIText(isLive || isCompleted ? "team creation is no longer available" : "team creation opens closer to match time")}
                </Text>
              </Card>
            )}
          </Animated.View>
        )}

        {/* ── Your Contests (after match starts: exclude H2H — those go in "your duels") ── */}
        {matchStarted && (() => {
          const nonH2H = dbContests.filter((c: any) => c.contestType !== "h2h");
          if (nonH2H.length === 0) return null;
          return (
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Text fontSize={14}>🏟️</Text>
                <Text {...textStyles.sectionHeader}>
                  {formatUIText("your contests")}
                </Text>
              </XStack>
              {nonH2H.map((contest: any, i: number) => {
                const mc = (myContestsQuery.data ?? []).find((c: any) => c.contestId === contest.id);
                const liveRank = mc?.rank ? `#${mc.rank} of ${mc.totalEntries}` : null;
                const livePoints = mc?.totalPoints != null ? `${mc.totalPoints.toFixed(1)} pts` : null;
                return (
                  <Card
                    key={contest.id}
                    pressable
                    padding={0}
                    overflow="hidden"
                    marginBottom="$3"
                    borderWidth={1}
                    borderColor="$borderColor"
                    onPress={() => router.push(`/contest/${contest.id}`)}
                    testID={`contest-${i}`}
                  >
                    <XStack padding="$4" paddingBottom={mc?.name ? "$2" : "$3"} alignItems="center" justifyContent="space-between">
                      <YStack flex={1} gap="$1">
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" numberOfLines={1}>
                          {contest.name}
                        </Text>
                        <XStack alignItems="center" gap="$2">
                          <Badge variant="live" size="sm">{formatBadgeText("live")}</Badge>
                          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                            {formatUIText(`${contest.contestType} · ${contest.currentEntries} joined`)}
                          </Text>
                        </XStack>
                      </YStack>
                      {livePoints && (
                        <YStack alignItems="flex-end" gap={1}>
                          <Text fontFamily="$mono" fontWeight="700" fontSize={15} color="$accentBackground">
                            {livePoints}
                          </Text>
                          {liveRank && (
                            <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{liveRank}</Text>
                          )}
                        </YStack>
                      )}
                    </XStack>
                    {mc?.name && (
                      <XStack
                        paddingHorizontal="$4"
                        paddingBottom="$3"
                        alignItems="center"
                        gap="$2"
                        onPress={(e: any) => { e.stopPropagation(); router.push(`/team/${mc.id}`); }}
                        cursor="pointer"
                      >
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">team:</Text>
                        <Text fontFamily="$body" fontWeight="600" fontSize={11} color="$accentBackground" numberOfLines={1}>
                          {mc.name}
                        </Text>
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">→</Text>
                      </XStack>
                    )}
                  </Card>
                );
              })}
            </Animated.View>
          );
        })()}

        {/* ── Contests (before match starts) ── */}
        {!matchStarted && (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            {dbContests.length > 0 ? (
              <>
                <XStack alignItems="center" gap="$2" marginBottom="$3">
                  <Text fontSize={14}>🏟️</Text>
                  <Text {...textStyles.sectionHeader}>
                    {formatUIText("contests")}
                  </Text>
                </XStack>
                {dbContests.map((contest: any, i: number) => {
                  const isJoined = myContestIds.has(contest.id);
                  const isFull = contest.currentEntries >= contest.maxEntries;
                  const isUnlimited = contest.maxEntries >= 10000;
                  return (
                    <ContestOption
                      key={contest.id}
                      title={contest.name}
                      subtitle={isUnlimited
                        ? `${contest.contestType} · ${contest.currentEntries} joined`
                        : `${contest.contestType} · ${contest.currentEntries}/${contest.maxEntries} joined`}
                      prize={contest.prizePool > 0 ? `${contest.prizePool.toLocaleString()} pc` : "glory"}
                      entry={contest.entryFee === 0 ? "free" : String(contest.entryFee)}
                      spots={isUnlimited ? "open" : `${contest.maxEntries - contest.currentEntries}`}
                      joined={isJoined}
                      onPlay={!isJoined && !isFull && match?.draftEnabled ? () => goToTeamCreate(contest.id) : undefined}
                      highlight={(() => {
                        if (isFull) return false;
                        const fillRate = contest.maxEntries > 0 ? contest.currentEntries / contest.maxEntries : 0;
                        if (fillRate < 0.5) return false;
                        const eligibleContests = (dbContests ?? []).filter((c: any) => c.currentEntries < c.maxEntries && c.maxEntries > 0);
                        const maxFill = Math.max(...eligibleContests.map((c: any) => c.currentEntries / c.maxEntries), 0);
                        return fillRate === maxFill;
                      })()}
                      testID={`contest-${i}`}
                    />
                  );
                })}
              </>
            ) : match?.draftEnabled && user && (
              <Card padding="$5" marginBottom="$3" alignItems="center" borderColor="$borderColor" borderWidth={1}>
                <Text fontFamily="$mono" fontSize={13} fontWeight="600" color="$color" textAlign="center" marginBottom="$1">
                  {formatUIText("no contests yet")}
                </Text>
                <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center" marginBottom="$4">
                  {formatUIText("create a league or join one to play this match")}
                </Text>
                <Button
                  variant="primary"
                  size="md"
                  testID="play-this-match-btn"
                  onPress={() => goToTeamCreate()}
                >
                  {formatUIText("play this match")}
                </Button>
              </Card>
            )}
          </Animated.View>
        )}

        {/* ── My Duels (H2H contests for this match) ── */}
        {user && dbMatchUuid && (() => {
          const myH2HContests = allDbContests.filter((c: any) => c.contestType === "h2h" && myContestIds.has(c.id));
          if (myH2HContests.length === 0) return null;
          return (
            <Animated.View entering={FadeInDown.delay(120).springify()}>
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Text fontSize={14}>⚔️</Text>
                <Text {...textStyles.sectionHeader}>{formatUIText("your duels")}</Text>
              </XStack>
              {myH2HContests.map((duel: any) => {
                const isFull = duel.currentEntries >= duel.maxEntries;
                const duelData = matchStarted
                  ? (myContestsQuery.data ?? []).find((c: any) => c.contestId === duel.id)
                  : null;
                return (
                  <Card
                    key={duel.id}
                    pressable
                    padding="$4"
                    marginBottom="$2"
                    borderWidth={1}
                    borderColor="$borderColor"
                    onPress={() => router.push(`/contest/${duel.id}`)}
                    testID={`duel-${duel.id}`}
                  >
                    <YStack gap="$2">
                      <XStack alignItems="center" justifyContent="space-between">
                        <YStack flex={1} gap="$1">
                          <XStack alignItems="center" gap="$2">
                            <Badge variant={matchStarted && isFull ? "live" : isFull ? "role" : "warning"} size="sm">
                              {matchStarted && isFull ? formatBadgeText("live") : isFull ? formatBadgeText("matched") : formatBadgeText("waiting")}
                            </Badge>
                            {duel.entryFee > 0 && (
                              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                                {duel.entryFee} PC stake
                              </Text>
                            )}
                          </XStack>
                          <Text fontFamily="$body" fontSize={12} color="$colorMuted" numberOfLines={1}>
                            {duel.name}
                          </Text>
                        </YStack>
                        {matchStarted && duelData?.totalPoints != null ? (
                          <YStack alignItems="flex-end" gap={1}>
                            <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$accentBackground">
                              {duelData.totalPoints.toFixed(1)}
                            </Text>
                            {duelData.rank && (
                              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                                #{duelData.rank} of {duelData.totalEntries}
                              </Text>
                            )}
                          </YStack>
                        ) : (
                          <Text fontFamily="$mono" fontSize={12} color="$colorMuted">→</Text>
                        )}
                      </XStack>
                      {duelData?.name && (
                        <XStack
                          alignItems="center"
                          gap="$2"
                          onPress={(e: any) => { e.stopPropagation(); router.push(`/team/${duelData.id}`); }}
                          cursor="pointer"
                        >
                          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">team:</Text>
                          <Text fontFamily="$body" fontWeight="600" fontSize={11} color="$accentBackground" numberOfLines={1}>
                            {duelData.name}
                          </Text>
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">→</Text>
                        </XStack>
                      )}
                    </YStack>
                  </Card>
                );
              })}
            </Animated.View>
          );
        })()}

        {/* ── Scoring Rules during live ── */}
        {isLive && (
          <Animated.View entering={FadeInDown.delay(140).springify()}>
            <YStack marginBottom="$3">
              <ScoringRulesCard format={match?.format} testID="live-scoring-rules" />
            </YStack>
          </Animated.View>
        )}

        {/* ── FDR / AI Tools — only when draft is open and before match starts ── */}
        {!matchStarted && match?.draftEnabled && (
          <>
            {/* ── AI Tools — upsell after primary CTA ── */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Text fontSize={14}>🤖</Text>
                <Text {...textStyles.sectionHeader}>{formatUIText("explore")}</Text>
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

              {/* Scoring Rules — always visible */}
              <YStack marginBottom="$3">
                <ScoringRulesCard format={match?.format} testID="match-scoring-rules" />
              </YStack>
            </Animated.View>
          </>
        )}

        {/* ── Points Breakdown (completed matches only) ── */}
        {isCompleted && canAccess("hasPointsBreakdown") && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
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
                <Card padding="$3" marginBottom="$3" marginTop={-8}>
                  {pointsBreakdownQuery.isLoading ? (
                    <EggLoadingSpinner size={24} message={formatUIText("calculating breakdown")} />
                  ) : pointsBreakdownQuery.data && pointsBreakdownQuery.data.length > 0 ? (
                    <YStack gap="$1">
                      {pointsBreakdownQuery.data.map((p: any, i: number) => {
                        const roleKey = (({ batsman: "BAT", bowler: "BOWL", all_rounder: "AR", wicket_keeper: "WK" }) as Record<string, string>)[p.role] ?? "BAT";
                        return (
                          <Card key={p.playerId || i} padding="$3" marginBottom="$1">
                            <XStack alignItems="center">
                              <InitialsAvatar name={p.playerName} playerRole={roleKey} ovr={Math.round(p.totalFantasyPoints)} size={32} imageUrl={p.photoUrl} />
                              <YStack flex={1} marginLeft="$2">
                                <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" numberOfLines={1}>{p.playerName}</Text>
                                <XStack alignItems="center" gap="$1" marginTop={2}>
                                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{p.team ?? ""}</Text>
                                  <Badge variant="default" size="sm">{formatBadgeText(roleKey)}</Badge>
                                </XStack>
                              </YStack>
                              <Text fontFamily="$mono" fontWeight="800" fontSize={15} color="$accentBackground">{p.totalFantasyPoints}</Text>
                            </XStack>
                            <XStack flexWrap="wrap" gap="$1" marginTop="$2">
                              {(p.categories ?? []).filter((c: any) => c.points !== 0).map((c: any, ci: number) => (
                                <Badge key={ci} variant={c.points > 0 ? "role" : "default"} size="sm">
                                  {`${c.label}: ${c.stat} (${c.points > 0 ? "+" : ""}${c.points})`}
                                </Badge>
                              ))}
                            </XStack>
                          </Card>
                        );
                      })}
                    </YStack>
                  ) : (
                    <Text {...textStyles.hint} textAlign="center">{formatUIText("no scoring data available")}</Text>
                  )}
                </Card>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* ── Tournament link (subtle footer) ── */}
        {tournament && (
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <Card
              pressable
              testID="tournament-footer-card"
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

      {/* H2H Stake Picker Modal */}
      {dbMatchUuid && (
        <StakePickerModal
          visible={showStakePicker}
          onClose={() => setShowStakePicker(false)}
          onConfirm={(stake) => {
            setShowStakePicker(false);
            // Defer H2H contest creation — store stake in flowState, create contest only when team is submitted
            setFlowState({
              step: "team_build",
              contestType: "h2h",
              contestName: `${user?.displayName || user?.username || "My"}'s H2H Duel`,
              entryFee: stake,
              stake,
            });
            setMatchContext({ matchId: dbMatchUuid!, teamA, teamB, format, venue: venue || undefined, tournament: tournament || undefined });
            router.push("/team/create");
          }}
          teamA={teamA}
          teamB={teamB}
          userBalance={walletQuery.data?.coinBalance ?? 0}
          isCreating={false}
        />
      )}

      <Paywall {...paywallProps} />
    </YStack>
  );
}
