import { ScrollView as RNScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback, useMemo } from "react";
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
  BackButton,
  InitialsAvatar,
  SegmentTab,
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
import { trpc } from "../../lib/trpc";

import type { AITeamStanding } from "@draftplay/shared";

// ─── Types ───────────────────────────────────────────────────────────
type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

const ROLE_MAP: Record<string, RoleKey> = {
  batsman: "BAT",
  bowler: "BOWL",
  all_rounder: "AR",
  wicket_keeper: "WK",
};

type DetailTab = "matches" | "standings" | "stats";

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

/** Format a date range */
function formatDateRange(start: string | null, end: string | null): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  if (!start && !end) return "dates tba";
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `from ${fmt(start)}`;
  return `until ${fmt(end!)}`;
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

// ─── TournamentMatchCard ─────────────────────────────────────────────
function TournamentMatchCard({
  match,
  index,
  onPress,
}: {
  match: any;
  index: number;
  onPress: () => void;
}) {
  const isLive = match.status === "live";
  const teamA = formatTeamName(match.teamA || match.teamHome || "TBA");
  const teamB = formatTeamName(match.teamB || match.teamAway || "TBA");
  const startTime = parseSafeDate(match.date, match.time);
  const isCompleted = match.status === "completed";
  const { scoreA, scoreB, oversA, oversB } = parseTeamScores(match.scoreSummary);
  const teamARole = getTeamRole(match.tossWinner, match.tossDecision, teamA);
  const teamAWon = didTeamAWin(match.result, teamA);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card pressable live={isLive} onPress={onPress} padding="$5" marginBottom="$3">
        {/* Header: format + status */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
          {match.format && (
            <Badge variant="role" size="sm">
              {formatBadgeText(match.format)}
            </Badge>
          )}
          <Badge variant={isLive ? "live" : "default"} size="sm">
            {isLive ? formatBadgeText("live") : formatCountdown(startTime)}
          </Badge>
        </XStack>

        {/* Teams */}
        <XStack alignItems="center" justifyContent="center" marginBottom="$3">
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
            <Text {...textStyles.playerName} fontSize={13} numberOfLines={1} textAlign="center">
              {teamA}
            </Text>
            {scoreA && (
              <YStack alignItems="center" gap={1}>
                <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$color">{scoreA}</Text>
                {oversA && <Text fontFamily="$mono" fontSize={9} color="$colorMuted">({oversA})</Text>}
              </YStack>
            )}
          </YStack>

          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {formatUIText("vs")}
          </Text>

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
            <Text {...textStyles.playerName} fontSize={13} numberOfLines={1} textAlign="center">
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

        {/* Footer: venue + time */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop="$2"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          <Text {...textStyles.hint} flex={1} numberOfLines={1}>
            {match.venue || match.time || ""}
          </Text>
          <Text {...textStyles.hint}>
            {match.date || ""}
          </Text>
        </XStack>
      </Card>
    </Animated.View>
  );
}

// ─── StandingsTable ──────────────────────────────────────────────────
function StandingsTable({ standings }: { standings: AITeamStanding[] }) {
  // Group by group name if any have groups
  const groups = useMemo(() => {
    const groupMap = new Map<string, AITeamStanding[]>();
    for (const s of standings) {
      const key = s.group ?? "__all__";
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(s);
    }
    // Sort each group by position
    for (const arr of groupMap.values()) {
      arr.sort((a, b) => a.position - b.position);
    }
    return groupMap;
  }, [standings]);

  return (
    <YStack gap="$4">
      {Array.from(groups.entries()).map(([groupName, rows]) => (
        <Animated.View key={groupName} entering={FadeInDown.springify()}>
          <YStack>
            {groupName !== "__all__" && (
              <Text fontFamily="$body" fontWeight="700" fontSize={14} color="$color" marginBottom="$2">
                {formatUIText(groupName)}
              </Text>
            )}

            {/* Header row */}
            <XStack
              paddingVertical="$2"
              paddingHorizontal="$3"
              backgroundColor="$backgroundSurfaceAlt"
              borderRadius="$2"
              marginBottom="$1"
            >
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={24}>#</Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" flex={1}>TEAM</Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={24} textAlign="center">P</Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={24} textAlign="center">W</Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={24} textAlign="center">L</Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={30} textAlign="center">PTS</Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" width={48} textAlign="right">NRR</Text>
            </XStack>

            {/* Data rows */}
            {rows.map((row) => (
              <XStack
                key={`${groupName}-${row.position}-${row.team}`}
                paddingVertical="$2"
                paddingHorizontal="$3"
                borderBottomWidth={1}
                borderBottomColor="$borderColor"
                alignItems="center"
              >
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted" width={24}>
                  {row.position}
                </Text>
                <Text fontFamily="$body" fontSize={12} color="$color" flex={1} numberOfLines={1}>
                  {row.team}
                </Text>
                <Text fontFamily="$mono" fontSize={12} color="$color" width={24} textAlign="center">
                  {row.played}
                </Text>
                <Text fontFamily="$mono" fontSize={12} color="$color" width={24} textAlign="center">
                  {row.won}
                </Text>
                <Text fontFamily="$mono" fontSize={12} color="$color" width={24} textAlign="center">
                  {row.lost}
                </Text>
                <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$colorCricket" width={30} textAlign="center">
                  {row.points}
                </Text>
                <Text
                  fontFamily="$mono"
                  fontSize={11}
                  color={row.netRunRate.startsWith("+") ? "$green10" : "$red10"}
                  width={48}
                  textAlign="right"
                >
                  {row.netRunRate}
                </Text>
              </XStack>
            ))}
          </YStack>
        </Animated.View>
      ))}
    </YStack>
  );
}

// ─── Main ────────────────────────────────────────────────────────────
export default function TournamentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentName = decodeURIComponent(id ?? "");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();

  const [detailTab, setDetailTab] = useState<DetailTab>("matches");
  const [refreshing, setRefreshing] = useState(false);

  // ── tRPC queries ──
  const dashboardQuery = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60_000, retry: 1 },
  );
  const playersQuery = trpc.player.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  // DB matches for toss/score enrichment
  const dbLive = trpc.match.live.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });

  // ── Find tournament + filter matches (enriched with DB toss/score) ──
  const tournament = (dashboardQuery.data?.tournaments ?? []).find(
    (t: any) => t.name === tournamentName,
  );

  const dbMatchesRaw = dbLive.data ?? [];
  const dbLookup = new Map<string, any>();
  for (const m of dbMatchesRaw) {
    const key = [m.teamHome, m.teamAway].map((t: string) => t.toLowerCase().trim()).sort().join("|");
    dbLookup.set(key, m);
  }

  const tournamentMatches = (dashboardQuery.data?.matches ?? [])
    .filter((m: any) => (m.tournamentName ?? "") === tournamentName)
    .map((ai: any) => {
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

  // ── Standings query ──
  const standingsQuery = trpc.sports.standings.useQuery(
    { tournamentName, sport: "cricket" },
    { staleTime: 60 * 60_000 },
  );

  // ── Top players by credits, grouped by role (filtered to this tournament's teams) ──
  const topPlayers = useMemo(() => {
    const raw = (playersQuery.data ?? []) as any[];

    // Extract team names from this tournament's matches
    const tournamentTeams = new Set<string>();
    for (const m of tournamentMatches) {
      const match = m as any;
      if (match.teamA) tournamentTeams.add(match.teamA);
      if (match.teamHome) tournamentTeams.add(match.teamHome);
      if (match.teamB) tournamentTeams.add(match.teamB);
      if (match.teamAway) tournamentTeams.add(match.teamAway);
    }

    // If no teams found from matches, return empty (don't fall back to showing all players)
    if (tournamentTeams.size === 0) {
      return { BAT: [], BOWL: [], AR: [], WK: [] } as Record<RoleKey, any[]>;
    }

    const mapped = raw
      .filter((p: any) => tournamentTeams.has(p.team as string))
      .map((p: any) => {
        const stats =
          typeof p.stats === "string" ? JSON.parse(p.stats) : p.stats ?? {};
        return {
          id: p.id as string,
          name: p.name as string,
          role: ROLE_MAP[p.role as string] ?? ("BAT" as RoleKey),
          team: (p.team as string) ?? "???",
          credits: (stats.credits as number) ?? 8,
          battingAvg: (stats.average as number) ?? null,
          bowlingAvg: (stats.bowlingAverage as number) ?? null,
        };
      });
    // Top 5 per role
    const grouped: Record<RoleKey, typeof mapped> = { BAT: [], BOWL: [], AR: [], WK: [] };
    for (const p of mapped) {
      if (grouped[p.role]) grouped[p.role].push(p);
    }
    for (const role of Object.keys(grouped) as RoleKey[]) {
      grouped[role] = grouped[role].sort((a, b) => b.credits - a.credits).slice(0, 5);
    }
    return grouped;
  }, [playersQuery.data, tournamentMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([dashboardQuery.refetch(), playersQuery.refetch(), standingsQuery.refetch()]);
    setRefreshing(false);
  }, [dashboardQuery, playersQuery, standingsQuery]);

  // ── Loading ──
  if (dashboardQuery.isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" paddingTop={insets.top} backgroundColor="$background">
        <EggLoadingSpinner size={48} message={formatUIText("loading tournament")} />
      </YStack>
    );
  }

  // ── Not found ──
  if (!tournament) {
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
              {formatUIText("tournament")}
            </Text>
          </XStack>
          <ModeToggle mode={mode} onToggle={toggleMode} />
        </XStack>
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
          <CricketBatIcon size={DesignSystem.emptyState.iconSize} />
          <Text {...textStyles.playerName}>{formatUIText("tournament not found")}</Text>
          <Text {...textStyles.hint}>{formatUIText("this tournament may no longer be active")}</Text>
          <Button variant="primary" size="md" marginTop="$3" onPress={() => router.back()}>
            {formatUIText("go back")}
          </Button>
        </YStack>
      </YStack>
    );
  }

  const t = tournament as any;

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
            {formatUIText("tournament")}
          </Text>
        </XStack>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      {/* ── Tournament Header ── */}
      <Animated.View entering={FadeIn.delay(0)}>
        <YStack paddingHorizontal="$5" paddingBottom="$4">
          <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" marginBottom="$2">
            {t.name}
          </Text>
          <XStack alignItems="center" gap="$2" marginBottom="$2">
            <Badge variant="role" size="sm">
              {formatBadgeText(t.category)}
            </Badge>
            <Text {...textStyles.secondary}>
              {tournamentMatches.length} {formatUIText(tournamentMatches.length === 1 ? "match" : "matches")}
            </Text>
          </XStack>
          <Text {...textStyles.hint}>
            {formatUIText(formatDateRange(t.startDate, t.endDate))}
          </Text>
        </YStack>
      </Animated.View>

      {/* ── Detail Tabs ── */}
      <XStack
        marginHorizontal="$5"
        marginBottom="$3"
        borderRadius="$3"
        backgroundColor="$backgroundSurfaceAlt"
        padding="$1"
        gap="$1"
      >
        {([
          { key: "matches" as const, label: "matches", count: tournamentMatches.length },
          { key: "standings" as const, label: "standings", count: (standingsQuery.data ?? []).length },
          { key: "stats" as const, label: "stats", count: Object.values(topPlayers).flat().length },
        ]).map((tb) => (
          <SegmentTab key={tb.key} active={detailTab === tb.key} onPress={() => setDetailTab(tb.key)}>
            <Text
              fontFamily="$body"
              fontWeight="600"
              fontSize={13}
              color={detailTab === tb.key ? "$color" : "$colorMuted"}
            >
              {formatUIText(tb.label)}
            </Text>
            <Text fontFamily="$mono" fontSize={11} color={detailTab === tb.key ? "$colorSecondary" : "$colorMuted"}>
              {tb.count}
            </Text>
          </SegmentTab>
        ))}
      </XStack>

      {/* ── Matches Tab ── */}
      {detailTab === "matches" && (
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
          {tournamentMatches.length > 0 ? (
            tournamentMatches.map((m: any, i: number) => (
              <TournamentMatchCard
                key={m.id}
                match={m}
                index={i}
                onPress={() => {
                  router.push(`/match/${encodeURIComponent(m.id)}`);
                }}
              />
            ))
          ) : (
            <Animated.View entering={FadeIn.delay(80)}>
              <YStack alignItems="center" gap="$3" paddingVertical="$10">
                <CricketBatIcon size={DesignSystem.emptyState.iconSize} />
                <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                  {formatUIText("no matches scheduled")}
                </Text>
                <Text {...textStyles.hint} textAlign="center" lineHeight={18}>
                  {formatUIText("matches will appear here when they're announced")}
                </Text>
              </YStack>
            </Animated.View>
          )}
        </RNScrollView>
      )}

      {/* ── Standings Tab ── */}
      {detailTab === "standings" && (
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
          {standingsQuery.isLoading ? (
            <YStack alignItems="center" paddingVertical="$10">
              <EggLoadingSpinner size={40} message={formatUIText("loading standings")} />
            </YStack>
          ) : (standingsQuery.data ?? []).length > 0 ? (
            <StandingsTable standings={standingsQuery.data!} />
          ) : (
            <Animated.View entering={FadeIn.delay(80)}>
              <YStack alignItems="center" gap="$3" paddingVertical="$10">
                <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
                <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                  {formatUIText("no standings available")}
                </Text>
                <Text {...textStyles.hint} textAlign="center" lineHeight={18}>
                  {formatUIText("standings will appear once tournament matches begin")}
                </Text>
              </YStack>
            </Animated.View>
          )}
        </RNScrollView>
      )}

      {/* ── Stats Tab ── */}
      {detailTab === "stats" && (
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
          {playersQuery.isLoading ? (
            <YStack alignItems="center" paddingVertical="$10">
              <EggLoadingSpinner size={40} message={formatUIText("loading players")} />
            </YStack>
          ) : (
            (["BAT", "BOWL", "AR", "WK"] as RoleKey[]).map((role) => (
              <Animated.View key={role} entering={FadeInDown.delay(({ BAT: 0, BOWL: 50, AR: 100, WK: 150 })[role]).springify()}>
                <YStack marginBottom="$5">
                  <XStack alignItems="center" gap="$2" marginBottom="$3">
                    <Text fontSize={16}>{DesignSystem.roles[role].emoji}</Text>
                    <Text {...textStyles.sectionHeader}>
                      {formatUIText(`top ${DesignSystem.roles[role].name.toLowerCase()}`)}
                    </Text>
                  </XStack>

                  {topPlayers[role].length > 0 ? (
                    topPlayers[role].map((p, i) => (
                      <Card key={p.id} marginBottom="$2" padding="$3">
                        <XStack alignItems="center" gap="$3">
                          <Text fontFamily="$mono" fontSize={11} color="$colorMuted" width={16} textAlign="center">
                            {i + 1}
                          </Text>
                          <InitialsAvatar name={p.name} playerRole={p.role} ovr={p.credits * 10} size={36} />
                          <YStack flex={1}>
                            <Text {...textStyles.playerName} fontSize={13}>
                              {p.name}
                            </Text>
                            <XStack gap="$2" alignItems="center">
                              <Text {...textStyles.secondary}>{p.team}</Text>
                              {p.battingAvg != null && (
                                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                                  bat {p.battingAvg.toFixed(1)}
                                </Text>
                              )}
                              {p.bowlingAvg != null && (
                                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                                  bowl {p.bowlingAvg.toFixed(1)}
                                </Text>
                              )}
                            </XStack>
                          </YStack>
                          <YStack alignItems="center">
                            <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">
                              {p.credits.toFixed(1)}
                            </Text>
                            <Text {...textStyles.hint}>{formatUIText("cr")}</Text>
                          </YStack>
                        </XStack>
                      </Card>
                    ))
                  ) : (
                    <Text {...textStyles.hint} marginLeft="$6">
                      {formatUIText("no players available")}
                    </Text>
                  )}
                </YStack>
              </Animated.View>
            ))
          )}
        </RNScrollView>
      )}
    </YStack>
  );
}
