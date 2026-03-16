import { ScrollView as RNScrollView, RefreshControl, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useState, useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  sport = "cricket",
  getTeamLogo,
}: {
  match: any;
  onPress: () => void;
  sport?: string;
  getTeamLogo?: (name: string) => string | undefined;
}) {
  const isCricket = sport === "cricket";
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
              ? new Date(`${match.date} ${(match.time ?? "").replace(/\s+[A-Z]{2,4}$/, "")}`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
                + " · "
                + new Date(`${match.date} ${(match.time ?? "").replace(/\s+[A-Z]{2,4}$/, "")}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
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
              {formatUIText(isCricket ? "create team" : "build grid")}
            </Button>
          </>
        ) : (
          <YStack flex={1} alignItems="center" gap={1}>
            <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorMuted">
              {formatUIText("draft not open yet")}
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

// ─── Highlights Horizontal Scroll ────────────────────────────────────
function HighlightsSection({
  tournaments,
  sport,
  walletData,
}: {
  tournaments: any[];
  sport: string;
  walletData?: { canClaimDaily?: boolean; currentStreak?: number } | null;
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
      icon: "🍿",
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
      <Text {...textStyles.sectionHeader} marginTop="$4" marginBottom="$2">
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
            width={140}
            gap="$2"
            testID={`highlight-${card.key}`}
          >
            <Text fontSize={24}>{card.icon}</Text>
            <Text fontFamily="$mono" fontWeight="600" fontSize={11} color={(card.accent ?? "$color") as any} numberOfLines={2} lineHeight={16}>
              {card.preserveCase ? card.title : formatUIText(card.title)}
            </Text>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted" numberOfLines={2} lineHeight={14}>
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
  });

  const myLeaguesQuery = trpc.league.myLeagues.useQuery(undefined, {
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

  // Refetch key queries when tab gains focus (e.g. after creating a league)
  useFocusEffect(
    useCallback(() => {
      myLeaguesQuery.refetch();
      myTeamsQuery.refetch();
    }, [myLeaguesQuery, myTeamsQuery])
  );

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
      dbId: db?.id || null,
      tossWinner: ai.tossWinner || db?.tossWinner || null,
      tossDecision: ai.tossDecision || db?.tossDecision || null,
      scoreSummary: ai.scoreSummary || db?.scoreSummary || null,
      result: ai.result || db?.result || null,
      draftEnabled: db?.draftEnabled ?? false,
    };
  });
  const upcomingMatches = allMatches
    .filter((m: any) => m.status === "upcoming" || m.status === "live")
    .sort((a: any, b: any) => {
      // Live matches first, then sort by date ascending
      if (a.status === "live" && b.status !== "live") return -1;
      if (b.status === "live" && a.status !== "live") return 1;
      const getTime = (m: any) => {
        if (!m.date) return 0;
        const cleanTime = (m.time ?? "").replace(/\s+[A-Z]{2,4}$/, "");
        const parsed = new Date(`${m.date} ${cleanTime}`);
        return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
      };
      return getTime(a) - getTime(b);
    });
  const nextMatch = upcomingMatches[0] ?? null;
  const otherMatches = upcomingMatches.slice(1, 4);
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
        {/* ── Stats Row (authenticated) ── */}
        {user && (
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <XStack gap="$2" marginBottom="$4">
              <StatCard label="teams" value={teamCount} icon="👥" onPress={() => router.push("/(tabs)/contests")} />
              <StatCard label="leagues" value={leagueCount} icon="🏟️" onPress={() => router.push("/(tabs)/social")} />
              <StatCard label="pop coins" value={`${balance} PC`} icon="🍿" onPress={() => router.push("/wallet")} />
            </XStack>
          </Animated.View>
        )}

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
                      {formatUIText("create or join a league")}
                    </Text>
                    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                      {formatUIText("pick a tournament (ipl, world cup, etc.), invite friends with a code")}
                    </Text>
                  </YStack>
                </XStack>
                <XStack alignItems="flex-start" gap="$3">
                  <YStack width={24} height={24} borderRadius={12} backgroundColor="$backgroundSurfaceAlt" alignItems="center" justifyContent="center">
                    <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$colorMuted">2</Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$colorMuted">
                      {formatUIText("contests appear each match day")}
                    </Text>
                    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16} opacity={0.6}>
                      {formatUIText("auto-created for every match in your tournament — no setup needed")}
                    </Text>
                  </YStack>
                </XStack>
                <XStack alignItems="flex-start" gap="$3">
                  <YStack width={24} height={24} borderRadius={12} backgroundColor="$backgroundSurfaceAlt" alignItems="center" justifyContent="center">
                    <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$colorMuted">3</Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$colorMuted">
                      {formatUIText("build your team & compete")}
                    </Text>
                    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16} opacity={0.6}>
                      {formatUIText("pick 11 players within budget — best fantasy team wins")}
                    </Text>
                  </YStack>
                </XStack>
              </YStack>
              <Button variant="primary" size="md" marginTop="$3" onPress={() => router.push("/league/create" as any)} testID="how-it-works-get-started-btn">
                {formatUIText("create a league")}
              </Button>
            </Card>
          </Animated.View>
        )}
        {user && leagueCount > 0 && teamCount === 0 && (
          <Animated.View entering={FadeInDown.delay(30).springify()}>
            <Card padding="$4" marginBottom="$4" testID="onboard-build-team-card">
              <XStack alignItems="center" gap="$3" marginBottom="$3">
                <YStack width={24} height={24} borderRadius={12} backgroundColor="$accentBackground" alignItems="center" justifyContent="center">
                  <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="white">2</Text>
                </YStack>
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color">
                  {formatUIText("next: build your team")}
                </Text>
              </XStack>
              {nextMatch ? (
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
                    {formatUIText(nextMatch.draftEnabled ? "create team" : "view match")}
                  </Button>
                </YStack>
              ) : (
                <YStack gap="$2">
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                    {formatUIText("no upcoming matches right now. contests will appear automatically when matches are scheduled.")}
                  </Text>
                  <Button variant="secondary" size="md" marginTop="$1" onPress={() => router.push("/(tabs)/social")} testID="onboard-go-to-league-btn">
                    {formatUIText("view my leagues")}
                  </Button>
                </YStack>
              )}
            </Card>
          </Animated.View>
        )}
        {user && leagueCount > 0 && teamCount > 0 && nextMatch && !nextMatch.draftEnabled && (
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

        {/* ── Featured Match with CTA ── */}
        {nextMatch && (
          <Animated.View entering={FadeInDown.delay(60).springify()}>
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText(nextMatch.status === "live"
                ? "live now — join the action"
                : nextMatch.draftEnabled
                  ? (sport === "f1" ? "next race — build your grid" : "next match — create your team")
                  : (sport === "f1" ? "next race" : "next match"))}
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
        <HighlightsSection tournaments={activeTournaments} sport={sport} walletData={walletQuery.data} />

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
                            ? new Date(`${m.date} ${(m.time ?? "").replace(/\s+[A-Z]{2,4}$/, "")}`).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
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
