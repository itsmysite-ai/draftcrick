import {
  FlatList, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";
import { Card, Badge, Button, tokens } from "@draftcrick/ui";

// ---------------------------------------------------------------------------
// PulsingDot — animated live indicator (reanimated, needs raw color values)
// ---------------------------------------------------------------------------
function PulsingDot({ size = 6, color }: { size?: number; color?: string }) {
  const dotColor = color ?? tokens.color.error.val;

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <YStack width={size * 2} height={size * 2} alignItems="center" justifyContent="center">
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: dotColor,
          },
          animatedStyle,
        ]}
      />
      <YStack
        width={size}
        height={size}
        borderRadius={size / 2}
        backgroundColor={dotColor}
      />
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// LiveMatchCard
// ---------------------------------------------------------------------------
function LiveMatchCard({
  match,
  index,
  onPress,
}: {
  match: any;
  index: number;
  onPress: () => void;
}) {
  const theme = useTamaguiTheme();
  const isLive = match.status === "live";
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "Cricket";

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card pressable live={isLive} onPress={onPress} padding="$6" marginBottom="$3">
        {/* Header: tournament badge + live/upcoming status */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
          <Badge
            backgroundColor="$colorAccentLight"
            color="$accentBackground"
            fontFamily="$body"
            textTransform="uppercase"
            letterSpacing={0.5}
            size="sm"
            paddingHorizontal="$2"
          >
            {tournament}
          </Badge>

          <XStack alignItems="center" gap={5}>
            {isLive && <PulsingDot size={4} />}
            <Text
              fontFamily="$body"
              fontWeight="700"
              fontSize={10}
              color={isLive ? "$error" : "#4A5DB5"}
            >
              {(match.status || "upcoming").toUpperCase()}
            </Text>
          </XStack>
        </XStack>

        {/* Teams */}
        <XStack alignItems="center" justifyContent="center" marginBottom="$4">
          {/* Team A */}
          <YStack flex={1} alignItems="center" gap={6}>
            <YStack
              width={48}
              height={48}
              borderRadius={24}
              borderWidth={1}
              alignItems="center"
              justifyContent="center"
              backgroundColor="$backgroundHover"
              borderColor="$borderColor"
            >
              <Text fontFamily="$body" fontWeight="700" fontSize={14} color="$color">
                {teamA.substring(0, 3).toUpperCase()}
              </Text>
            </YStack>
            <Text
              fontFamily="$body"
              fontWeight="600"
              fontSize={14}
              color="$color"
              numberOfLines={1}
              textAlign="center"
            >
              {teamA}
            </Text>
          </YStack>

          {/* VS divider */}
          <YStack alignItems="center" gap={2}>
            <Text fontFamily="$body" fontSize={10} color="$colorMuted">
              VS
            </Text>
            {match.format && (
              <Text
                fontFamily="$body"
                fontSize={9}
                color="$colorMuted"
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                {match.format}
              </Text>
            )}
          </YStack>

          {/* Team B */}
          <YStack flex={1} alignItems="center" gap={6}>
            <YStack
              width={48}
              height={48}
              borderRadius={24}
              borderWidth={1}
              alignItems="center"
              justifyContent="center"
              backgroundColor="$backgroundHover"
              borderColor="$borderColor"
            >
              <Text fontFamily="$body" fontWeight="700" fontSize={14} color="$color">
                {teamB.substring(0, 3).toUpperCase()}
              </Text>
            </YStack>
            <Text
              fontFamily="$body"
              fontWeight="600"
              fontSize={14}
              color="$color"
              numberOfLines={1}
              textAlign="center"
            >
              {teamB}
            </Text>
          </YStack>
        </XStack>

        {/* Score summary */}
        {match.scoreSummary && (
          <YStack alignItems="center" marginBottom="$3">
            <Text fontFamily="$body" fontWeight="700" fontSize={14} color="$colorCricket">
              {match.scoreSummary}
            </Text>
          </YStack>
        )}

        {/* Footer: venue/time + action button */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop="$3"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          <XStack alignItems="center" gap="$1">
            <Ionicons name="time-outline" size={12} color={theme.colorMuted.val} />
            <Text fontFamily="$body" fontSize={10} color="$colorMuted">
              {match.time || match.venue || ""}
            </Text>
          </XStack>

          <Button
            onPress={onPress}
            size="sm"
            backgroundColor={isLive ? "$error" : "$colorAccentLight"}
            color={isLive ? "$color" : "$accentBackground"}
          >
            {isLive ? "Watch Live" : "Draft Now"}
          </Button>
        </XStack>
      </Card>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// LiveScreen (default export)
// ---------------------------------------------------------------------------
export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode } = useTheme();
  const theme = useTamaguiTheme();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch from Gemini sports API (cached 24hr)
  const aiData = trpc.sports.dashboard.useQuery(
    { sport: "cricket" },
    { staleTime: 60 * 60 * 1000, retry: 1 },
  );

  // Also fetch DB live matches (real-time 10s poll)
  const dbLive = trpc.match.live.useQuery(undefined, {
    refetchInterval: 10_000,
    retry: false,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([aiData.refetch(), dbLive.refetch()]);
    setRefreshing(false);
  }, [aiData, dbLive]);

  // Merge data: AI matches (live+upcoming) + DB live matches
  const aiMatches = aiData.data?.matches ?? [];
  const dbMatches = dbLive.data ?? [];

  const allMatches =
    aiMatches.length > 0
      ? aiMatches
      : dbMatches.map((m: any) => ({
          id: m.id,
          teamA: m.teamHome,
          teamB: m.teamAway,
          tournamentName: m.tournament,
          time: new Date(m.startTime).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          status: m.status,
          format: m.format?.toUpperCase() || "T20",
          venue: m.venue,
          sport: "cricket" as const,
          scoreSummary: m.result || null,
          sourceUrl: null,
        }));

  const liveMatches = allMatches.filter((m) => m.status === "live");
  const upcomingMatches = allMatches.filter((m) => m.status === "upcoming");
  const data = [...liveMatches, ...upcomingMatches];

  const isLoading = aiData.isLoading && dbLive.isLoading;

  if (isLoading) {
    return (
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        paddingTop={insets.top}
        backgroundColor="$background"
      >
        <ActivityIndicator color={theme.accentBackground.val} size="large" />
      </YStack>
    );
  }

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background">
      {/* Header */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$5"
        paddingVertical="$4"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
      >
        <XStack alignItems="center" gap="$2">
          <YStack width={4} height={20} borderRadius={2} backgroundColor="$error" />
          <Text fontFamily="$body" fontWeight="700" fontSize={22} color="$color">
            Live & Upcoming
          </Text>
        </XStack>

        <XStack alignItems="center" gap="$2">
          {liveMatches.length > 0 && (
            <XStack alignItems="center" gap={5}>
              <PulsingDot size={4} />
              <Text
                fontFamily="$body"
                fontWeight="600"
                fontSize={10}
                letterSpacing={1}
                color="$colorSecondary"
              >
                REAL-TIME
              </Text>
            </XStack>
          )}
          {data.length > 0 && (
            <Badge
              backgroundColor="$errorLight"
              color="$error"
              fontFamily="$body"
              fontWeight="600"
              fontSize={12}
            >
              {data.length}
            </Badge>
          )}
        </XStack>
      </XStack>

      {data.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={{ flex: 1 }}>
          <YStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            paddingHorizontal="$8"
            gap="$3"
          >
            <Ionicons name="pulse-outline" size={40} color={theme.colorMuted.val} />
            <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color">
              No matches right now
            </Text>
            <Text
              fontFamily="$body"
              fontSize={14}
              color="$colorSecondary"
              textAlign="center"
              lineHeight={22}
              marginBottom="$3"
            >
              Live scoring and real-time updates appear here during matches
            </Text>

            <Card alignSelf="stretch" gap="$3" padding="$6">
              {([
                ["flash-outline", "Real-time scores & ball-by-ball"],
                ["stats-chart-outline", "Fantasy point tracking"],
                ["notifications-outline", "Wicket & milestone alerts"],
              ] as const).map(([icon, text], i) => (
                <XStack key={i} alignItems="center" gap="$3">
                  <Ionicons name={icon} size={15} color={theme.accentBackground.val} />
                  <Text fontFamily="$body" fontSize={14} color="$colorSecondary">
                    {text}
                  </Text>
                </XStack>
              ))}
            </Card>
          </YStack>
        </Animated.View>
      ) : (
        <FlatList
          data={data}
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
            <LiveMatchCard
              match={item}
              index={index}
              onPress={() => {
                if (item.id.startsWith("ai-")) {
                  router.push("/(tabs)/contests");
                } else {
                  router.push(`/match/${item.id}`);
                }
              }}
            />
          )}
        />
      )}
    </YStack>
  );
}
