import { ScrollView as RNScrollView } from "react-native";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import {
  XStack,
  YStack,
  Text,
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
  MatchCard,
  formatUIText,
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

// ─── Main ───────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { mode, toggleMode } = useTheme();

  // ── tRPC queries ──
  const dashboardQuery = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 5 * 60_000 },
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

  // ── Retry handler ──
  const handleRetry = useCallback(() => {
    dashboardQuery.refetch();
    playersQuery.refetch();
  }, [dashboardQuery, playersQuery]);

  // ── Full-screen loading state ──
  const isInitialLoad = dashboardQuery.isLoading && playersQuery.isLoading;
  if (isInitialLoad) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <EggLoadingSpinner size={56} message="fetching matches" />
      </YStack>
    );
  }

  // ── Full-screen error state ──
  const hasError = dashboardQuery.isError && playersQuery.isError;
  if (hasError) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" padding="$6">
        <Text fontSize={48} marginBottom="$4">😵</Text>
        <Text fontFamily="$body" fontWeight="600" fontSize={16} color="$color" textAlign="center" marginBottom="$2">
          something went wrong
        </Text>
        <Text fontFamily="$mono" fontSize={12} color="$colorMuted" textAlign="center" marginBottom="$6" lineHeight={18}>
          {dashboardQuery.error?.message ?? "couldn't load cricket data. check your connection."}
        </Text>
        <Button variant="primary" onPress={handleRetry}>
          try again
        </Button>
      </YStack>
    );
  }

  const matches = dashboardQuery.data?.matches ?? [];

  return (
    <YStack flex={1} backgroundColor="$background">
      <RNScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <Animated.View entering={FadeIn.delay(0)}>
          <XStack
            justifyContent="space-between"
            alignItems="flex-start"
            paddingHorizontal="$4"
            paddingBottom="$5"
            paddingTop={insets.top + 8}
          >
            <YStack>
              <XStack alignItems="center" gap="$2">
                <Text fontSize={22}>🥚</Text>
                <Text fontFamily="$mono" fontSize={17} fontWeight="500" color="$color" letterSpacing={-0.5}>
                  tami·draft
                </Text>
                <XStack backgroundColor="$colorAccentLight" paddingHorizontal={7} paddingVertical={2} borderRadius="$1">
                  <Text fontFamily="$mono" fontSize={9} fontWeight="600" color="$colorAccent">
                    🏏 cricket
                  </Text>
                </XStack>
              </XStack>
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop={3} marginLeft={30}>
                fantasy cricket companion
              </Text>
            </YStack>

            <ModeToggle mode={mode} onToggle={toggleMode} />
          </XStack>
        </Animated.View>

        {/* ── Announcement Banner ── */}
        <Animated.View entering={FadeInDown.delay(30).springify()}>
          <AnnouncementBanner />
        </Animated.View>

        {/* ── Segment Tabs: Matches / Available / My Squad ── */}
        <XStack
          backgroundColor="$backgroundSurfaceAlt"
          marginHorizontal="$4"
          marginBottom="$3"
          borderRadius="$3"
          padding="$1"
          gap="$1"
        >
          {([
            { key: "matches" as const, label: formatUIText("matches"), count: matches.length },
            { key: "draft" as const, label: formatUIText("available"), count: available.length },
            { key: "team" as const, label: formatUIText("my squad"), count: myTeam.length },
          ]).map((tb) => (
            <SegmentTab key={tb.key} active={tab === tb.key} onPress={() => setTab(tb.key)}>
              <Text
                fontFamily="$body"
                fontWeight="600"
                fontSize={13}
                color={tab === tb.key ? "$color" : "$colorMuted"}
              >
                {tb.label}
              </Text>
              <Text fontFamily="$mono" fontSize={11} color={tab === tb.key ? "$colorSecondary" : "$colorMuted"}>
                {tb.count}
              </Text>
            </SegmentTab>
          ))}
        </XStack>

        {/* ── Tab Content ── */}
        {tab === "matches" && (
          <YStack paddingHorizontal="$4" gap="$2">
            {/* Inline error banner for dashboard (non-blocking) */}
            {dashboardQuery.isError && (
              <Card>
                <XStack alignItems="center" justifyContent="space-between">
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontSize={13} color="$colorMuted">
                      couldn't refresh matches
                    </Text>
                  </YStack>
                  <Button size="sm" variant="secondary" onPress={() => dashboardQuery.refetch()}>
                    retry
                  </Button>
                </XStack>
              </Card>
            )}

            {dashboardQuery.isLoading ? (
              <YStack alignItems="center" paddingVertical="$8">
                <EggLoadingSpinner size={40} message="loading matches" />
              </YStack>
            ) : matches.length > 0 ? (
              matches.map((m: any, i: number) => (
                <Animated.View key={m.id} entering={FadeInDown.delay(60 + i * 40).springify()}>
                  <MatchCard
                    teamHome={m.teamA}
                    teamAway={m.teamB}
                    venue={m.venue ?? m.tournamentName}
                    startTime={new Date(`${m.date} ${m.time}`)}
                    status={m.status === "delayed" || m.status === "abandoned" ? "abandoned" : m.status}
                    result={m.scoreSummary}
                    onPress={() => {
                      // Navigate to match detail when available
                    }}
                  />
                </Animated.View>
              ))
            ) : (
              <YStack alignItems="center" paddingVertical="$8">
                <Text fontSize={48} marginBottom="$4">🏏</Text>
                <Text fontFamily="$body" fontWeight="600" fontSize={15} color="$color" textAlign="center" marginBottom="$2">
                  no matches right now
                </Text>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted" textAlign="center" lineHeight={18}>
                  check back soon for upcoming fixtures
                </Text>
              </YStack>
            )}

            {/* Data source footer */}
            {dashboardQuery.data?.lastFetched && (
              <Text fontFamily="$mono" fontSize={9} color="$colorMuted" textAlign="center" marginTop="$2">
                last updated: {new Date(dashboardQuery.data.lastFetched).toLocaleTimeString()}
              </Text>
            )}
          </YStack>
        )}

        {/* ── Role Filter (draft tab only) ── */}
        {tab === "draft" && (
          <RNScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 14 }}
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
                  {f.label}
                </Text>
              </FilterPill>
            ))}
          </RNScrollView>
        )}

        {/* ── Player List (draft tab) ── */}
        {tab === "draft" && (
          <YStack paddingHorizontal="$4" gap="$2">
            {/* Inline error for players */}
            {playersQuery.isError && (
              <Card>
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontFamily="$body" fontSize={13} color="$colorMuted">
                    couldn't load players
                  </Text>
                  <Button size="sm" variant="secondary" onPress={() => playersQuery.refetch()}>
                    retry
                  </Button>
                </XStack>
              </Card>
            )}

            {playersQuery.isLoading ? (
              <YStack alignItems="center" paddingVertical="$8">
                <EggLoadingSpinner size={40} message="loading players" />
              </YStack>
            ) : filtered.length > 0 ? (
              filtered.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(60 + i * 40).springify()}>
                  <PlayerRow player={p} onDraft={handleDraft} />
                </Animated.View>
              ))
            ) : (
              <YStack alignItems="center" paddingVertical="$8">
                <Text fontSize={40} marginBottom="$3">🏏</Text>
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted" textAlign="center">
                  no players in this role
                </Text>
              </YStack>
            )}
          </YStack>
        )}

        {/* ── My Squad (team tab) ── */}
        {tab === "team" && (
          <YStack paddingHorizontal="$4" gap="$2">
            {myTeam.length > 0 ? (
              myTeam.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(60 + i * 40).springify()}>
                  <Card>
                    <XStack alignItems="center" gap="$3">
                      <Text fontFamily="$mono" fontSize={11} color="$colorMuted" width={20} textAlign="center">
                        {i + 1}
                      </Text>
                      <InitialsAvatar name={p.name} playerRole={p.role} ovr={p.credits * 10} size={40} />
                      <YStack flex={1}>
                        <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" marginBottom={3}>
                          {p.name}
                        </Text>
                        <XStack alignItems="center" gap="$2">
                          <Badge variant="role" size="sm">{p.role}</Badge>
                          <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{p.team}</Text>
                        </XStack>
                      </YStack>
                    </XStack>
                  </Card>
                </Animated.View>
              ))
            ) : (
              <YStack alignItems="center" paddingVertical="$8">
                <Text fontSize={48} marginBottom="$4">🥚</Text>
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted" textAlign="center" lineHeight={20}>
                  draft cricketers to hatch your squad
                </Text>
              </YStack>
            )}
          </YStack>
        )}
      </RNScrollView>
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
    >
      <XStack alignItems="center" gap="$3">
        <InitialsAvatar
          name={player.name}
          playerRole={player.role}
          ovr={player.credits * 10}
          scale={isHovered ? 1.12 : 1}
        />
        <YStack flex={1} minWidth={0}>
          <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" marginBottom={3}>
            {player.name}
          </Text>
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            <Badge variant="role" size="sm">{player.role}</Badge>
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{player.team}</Text>
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
          backgroundColor={isHovered ? "$accentBackground" : "$backgroundSurfaceAlt"}
          color={isHovered ? "$white" : "$colorMuted"}
        >
          draft
        </Button>
      </XStack>
    </Card>
  );
}
