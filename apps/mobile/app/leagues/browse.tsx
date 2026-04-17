/**
 * /leagues/browse — full public-league discovery screen.
 *
 * Filters: format + sort (newest / largest).
 * Each row: one-tap Join with CM vs other routing.
 */

import { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  EggLoadingSpinner,
  DesignSystem,
  formatUIText,
  formatBadgeText,
  textStyles,
} from "@draftplay/ui";
import { SafeBackButton } from "../../components/SafeBackButton";
import { HeaderControls } from "../../components/HeaderControls";
import { trpc } from "../../lib/trpc";

const FORMAT_META: Record<string, { emoji: string; label: string }> = {
  cricket_manager: { emoji: "🏆", label: "cricket manager" },
  salary_cap: { emoji: "💰", label: "salary cap" },
  draft: { emoji: "🐍", label: "snake draft" },
  auction: { emoji: "🔨", label: "auction" },
  prediction: { emoji: "🔮", label: "prediction" },
};

type FormatFilter =
  | "all"
  | "cricket_manager"
  | "salary_cap"
  | "draft"
  | "auction"
  | "prediction";
type SortFilter = "newest" | "largest";

const FORMAT_OPTIONS: { key: FormatFilter; label: string }[] = [
  { key: "all", label: "all" },
  { key: "cricket_manager", label: "cricket manager" },
  { key: "salary_cap", label: "salary cap" },
  { key: "draft", label: "draft" },
  { key: "auction", label: "auction" },
  { key: "prediction", label: "prediction" },
];

const SORT_OPTIONS: { key: SortFilter; label: string }[] = [
  { key: "newest", label: "newest" },
  { key: "largest", label: "largest" },
];

export default function BrowseLeaguesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();

  const [format, setFormat] = useState<FormatFilter>("all");
  const [sort, setSort] = useState<SortFilter>("newest");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = trpc.league.browsePublic.useQuery(
    {
      format: format === "all" ? undefined : format,
      sort,
      limit: 50,
    },
    { staleTime: 60 * 1000 }
  );

  const joinPublic = trpc.league.joinPublic.useMutation({
    onSuccess: () => {
      setJoiningId(null);
      query.refetch();
    },
    onError: () => setJoiningId(null),
  });
  const joinCmLeague = trpc.cricketManager.joinLeague.useMutation({
    onSuccess: () => {
      setJoiningId(null);
      query.refetch();
    },
    onError: () => setJoiningId(null),
  });

  function handleJoin(leagueId: string, fmt: string) {
    setJoiningId(leagueId);
    if (fmt === "cricket_manager") {
      joinCmLeague.mutate({ leagueId });
    } else {
      joinPublic.mutate({ leagueId });
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await query.refetch();
    setRefreshing(false);
  }

  const rows = query.data ?? [];

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList
        data={rows}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accentBackground?.val}
          />
        }
        ListHeaderComponent={
          <YStack marginBottom="$3">
            <XStack
              justifyContent="space-between"
              alignItems="center"
              paddingTop={insets.top + 8}
              paddingBottom="$3"
              marginBottom="$3"
            >
              <XStack alignItems="center" gap="$3">
                <SafeBackButton />
                <Text
                  fontFamily="$mono"
                  fontWeight="500"
                  fontSize={17}
                  color="$color"
                  letterSpacing={-0.5}
                >
                  {formatUIText("browse public leagues")}
                </Text>
              </XStack>
              <HeaderControls />
            </XStack>

            {/* Format filter — scrollable */}
            <Text
              fontFamily="$body"
              fontSize={11}
              fontWeight="600"
              color="$colorMuted"
              marginBottom="$2"
              letterSpacing={0.5}
            >
              {formatBadgeText("format")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, alignItems: "center" }}
              style={{ marginBottom: 12, flexGrow: 0, flexShrink: 0, height: 40 }}
            >
              {FORMAT_OPTIONS.map((opt) => {
                const active = format === opt.key;
                return (
                  <Pressable key={opt.key} onPress={() => setFormat(opt.key)}>
                    <XStack
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius="$3"
                      backgroundColor={active ? "$backgroundSurface" : "$backgroundSurfaceAlt"}
                      borderWidth={1}
                      borderColor={active ? "$accentBackground" : "transparent"}
                    >
                      <Text
                        fontFamily="$body"
                        fontSize={12}
                        fontWeight="600"
                        color={active ? "$color" : "$colorMuted"}
                      >
                        {formatUIText(opt.label)}
                      </Text>
                    </XStack>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Sort filter */}
            <XStack gap="$2" alignItems="center" marginBottom="$2">
              <Text fontFamily="$body" fontSize={11} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                {formatBadgeText("sort")}
              </Text>
              {SORT_OPTIONS.map((opt) => {
                const active = sort === opt.key;
                return (
                  <Pressable key={opt.key} onPress={() => setSort(opt.key)}>
                    <XStack
                      paddingHorizontal="$3"
                      paddingVertical="$1"
                      borderRadius="$3"
                      backgroundColor={active ? "$backgroundSurface" : "$backgroundSurfaceAlt"}
                      borderWidth={1}
                      borderColor={active ? "$accentBackground" : "transparent"}
                    >
                      <Text
                        fontFamily="$body"
                        fontSize={11}
                        fontWeight="600"
                        color={active ? "$color" : "$colorMuted"}
                      >
                        {formatUIText(opt.label)}
                      </Text>
                    </XStack>
                  </Pressable>
                );
              })}
            </XStack>
          </YStack>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <YStack alignItems="center" marginTop="$8">
              <EggLoadingSpinner size={40} message={formatUIText("loading leagues")} />
            </YStack>
          ) : (
            <YStack alignItems="center" marginTop="$8" padding="$4" gap="$2">
              <Text fontSize={36}>🏟</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color" textAlign="center">
                {formatUIText("no matching leagues")}
              </Text>
              <Text {...textStyles.hint} textAlign="center" lineHeight={18}>
                {formatUIText("try a different format filter")}
              </Text>
            </YStack>
          )
        }
        renderItem={({ item: league, index }: { item: any; index: number }) => {
          const meta = FORMAT_META[league.format] ?? {
            emoji: "🏟",
            label: league.format,
          };
          const isJoining = joiningId === league.id;
          return (
            <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
              <Card marginBottom="$2" padding="$4">
                <XStack alignItems="center" gap="$3">
                  <Text fontSize={24}>{meta.emoji}</Text>
                  <YStack flex={1}>
                    <Pressable
                      onPress={() => router.push(`/league/${league.id}` as any)}
                    >
                      <Text {...textStyles.playerName} fontSize={15} numberOfLines={1}>
                        {league.name}
                      </Text>
                    </Pressable>
                    <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2} numberOfLines={1}>
                      {league.tournament}
                    </Text>
                    <XStack gap="$2" marginTop="$1" alignItems="center" flexWrap="wrap">
                      <Badge variant="role" size="sm">
                        {formatBadgeText(meta.label)}
                      </Badge>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                        {league.memberCount ?? 0} {formatUIText("members")}
                      </Text>
                    </XStack>
                  </YStack>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isJoining}
                    onPress={() => handleJoin(league.id, league.format)}
                    testID={`browse-join-${league.id}`}
                  >
                    {isJoining ? formatUIText("joining…") : formatUIText("join")}
                  </Button>
                </XStack>
              </Card>
            </Animated.View>
          );
        }}
      />
    </YStack>
  );
}
