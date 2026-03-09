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
  ModeToggle,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
  CricketBatIcon,
  CricketBallIcon,
  DraftPlayLogo,
} from "@draftplay/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";
import { trpc } from "../../lib/trpc";

// ─── Helpers ─────────────────────────────────────────────────────────
function parseSafeDate(dateStr?: string, timeStr?: string): Date {
  if (!dateStr) return new Date();
  const cleanTime = (timeStr ?? "").replace(/\s+[A-Z]{2,4}$/, "");
  const parsed = new Date(`${dateStr} ${cleanTime}`);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
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

function parseTeamScores(scoreSummary: string | null | undefined) {
  if (!scoreSummary) return { scoreA: null, scoreB: null, oversA: null, oversB: null };
  const parts = scoreSummary.split(/\s+vs\s+/i);
  const extract = (part: string) => {
    const s = part.match(/(\d+\/\d+)/);
    const o = part.match(/\(([^)]+)\)/);
    return { score: s ? s[1] : null, overs: o ? o[1] : null };
  };
  const a = parts[0] ? extract(parts[0]) : { score: null, overs: null };
  const b = parts[1] ? extract(parts[1]) : { score: null, overs: null };
  return { scoreA: a.score, scoreB: b.score, oversA: a.overs, oversB: b.overs };
}

function didTeamAWin(result: string | null, teamA: string): boolean | null {
  if (!result) return null;
  const r = result.toLowerCase();
  if (r.includes("no result") || r.includes("tied") || r.includes("draw")) return null;
  return r.includes(teamA.toLowerCase().slice(0, 4));
}

function getTeamRole(tossWinner: string | null, tossDecision: string | null, teamA: string): "bat" | "bowl" | null {
  if (!tossWinner || !tossDecision) return null;
  const winnerChoseBat = tossDecision.toLowerCase().includes("bat");
  const teamAWonToss = tossWinner.toLowerCase().includes(teamA.toLowerCase().slice(0, 4));
  if (teamAWonToss) return winnerChoseBat ? "bat" : "bowl";
  return winnerChoseBat ? "bowl" : "bat";
}

// ─── Featured Match Card — drives user to create team ────────────────
function FeaturedMatchCard({
  match,
  onPress,
}: {
  match: any;
  onPress: () => void;
}) {
  const teamA = formatTeamName(match.teamA || match.teamHome || "TBA");
  const teamB = formatTeamName(match.teamB || match.teamAway || "TBA");
  const startTime = parseSafeDate(match.date, match.time);
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const { scoreA, scoreB, oversA, oversB } = parseTeamScores(match.scoreSummary);
  const teamARole = getTeamRole(match.tossWinner, match.tossDecision, teamA);
  const teamAWon = didTeamAWin(match.result, teamA);

  return (
    <Card pressable live={isLive} onPress={onPress} padding={0} overflow="hidden" testID="featured-match-card">
      <YStack padding="$4" paddingBottom="$3">
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
            {formatBadgeText(match.tournamentName || match.tournament || "cricket")}
          </Text>
          <Badge variant={isLive ? "live" : "default"} size="sm">
            {isLive ? formatBadgeText("live") : formatCountdown(startTime)}
          </Badge>
        </XStack>

        <XStack alignItems="center" justifyContent="center" gap="$4">
          <YStack flex={1} alignItems="center" gap={4}>
            <InitialsAvatar
              name={teamA} playerRole="BAT" ovr={0} size={42}
              hideBadge={isCompleted ? teamAWon !== true : !isLive || !teamARole}
              badgeContent={
                isCompleted && teamAWon === true
                  ? <Text fontSize={10} lineHeight={14}>🏆</Text>
                  : isLive && teamARole
                    ? (teamARole === "bat" ? <CricketBatIcon size={14} /> : <CricketBallIcon size={10} />)
                    : undefined
              }
            />
            <Text {...textStyles.playerName} fontSize={12} numberOfLines={1} textAlign="center">
              {teamA}
            </Text>
            {scoreA && (
              <YStack alignItems="center" gap={1}>
                <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$color">{scoreA}</Text>
                {oversA && <Text fontFamily="$mono" fontSize={9} color="$colorMuted">({oversA})</Text>}
              </YStack>
            )}
          </YStack>

          <YStack alignItems="center">
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              {formatUIText("vs")}
            </Text>
            {match.format && (
              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                {formatBadgeText(match.format)}
              </Text>
            )}
          </YStack>

          <YStack flex={1} alignItems="center" gap={4}>
            <InitialsAvatar
              name={teamB} playerRole="BOWL" ovr={0} size={42}
              hideBadge={isCompleted ? teamAWon !== false : !isLive || !teamARole}
              badgeContent={
                isCompleted && teamAWon === false
                  ? <Text fontSize={10} lineHeight={14}>🏆</Text>
                  : isLive && teamARole
                    ? (teamARole === "bat" ? <CricketBallIcon size={10} /> : <CricketBatIcon size={14} />)
                    : undefined
              }
            />
            <Text {...textStyles.playerName} fontSize={12} numberOfLines={1} textAlign="center">
              {teamB}
            </Text>
            {scoreB && (
              <YStack alignItems="center" gap={1}>
                <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$color">{scoreB}</Text>
                {oversB && <Text fontFamily="$mono" fontSize={9} color="$colorMuted">({oversB})</Text>}
              </YStack>
            )}
          </YStack>
        </XStack>

        {/* Result */}
        {match.result && (
          <Text fontFamily="$body" fontWeight="700" fontSize={11} color="$accentBackground" textAlign="center" marginTop={2}>
            {match.result}
          </Text>
        )}

        {/* Toss */}
        {match.tossWinner && (
          <XStack alignSelf="center" alignItems="center" gap={6} marginTop="$2" opacity={match.scoreSummary ? 0.6 : 1}>
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

        {match.venue && (
          <Text {...textStyles.hint} textAlign="center" marginTop="$2" fontSize={10} numberOfLines={1}>
            {match.venue}
          </Text>
        )}
      </YStack>

      {/* CTA strip */}
      <XStack
        backgroundColor="$backgroundSurfaceAlt"
        paddingVertical="$3"
        paddingHorizontal="$4"
        justifyContent="space-between"
        alignItems="center"
        borderTopWidth={1}
        borderTopColor="$borderColor"
      >
        <YStack gap={1}>
          <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorAccent">
            {formatUIText("mega contest")}
          </Text>
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {formatUIText("free entry · win prizes")}
          </Text>
        </YStack>
        <Button variant="primary" size="sm" onPress={onPress} testID="featured-create-team-btn">
          {formatUIText("create team")}
        </Button>
      </XStack>
    </Card>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string | number;
  icon: string;
  onPress?: () => void;
}) {
  return (
    <Card flex={1} padding="$3" pressable={!!onPress} onPress={onPress}>
      <XStack alignItems="center" gap="$2" marginBottom="$1">
        <Text fontSize={14}>{icon}</Text>
        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
          {formatUIText(label)}
        </Text>
      </XStack>
      <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$color">
        {value}
      </Text>
    </Card>
  );
}

// ─── Main ───────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  // ── Queries ──
  const dashboardQuery = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60_000, retry: 1 },
  );

  // DB matches for toss/score enrichment
  const dbLive = trpc.match.live.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });

  const profileQuery = trpc.auth.getProfile.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const walletQuery = trpc.wallet.getBalance.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const myTeamsQuery = trpc.team.myTeams.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const myLeaguesQuery = trpc.league.myLeagues.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const unreadQuery = trpc.notification.getUnreadCount.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dashboardQuery.refetch(),
      dbLive.refetch(),
      profileQuery.refetch(),
      walletQuery.refetch(),
      myTeamsQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [dashboardQuery, dbLive, profileQuery, walletQuery, myTeamsQuery]);

  // ── Derived data ──
  // Build DB lookup for toss/score enrichment
  const dbMatches = dbLive.data ?? [];
  const dbLookup = new Map<string, any>();
  for (const m of dbMatches) {
    const key = [m.teamHome, m.teamAway].map((t: string) => t.toLowerCase().trim()).sort().join("|");
    dbLookup.set(key, m);
  }

  const allMatches = (dashboardQuery.data?.matches ?? []).map((ai: any) => {
    const key = [ai.teamA || "", ai.teamB || ""].map((t: string) => t.toLowerCase().trim()).sort().join("|");
    const db = dbLookup.get(key);
    return {
      ...ai,
      tossWinner: ai.tossWinner || db?.tossWinner || null,
      tossDecision: ai.tossDecision || db?.tossDecision || null,
      scoreSummary: ai.scoreSummary || db?.scoreSummary || null,
      result: ai.result || db?.result || null,
    };
  });
  const upcomingMatches = allMatches.filter(
    (m: any) => m.status === "upcoming" || m.status === "live"
  );
  const nextMatch = upcomingMatches[0] ?? null;
  const otherMatches = upcomingMatches.slice(1, 4);

  const teamCount = myTeamsQuery.data?.length ?? 0;
  const leagueCount = myLeaguesQuery.data?.length ?? 0;
  const balance = walletQuery.data?.coinBalance ?? 0;
  const unread = unreadQuery.data ?? 0;
  const displayName = profileQuery.data?.displayName || user?.email?.split("@")[0] || "player";

  // ── Loading ──
  const hasData = !!dashboardQuery.data;
  if (dashboardQuery.isLoading && !hasData) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" paddingTop={insets.top} backgroundColor="$background">
        <EggLoadingSpinner size={48} message={formatUIText("loading dashboard")} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="home-screen">
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
              <DraftPlayLogo size={22} />
              <Text fontFamily="$mono" fontSize={17} fontWeight="500" color="$color" letterSpacing={-0.5}>
                draftplay.ai
              </Text>
            </XStack>
            <Text {...textStyles.hint} marginTop={3} marginLeft={30}>
              {formatUIText(`welcome, ${displayName}`)}
            </Text>
          </YStack>

          <XStack alignItems="center" gap="$3">
            {unread > 0 && (
              <Card
                pressable
                onPress={() => router.push("/settings/notifications")}
                padding="$1"
                paddingHorizontal="$2"
              >
                <XStack alignItems="center" gap={4}>
                  <Text fontSize={12}>🔔</Text>
                  <Badge variant="live" size="sm">{unread}</Badge>
                </XStack>
              </Card>
            )}
            <ModeToggle mode={mode} onToggle={toggleMode} />
          </XStack>
        </XStack>
      </Animated.View>

      <AnnouncementBanner />

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
        {/* ── Stats Row (authenticated) ── */}
        {user && (
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <XStack gap="$2" marginBottom="$4">
              <StatCard label="teams" value={teamCount} icon="👥" onPress={() => router.push("/team/create")} />
              <StatCard label="leagues" value={leagueCount} icon="🏟️" onPress={() => router.push("/(tabs)/contests")} />
              <StatCard label="pop coins" value={`${balance} PC`} icon="💰" onPress={() => router.push("/wallet")} />
            </XStack>
          </Animated.View>
        )}

        {/* ── Featured Match with CTA ── */}
        {nextMatch && (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText(nextMatch.status === "live" ? "live now — join the action" : "next match — create your team")}
            </Text>
            <FeaturedMatchCard
              match={nextMatch}
              onPress={() => router.push(`/match/${encodeURIComponent(nextMatch.id)}`)}
            />
          </Animated.View>
        )}

        {/* ── More Matches — each with play button ── */}
        {otherMatches.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).springify()}>
            <XStack justifyContent="space-between" alignItems="center" marginTop="$5" marginBottom="$2">
              <Text {...textStyles.sectionHeader}>
                {formatUIText("more matches")}
              </Text>
              <Button size="sm" variant="secondary" onPress={() => router.push("/(tabs)/contests")}>
                {formatUIText("see all")}
              </Button>
            </XStack>
            <Card>
              {otherMatches.map((m: any, i: number) => {
                const tA = formatTeamName(m.teamA || m.teamHome || "TBA");
                const tB = formatTeamName(m.teamB || m.teamAway || "TBA");
                const startTime = parseSafeDate(m.date, m.time);
                const isLast = i === otherMatches.length - 1;
                return (
                  <XStack
                    key={m.id}
                    pressStyle={{ opacity: 0.7 }}
                    onPress={() => router.push(`/match/${encodeURIComponent(m.id)}`)}
                    justifyContent="space-between"
                    alignItems="center"
                    paddingVertical="$3"
                    paddingHorizontal="$4"
                    borderBottomWidth={isLast ? 0 : 1}
                    borderBottomColor="$borderColor"
                    cursor="pointer"
                    testID={`upcoming-match-${i}`}
                  >
                    <YStack flex={1} gap={2}>
                      <Text fontFamily="$body" fontWeight="500" fontSize={13} color="$color" numberOfLines={1}>
                        {tA} {formatUIText("vs")} {tB}
                      </Text>
                      <XStack alignItems="center" gap="$2">
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                          {formatBadgeText(m.format || "T20")}
                        </Text>
                        <Badge variant="default" size="sm">
                          {formatCountdown(startTime)}
                        </Badge>
                      </XStack>
                    </YStack>
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => router.push(`/match/${encodeURIComponent(m.id)}`)}
                      testID={`play-match-btn-${i}`}
                    >
                      {formatUIText("play")}
                    </Button>
                  </XStack>
                );
              })}
            </Card>
          </Animated.View>
        )}

        {/* ── Quick Actions — Predictions, Guru, Tournaments ── */}
        <Animated.View entering={FadeInDown.delay(180).springify()}>
          <Text {...textStyles.sectionHeader} marginTop="$5" marginBottom="$2">
            {formatUIText("explore")}
          </Text>
          <XStack gap="$2" marginBottom="$4">
            <Card
              pressable
              flex={1}
              padding="$3"
              alignItems="center"
              gap="$2"
              onPress={() => router.push("/predictions" as any)}
              testID="nav-predictions"
            >
              <Text fontSize={24}>🎯</Text>
              <Text fontFamily="$mono" fontWeight="600" fontSize={11} color="$color">
                {formatUIText("predictions")}
              </Text>
            </Card>
            <Card
              pressable
              flex={1}
              padding="$3"
              alignItems="center"
              gap="$2"
              onPress={() => router.push("/guru")}
              testID="nav-guru"
            >
              <DraftPlayLogo size={24} />
              <Text fontFamily="$mono" fontWeight="600" fontSize={11} color="$color">
                {formatUIText("cricket guru")}
              </Text>
            </Card>
            <Card
              pressable
              flex={1}
              padding="$3"
              alignItems="center"
              gap="$2"
              onPress={() => router.push("/notifications/inbox" as any)}
              testID="nav-notifications"
            >
              <Text fontSize={24}>🔔</Text>
              <Text fontFamily="$mono" fontWeight="600" fontSize={11} color="$color">
                {formatUIText("inbox")}
              </Text>
            </Card>
          </XStack>
        </Animated.View>

        {/* ── Empty state ── */}
        {upcomingMatches.length === 0 && (
          <Animated.View entering={FadeIn.delay(120)}>
            <YStack alignItems="center" gap="$3" paddingVertical="$8">
              <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
              <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color">
                {formatUIText("no upcoming matches")}
              </Text>
              <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
                {formatUIText("check back soon for upcoming fixtures")}
              </Text>
            </YStack>
          </Animated.View>
        )}

        {/* ── Data freshness footer ── */}
        {dashboardQuery.data?.lastFetched && (
          <Text {...textStyles.hint} textAlign="center" marginTop="$4">
            {formatUIText(`updated ${new Date(dashboardQuery.data.lastFetched).toLocaleTimeString()}`)}
          </Text>
        )}
      </RNScrollView>
    </YStack>
  );
}
