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
  SegmentTab,
  ModeToggle,
  StatLabel,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { useTheme } from "../../providers/ThemeProvider";
import { trpc } from "../../lib/trpc";

// ─── Types ───────────────────────────────────────────────────────────
type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

/** Map DB role strings to display role codes */
const ROLE_MAP: Record<string, RoleKey> = {
  batsman: "BAT",
  bowler: "BOWL",
  all_rounder: "AR",
  wicket_keeper: "WK",
};

interface PlayerStats {
  credits?: number;
  [key: string]: number | undefined;
}

interface DraftPlayer {
  id: string;
  name: string;
  role: RoleKey;
  team: string;
  credits: number;
  stats: Record<string, number>;
}

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

        {/* Footer: venue + time */}
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
            {isLive ? formatUIText("watch live") : formatUIText("draft now")}
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
  const playersQuery = trpc.player.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  // ── Draft state ──
  const [myTeam, setMyTeam] = useState<DraftPlayer[]>([]);
  const [allDrafted, setAllDrafted] = useState<string[]>([]);
  const [round, setRound] = useState(1);
  const [pick, setPick] = useState(1);
  const [tab, setTab] = useState<"matches" | "draft" | "team">("matches");
  const [roleFilter, setRoleFilter] = useState<"all" | RoleKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  // ── Map DB players to draft-friendly shape ──
  const players: DraftPlayer[] = (playersQuery.data ?? []).map((p: any) => {
    const rawStats = (typeof p.stats === "string" ? JSON.parse(p.stats) : p.stats ?? {}) as PlayerStats;
    const credits = rawStats.credits ?? 8;
    return {
      id: p.id as string,
      name: p.name as string,
      role: ROLE_MAP[p.role as string] ?? "BAT",
      team: (p.team as string) ?? "???",
      credits,
      stats: { cr: credits },
    };
  });

  const handleDraft = useCallback((player: DraftPlayer) => {
    setMyTeam((prev) => [...prev, player]);
    setAllDrafted((prev) => [...prev, player.id]);
    setPick((p) => p + 1);
    if (pick % 4 === 0) setRound((r) => r + 1);
  }, [pick]);

  const available = players.filter((p) => !allDrafted.includes(p.id));
  const filtered = roleFilter === "all" ? available : available.filter((p) => p.role === roleFilter);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([dashboardQuery.refetch(), playersQuery.refetch()]);
    setRefreshing(false);
  }, [dashboardQuery, playersQuery]);

  // ── Full-screen loading state ──
  const isInitialLoad = dashboardQuery.isLoading && playersQuery.isLoading;
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

  // ── Full-screen error state ──
  const hasError = dashboardQuery.isError && playersQuery.isError;
  if (hasError) {
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

      {/* ── Segment Tabs ── */}
      <XStack
        marginHorizontal="$5"
        marginTop="$4"
        marginBottom="$4"
        borderRadius="$3"
        backgroundColor="$backgroundSurfaceAlt"
        padding="$1"
        gap="$1"
      >
        {([
          { key: "matches" as const, label: "matches", count: matches.length },
          { key: "draft" as const, label: "available", count: available.length },
          { key: "team" as const, label: "my squad", count: myTeam.length },
        ]).map((tb) => (
          <SegmentTab key={tb.key} active={tab === tb.key} onPress={() => setTab(tb.key)}>
            <Text
              fontFamily="$body"
              fontWeight="600"
              fontSize={13}
              color={tab === tb.key ? "$color" : "$colorMuted"}
            >
              {formatUIText(tb.label)}
            </Text>
            <Text fontFamily="$mono" fontSize={11} color={tab === tb.key ? "$colorSecondary" : "$colorMuted"}>
              {tb.count}
            </Text>
          </SegmentTab>
        ))}
      </XStack>

      {/* ── Matches Tab ── */}
      {tab === "matches" && (
        <RNScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accentBackground?.val}
            />
          }
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
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

          {dashboardQuery.isLoading ? (
            <YStack alignItems="center" paddingVertical="$10">
              <EggLoadingSpinner size={40} message={formatUIText("loading matches")} />
            </YStack>
          ) : matches.length > 0 ? (
            <>
              {matches.map((m: any, i: number) => (
                <HomeMatchCard
                  key={m.id}
                  match={m}
                  index={i}
                  onPress={() => {
                    if (m.id.startsWith("ai-")) {
                      router.push("/(tabs)/contests");
                    }
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
                  {formatUIText("no matches right now")}
                </Text>
                <Text
                  {...textStyles.hint}
                  textAlign="center"
                  lineHeight={18}
                >
                  {formatUIText("check back soon for upcoming fixtures")}
                </Text>
              </YStack>
            </Animated.View>
          )}
        </RNScrollView>
      )}

      {/* ── Draft Tab ── */}
      {tab === "draft" && (
        <YStack flex={1}>
          {/* Role Filter */}
          <RNScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 6, paddingBottom: 14 }}
          >
            {([
              { key: "all" as const, label: "all" },
              { key: "BAT" as const, label: "🏏 batsmen" },
              { key: "BOWL" as const, label: "🎯 bowlers" },
              { key: "AR" as const, label: "⚡ all-round" },
              { key: "WK" as const, label: "🧤 keepers" },
            ]).map((f) => (
              <FilterPill key={f.key} active={roleFilter === f.key} onPress={() => setRoleFilter(f.key)}>
                <Text
                  fontFamily="$body"
                  fontSize={12}
                  fontWeight="500"
                  color={roleFilter === f.key ? "$background" : "$colorSecondary"}
                >
                  {formatUIText(f.label)}
                </Text>
              </FilterPill>
            ))}
          </RNScrollView>

          <RNScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 120 }}
          >
            {/* Inline error for players */}
            {playersQuery.isError && (
              <Card marginBottom="$3" padding="$4">
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontFamily="$body" fontSize={13} color="$colorMuted">
                    {formatUIText("couldn't load players")}
                  </Text>
                  <Button size="sm" variant="secondary" onPress={() => playersQuery.refetch()}>
                    {formatUIText("retry")}
                  </Button>
                </XStack>
              </Card>
            )}

            {playersQuery.isLoading ? (
              <YStack alignItems="center" paddingVertical="$10">
                <EggLoadingSpinner size={40} message={formatUIText("loading players")} />
              </YStack>
            ) : filtered.length > 0 ? (
              filtered.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(60 + i * 40).springify()}>
                  <PlayerRow player={p} onDraft={handleDraft} />
                </Animated.View>
              ))
            ) : (
              <Animated.View entering={FadeIn.delay(80)}>
                <YStack alignItems="center" gap="$3" paddingVertical="$10">
                  <Text fontSize={DesignSystem.emptyState.iconSize}>{DesignSystem.emptyState.icon}</Text>
                  <Text fontFamily="$mono" fontSize={12} color="$colorMuted" textAlign="center">
                    {formatUIText("no players in this role")}
                  </Text>
                </YStack>
              </Animated.View>
            )}
          </RNScrollView>
        </YStack>
      )}

      {/* ── My Squad Tab ── */}
      {tab === "team" && (
        <RNScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        >
          {myTeam.length > 0 ? (
            myTeam.map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(60 + i * 40).springify()}>
                <Card marginBottom="$3">
                  <XStack alignItems="center" gap="$3">
                    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" width={20} textAlign="center">
                      {i + 1}
                    </Text>
                    <InitialsAvatar name={p.name} playerRole={p.role} ovr={p.credits * 10} size={40} />
                    <YStack flex={1}>
                      <Text {...textStyles.playerName} marginBottom={3}>
                        {p.name}
                      </Text>
                      <XStack alignItems="center" gap="$2">
                        <Badge variant="role" size="sm">{p.role}</Badge>
                        <Text {...textStyles.secondary}>{p.team}</Text>
                      </XStack>
                    </YStack>
                  </XStack>
                </Card>
              </Animated.View>
            ))
          ) : (
            <Animated.View entering={FadeIn.delay(80)}>
              <YStack alignItems="center" gap="$3" paddingVertical="$10">
                <Text fontSize={DesignSystem.emptyState.iconSize}>{DesignSystem.emptyState.icon}</Text>
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted" textAlign="center" lineHeight={20}>
                  {formatUIText(DesignSystem.emptyState.message)}
                </Text>
              </YStack>
            </Animated.View>
          )}
        </RNScrollView>
      )}
    </YStack>
  );
}

// ─── PlayerRow (extracted to avoid useState inside map) ──────────────
function PlayerRow({ player, onDraft }: { player: DraftPlayer; onDraft: (p: DraftPlayer) => void }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      pressable
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      marginBottom="$3"
      hoverStyle={{ backgroundColor: "$backgroundSurfaceHover" }}
      pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
    >
      <XStack alignItems="center" gap="$3">
        <InitialsAvatar
          name={player.name}
          playerRole={player.role}
          ovr={player.credits * 10}
          scale={isHovered ? DesignSystem.avatar.hoverScale : 1}
        />
        <YStack flex={1} minWidth={0}>
          <Text {...textStyles.playerName} marginBottom={3}>
            {player.name}
          </Text>
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            <Badge variant="role" size="sm">{player.role}</Badge>
            <Text {...textStyles.secondary}>{player.team}</Text>
            <Text color="$borderColor">·</Text>
            {Object.entries(player.stats).map(([k, v]) => (
              <StatLabel key={k} label={k} value={v} />
            ))}
          </XStack>
        </YStack>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => onDraft(player)}
        >
          {formatUIText("draft")}
        </Button>
      </XStack>
    </Card>
  );
}
