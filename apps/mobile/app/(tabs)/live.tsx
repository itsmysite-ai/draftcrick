import {
  FlatList, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  StatLabel,
  ModeToggle,
  AnnouncementBanner,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  tokens,
} from "@draftcrick/ui";

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
  const isLive = match.status === "live";
  const teamA = match.teamA || match.teamHome || "TBA";
  const teamB = match.teamB || match.teamAway || "TBA";
  const tournament = match.tournamentName || match.tournament || "cricket";

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Card pressable live={isLive} onPress={onPress} padding="$6" marginBottom="$3">
        {/* Header: tournament badge + live/upcoming status */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
          <Badge variant="role" size="sm">
            {formatBadgeText(tournament)}
          </Badge>

          <XStack alignItems="center" gap={5}>
            {isLive && <PulsingDot size={4} />}
            <Badge variant={isLive ? "live" : "default"} size="sm">
              {formatBadgeText(match.status || "upcoming")}
            </Badge>
          </XStack>
        </XStack>

        {/* Teams */}
        <XStack alignItems="center" justifyContent="center" marginBottom="$4">
          {/* Team A */}
          <YStack flex={1} alignItems="center" gap={6}>
            <InitialsAvatar
              name={teamA}
              playerRole="BAT"
              ovr={0}
              size={48}
            />
            <Text
              {...textStyles.playerName}
              numberOfLines={1}
              textAlign="center"
            >
              {teamA}
            </Text>
          </YStack>

          {/* VS divider */}
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

          {/* Team B */}
          <YStack flex={1} alignItems="center" gap={6}>
            <InitialsAvatar
              name={teamB}
              playerRole="BOWL"
              ovr={0}
              size={48}
            />
            <Text
              {...textStyles.playerName}
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
            <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">
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
          <Text {...textStyles.hint}>
            {match.time || match.venue || ""}
          </Text>

          <Button
            onPress={onPress}
            size="sm"
            variant={isLive ? "primary" : "secondary"}
            fontFamily="$mono"
          >
            {isLive ? formatUIText("watch live") : formatUIText("draft now")}
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
  const { mode, toggleMode } = useTheme();
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
        <EggLoadingSpinner size={48} message={formatUIText("loading matches")} />
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
      >
        <XStack alignItems="center" gap="$2">
          <YStack width={4} height={20} borderRadius={2} backgroundColor="$error" />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("live & upcoming")}
          </Text>
        </XStack>

        <XStack alignItems="center" gap="$3">
          {liveMatches.length > 0 && (
            <XStack alignItems="center" gap={5}>
              <PulsingDot size={4} />
              <Text fontFamily="$mono" fontSize={10} letterSpacing={1} color="$colorSecondary">
                {formatBadgeText("real-time")}
              </Text>
            </XStack>
          )}
          {data.length > 0 && (
            <Badge variant="live" size="sm">
              {data.length}
            </Badge>
          )}
          <ModeToggle mode={mode} onToggle={toggleMode} />
        </XStack>
      </XStack>

      <AnnouncementBanner />

      {data.length === 0 ? (
        <Animated.View entering={FadeIn.delay(80)} style={{ flex: 1 }}>
          <YStack
            flex={1}
            justifyContent="center"
            alignItems="center"
            paddingHorizontal="$8"
            gap="$3"
          >
            <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$3">
              {DesignSystem.emptyState.icon}
            </Text>
            <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$color">
              {formatUIText("no matches right now")}
            </Text>
            <Text
              {...textStyles.hint}
              textAlign="center"
              lineHeight={20}
              marginBottom="$3"
            >
              {formatUIText("live scoring and real-time updates appear here during matches")}
            </Text>

            <Card alignSelf="stretch" gap="$3" padding="$6">
              {([
                "real-time scores & ball-by-ball",
                "fantasy point tracking",
                "wicket & milestone alerts",
              ]).map((text, i) => (
                <XStack key={i} alignItems="center" gap="$3">
                  <Text fontFamily="$mono" fontSize={11} color="$colorAccent">
                    &gt;
                  </Text>
                  <Text fontFamily="$body" fontSize={14} color="$colorSecondary">
                    {formatUIText(text)}
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
