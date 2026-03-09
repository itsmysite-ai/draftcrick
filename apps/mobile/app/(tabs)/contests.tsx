import {
  FlatList,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  SegmentTab,
  ModeToggle,
  AnnouncementBanner,
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
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";

// ─── Helpers ─────────────────────────────────────────────────────────
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

// ─── Match Contest Card ──────────────────────────────────────────────
// Business-focused: match as the entry point to contests & team creation
function MatchContestCard({
  match,
  index,
  onPress,
}: {
  match: any;
  index: number;
  onPress: () => void;
}) {
  const teamA = formatTeamName(match.teamA || match.teamHome || "TBA");
  const teamB = formatTeamName(match.teamB || match.teamAway || "TBA");
  const tournament = match.tournamentName || match.tournament || "Cricket";
  const isLive = match.status === "live";
  const startTime = parseSafeDate(match.date, match.time);
  const { scoreA, scoreB, oversA, oversB } = parseTeamScores(match.scoreSummary);
  const teamARole = getTeamRole(match.tossWinner, match.tossDecision, teamA);
  const isCompleted = match.status === "completed";
  const teamAWon = didTeamAWin(match.result, teamA);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <Card pressable onPress={onPress} marginBottom="$3" padding={0} overflow="hidden" testID={`contest-match-card-${index}`}>
        {/* Match header */}
        <YStack padding="$4" paddingBottom="$3">
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
              {formatBadgeText(tournament)}
            </Text>
            <Badge variant={isLive ? "live" : "default"} size="sm">
              {isLive ? formatBadgeText("live") : formatCountdown(startTime)}
            </Badge>
          </XStack>

          {/* Teams row */}
          <XStack alignItems="center" justifyContent="center" gap="$3">
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

          {match.result && (
            <Text fontFamily="$body" fontWeight="700" fontSize={11} color="$accentBackground" textAlign="center" marginTop={2}>
              {match.result}
            </Text>
          )}

          {/* Toss — smaller when score is showing */}
          {match.tossWinner && (
            <XStack alignSelf="center" alignItems="center" gap={6} marginTop={4} opacity={match.scoreSummary ? 0.6 : 1}>
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

        {/* CTA strip — the business conversion point */}
        <XStack
          backgroundColor="$backgroundSurfaceAlt"
          paddingVertical="$3"
          paddingHorizontal="$4"
          justifyContent="space-between"
          alignItems="center"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          {isCompleted ? (
            <XStack flex={1} justifyContent="center" alignItems="center">
              <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorMuted">
                {formatUIText("match completed · view results")}
              </Text>
            </XStack>
          ) : (
            <>
              <YStack gap={2}>
                <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorAccent">
                  {formatUIText("mega contest")}
                </Text>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {formatUIText("free entry · win prizes")}
                </Text>
              </YStack>

              <Button
                variant="primary"
                size="sm"
                onPress={onPress}
                testID={`join-contest-btn-${index}`}
              >
                {formatUIText(isLive ? "view contest" : "create team")}
              </Button>
            </>
          )}
        </XStack>
      </Card>
    </Animated.View>
  );
}

// ─── User Contest Card (My Contests tab) ─────────────────────────────
function UserContestCard({
  item,
  index,
  onPress,
}: {
  item: any;
  index: number;
  onPress: () => void;
}) {
  const contest = item.contest;
  const match = item.match ?? contest?.match;
  const status = contest?.status ?? (match?.status === "completed" ? "settled" : match?.status === "live" ? "live" : "open");
  const hasContest = !!contest;

  const statusConfig: Record<string, { color: string; bg: string }> = {
    live: { color: "$error", bg: "$errorLight" },
    settling: { color: "$colorAccent", bg: "$colorAccentLight" },
    settled: { color: "$colorAccent", bg: "$colorAccentLight" },
    completed: { color: "$colorAccent", bg: "$colorAccentLight" },
    cancelled: { color: "$colorMuted", bg: "$backgroundHover" },
    open: { color: "$colorCricket", bg: "$colorCricketLight" },
    upcoming: { color: "#5DA8B8", bg: "rgba(93, 168, 184, 0.1)" },
  };
  const cfg = statusConfig[status] ?? statusConfig.open!;

  const teamCount = Array.isArray(item.players) ? item.players.length : 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card pressable onPress={onPress} marginBottom="$3" padding={0} overflow="hidden">
        <XStack justifyContent="space-between" alignItems="flex-start" padding="$4" paddingBottom="$3">
          <YStack flex={1}>
            <Text fontFamily="$body" fontWeight="600" fontSize={15} color="$color" numberOfLines={1} marginBottom={2}>
              {contest?.name ?? (match ? `${formatTeamName(match.teamHome)} vs ${formatTeamName(match.teamAway)}` : "My Team")}
            </Text>
            {match && (
              <XStack alignItems="center" gap="$2">
                <Text fontFamily="$body" fontSize={12} color="$colorSecondary">
                  {hasContest ? `${formatTeamName(match.teamHome)} vs ${formatTeamName(match.teamAway)}` : (match.tournament ?? "Cricket")}
                </Text>
                {match.format && (
                  <Badge variant="default" size="sm">{formatBadgeText(match.format)}</Badge>
                )}
              </XStack>
            )}
          </YStack>
          <YStack alignItems="flex-end" gap={3}>
            <Badge backgroundColor={cfg.bg as any} color={cfg.color as any} size="sm" fontWeight="700">
              {status.toUpperCase()}
            </Badge>
            {!hasContest && (
              <Text fontFamily="$mono" fontSize={8} color="$colorMuted" letterSpacing={0.5}>
                {formatBadgeText("free play")}
              </Text>
            )}
          </YStack>
        </XStack>

        {/* Score for live/completed matches */}
        {match?.scoreSummary && (
          <YStack paddingHorizontal="$4" paddingBottom="$2">
            <Text
              fontFamily="$mono"
              fontWeight="800"
              fontSize={13}
              color={match.status === "live" ? "$color" : "$colorCricket"}
              textAlign="center"
            >
              {match.scoreSummary}
            </Text>
          </YStack>
        )}

        {/* Stats */}
        <XStack borderTopWidth={1} borderTopColor="$borderColor" paddingVertical="$3" marginHorizontal="$4">
          {/* Rank badge (#6) */}
          {item.rank && (
            <>
              <YStack flex={1} alignItems="center">
                <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
                  Rank
                </Text>
                <Text fontFamily="$mono" fontWeight="800" fontSize={16} color="$accentBackground">
                  #{item.rank}
                </Text>
                {item.totalEntries && (
                  <Text fontFamily="$mono" fontSize={8} color="$colorMuted">
                    of {item.totalEntries}
                  </Text>
                )}
              </YStack>
              <YStack width={1} backgroundColor="$borderColor" />
            </>
          )}
          <YStack flex={1} alignItems="center">
            <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
              Points
            </Text>
            <XStack alignItems="baseline" gap={4}>
              <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color">
                {item.totalPoints.toFixed(1)}
              </Text>
              {/* Points delta (#10) — show when live/settled and has points */}
              {(status === "live" || status === "settled") && item.totalPoints > 0 && (
                <Text fontFamily="$mono" fontWeight="700" fontSize={11} color="$accentBackground">
                  +{item.totalPoints.toFixed(0)}
                </Text>
              )}
            </XStack>
          </YStack>
          <YStack width={1} backgroundColor="$borderColor" />
          <YStack flex={1} alignItems="center">
            <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
              Players
            </Text>
            <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color">
              {teamCount}
            </Text>
          </YStack>
          {hasContest && (
            <>
              <YStack width={1} backgroundColor="$borderColor" />
              <YStack flex={1} alignItems="center">
                <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
                  Prize
                </Text>
                <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$colorAccent">
                  {contest.prizePool > 0 ? `${contest.prizePool.toLocaleString()} PC` : "FREE"}
                </Text>
              </YStack>
              <YStack width={1} backgroundColor="$borderColor" />
              <YStack flex={1} alignItems="center">
                <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
                  Entry
                </Text>
                <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color">
                  {contest.entryFee === 0 ? "FREE" : `${contest.entryFee} PC`}
                </Text>
              </YStack>
            </>
          )}
          {!hasContest && (
            <>
              <YStack width={1} backgroundColor="$borderColor" />
              <YStack flex={1} alignItems="center">
                <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
                  Credits
                </Text>
                <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color">
                  {item.creditsUsed ?? "-"}
                </Text>
              </YStack>
            </>
          )}
        </XStack>
      </Card>
    </Animated.View>
  );
}

// ─── Main ────────────────────────────────────────────────────────────
export default function ContestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"matches" | "my">("matches");

  // Match data
  const aiData = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60_000, retry: 1 },
  );

  // DB matches for toss/score enrichment
  const dbLive = trpc.match.live.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: false,
  });

  // User's contests (only when authenticated)
  const myContests = trpc.contest.myContests.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([aiData.refetch(), dbLive.refetch(), myContests.refetch()]);
    setRefreshing(false);
  }, [aiData, dbLive, myContests]);

  // Build DB lookup for toss/score enrichment
  const dbMatches = dbLive.data ?? [];
  const dbLookup = new Map<string, any>();
  for (const m of dbMatches) {
    const key = [m.teamHome, m.teamAway].map((t: string) => t.toLowerCase().trim()).sort().join("|");
    dbLookup.set(key, m);
  }

  const aiMatches = (aiData.data?.matches?.filter(
    (m) => m.status === "upcoming" || m.status === "live",
  ) ?? []).map((ai: any) => {
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
  const userContests = myContests.data ?? [];

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="contests-screen">
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$5" paddingVertical="$4">
        <XStack alignItems="center" gap="$2">
          <YStack width={4} height={20} borderRadius={2} backgroundColor="$colorAccent" />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("play")}
          </Text>
        </XStack>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      <AnnouncementBanner />

      {/* Tournament Leagues banner */}
      <Card
        pressable
        marginHorizontal="$4"
        marginTop="$2"
        padding="$3"
        onPress={() => router.push("/tournament-league/create" as any)}
        testID="tournament-leagues-banner"
      >
        <XStack alignItems="center" gap="$3">
          <Text fontSize={20}>🏆</Text>
          <YStack flex={1}>
            <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
              {formatUIText("tournament leagues")}
            </Text>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              {formatUIText("season-long fantasy with chips & awards")}
            </Text>
          </YStack>
          <Text fontFamily="$mono" fontSize={14} color="$colorMuted">→</Text>
        </XStack>
      </Card>

      {/* Tab switcher */}
      <XStack
        marginHorizontal="$5"
        marginTop="$2"
        marginBottom="$3"
        borderRadius="$3"
        backgroundColor="$backgroundSurfaceAlt"
        padding="$1"
        gap="$1"
      >
        {([
          { key: "matches" as const, label: "Join Contest", count: aiMatches.length },
          { key: "my" as const, label: "My Contests", count: userContests.length },
        ]).map((tb) => (
          <SegmentTab key={tb.key} active={tab === tb.key} onPress={() => setTab(tb.key)} testID={`contests-tab-${tb.key}`}>
            <Text fontFamily="$body" fontWeight="600" fontSize={13} color={tab === tb.key ? "$color" : "$colorMuted"}>
              {formatUIText(tb.label)}
            </Text>
            {tb.count > 0 && (
              <Text fontFamily="$mono" fontSize={11} color={tab === tb.key ? "$colorSecondary" : "$colorMuted"}>
                {tb.count}
              </Text>
            )}
          </SegmentTab>
        ))}
      </XStack>

      {tab === "matches" ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />
          }
          contentContainerStyle={{ padding: 20, paddingTop: 6, paddingBottom: 120 }}
        >
          {/* How it works — first-time hint */}
          {userContests.length === 0 && aiMatches.length > 0 && (
            <Animated.View entering={FadeInDown.delay(0).springify()}>
              <Card padding="$3" marginBottom="$3" borderWidth={1} borderColor="$colorAccentLight">
                <XStack gap="$3" alignItems="center">
                  <Text fontSize={16}>💡</Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="500" fontSize={12} color="$color">
                      {formatUIText("pick a match → build your team → win prizes")}
                    </Text>
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          )}

          {aiData.isLoading ? (
            <YStack alignItems="center" paddingVertical="$10">
              <EggLoadingSpinner size={40} message={formatUIText("loading matches")} />
            </YStack>
          ) : aiMatches.length > 0 ? (
            aiMatches.map((m, i) => (
              <MatchContestCard
                key={m.id}
                match={m}
                index={i}
                onPress={() => router.push(`/match/${encodeURIComponent(m.id)}`)}
              />
            ))
          ) : (
            <Animated.View entering={FadeIn.delay(80)}>
              <YStack alignItems="center" gap="$3" paddingVertical="$10">
                <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
                <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color">
                  {formatUIText("no matches available")}
                </Text>
                <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
                  {formatUIText("contests open when matches are scheduled")}
                </Text>
              </YStack>
            </Animated.View>
          )}
        </ScrollView>
      ) : /* ── My Contests ── */
      !user ? (
        <Animated.View entering={FadeIn.delay(80)} style={{ flex: 1 }}>
          <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$8" gap="$3">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color">
              {formatUIText("sign in to view your contests")}
            </Text>
            <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
              {formatUIText("track your fantasy teams and contest results")}
            </Text>
            <Button variant="primary" size="md" marginTop="$3" onPress={() => router.push("/auth/login")} testID="contests-signin-btn">
              {formatUIText("sign in")}
            </Button>
          </YStack>
        </Animated.View>
      ) : myContests.isLoading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <EggLoadingSpinner size={40} />
        </YStack>
      ) : userContests.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={{ flex: 1 }}>
          <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$8" gap="$3">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color">
              {formatUIText("no contests yet")}
            </Text>
            <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
              {formatUIText("join your first contest to start winning")}
            </Text>
            <Button variant="primary" size="md" marginTop="$3" onPress={() => setTab("matches")} testID="browse-matches-btn">
              {formatUIText("pick a match")}
            </Button>
          </YStack>
        </Animated.View>
      ) : (
        <FlatList
          data={userContests}
          keyExtractor={(i) => i.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />
          }
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <UserContestCard
              item={item}
              index={index}
              onPress={() => {
                if (item.contest) {
                  router.push(`/contest/${item.contest.id}`);
                } else {
                  router.push(`/team/${item.id}`);
                }
              }}
            />
          )}
        />
      )}
    </YStack>
  );
}
