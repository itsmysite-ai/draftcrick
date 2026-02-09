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
import { Card, Badge, Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

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
            textTransform="uppercase"
            letterSpacing={0.5}
            fontWeight="600"
          >
            {tournament}
          </Badge>
          <Badge
            backgroundColor={isLive ? "$error" : "$info"}
            color="$color"
            size="sm"
            fontWeight="700"
            letterSpacing={0.3}
            fontSize={9}
          >
            {isLive ? "LIVE" : "UPCOMING"}
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
            variant="primary"
            size="sm"
            onPress={onPress}
            iconAfter={
              <Ionicons
                name="chevron-forward"
                size={12}
                color={theme.accentColor.val}
              />
            }
          >
            Draft
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
        alignItems="center"
        paddingHorizontal="$5"
        paddingVertical="$4"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
      >
        <XStack alignItems="center" gap="$2">
          <YStack
            width={4}
            height={20}
            borderRadius={2}
            backgroundColor="$colorCricket"
          />
          <Text
            fontFamily="$heading"
            fontWeight="700"
            fontSize={22}
            color="$color"
          >
            Contests
          </Text>
        </XStack>
      </XStack>

      {/* Tab switcher */}
      <XStack
        marginHorizontal="$5"
        marginTop="$4"
        marginBottom="$4"
        borderRadius="$2"
        borderWidth={1}
        borderColor="$borderColor"
        backgroundColor="$backgroundSurface"
        padding={3}
      >
        <XStack
          flex={1}
          paddingVertical="$2"
          alignItems="center"
          justifyContent="center"
          borderRadius="$1"
          backgroundColor={
            tab === "browse" ? "$backgroundPress" : "transparent"
          }
          onPress={() => setTab("browse")}
          cursor="pointer"
        >
          <Text
            fontFamily="$body"
            fontWeight="600"
            fontSize={12}
            color={tab === "browse" ? "$color" : "$colorMuted"}
          >
            Browse Matches
          </Text>
        </XStack>
        <XStack
          flex={1}
          paddingVertical="$2"
          alignItems="center"
          justifyContent="center"
          borderRadius="$1"
          backgroundColor={
            tab === "my" ? "$backgroundPress" : "transparent"
          }
          onPress={() => setTab("my")}
          cursor="pointer"
        >
          <Text
            fontFamily="$body"
            fontWeight="600"
            fontSize={12}
            color={tab === "my" ? "$color" : "$colorMuted"}
          >
            My Contests
            {userContests.length > 0 ? ` (${userContests.length})` : ""}
          </Text>
        </XStack>
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
                <Ionicons
                  name="trophy-outline"
                  size={36}
                  color={theme.colorMuted.val}
                />
                <Text fontFamily="$heading" fontSize={18} color="$color">
                  No available matches
                </Text>
                <Text
                  fontFamily="$body"
                  fontSize={14}
                  color="$colorSecondary"
                  textAlign="center"
                  lineHeight={22}
                >
                  Contests will appear when matches are scheduled
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
            <Ionicons
              name="trophy-outline"
              size={40}
              color={theme.colorMuted.val}
            />
            <Text fontFamily="$heading" fontSize={18} color="$color">
              Sign in to view contests
            </Text>
            <Text
              fontFamily="$body"
              fontSize={14}
              color="$colorSecondary"
              textAlign="center"
              lineHeight={22}
            >
              Create and track your fantasy contests
            </Text>
            <Button
              variant="primary"
              size="md"
              marginTop="$3"
              onPress={() => router.push("/auth/login")}
              iconAfter={
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={theme.accentColor.val}
                />
              }
            >
              Sign In
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
            <Ionicons
              name="trophy-outline"
              size={40}
              color={theme.colorMuted.val}
            />
            <Text fontFamily="$heading" fontSize={18} color="$color">
              No contests yet
            </Text>
            <Text
              fontFamily="$body"
              fontSize={14}
              color="$colorSecondary"
              textAlign="center"
              lineHeight={22}
            >
              Browse matches and join your first contest
            </Text>
            <Button
              variant="primary"
              size="md"
              marginTop="$3"
              onPress={() => setTab("browse")}
            >
              Browse Matches
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
