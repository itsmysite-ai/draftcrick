import {
  FlatList,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Badge, Button, SegmentTab, ModeToggle, AnnouncementBanner, formatUIText, formatBadgeText } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

// ─── Match-based contest browser card ──────────────────────────────────
function MatchContestCard({
  match,
  index,
  onPress,
}: {
  match: any;
  index: number;
  onPress: () => void;
}) {
  const theme = useTamaguiTheme();
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "Cricket";
  const isLive = match.status === "live";

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card
        pressable
        onPress={onPress}
        hoverStyle={{ backgroundColor: "$backgroundSurfaceHover" }}
        pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
        marginBottom="$3"
        padding="$6"
      >
        {/* Header */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          marginBottom="$2"
        >
          <Badge
            backgroundColor="$colorAccentLight"
            color="$colorAccent"
            size="sm"
            fontWeight="600"
          >
            {formatBadgeText(tournament)}
          </Badge>
          <Badge
            variant={isLive ? "live" : "default"}
            size="sm"
            fontWeight="700"
          >
            {formatBadgeText(isLive ? "LIVE" : "UPCOMING")}
          </Badge>
        </XStack>

        {/* Teams */}
        <Text
          color="$color"
          fontFamily="$heading"
          fontSize={18}
          marginBottom="$4"
        >
          {teamA} vs {teamB}
        </Text>

        {/* Footer */}
        <XStack
          alignItems="center"
          gap="$2"
          paddingTop="$3"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          <XStack alignItems="center" gap="$1" flex={1}>
            <Ionicons
              name="time-outline"
              size={12}
              color={theme.colorMuted.val}
            />
            <Text color="$colorMuted" fontFamily="$body" fontSize={12}>
              {match.time || "TBD"}
            </Text>
          </XStack>
          {match.format && (
            <Badge
              backgroundColor="$backgroundPress"
              color="$colorSecondary"
              size="sm"
              letterSpacing={0.3}
              fontSize={10}
            >
              {match.format}
            </Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            onPress={onPress}
          >
            {formatUIText("draft")}
          </Button>
        </XStack>
      </Card>
    </Animated.View>
  );
}

// ─── User's contest card ───────────────────────────────────────────────
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
  const match = contest?.match;
  const status = contest?.status ?? "open";

  const statusConfig: Record<string, { color: string; bg: string }> = {
    live: { color: "$error", bg: "$errorLight" },
    settled: { color: "$colorAccent", bg: "$colorAccentLight" },
    open: { color: "$colorCricket", bg: "$colorCricketLight" },
    upcoming: { color: "#5DA8B8", bg: "rgba(93, 168, 184, 0.1)" },
  };
  const cfg = statusConfig[status] ?? statusConfig.open!;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card
        pressable
        onPress={onPress}
        hoverStyle={{ backgroundColor: "$backgroundSurfaceHover" }}
        pressStyle={{ backgroundColor: "$backgroundPress", scale: 0.98 }}
        marginBottom="$3"
        padding={0}
        overflow="hidden"
      >
        {/* Top section */}
        <XStack
          justifyContent="space-between"
          alignItems="flex-start"
          padding="$6"
          paddingBottom="$3"
        >
          <YStack flex={1}>
            <Text
              color="$color"
              fontFamily="$body"
              fontWeight="600"
              fontSize={16}
              numberOfLines={1}
              marginBottom={2}
            >
              {contest?.name ?? "Contest"}
            </Text>
            {match && (
              <Text color="$colorSecondary" fontFamily="$body" fontSize={12}>
                {match.teamHome} vs {match.teamAway}
              </Text>
            )}
          </YStack>
          <Badge
            backgroundColor={cfg.bg as any}
            color={cfg.color as any}
            size="sm"
            fontWeight="700"
            letterSpacing={0.3}
          >
            {status.toUpperCase()}
          </Badge>
        </XStack>

        {/* Stats row */}
        <XStack
          borderTopWidth={1}
          borderTopColor="$borderColor"
          paddingVertical="$3"
          marginHorizontal="$6"
        >
          <YStack flex={1} alignItems="center">
            <Text
              color="$colorMuted"
              fontFamily="$body"
              fontSize={10}
              textTransform="uppercase"
              letterSpacing={0.3}
              marginBottom={2}
            >
              Points
            </Text>
            <Text
              color="$color"
              fontFamily="$body"
              fontWeight="700"
              fontSize={16}
            >
              {item.totalPoints.toFixed(1)}
            </Text>
          </YStack>
          <YStack width={1} backgroundColor="$borderColor" />
          <YStack flex={1} alignItems="center">
            <Text
              color="$colorMuted"
              fontFamily="$body"
              fontSize={10}
              textTransform="uppercase"
              letterSpacing={0.3}
              marginBottom={2}
            >
              Prize Pool
            </Text>
            <Text
              color="$colorAccent"
              fontFamily="$body"
              fontWeight="700"
              fontSize={16}
            >
              {contest
                ? contest.prizePool > 0
                  ? `\u20B9${contest.prizePool.toLocaleString()}`
                  : "FREE"
                : "-"}
            </Text>
          </YStack>
          <YStack width={1} backgroundColor="$borderColor" />
          <YStack flex={1} alignItems="center">
            <Text
              color="$colorMuted"
              fontFamily="$body"
              fontSize={10}
              textTransform="uppercase"
              letterSpacing={0.3}
              marginBottom={2}
            >
              Entry
            </Text>
            <Text
              color="$color"
              fontFamily="$body"
              fontWeight="700"
              fontSize={16}
            >
              {contest
                ? contest.entryFee === 0
                  ? "FREE"
                  : `\u20B9${contest.entryFee}`
                : "-"}
            </Text>
          </YStack>
        </XStack>
      </Card>
    </Animated.View>
  );
}

export default function ContestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"browse" | "my">("browse");

  // Gemini AI-powered match data for browsing
  const aiData = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60 * 1000, retry: 1 },
  );

  // User's contests
  const myContests = trpc.contest.myContests.useQuery(undefined, {
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([aiData.refetch(), myContests.refetch()]);
    setRefreshing(false);
  }, [aiData, myContests]);

  const isUnauth = myContests.error?.data?.code === "UNAUTHORIZED";
  const aiMatches =
    aiData.data?.matches?.filter(
      (m) => m.status === "upcoming" || m.status === "live",
    ) ?? [];
  const userContests = myContests.data ?? [];

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background">
      {/* Header */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$5"
        paddingVertical="$4"
      >
        <Text
          fontFamily="$mono"
          fontWeight="500"
          fontSize={17}
          color="$color"
          letterSpacing={-0.5}
        >
          {formatUIText("contests")}
        </Text>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      <AnnouncementBanner />

      {/* Tab switcher */}
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
          { key: "browse" as const, label: "Browse Matches", count: aiMatches.length },
          { key: "my" as const, label: "My Contests", count: userContests.length },
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
            {tb.count > 0 && (
              <Text fontFamily="$mono" fontSize={11} color={tab === tb.key ? "$colorSecondary" : "$colorMuted"}>
                {tb.count}
              </Text>
            )}
          </SegmentTab>
        ))}
      </XStack>

      {tab === "browse" ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accentBackground.val}
            />
          }
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        >
          {aiData.isLoading ? (
            <ActivityIndicator
              color={theme.accentBackground.val}
              style={{ paddingVertical: 40 }}
            />
          ) : aiMatches.length > 0 ? (
            aiMatches.map((m, i) => (
              <MatchContestCard
                key={m.id}
                match={m}
                index={i}
                onPress={() => {
                  if (m.id.startsWith("ai-")) {
                    // AI match — show details
                  } else {
                    router.push(`/match/${m.id}`);
                  }
                }}
              />
            ))
          ) : (
            <Animated.View entering={FadeIn.delay(80)}>
              <YStack alignItems="center" gap="$3" paddingVertical="$10">
                <Text fontSize={48}>🥚</Text>
                <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                  {formatUIText("no available matches")}
                </Text>
                <Text
                  fontFamily="$mono"
                  fontSize={11}
                  color="$colorMuted"
                  textAlign="center"
                  lineHeight={18}
                >
                  {formatUIText("contests will appear when matches are scheduled")}
                </Text>
              </YStack>
            </Animated.View>
          )}
        </ScrollView>
      ) : /* My Contests */
      isUnauth ? (
        <Animated.View entering={FadeIn.delay(80)} style={{ flex: 1 }}>
          <YStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            paddingHorizontal="$8"
            gap="$3"
          >
            <Text fontSize={48}>🥚</Text>
            <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
              {formatUIText("sign in to view contests")}
            </Text>
            <Text
              fontFamily="$mono"
              fontSize={11}
              color="$colorMuted"
              textAlign="center"
              lineHeight={18}
            >
              {formatUIText("create and track your fantasy contests")}
            </Text>
            <Button
              variant="primary"
              size="md"
              marginTop="$3"
              onPress={() => router.push("/auth/login")}
            >
              {formatUIText("sign in")}
            </Button>
          </YStack>
        </Animated.View>
      ) : myContests.isLoading ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator
            color={theme.accentBackground.val}
            size="large"
          />
        </YStack>
      ) : userContests.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={{ flex: 1 }}>
          <YStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            paddingHorizontal="$8"
            gap="$3"
          >
            <Text fontSize={48}>🥚</Text>
            <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
              {formatUIText("no contests yet")}
            </Text>
            <Text
              fontFamily="$mono"
              fontSize={11}
              color="$colorMuted"
              textAlign="center"
              lineHeight={18}
            >
              {formatUIText("browse matches and join your first contest")}
            </Text>
            <Button
              variant="primary"
              size="md"
              marginTop="$3"
              onPress={() => setTab("browse")}
            >
              {formatUIText("browse matches")}
            </Button>
          </YStack>
        </Animated.View>
      ) : (
        <FlatList
          data={userContests}
          keyExtractor={(i) => i.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.accentBackground.val}
            />
          }
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <UserContestCard
              item={item}
              index={index}
              onPress={() =>
                item.contest
                  ? router.push(`/contest/${item.contest.id}`)
                  : undefined
              }
            />
          )}
        />
      )}
    </YStack>
  );
}
