import { ScrollView as RNScrollView, RefreshControl, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { parseTeamScores, didTeamAWin } from "../../lib/score-utils";
import { useState, useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import {
  XStack,
  YStack,
  useTheme as useTamaguiTheme,
} from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
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
import { useTheme, useSport } from "../../providers/ThemeProvider";
import { HeaderControls } from "../../components/HeaderControls";
import { DiscoverPublicLeagues } from "../../components/DiscoverPublicLeagues";
import { SubHeader } from "../../components/SubHeader";
import { useAuth } from "../../providers/AuthProvider";
import { trpc } from "../../lib/trpc";

// ─── Helpers ─────────────────────────────────────────────────────────
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

function formatCountdown(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "NOW";
  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)}d`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ─── Featured Match Card — drives user to create team ────────────────
function FeaturedMatchCard({
  match,
  onPress,
  sport = "cricket",
  getTeamLogo,
}: {
  match: any;
  onPress: () => void;
  sport?: string;
  getTeamLogo?: (name: string) => string | undefined;
}) {
  const isCricket = sport === "cricket";
  const rawTeamA = match.teamA || match.teamHome || "TBA";
  const rawTeamB = match.teamB || match.teamAway || "TBA";
  const teamA = formatTeamName(rawTeamA);
  const teamB = formatTeamName(rawTeamB);
  const startTime = parseSafeDate(match.date, match.time);
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  // Pass both abbreviated and full names so parser can match either
  const { scoreA, scoreB, oversA, oversB } = parseTeamScores(match.scoreSummary, rawTeamA, rawTeamB);
  const teamARole: "bat" | "bowl" | null = null; // Disabled — backlogged for proper implementation
  const teamAWon = didTeamAWin(match.result, rawTeamA);

  return (
    <Card pressable live={isLive} onPress={onPress} padding={0} overflow="hidden" testID="featured-match-card">
      <YStack padding="$4" paddingBottom="$3">
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
            {formatBadgeText(match.tournamentName || match.tournament || (isCricket ? "cricket" : "formula 1"))}
          </Text>
          <Badge variant={isLive ? "live" : "default"} size="sm">
            {isLive ? formatBadgeText("live") : formatCountdown(startTime)}
          </Badge>
        </XStack>

        <XStack alignItems="center" justifyContent="center" gap="$4">
          <YStack flex={1} alignItems="center" gap={4}>
            <InitialsAvatar
              name={teamA} playerRole={(isCricket ? "BAT" : "DRV") as any} ovr={0} size={42}
              imageUrl={getTeamLogo?.(match.teamA || match.teamHome || "")}
              hideBadge={isCompleted ? teamAWon !== true : isCricket ? (!isLive || !teamARole) : true}
              badgeContent={
                isCompleted && teamAWon === true
                  ? <Text fontSize={10} lineHeight={14}>🏆</Text>
                  : isLive && isCricket && teamARole
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
              name={teamB} playerRole={(isCricket ? "BOWL" : "CON") as any} ovr={0} size={42}
              imageUrl={getTeamLogo?.(match.teamB || match.teamAway || "")}
              hideBadge={isCompleted ? teamAWon !== false : isCricket ? (!isLive || !teamARole) : true}
              badgeContent={
                isCompleted && teamAWon === false
                  ? <Text fontSize={10} lineHeight={14}>🏆</Text>
                  : isLive && isCricket && teamARole
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

        {/* Toss — cricket only */}
        {isCricket && match.tossWinner && (
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

        {/* Date & Venue — match the match center gold standard */}
        <YStack alignItems="center" gap={2} marginTop="$2">
          <Text fontFamily="$mono" fontSize={11} fontWeight="500" color="$accentBackground">
            {match.date
              ? startTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                + " · "
                + startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
              : match.time || ""}
          </Text>
          {match.venue && (
            <Text {...textStyles.hint} fontSize={10} numberOfLines={2}>
              {match.venue}
            </Text>
          )}
        </YStack>
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
        {match.draftEnabled ? (
          <>
            <YStack gap={1}>
              <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorAccent">
                {formatUIText(isCricket ? "mega contest" : "grand prix contest")}
              </Text>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText(isCricket ? "free entry · win prizes" : "free entry · build your grid")}
              </Text>
            </YStack>
            <Button variant="primary" size="sm" onPress={onPress} testID="featured-create-team-btn">
              {formatUIText(isCricket ? "play" : "build grid")}
            </Button>
          </>
        ) : (
          <YStack flex={1} alignItems="center" gap={1}>
            <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorMuted">
              {formatUIText(isLive || isCompleted ? "draft closed" : "draft not open yet")}
            </Text>
            <Button variant="secondary" size="sm" onPress={onPress} testID="featured-view-match-btn" marginTop={4}>
              {formatUIText("view match")}
            </Button>
          </YStack>
        )}
      </XStack>
    </Card>
  );
}

// ─── My Contests Section ────────────────────────────────────────────
function MyContestsSection({
  contests,
  sport,
}: {
  contests: any[];
  sport: string;
}) {
  const router = useRouter();

  // Sort: live first, then upcoming (by match date), then recently settled (max 2)
  const sorted = useMemo(() => {
    const statusOrder: Record<string, number> = { live: 0, locked: 1, open: 2, settling: 3, settled: 4, cancelled: 5 };
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const active = contests
      .filter((c) => c.contest) // Only contest-linked teams
      .filter((c) => {
        // Hide settled contests older than 1 day
        if (c.contest?.status === "settled") {
          const settledAt = c.contest?.settledAt ? new Date(c.contest.settledAt).getTime() : 0;
          const matchTime = c.match?.startTime ? new Date(c.match.startTime).getTime() : 0;
          const refTime = settledAt || matchTime;
          if (refTime && refTime < oneDayAgo) return false;
        }
        return c.contest?.status !== "cancelled";
      })
      .sort((a, b) => {
        const sa = statusOrder[a.contest?.status] ?? 9;
        const sb = statusOrder[b.contest?.status] ?? 9;
        if (sa !== sb) return sa - sb;
        const da = a.match?.startTime ? new Date(a.match.startTime).getTime() : 0;
        const db = b.match?.startTime ? new Date(b.match.startTime).getTime() : 0;
        return da - db;
      });
    const nonSettled = active.filter((c) => c.contest?.status !== "settled");
    const settled = active.filter((c) => c.contest?.status === "settled").slice(0, 2);
    return [...nonSettled.slice(0, 3), ...settled].slice(0, 4);
  }, [contests]);

  if (sorted.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.delay(0).springify()}>
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
        <Text {...textStyles.sectionHeader}>
          {formatUIText("my contests")}
        </Text>
        <Button size="sm" variant="secondary" onPress={() => router.push("/(tabs)/contests")}>
          {formatUIText("see all")}
        </Button>
      </XStack>
      <YStack gap="$2">
        {sorted.map((entry: any) => {
          const contest = entry.contest;
          const match = entry.match ?? contest?.match;
          const teamHome = formatTeamName(match?.teamHome || "TBA");
          const teamAway = formatTeamName(match?.teamAway || "TBA");
          const isLive = contest?.status === "live";
          const isSettled = contest?.status === "settled";
          const rawTime = match?.startTime;
          const matchDate = rawTime
            ? (rawTime instanceof Date ? rawTime : parseSafeDate(String(rawTime)))
            : null;

          const points = entry.totalPoints?.toFixed(0) ?? "0";
          const totalText = entry.totalEntries ?? "?";
          const isOpen = contest?.status === "open";
          const isPreMatch = isOpen && !isLive && !isSettled;
          const hasWon = isSettled && entry.prizeWon > 0;

          const entryText = contest?.entryFee === 0 ? "free entry" : contest?.entryFee ? `${contest.entryFee} PC entry` : null;

          // Countdown for pre-match
          const countdownText = matchDate ? formatCountdown(matchDate) : null;
          // Unlimited leagues use a 100k sentinel for maxEntries — hide
          // the cap / spots-left on those because "99,999 spots left"
          // is meaningless noise. Threshold: any cap >= 10k.
          const isUnlimitedCap = (contest?.maxEntries ?? 0) >= 10000;
          const spotsLeft = !isUnlimitedCap && contest?.maxEntries && contest?.currentEntries != null ? contest.maxEntries - contest.currentEntries : null;

          return (
            <Card
              key={entry.id}
              pressable
              live={isLive}
              padding={0}
              overflow="hidden"
              onPress={() => router.push(`/contest/${contest?.id}` as any)}
              testID={`my-contest-${entry.id}`}
            >
              {/* Main content area */}
              <YStack padding="$3" paddingBottom="$3">
                {/* Row 1: "team name in contest name" + status badge */}
                <XStack justifyContent="space-between" alignItems="flex-start" marginBottom="$3">
                  <Text flex={1} marginRight="$2" numberOfLines={2}>
                    <Text fontFamily="$body" fontWeight="700" fontSize={15} color="$accentBackground">
                      {formatUIText(entry.name || "my team")}
                    </Text>
                    {contest?.name && (
                      <Text fontFamily="$mono" fontSize={12} color="$colorMuted">
                        {" "}{formatUIText("in")}{" "}
                      </Text>
                    )}
                    {contest?.name && (
                      <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                        {formatUIText(contest.name)}
                      </Text>
                    )}
                  </Text>
                  <XStack gap="$1" alignItems="center">
                    {isSettled && entry.rank === 1 && !hasWon && (
                      <Badge variant="success" size="sm">{formatBadgeText("won glory")}</Badge>
                    )}
                    {hasWon && (
                      <Badge variant="success" size="sm">{formatBadgeText(`won ${entry.prizeWon} pc`)}</Badge>
                    )}
                    <Badge variant={isLive ? "live" : "default"} size="sm">
                      {formatBadgeText(contest?.status || "open")}
                    </Badge>
                  </XStack>
                </XStack>

                {/* Row 2: Context-aware content */}
                {isPreMatch ? (
                  /* Pre-match: show countdown, spots, and change team hint */
                  <YStack gap="$2">
                    <XStack justifyContent="center" alignItems="center" gap="$4">
                      {countdownText && (
                        <YStack alignItems="center">
                          <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$accentBackground">
                            {countdownText}
                          </Text>
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                            {formatUIText("starts in")}
                          </Text>
                        </YStack>
                      )}
                      <YStack width={1} height={28} backgroundColor="$borderColor" />
                      <YStack alignItems="center">
                        <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">
                          {contest?.currentEntries ?? 0}
                          {!isUnlimitedCap && (
                            <Text fontWeight="400" fontSize={13} color="$colorMuted">/{contest?.maxEntries ?? "?"}</Text>
                          )}
                        </Text>
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                          {formatUIText("joined")}
                        </Text>
                      </YStack>
                      {spotsLeft != null && spotsLeft > 0 && (
                        <>
                          <YStack width={1} height={28} backgroundColor="$borderColor" />
                          <YStack alignItems="center">
                            <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$colorCricket">
                              {spotsLeft}
                            </Text>
                            <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                              {formatUIText("spots left")}
                            </Text>
                          </YStack>
                        </>
                      )}
                    </XStack>
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted" textAlign="center">
                      {formatUIText("tap to change team or invite friends")}
                    </Text>
                  </YStack>
                ) : (
                  /* Live/Settled: show rank + points */
                  <XStack justifyContent="center" alignItems="center" gap="$5">
                    <YStack alignItems="center">
                      <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">
                        {entry.rank ?? "—"}<Text fontWeight="400" fontSize={13} color="$colorMuted">/{totalText}</Text>
                      </Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                        {formatUIText("rank")}
                      </Text>
                    </YStack>

                    <YStack width={1} height={28} backgroundColor="$borderColor" />

                    <YStack alignItems="center">
                      <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">
                        {points}
                      </Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                        {formatUIText("points")}
                      </Text>
                    </YStack>

                    {hasWon && (
                      <>
                        <YStack width={1} height={24} backgroundColor="$borderColor" />
                        <YStack alignItems="center">
                          <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$colorSuccess">
                            {entry.prizeWon}
                          </Text>
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                            {formatUIText("prize")}
                          </Text>
                        </YStack>
                      </>
                    )}
                  </XStack>
                )}
              </YStack>

              {/* Bottom strip — match info (mirrors match card CTA bar) */}
              <XStack
                backgroundColor="$backgroundSurfaceAlt"
                paddingVertical="$3"
                paddingHorizontal="$4"
                justifyContent="space-between"
                alignItems="center"
                borderTopWidth={1}
                borderTopColor="$borderColor"
              >
                <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorAccent" numberOfLines={1}>
                  {formatUIText(`${teamHome} vs ${teamAway}`)}
                  {match?.format && (
                    <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorMuted">
                      {`  ·  ${match.format.toUpperCase()}`}
                    </Text>
                  )}
                </Text>
                {entryText && (
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                    {formatUIText(entryText)}
                  </Text>
                )}
              </XStack>
            </Card>
          );
        })}
      </YStack>
    </Animated.View>
  );
}

// ─── Highlights Horizontal Scroll ────────────────────────────────────
function HighlightsSection({
  tournaments,
  sport,
  walletData,
  teamCount,
  leagueCount,
  balance,
  isAuthenticated,
}: {
  tournaments: any[];
  sport: string;
  walletData?: { canClaimDaily?: boolean; currentStreak?: number } | null;
  teamCount?: number;
  leagueCount?: number;
  balance?: number;
  isAuthenticated?: boolean;
}) {
  const router = useRouter();

  // Active tournament (first one, typically IPL)
  const activeTournament = tournaments[0];

  const cards = useMemo(() => {
    const items: { key: string; icon: string; title: string; subtitle: string; onPress: () => void; accent?: string; preserveCase?: boolean }[] = [];

    // Daily coins — streak retention driver
    const streak = walletData?.currentStreak ?? 0;
    const canClaim = walletData?.canClaimDaily ?? false;
    items.push({
      key: "daily-coins",
      icon: canClaim ? "🎁" : "🔥",
      title: canClaim ? "claim daily coins" : `day ${streak} streak`,
      subtitle: canClaim ? `day ${streak + 1} — tap to claim!` : "come back tomorrow!",
      onPress: () => router.push("/wallet" as any),
      accent: canClaim ? "$colorSuccess" : undefined,
    });

    // Tournament standings card
    if (activeTournament) {
      const fullName: string = activeTournament.name || "Tournament";
      items.push({
        key: "standings",
        icon: "🏆",
        title: fullName.replace(/\s*\d{4}\s*$/, "").trim(),
        subtitle: "points table & standings",
        onPress: () => router.push(`/tournament/${encodeURIComponent(fullName)}`),
        accent: "$colorCricket",
        preserveCase: true,
      });
    }

    // Rate my team — Pro upsell, unique to DraftPlay
    items.push({
      key: "rate-team",
      icon: "📊",
      title: "rate my team",
      subtitle: "get a grade",
      onPress: () => router.push("/team/rate" as any),
    });

    // All tournaments — deduplicate by name, link to match center
    const uniqueNames = new Set(tournaments.map((t: any) => t.name));
    if (uniqueNames.size > 1) {
      items.push({
        key: "tournaments",
        icon: "📋",
        title: "all tournaments",
        subtitle: `${uniqueNames.size} active`,
        onPress: () => router.push("/(tabs)/live" as any),
      });
    }

    return items;
  }, [activeTournament, tournaments, router, walletData]);

  if (cards.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.delay(90).springify()}>
      {/* Stats strip — compact inline row */}
      {isAuthenticated && (
        <XStack
          justifyContent="space-around"
          alignItems="center"
          marginTop="$4"
          marginBottom="$3"
          paddingVertical="$3"
          paddingHorizontal="$2"
          backgroundColor="$backgroundSurface"
          borderRadius={12}
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Card pressable padding="$2" onPress={() => router.push("/(tabs)/contests")} backgroundColor="transparent" borderWidth={0} testID="highlight-teams">
            <XStack alignItems="center" gap="$2">
              <Text fontSize={16}>👥</Text>
              <YStack>
                <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color">{teamCount ?? 0}</Text>
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("teams")}</Text>
              </YStack>
            </XStack>
          </Card>
          <YStack width={1} height={28} backgroundColor="$borderColor" />
          <Card pressable padding="$2" onPress={() => router.push("/(tabs)/social")} backgroundColor="transparent" borderWidth={0} testID="highlight-leagues">
            <XStack alignItems="center" gap="$2">
              <Text fontSize={16}>🏟️</Text>
              <YStack>
                <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color">{leagueCount ?? 0}</Text>
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("leagues")}</Text>
              </YStack>
            </XStack>
          </Card>
          <YStack width={1} height={28} backgroundColor="$borderColor" />
          <Card pressable padding="$2" onPress={() => router.push("/wallet" as any)} backgroundColor="transparent" borderWidth={0} testID="highlight-coins">
            <XStack alignItems="center" gap="$2">
              <Text fontSize={16}>🍿</Text>
              <YStack>
                <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color">{balance ?? 0}</Text>
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("pop coins")}</Text>
              </YStack>
            </XStack>
          </Card>
        </XStack>
      )}

      <Text {...textStyles.sectionHeader} marginBottom="$2">
        {formatUIText("highlights")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 20 }}
      >
        {cards.map((card) => (
          <Card
            key={card.key}
            pressable
            onPress={card.onPress}
            padding="$3"
            width={150}
            gap="$2"
            testID={`highlight-${card.key}`}
          >
            <Text fontSize={24}>{card.icon}</Text>
            <Text fontFamily="$mono" fontWeight="600" fontSize={11} color={(card.accent ?? "$color") as any} numberOfLines={2} lineHeight={16} ellipsizeMode="tail">
              {card.preserveCase ? card.title : formatUIText(card.title)}
            </Text>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted" numberOfLines={2} lineHeight={14} ellipsizeMode="tail">
              {formatUIText(card.subtitle)}
            </Text>
          </Card>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

// ─── Main ───────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { t } = useTheme();
  const { sport, setSport } = useSport();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  // ── Queries ──
  const dashboardQuery = trpc.sports.dashboard.useQuery(
    { sport },
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
    staleTime: 30_000,
  });

  // Check for active auctions across user's leagues
  const activeAuctionsQuery = trpc.league.myActiveAuctions.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 10_000,
  });

  const myLeaguesQuery = trpc.league.myLeagues.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });

  const myContestsQuery = trpc.contest.myContests.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000, // Refresh every minute for live contest updates
  });

  const pendingContestsQuery = trpc.contest.pendingLeagueContests.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 30_000,
  });

  // Cricket Manager — home-feed integration
  const cmPendingRoundsQuery = trpc.cricketManager.pendingRoundsForMe.useQuery(
    { daysAhead: 7 },
    { enabled: !!user, retry: false, staleTime: 30_000 }
  );
  const cmActiveEntriesQuery = trpc.cricketManager.myActiveEntries.useQuery(
    undefined,
    { enabled: !!user, retry: false, staleTime: 30_000, refetchInterval: 60_000 }
  );


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dashboardQuery.refetch(),
      dbLive.refetch(),
      profileQuery.refetch(),
      walletQuery.refetch(),
      myTeamsQuery.refetch(),
      myContestsQuery.refetch(),
      pendingContestsQuery.refetch(),
      cmPendingRoundsQuery.refetch(),
      cmActiveEntriesQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [dashboardQuery, dbLive, profileQuery, walletQuery, myTeamsQuery, myContestsQuery, pendingContestsQuery, cmPendingRoundsQuery, cmActiveEntriesQuery]);

  // Refetch key queries when tab gains focus (e.g. after creating a league)
  useFocusEffect(
    useCallback(() => {
      myLeaguesQuery.refetch();
      myTeamsQuery.refetch();
      myContestsQuery.refetch();
      pendingContestsQuery.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // ── Derived data ──
  // Build DB lookup for toss/score enrichment
  // Use externalId as primary key (unique per match), fall back to team-name key
  const dbMatches = dbLive.data ?? [];
  const dbByExternalId = new Map<string, any>();
  const dbByTeamKey = new Map<string, any>();
  for (const m of dbMatches) {
    if (m.externalId) dbByExternalId.set(m.externalId, m);
    const key = [m.teamHome, m.teamAway].map((t: string) => t.toLowerCase().trim()).sort().join("|");
    dbByTeamKey.set(key, m);
  }

  const allMatches = (dashboardQuery.data?.matches ?? []).map((ai: any) => {
    // Primary: match by externalId (unique per match — handles same-team series correctly)
    const db = dbByExternalId.get(ai.id)
      || (() => {
        const key = [ai.teamA || "", ai.teamB || ""].map((t: string) => t.toLowerCase().trim()).sort().join("|");
        return dbByTeamKey.get(key);
      })();
    return {
      ...ai,
      status: db?.status || ai.status,
      dbId: db?.id || null,
      tossWinner: ai.tossWinner || db?.tossWinner || null,
      tossDecision: ai.tossDecision || db?.tossDecision || null,
      scoreSummary: db?.scoreSummary || ai.scoreSummary || null,
      result: ai.result || db?.result || null,
      draftEnabled: db?.draftEnabled ?? false,
    };
  });
  // Defensive filter: the backend sometimes lags on flipping status from
  // "upcoming" to "completed" (phase transitions can miss matches), so drop
  // anything whose start time is more than 6h in the past unless it's
  // actively live. Without this guard, weeks-old matches leak into
  // "more matches" as ghost "upcoming" rows.
  const nowMs = Date.now();
  const upcomingCutoffMs = nowMs - 6 * 60 * 60 * 1000;
  const upcomingMatches = allMatches
    .filter((m: any) => {
      if (m.status === "live") return true;
      if (m.status !== "upcoming") return false;
      if (!m.date) return true; // no date — keep, we can't judge
      const t = parseSafeDate(m.date, m.time).getTime();
      return t >= upcomingCutoffMs;
    })
    .sort((a: any, b: any) => {
      // Live matches first, then sort by date ascending
      if (a.status === "live" && b.status !== "live") return -1;
      if (b.status === "live" && a.status !== "live") return 1;
      const getTime = (m: any) => {
        if (!m.date) return 0;
        return parseSafeDate(m.date, m.time).getTime();
      };
      return getTime(a) - getTime(b);
    });
  const nextMatch = upcomingMatches[0] ?? null;
  const liveMatches = upcomingMatches.filter((m: any) => m.status === "live");
  const draftOpenMatches = upcomingMatches.filter((m: any) => m.draftEnabled && m.status !== "live");
  const otherMatches = upcomingMatches.filter((m: any) => !m.draftEnabled && m.status !== "live").slice(0, 4);
  const activeTournaments = dashboardQuery.data?.tournaments ?? [];

  // Build team logo lookup from tournament teams data
  const teamLogoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of dashboardQuery.data?.tournaments ?? []) {
      for (const team of (t as any).teams ?? []) {
        if (team.logo) {
          map.set(team.name?.toLowerCase(), team.logo);
          if (team.shortName) map.set(team.shortName.toLowerCase(), team.logo);
        }
      }
    }
    return map;
  }, [dashboardQuery.data?.tournaments]);

  const getTeamLogo = useCallback((teamName: string) => {
    const key = teamName.toLowerCase();
    return teamLogoMap.get(key) ?? [...teamLogoMap.entries()].find(([k]) => key.includes(k) || k.includes(key))?.[1] ?? undefined;
  }, [teamLogoMap]);

  const teamCount = myTeamsQuery.data?.length ?? 0;
  const leagueCount = myLeaguesQuery.data?.length ?? 0;
  const balance = walletQuery.data?.coinBalance ?? 0;

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

          <HeaderControls />
        </XStack>
      </Animated.View>

      <SubHeader />

      <AnnouncementBanner sport={sport} />

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
        {/* ── Live Auction Banner ── */}
        {(activeAuctionsQuery.data ?? []).map((auction: any) => (
          <Animated.View key={auction.roomId} entering={FadeInDown.delay(0).springify()}>
            <Card
              testID="live-auction-banner"
              marginBottom="$4"
              padding="$4"
              borderWidth={2}
              borderColor="$accentBackground"
              pressable
              onPress={() => router.push(`/auction/${auction.roomId}` as any)}
            >
              <XStack alignItems="center" justifyContent="space-between">
                <XStack alignItems="center" gap="$3" flex={1}>
                  <YStack width={40} height={40} borderRadius={20} backgroundColor="$accentBackground" alignItems="center" justifyContent="center">
                    <Text fontSize={20}>🔨</Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$accentBackground">
                      {formatUIText("auction is live!")}
                    </Text>
                    <Text fontFamily="$body" fontSize={12} color="$colorMuted" numberOfLines={1}>
                      {auction.leagueName} — {formatUIText("tap to join and bid")}
                    </Text>
                  </YStack>
                </XStack>
                <Badge variant="live" size="sm">LIVE</Badge>
              </XStack>
            </Card>
          </Animated.View>
        ))}

        {/* ── My Contests (authenticated, has contests) ── */}
        {user && (myContestsQuery.data?.length ?? 0) > 0 && (
          <YStack marginBottom="$4">
            <MyContestsSection contests={myContestsQuery.data ?? []} sport={sport} getTeamLogo={getTeamLogo} />
          </YStack>
        )}

        {/* ── My CM Entries — mirrors the visual shape of MyContestsSection
            so the home feed has one consistent card treatment. Same
            card size, header layout, stat-tile row with vertical
            dividers, and bottom strip with border-top. Content is
            adapted to CM's round/NRR model: round name "in" league,
            NRR/BAT/BOWL tiles, bottom strip shows match progress
            (X/Y matches) + entry-fee stance. */}
        {user && (cmActiveEntriesQuery.data?.length ?? 0) > 0 && (
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <YStack marginBottom="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
                <Text {...textStyles.sectionHeader}>
                  {formatUIText("my cricket manager entries")}
                </Text>
              </XStack>
              <YStack gap="$2">
                {(cmActiveEntriesQuery.data ?? []).map((e: any) => {
                  const isLive = e.roundStatus === "live";
                  const isSettled = e.roundStatus === "settled";
                  const nrrLabel =
                    e.nrr > 0 ? `+${e.nrr.toFixed(2)}` : e.nrr.toFixed(2);
                  return (
                    <Card
                      key={e.entryId}
                      pressable
                      live={isLive}
                      padding={0}
                      overflow="hidden"
                      onPress={() =>
                        router.push(
                          `/league/${e.leagueId}/round/${e.roundId}`
                        )
                      }
                      testID={`my-cm-entry-${e.entryId}`}
                    >
                      {/* Main content area */}
                      <YStack padding="$3" paddingBottom="$3">
                        {/* Row 1: "round name in league name" + status badge */}
                        <XStack
                          justifyContent="space-between"
                          alignItems="flex-start"
                          marginBottom="$3"
                        >
                          <Text flex={1} marginRight="$2" numberOfLines={2}>
                            <Text
                              fontFamily="$body"
                              fontWeight="700"
                              fontSize={15}
                              color="$accentBackground"
                            >
                              🏆 {formatUIText(e.roundName ?? `round ${e.roundNumber}`)}
                            </Text>
                            <Text
                              fontFamily="$mono"
                              fontSize={12}
                              color="$colorMuted"
                            >
                              {" "}{formatUIText("in")}{" "}
                            </Text>
                            <Text
                              fontFamily="$body"
                              fontWeight="600"
                              fontSize={13}
                              color="$color"
                            >
                              {formatUIText(e.leagueName)}
                            </Text>
                          </Text>
                          <Badge variant={isLive ? "live" : "default"} size="sm">
                            {formatBadgeText(e.roundStatus)}
                          </Badge>
                        </XStack>

                        {/* Row 2: NRR / BAT / BOWL stat tiles — same shape as
                            rank/points on MyContestsSection */}
                        <XStack
                          justifyContent="center"
                          alignItems="center"
                          gap="$5"
                        >
                          <YStack alignItems="center">
                            <Text
                              fontFamily="$mono"
                              fontWeight="800"
                              fontSize={18}
                              color={e.nrr >= 0 ? "$colorCricket" : "$error"}
                            >
                              {nrrLabel}
                            </Text>
                            <Text
                              fontFamily="$mono"
                              fontSize={9}
                              color="$colorMuted"
                            >
                              {formatUIText("nrr")}
                            </Text>
                          </YStack>
                          <YStack
                            width={1}
                            height={28}
                            backgroundColor="$borderColor"
                          />
                          <YStack alignItems="center">
                            <Text
                              fontFamily="$mono"
                              fontWeight="800"
                              fontSize={18}
                              color="$color"
                            >
                              {e.battingTotal ?? 0}
                            </Text>
                            <Text
                              fontFamily="$mono"
                              fontSize={9}
                              color="$colorMuted"
                            >
                              {formatUIText("bat")}
                            </Text>
                          </YStack>
                          <YStack
                            width={1}
                            height={28}
                            backgroundColor="$borderColor"
                          />
                          <YStack alignItems="center">
                            <Text
                              fontFamily="$mono"
                              fontWeight="800"
                              fontSize={18}
                              color="$color"
                            >
                              {e.bowlingTotal ?? 0}
                            </Text>
                            <Text
                              fontFamily="$mono"
                              fontSize={9}
                              color="$colorMuted"
                            >
                              {formatUIText("bowl")}
                            </Text>
                          </YStack>
                        </XStack>
                      </YStack>

                      {/* Bottom strip — match progress + status */}
                      <XStack
                        backgroundColor="$backgroundSurfaceAlt"
                        paddingVertical="$3"
                        paddingHorizontal="$4"
                        justifyContent="space-between"
                        alignItems="center"
                        borderTopWidth={1}
                        borderTopColor="$borderColor"
                      >
                        <Text
                          fontFamily="$mono"
                          fontSize={11}
                          fontWeight="600"
                          color="$colorAccent"
                          numberOfLines={1}
                        >
                          {e.matchesCompleted}/{e.matchesTotal}{" "}
                          {formatUIText("matches")}
                          {isLive ? (
                            <Text
                              fontFamily="$mono"
                              fontSize={11}
                              color="$colorMuted"
                            >
                              {"  ·  "}{formatUIText("live")}
                            </Text>
                          ) : isSettled ? (
                            <Text
                              fontFamily="$mono"
                              fontSize={11}
                              color="$colorMuted"
                            >
                              {"  ·  "}{formatUIText("settled")}
                            </Text>
                          ) : null}
                        </Text>
                        <Text
                          fontFamily="$mono"
                          fontSize={10}
                          color="$colorMuted"
                        >
                          {formatUIText("free entry")}
                        </Text>
                      </XStack>
                    </Card>
                  );
                })}
              </YStack>
            </YStack>
          </Animated.View>
        )}

        {/* ── Waiting for your team — both salary-cap contests AND CM rounds
            that the user is eligible for but hasn't built a team / entry
            for yet. Unified section so users don't have to check two
            places. CM cards carry round-specific info (matches, lock time). */}
        {user && (
          ((pendingContestsQuery.data?.length ?? 0) > 0 ||
            (cmPendingRoundsQuery.data?.length ?? 0) > 0)
        ) && (
          <YStack marginBottom="$4" paddingHorizontal="$4">
            <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$color" marginBottom="$2">
              {formatUIText("waiting for your team")}
            </Text>
            {[...(pendingContestsQuery.data ?? [])]
              .sort((a: any, b: any) => {
                const aTime = a.match?.startTime ? new Date(a.match.startTime).getTime() : Infinity;
                const bTime = b.match?.startTime ? new Date(b.match.startTime).getTime() : Infinity;
                return aTime - bTime;
              })
              .map((pc: any) => {
                const matchTime = pc.match?.startTime ? new Date(pc.match.startTime) : null;
                const now = Date.now();
                const diffMs = matchTime ? matchTime.getTime() - now : 0;
                const isUrgent = diffMs > 0 && diffMs < 2 * 60 * 60 * 1000; // < 2 hours
                let countdown = "";
                if (matchTime && diffMs > 0) {
                  const hrs = Math.floor(diffMs / 3600000);
                  const mins = Math.floor((diffMs % 3600000) / 60000);
                  countdown = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                } else if (matchTime && diffMs <= 0) {
                  countdown = "started";
                }

                return (
                <Animated.View key={pc.id} entering={FadeInDown.springify()}>
                  <Card
                    marginBottom="$2"
                    padding="$3"
                    pressable
                    onPress={() => router.push(`/contest/${pc.id}`)}
                    cursor="pointer"
                    borderColor={isUrgent ? "$error" : "$colorAccentLight"}
                    borderWidth={1}
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack flex={1} gap={2}>
                        <Text fontFamily="$body" fontWeight="700" fontSize={14} color="$color" numberOfLines={3}>
                          {pc.leagueName} · {pc.match ? `${formatTeamName(pc.match.teamHome)} vs ${formatTeamName(pc.match.teamAway)}` : ""}
                        </Text>
                        <XStack alignItems="center" gap="$2">
                          {countdown && (
                            <XStack alignItems="center" gap={3}>
                              <Ionicons name="time-outline" size={11} color={isUrgent ? "#E5484D" : "#D4A43D"} />
                              <Text fontFamily="$mono" fontSize={11} fontWeight="700" color={isUrgent ? "$error" : "$colorCricket"}>
                                {countdown}
                              </Text>
                            </XStack>
                          )}
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                            {pc.currentEntries}
                            {(pc.maxEntries ?? 0) < 10000 ? `/${pc.maxEntries}` : ""}
                            {" "}{formatUIText("joined")} · {pc.entryFee === 0 ? formatUIText("free") : `${pc.entryFee} PC`}
                          </Text>
                        </XStack>
                      </YStack>
                      <Badge variant="role" size="sm">{formatBadgeText("pending")}</Badge>
                    </XStack>
                  </Card>
                </Animated.View>
              );})}

            {/* CM rounds pending entry — same visual pattern, sub-headered
                with a 🏆 so users can tell rounds apart from contests. */}
            {(cmPendingRoundsQuery.data ?? []).map((r: any) => {
              const lockTime = r.windowStart ? new Date(r.windowStart) : null;
              const nowMs = Date.now();
              const diffMs = lockTime ? lockTime.getTime() - nowMs : 0;
              const isUrgent = diffMs > 0 && diffMs < 24 * 60 * 60 * 1000; // < 1d
              let countdown = "";
              if (lockTime && diffMs > 0) {
                const days = Math.floor(diffMs / 86400000);
                const hrs = Math.floor((diffMs % 86400000) / 3600000);
                countdown = days > 0 ? `${days}d ${hrs}h` : `${hrs}h`;
              } else if (lockTime && diffMs <= 0) {
                countdown = "starting";
              }
              return (
                <Animated.View key={r.id} entering={FadeInDown.springify()}>
                  <Card
                    marginBottom="$2"
                    padding="$3"
                    pressable
                    onPress={() => router.push(`/league/${r.leagueId}/round/${r.id}/build`)}
                    cursor="pointer"
                    borderColor={isUrgent ? "$error" : "$colorAccentLight"}
                    borderWidth={1}
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack flex={1} gap={2}>
                        <Text fontFamily="$body" fontWeight="700" fontSize={14} color="$color" numberOfLines={3}>
                          🏆 {r.leagueName} · {r.name}
                        </Text>
                        <XStack alignItems="center" gap="$2">
                          {countdown && (
                            <XStack alignItems="center" gap={3}>
                              <Ionicons name="time-outline" size={11} color={isUrgent ? "#E5484D" : "#D4A43D"} />
                              <Text fontFamily="$mono" fontSize={11} fontWeight="700" color={isUrgent ? "$error" : "$colorCricket"}>
                                {formatUIText("locks in")} {countdown}
                              </Text>
                            </XStack>
                          )}
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                            {r.matchesTotal} {formatUIText("matches")}
                          </Text>
                        </XStack>
                      </YStack>
                      <Badge variant="role" size="sm">{formatBadgeText("build entry")}</Badge>
                    </XStack>
                  </Card>
                </Animated.View>
              );
            })}
          </YStack>
        )}

        {/* ── Discover public leagues — hides itself when there's nothing
            new to show. Sits here so it naturally fills the "what now?"
            gap between pending-contest callouts and live match surface. */}
        {user && <DiscoverPublicLeagues limit={3} />}

        {/* ── Progressive Onboarding — adapts to user stage ── */}
        {user && leagueCount === 0 && teamCount === 0 && (
          <Animated.View entering={FadeInDown.delay(30).springify()}>
            <Card padding="$4" marginBottom="$4" testID="how-it-works-card">
              <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color" marginBottom="$3">
                {formatUIText("how it works")}
              </Text>
              <YStack gap="$3">
                <XStack alignItems="flex-start" gap="$3">
                  <YStack width={24} height={24} borderRadius={12} backgroundColor="$accentBackground" alignItems="center" justifyContent="center">
                    <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="white">1</Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                      {formatUIText("join or create a league")}
                    </Text>
                    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                      {formatUIText("jump into a public league above, or create a private one with friends")}
                    </Text>
                  </YStack>
                </XStack>
                <XStack alignItems="flex-start" gap="$3">
                  <YStack width={24} height={24} borderRadius={12} backgroundColor="$backgroundSurfaceAlt" alignItems="center" justifyContent="center">
                    <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$colorMuted">2</Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$colorMuted">
                      {formatUIText("contests & rounds open before every match")}
                    </Text>
                    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16} opacity={0.6}>
                      {formatUIText("salary cap = per-match, cricket manager = multi-match rounds — the app surfaces both automatically")}
                    </Text>
                  </YStack>
                </XStack>
                <XStack alignItems="flex-start" gap="$3">
                  <YStack width={24} height={24} borderRadius={12} backgroundColor="$backgroundSurfaceAlt" alignItems="center" justifyContent="center">
                    <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$colorMuted">3</Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$colorMuted">
                      {formatUIText("build your 11 & compete")}
                    </Text>
                    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16} opacity={0.6}>
                      {formatUIText("pick players within a budget, or strategise a batting + bowling order across a round — climb the standings")}
                    </Text>
                  </YStack>
                </XStack>
              </YStack>
              <XStack gap="$2" marginTop="$3">
                <Button variant="secondary" size="md" flex={1} onPress={() => router.push("/leagues/browse" as any)} testID="how-it-works-browse-public-btn">
                  {formatUIText("browse public")}
                </Button>
                <Button variant="primary" size="md" flex={1} onPress={() => router.push("/league/create" as any)} testID="how-it-works-get-started-btn">
                  {formatUIText("create a league")}
                </Button>
              </XStack>
            </Card>
          </Animated.View>
        )}
        {user && leagueCount > 0 && teamCount === 0 && (() => {
          // Figure out which format the user's leagues are — when they
          // have a pending CM round, send them there instead of the
          // salary-cap next-match flow. The CM path was missing
          // entirely before, so CM-only users got stranded on
          // "your next contest opens closer to match time" forever.
          const firstCmPending = (cmPendingRoundsQuery.data ?? [])[0];
          const hasCmLeague =
            (myLeaguesQuery.data ?? []).some(
              (m: any) => m.league?.format === "cricket_manager"
            );

          return (
          <Animated.View entering={FadeInDown.delay(30).springify()}>
            <Card padding="$4" marginBottom="$4" testID="onboard-build-team-card">
              <XStack alignItems="center" gap="$3" marginBottom="$3">
                <YStack width={24} height={24} borderRadius={12} backgroundColor="$accentBackground" alignItems="center" justifyContent="center">
                  <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="white">2</Text>
                </YStack>
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color">
                  {formatUIText(
                    firstCmPending ? "next: build your round entry" : "next: build your team"
                  )}
                </Text>
              </XStack>
              {firstCmPending ? (
                // CM branch — pending round takes priority over salary-cap
                // next-match, since round locking is time-bounded.
                <YStack gap="$2">
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                    {formatUIText(
                      "your cricket manager league has a round open — pick 11 players across the round's matches, set your batting and bowling orders."
                    )}
                  </Text>
                  <Card padding="$3" marginTop="$1">
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack flex={1} gap={2}>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
                          🏆 {formatBadgeText(firstCmPending.leagueName ?? "cricket manager")}
                        </Text>
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" numberOfLines={1}>
                          {firstCmPending.name ?? `Round ${firstCmPending.roundNumber}`}
                        </Text>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                          {firstCmPending.matchesTotal} {formatUIText("matches")}
                        </Text>
                      </YStack>
                      <Badge variant="live" size="sm">
                        {formatBadgeText("open")}
                      </Badge>
                    </XStack>
                  </Card>
                  <Button
                    variant="primary"
                    size="md"
                    marginTop="$1"
                    onPress={() =>
                      router.push(
                        `/league/${firstCmPending.leagueId}/round/${firstCmPending.id}/build`
                      )
                    }
                    testID="onboard-go-to-cm-round-btn"
                  >
                    {formatUIText("build entry")}
                  </Button>
                </YStack>
              ) : nextMatch ? (
                <YStack gap="$2">
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                    {formatUIText(nextMatch.draftEnabled
                      ? "your league has an open contest — pick 11 players within budget. your team earns points based on real match performance."
                      : "your next contest opens closer to match time. we'll notify you when it's ready."
                    )}
                  </Text>
                  <Card padding="$3" marginTop="$1">
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack flex={1} gap={2}>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
                          {formatBadgeText(nextMatch.tournamentName || nextMatch.tournament || "upcoming")}
                        </Text>
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" numberOfLines={1}>
                          {formatTeamName(nextMatch.teamA || nextMatch.teamHome || "TBA")} {formatUIText("vs")} {formatTeamName(nextMatch.teamB || nextMatch.teamAway || "TBA")}
                        </Text>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                          {formatBadgeText(nextMatch.format || "T20")} · {formatCountdown(parseSafeDate(nextMatch.date, nextMatch.time))}
                        </Text>
                      </YStack>
                      <Badge variant={nextMatch.draftEnabled ? "live" : "default"} size="sm">
                        {nextMatch.draftEnabled ? formatBadgeText("open") : formatCountdown(parseSafeDate(nextMatch.date, nextMatch.time))}
                      </Badge>
                    </XStack>
                  </Card>
                  <Button
                    variant="primary"
                    size="md"
                    marginTop="$1"
                    onPress={() => router.push(`/match/${encodeURIComponent(nextMatch.dbId || nextMatch.id)}`)}
                    testID="onboard-go-to-match-btn"
                  >
                    {formatUIText(nextMatch.draftEnabled ? "play" : "view match")}
                  </Button>
                </YStack>
              ) : (
                <YStack gap="$2">
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                    {formatUIText(
                      hasCmLeague
                        ? "no rounds open right now. the admin will compose new rounds as matches approach — we'll surface them here."
                        : "no upcoming matches right now. contests will appear automatically when matches are scheduled."
                    )}
                  </Text>
                  <Button variant="secondary" size="md" marginTop="$1" onPress={() => router.push("/(tabs)/social")} testID="onboard-go-to-league-btn">
                    {formatUIText("view my leagues")}
                  </Button>
                </YStack>
              )}
            </Card>
          </Animated.View>
          );
        })()}
        {user && leagueCount > 0 && teamCount > 0 && (myContestsQuery.data?.length ?? 0) === 0 && nextMatch && !nextMatch.draftEnabled && (
          <Animated.View entering={FadeInDown.delay(30).springify()}>
            <Card padding="$4" marginBottom="$4" testID="onboard-next-match-card">
              <Text fontFamily="$mono" fontWeight="600" fontSize={12} color="$accentBackground" marginBottom="$1">
                {formatUIText("you're all set")}
              </Text>
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                {formatUIText("drafts open closer to match time. we'll notify you when it's time to pick your team.")}
              </Text>
            </Card>
          </Animated.View>
        )}

        {/* ── Live Matches — shown prominently above everything else ── */}
        {liveMatches.length > 0 && (
          <Animated.View entering={FadeInDown.delay(40).springify()}>
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("live now")}
            </Text>
            <YStack gap="$3" marginBottom="$4">
              {liveMatches.map((m: any) => (
                <FeaturedMatchCard
                  key={m.id}
                  match={m}
                  sport={sport}
                  getTeamLogo={getTeamLogo}
                  onPress={() => router.push(`/match/${encodeURIComponent(m.dbId || m.id)}`)}
                />
              ))}
            </YStack>
          </Animated.View>
        )}

        {/* ── Draft Open Matches — create your team ── */}
        {draftOpenMatches.length > 0 && (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText(sport === "f1" ? "build your grid" : "create your team")}
            </Text>
            <YStack gap="$3">
              {draftOpenMatches.map((m: any) => (
                <FeaturedMatchCard
                  key={m.id}
                  match={m}
                  sport={sport}
                  getTeamLogo={getTeamLogo}
                  onPress={() => router.push(`/match/${encodeURIComponent(m.dbId || m.id)}`)}
                />
              ))}
            </YStack>
          </Animated.View>
        )}

        {/* ── Next Match (only when no draft open AND no live match — those have their own sections above) ── */}
        {draftOpenMatches.length === 0 && liveMatches.length === 0 && nextMatch && (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText(sport === "f1" ? "next race" : "next match")}
            </Text>
            <FeaturedMatchCard
              match={nextMatch}
              sport={sport}
              getTeamLogo={getTeamLogo}
              onPress={() => router.push(`/match/${encodeURIComponent(nextMatch.dbId || nextMatch.id)}`)}
            />
          </Animated.View>
        )}

        {/* ── Highlights — daily coins, standings, rate my team ── */}
        <HighlightsSection
          tournaments={activeTournaments}
          sport={sport}
          walletData={walletQuery.data}
          teamCount={teamCount}
          leagueCount={leagueCount}
          balance={balance}
          isAuthenticated={!!user}
        />

        {/* ── More Matches — each with play button ── */}
        {otherMatches.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).springify()}>
            <XStack justifyContent="space-between" alignItems="center" marginTop="$5" marginBottom="$2">
              <Text {...textStyles.sectionHeader}>
                {formatUIText(sport === "f1" ? "more races" : "more matches")}
              </Text>
              <Button size="sm" variant="secondary" onPress={() => router.push("/(tabs)/live")}>
                {formatUIText("see all")}
              </Button>
            </XStack>
            <YStack gap="$3">
              {otherMatches.map((m: any, i: number) => {
                const tA = formatTeamName(m.teamA || m.teamHome || "TBA");
                const tB = formatTeamName(m.teamB || m.teamAway || "TBA");
                const startTime = parseSafeDate(m.date, m.time);
                const isLive = m.status === "live";
                return (
                  <Card
                    key={m.id}
                    pressable
                    live={isLive}
                    onPress={() => router.push(`/match/${encodeURIComponent(m.dbId || m.id)}`)}
                    padding="$4"
                    testID={`upcoming-match-${i}`}
                  >
                    {/* Header: tournament + status */}
                    <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
                        {formatBadgeText(m.tournamentName || m.tournament || (sport === "f1" ? "formula 1" : "cricket"))}
                      </Text>
                      <Badge variant={isLive ? "live" : "default"} size="sm">
                        {isLive ? formatBadgeText("live") : formatBadgeText(m.status || "upcoming")}
                      </Badge>
                    </XStack>

                    {/* Teams with avatars */}
                    <XStack alignItems="center" justifyContent="center" marginBottom="$3">
                      <YStack flex={1} alignItems="center" gap={4}>
                        <InitialsAvatar
                          name={tA} playerRole="BAT" ovr={0} size={36}
                          imageUrl={getTeamLogo?.(m.teamA || m.teamHome || "")}
                          hideBadge
                        />
                        <Text {...textStyles.playerName} fontSize={11} numberOfLines={1} textAlign="center">
                          {tA}
                        </Text>
                      </YStack>

                      <YStack alignItems="center">
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                          {formatUIText("vs")}
                        </Text>
                        {m.format && (
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                            {formatBadgeText(m.format)}
                          </Text>
                        )}
                      </YStack>

                      <YStack flex={1} alignItems="center" gap={4}>
                        <InitialsAvatar
                          name={tB} playerRole="BOWL" ovr={0} size={36}
                          imageUrl={getTeamLogo?.(m.teamB || m.teamAway || "")}
                          hideBadge
                        />
                        <Text {...textStyles.playerName} fontSize={11} numberOfLines={1} textAlign="center">
                          {tB}
                        </Text>
                      </YStack>
                    </XStack>

                    {/* Footer: date/venue */}
                    <XStack
                      alignItems="center"
                      paddingTop="$2"
                      borderTopWidth={1}
                      borderTopColor="$borderColor"
                    >
                      <YStack flex={1} gap={2}>
                        <Text {...textStyles.hint}>
                          {m.date
                            ? startTime.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
                            : formatCountdown(startTime)}
                        </Text>
                        {m.venue && (
                          <Text {...textStyles.hint} fontSize={10} numberOfLines={2}>
                            {m.venue}
                          </Text>
                        )}
                      </YStack>
                    </XStack>
                  </Card>
                );
              })}
            </YStack>
          </Animated.View>
        )}


        {/* ── Empty state ── */}
        {upcomingMatches.length === 0 && (
          <Animated.View entering={FadeIn.delay(120)}>
            <YStack alignItems="center" gap="$3" paddingVertical="$8">
              <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
              <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color">
                {formatUIText(sport === "f1" ? "no upcoming races" : "no upcoming matches")}
              </Text>
              <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
                {formatUIText(sport === "f1" ? "check back soon for upcoming race weekends" : "check back soon for upcoming fixtures")}
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
