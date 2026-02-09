import { ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  BackButton,
  InitialsAvatar,
  StatLabel,
  ModeToggle,
  AnnouncementBanner,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

export default function ContestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const contest = trpc.contest.getById.useQuery({ id: id! }, { enabled: !!id });
  const standings = trpc.contest.getStandings.useQuery({ contestId: id! }, { enabled: !!id });
  const onRefresh = useCallback(async () => { setRefreshing(true); await Promise.all([contest.refetch(), standings.refetch()]); setRefreshing(false); }, [contest, standings]);

  if (contest.isLoading) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <EggLoadingSpinner size={48} message={formatUIText("loading contest")} />
    </YStack>
  );
  const c = contest.data;
  if (!c) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$4">{DesignSystem.emptyState.icon}</Text>
      <Text {...textStyles.hint}>{formatUIText("contest not found")}</Text>
    </YStack>
  );

  const match = c.match;
  const isOpen = c.status === "open";
  const isLive = c.status === "live";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.val }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />}>
      {/* ── Inline Header ── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("contest")}
          </Text>
        </XStack>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      {/* Contest Header */}
      <YStack padding="$5">
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5} flex={1}>
            {c.name}
          </Text>
          <Badge variant={isLive ? "live" : "role"} size="sm">
            {formatBadgeText(c.status ?? "open")}
          </Badge>
        </XStack>
        {match && (
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
              {match.teamHome} {formatUIText("vs")} {match.teamAway}
            </Text>
            <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$accentBackground">
              {match.tournament ?? formatUIText("cricket")}
            </Text>
          </XStack>
        )}
      </YStack>

      <AnnouncementBanner />

      {/* Stats Grid */}
      <XStack flexWrap="wrap" padding="$4" gap="$3">
        {[
          { label: formatUIText("prize pool"), value: `\u20B9${c.prizePool}` },
          { label: formatUIText("entry fee"), value: c.entryFee === 0 ? formatBadgeText("free") : `\u20B9${c.entryFee}` },
          { label: formatUIText("spots"), value: `${c.currentEntries}/${c.maxEntries}` },
          { label: formatUIText("type"), value: formatBadgeText(c.contestType ?? "") },
        ].map((item) => (
          <Card key={item.label} flex={1} minWidth="45%" padding="$3">
            <Text {...textStyles.hint}>{item.label}</Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color" marginTop="$1">
              {item.value}
            </Text>
          </Card>
        ))}
      </XStack>

      {/* Progress Bar */}
      <YStack paddingHorizontal="$4" marginBottom="$4">
        <YStack height={6} backgroundColor="$borderColor" borderRadius={3}>
          <YStack height={6} backgroundColor="$accentBackground" borderRadius={3} width={`${Math.min(100, (c.currentEntries / c.maxEntries) * 100)}%` as any} />
        </YStack>
        <Text fontFamily="$mono" fontSize={12} color="$colorMuted" marginTop="$1" textAlign="center">
          {c.maxEntries - c.currentEntries} {formatUIText("spots left")}
        </Text>
      </YStack>

      {/* Join Button */}
      {isOpen && (
        <YStack paddingHorizontal="$4" marginBottom="$4">
          <Button variant="primary" size="lg" onPress={() => { if (match) router.push(`/team/create?matchId=${match.id}&contestId=${c.id}`); }}>
            {c.entryFee === 0 ? formatUIText("join free") : `${formatUIText("join")} \u20B9${c.entryFee}`}
          </Button>
        </YStack>
      )}

      {/* Prize Distribution */}
      {c.prizeDistribution && Array.isArray(c.prizeDistribution) && (c.prizeDistribution as Array<{ rank: number; amount: number }>).length > 0 && (
        <YStack paddingHorizontal="$4" marginBottom="$6">
          <Text {...textStyles.sectionHeader} marginBottom="$3">
            {formatUIText("prize distribution")}
          </Text>
          {(c.prizeDistribution as Array<{ rank: number; amount: number }>).map((prize, i) => (
            <Card key={i} marginBottom="$1" padding="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$colorCricket">
                  #{prize.rank}
                </Text>
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color">
                  {"\u20B9"}{prize.amount}
                </Text>
              </XStack>
            </Card>
          ))}
        </YStack>
      )}

      {/* Leaderboard */}
      <YStack paddingHorizontal="$4" marginBottom="$6">
        <Text {...textStyles.sectionHeader} marginBottom="$3">
          {formatUIText("leaderboard")}
        </Text>
        {standings.isLoading ? (
          <EggLoadingSpinner size={32} message={formatUIText("loading standings")} />
        ) : standings.data && standings.data.length > 0 ? (
          standings.data.map((entry: { rank: number; userId: string; totalPoints: number }, i: number) => (
            <Animated.View key={entry.userId} entering={FadeInDown.delay(i * 30).springify()}>
              <Card marginBottom="$1" padding="$3" borderColor={i < 3 ? "$colorCricketLight" : "$borderColor"}>
                <XStack alignItems="center">
                  <YStack width={36} alignItems="center">
                    <Text fontFamily="$mono" fontWeight="800" fontSize={14} color={i === 0 ? "$colorCricket" : i === 1 ? "$colorSecondary" : i === 2 ? "$colorHatch" : "$color"}>
                      #{entry.rank}
                    </Text>
                  </YStack>
                  <XStack alignItems="center" gap="$2" flex={1} marginLeft="$2">
                    <InitialsAvatar
                      name={`Player ${entry.userId.slice(0, 4)}`}
                      playerRole="BAT"
                      ovr={0}
                      size={28}
                    />
                    <Text {...textStyles.playerName}>
                      {formatUIText("player")} {entry.userId.slice(0, 8)}
                    </Text>
                  </XStack>
                  <StatLabel label={formatUIText("pts")} value={entry.totalPoints.toFixed(1)} />
                </XStack>
              </Card>
            </Animated.View>
          ))
        ) : (
          <Card padding="$6" alignItems="center">
            <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$3">{DesignSystem.emptyState.icon}</Text>
            <Text {...textStyles.hint} textAlign="center">
              {isOpen ? formatUIText("leaderboard will appear once the match starts") : formatUIText("no entries yet")}
            </Text>
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
