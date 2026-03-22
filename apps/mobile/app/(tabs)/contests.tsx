import {
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  SegmentTab,
  AnnouncementBanner,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";
import { useAuth } from "../../providers/AuthProvider";

// ─── Contest Card ─────────────────────────────────────────────────────
function ContestCard({
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
  const status = contest?.status ?? "upcoming";

  const statusConfig: Record<string, { color: string; bg: string }> = {
    live: { color: "$error", bg: "$errorLight" },
    settling: { color: "$colorAccent", bg: "$colorAccentLight" },
    settled: { color: "$colorAccent", bg: "$colorAccentLight" },
    cancelled: { color: "$colorMuted", bg: "$backgroundHover" },
    open: { color: "$colorCricket", bg: "$colorCricketLight" },
    upcoming: { color: "#5DA8B8", bg: "rgba(93, 168, 184, 0.1)" },
    locked: { color: "$colorMuted", bg: "$backgroundHover" },
  };
  const cfg = statusConfig[status] ?? statusConfig.upcoming!;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card pressable onPress={onPress} marginBottom="$3" padding={0} overflow="hidden">
        <XStack justifyContent="space-between" alignItems="flex-start" padding="$4" paddingBottom="$3">
          <YStack flex={1}>
            <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" numberOfLines={1} ellipsizeMode="tail" marginBottom={2}>
              {contest?.name ?? "Contest"}
            </Text>
            {match && (
              <Text fontFamily="$body" fontSize={12} color="$colorSecondary">
                {formatTeamName(match.teamHome)} vs {formatTeamName(match.teamAway)}
              </Text>
            )}
            {match?.format && (
              <XStack alignItems="center" gap="$2" marginTop={2}>
                <Badge variant="default" size="sm">{formatBadgeText(match.format)}</Badge>
              </XStack>
            )}
          </YStack>
          <Badge backgroundColor={cfg.bg as any} color={cfg.color as any} size="sm" fontWeight="700">
            {status.toUpperCase()}
          </Badge>
        </XStack>

        {/* Score for live/completed */}
        {match?.scoreSummary && (
          <YStack paddingHorizontal="$4" paddingBottom="$2">
            <Text fontFamily="$mono" fontWeight="800" fontSize={13} color={match.status === "live" ? "$color" : "$colorCricket"} textAlign="center">
              {match.scoreSummary}
            </Text>
          </YStack>
        )}

        {/* Stats strip */}
        <XStack borderTopWidth={1} borderTopColor="$borderColor" paddingVertical="$3" marginHorizontal="$4">
          <YStack flex={1.4} alignItems="center" overflow="hidden" paddingHorizontal={2}>
            <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
              Your Team
            </Text>
            <Text fontFamily="$body" fontWeight="700" fontSize={12} color="$color" numberOfLines={1} ellipsizeMode="tail">
              {item.name ?? "—"}
            </Text>
          </YStack>
          <YStack width={1} backgroundColor="$borderColor" />
          {item.rank && (
            <>
              <YStack flex={0.7} alignItems="center">
                <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
                  Rank
                </Text>
                <Text fontFamily="$mono" fontWeight="800" fontSize={15} color="$accentBackground">
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
          <YStack flex={0.9} alignItems="center">
            <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
              Points
            </Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color">
              {item.totalPoints?.toFixed?.(1) ?? "0.0"}
            </Text>
          </YStack>
          <YStack width={1} backgroundColor="$borderColor" />
          <YStack flex={1} alignItems="center">
            <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
              {status === "settled" ? "Won" : "Pool"}
            </Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorAccent" numberOfLines={1}>
              {status === "settled"
                ? (item.prizeWon > 0 ? `${item.prizeWon.toLocaleString()} PC` : "—")
                : (contest?.prizePool > 0 ? `${contest.prizePool.toLocaleString()} PC` : "FREE")}
            </Text>
          </YStack>
        </XStack>
      </Card>
    </Animated.View>
  );
}

// ─── Team Card ──────────────────────────────────────────────────────
function TeamCard({
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
  const status = contest?.status ?? (match?.status === "completed" ? "settled" : match?.status === "live" ? "live" : "upcoming");
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
  const cfg = statusConfig[status] ?? statusConfig.upcoming!;

  const teamCount = Array.isArray(item.players) ? item.players.length : 0;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card pressable onPress={onPress} marginBottom="$3" padding={0} overflow="hidden">
        <XStack justifyContent="space-between" alignItems="flex-start" padding="$4" paddingBottom="$3">
          <YStack flex={1}>
            <Text fontFamily="$body" fontWeight="600" fontSize={15} color="$color" numberOfLines={1} marginBottom={2}>
              {item.name ?? (match ? `${formatTeamName(match.teamHome)} vs ${formatTeamName(match.teamAway)}` : "My Team")}
            </Text>
            {match && (
              <XStack alignItems="center" gap="$2">
                <Text fontFamily="$body" fontSize={12} color="$colorSecondary">
                  {formatTeamName(match.teamHome)} vs {formatTeamName(match.teamAway)}
                </Text>
                {match.format && (
                  <Badge variant="default" size="sm">{formatBadgeText(match.format)}</Badge>
                )}
              </XStack>
            )}
            {hasContest && (
              <Text fontFamily="$mono" fontSize={10} color="$colorAccent" marginTop={2}>
                {contest.name}
              </Text>
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

        {match?.scoreSummary && (
          <YStack paddingHorizontal="$4" paddingBottom="$2">
            <Text fontFamily="$mono" fontWeight="800" fontSize={13} color={match.status === "live" ? "$color" : "$colorCricket"} textAlign="center">
              {match.scoreSummary}
            </Text>
          </YStack>
        )}

        <XStack borderTopWidth={1} borderTopColor="$borderColor" paddingVertical="$3" marginHorizontal="$4">
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
            <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color">
              {item.totalPoints?.toFixed?.(1) ?? "0.0"}
            </Text>
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
          <YStack width={1} backgroundColor="$borderColor" />
          <YStack flex={1} alignItems="center">
            <Text fontFamily="$body" fontSize={10} color="$colorMuted" textTransform="uppercase" letterSpacing={0.3} marginBottom={2}>
              Credits
            </Text>
            <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color">
              {item.creditsUsed ?? "-"}
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
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"contests" | "my teams">("contests");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "live" | "completed">("all");

  const myContests = trpc.contest.myContests.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await myContests.refetch();
    setRefreshing(false);
  }, [myContests]);

  const allItems = useMemo(() => {
    const teams = myContests.data ?? [];
    return teams.map((t: any) => ({
      ...t,
      match: t.match ?? t.contest?.match ?? null,
      type: t.contestId ? "contest" : "team",
    }));
  }, [myContests.data]);

  // Split into contests (teams linked to a contest) and standalone teams
  const contestItems = useMemo(() => allItems.filter((i: any) => !!i.contest), [allItems]);
  const teamItems = useMemo(() => allItems, [allItems]); // all teams shown in "my teams" view

  // Apply status filter to the active view
  const activeItems = view === "contests" ? contestItems : teamItems;

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") return activeItems;
    return activeItems.filter((item: any) => {
      const match = item.match;
      if (!match) return statusFilter === "upcoming";
      return match.status === statusFilter;
    });
  }, [activeItems, statusFilter]);

  const filterCounts = useMemo(() => ({
    all: activeItems.length,
    upcoming: activeItems.filter((i: any) => !i.match || i.match.status === "upcoming").length,
    live: activeItems.filter((i: any) => i.match?.status === "live").length,
    completed: activeItems.filter((i: any) => i.match?.status === "completed").length,
  }), [activeItems]);

  const isLoading = myContests.isLoading;

  const headerTitle = view === "contests" ? "contests" : "my teams";
  const itemCount = activeItems.length;

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="contests-screen">
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$5" paddingVertical="$4">
        <XStack alignItems="center" gap="$2">
          <YStack width={4} height={20} borderRadius={2} backgroundColor="$colorAccent" />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText(headerTitle)}
          </Text>
          {itemCount > 0 && (
            <Badge variant="default" size="sm">
              {itemCount}
            </Badge>
          )}
        </XStack>
        <HeaderControls />
      </XStack>

      <AnnouncementBanner />

      {/* View toggle: contests | my teams */}
      {user && (
        <XStack marginHorizontal="$5" marginBottom="$3" borderRadius="$3" backgroundColor="$backgroundSurfaceAlt" padding="$1" gap="$1">
          {(["contests", "my teams"] as const).map((v) => (
            <SegmentTab
              key={v}
              active={view === v}
              onPress={() => { setView(v); setStatusFilter("all"); }}
              testID={`view-${v.replace(" ", "-")}`}
            >
              <Text fontFamily="$body" fontWeight="600" fontSize={13} color={view === v ? "$color" : "$colorMuted"}>
                {formatUIText(v)}
              </Text>
              <Text fontFamily="$mono" fontSize={11} color={view === v ? "$colorSecondary" : "$colorMuted"}>
                {v === "contests" ? contestItems.length : teamItems.length}
              </Text>
            </SegmentTab>
          ))}
        </XStack>
      )}

      {/* Status filter chips */}
      {user && activeItems.length > 0 && (
        <XStack marginHorizontal="$5" marginBottom="$3" borderRadius="$3" backgroundColor="$backgroundSurfaceAlt" padding="$1" gap="$1">
          {(["all", "upcoming", "live", "completed"] as const).map((f) => (
            <SegmentTab
              key={f}
              active={statusFilter === f}
              onPress={() => setStatusFilter(f)}
              testID={`filter-${f}`}
            >
              <Text fontFamily="$body" fontWeight="600" fontSize={13} color={statusFilter === f ? "$color" : "$colorMuted"}>
                {formatUIText(f)}
              </Text>
              {filterCounts[f] > 0 && (
                <Text fontFamily="$mono" fontSize={11} color={statusFilter === f ? "$colorSecondary" : "$colorMuted"}>
                  {filterCounts[f]}
                </Text>
              )}
            </SegmentTab>
          ))}
        </XStack>
      )}

      {/* Content */}
      {!user ? (
        <Animated.View entering={FadeIn.delay(80)} style={{ flex: 1 }}>
          <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$8" gap="$3">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color">
              {formatUIText("sign in to view your contests")}
            </Text>
            <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
              {formatUIText("join contests and track your performance")}
            </Text>
            <Button variant="primary" size="md" marginTop="$3" onPress={() => router.push("/auth/login")} testID="contests-signin-btn">
              {formatUIText("sign in")}
            </Button>
          </YStack>
        </Animated.View>
      ) : isLoading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <EggLoadingSpinner size={40} message={formatUIText(view === "contests" ? "loading contests" : "loading your teams")} />
        </YStack>
      ) : filteredItems.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={{ flex: 1 }}>
          <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$8" gap="$3">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color">
              {formatUIText(
                statusFilter === "all"
                  ? view === "contests" ? "no contests yet" : "no teams yet"
                  : `no ${statusFilter} ${view === "contests" ? "contests" : "teams"}`
              )}
            </Text>
            <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
              {formatUIText(
                statusFilter === "all"
                  ? "pick a match from the home screen and build your dream xi"
                  : "try a different filter"
              )}
            </Text>
            {statusFilter === "all" && (
              <Button variant="primary" size="md" marginTop="$3" onPress={() => router.push("/(tabs)")} testID="go-home-btn">
                {formatUIText("browse matches")}
              </Button>
            )}
            {statusFilter !== "all" && (
              <Button variant="secondary" size="md" marginTop="$3" onPress={() => setStatusFilter("all")} testID="clear-filter-btn">
                {formatUIText(view === "contests" ? "show all contests" : "show all teams")}
              </Button>
            )}
          </YStack>
        </Animated.View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(i) => i.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground?.val} />
          }
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) =>
            view === "contests" ? (
              <ContestCard
                item={item}
                index={index}
                onPress={() => router.push(`/contest/${item.contest.id}`)}
              />
            ) : (
              <TeamCard
                item={item}
                index={index}
                onPress={() => router.push(`/team/${item.id}`)}
              />
            )
          }
        />
      )}
    </YStack>
  );
}
