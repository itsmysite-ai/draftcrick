import { FlatList, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack } from "tamagui";
import { Text } from "../../components/SportText";
import { Card, Badge, Button, AnnouncementBanner, DraftPlayLogo, formatUIText, formatBadgeText } from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";
import { useAuth } from "../../providers/AuthProvider";
import { HeaderControls } from "../../components/HeaderControls";
import { SubHeader } from "../../components/SubHeader";

function LeagueCard({
  item,
  index,
  onPress,
}: {
  item: any;
  index: number;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const league = item.league;
  if (!league) return null;

  const FMT: Record<string, { color: string; label: string }> = {
    draft: { color: t.accent, label: "DRAFT" },
    auction: { color: t.amber, label: "AUCTION" },
    salary_cap: { color: t.blue, label: "SALARY CAP" },
    cricket_manager: { color: t.accent, label: "CRICKET MANAGER" },
    prediction: { color: t.accent, label: "PREDICTION" },
  };

  // Never fall back to a specific format label — that's how CM leagues
  // were showing as "DRAFT". Unknown format → neutral "LEAGUE" chip so
  // it's at least not lying about the game mode.
  const fmt = FMT[league.format] ?? { color: t.accent, label: "LEAGUE" };

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 50).springify()}>
      <Card pressable onPress={onPress} marginBottom="$3">
        <XStack
          justifyContent="space-between"
          alignItems="flex-start"
          marginBottom="$3"
        >
          <YStack flex={1} marginRight="$3">
            <Text
              fontFamily="$body"
              fontWeight="600"
              fontSize={16}
              color="$color"
              numberOfLines={2}
              marginBottom={2}
            >
              {league.name}
            </Text>
            <Text fontFamily="$body" fontSize={12} color="$colorSecondary">
              {league.tournament}
            </Text>
          </YStack>
          <Badge
            backgroundColor={fmt.color + "18"}
            color={fmt.color}
            fontWeight="700"
            letterSpacing={0.5}
          >
            {fmt.label}
          </Badge>
        </XStack>
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop="$3"
          borderTopWidth={1}
          borderTopColor="$borderColor"
        >
          <XStack alignItems="center" gap={5}>
            <Ionicons
              name={
                item.role === "owner"
                  ? "shield"
                  : item.role === "admin"
                    ? "shield-half"
                    : "person-outline"
              }
              size={12}
              color={item.role === "owner" ? t.amber : t.textTertiary}
            />
            <Text
              fontFamily="$body"
              fontWeight="600"
              fontSize={11}
              color={
                item.role === "owner" ? "$colorCricket" : "$colorSecondary"
              }
            >
              {formatUIText(item.role === "owner"
                ? "owner"
                : item.role === "admin"
                  ? "admin"
                  : "member")}
            </Text>
          </XStack>
          <Ionicons name="chevron-forward" size={14} color={t.textTertiary} />
        </XStack>
      </Card>
    </Animated.View>
  );
}

export default function SocialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const { user } = useAuth();
  const {
    data: memberships,
    isLoading,
    refetch,
  } = trpc.league.myLeagues.useQuery(undefined, { retry: false });
  const myTeamsQuery = trpc.team.myTeams.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const teamCount = myTeamsQuery.data?.length ?? 0;
  const leagueCount = memberships?.length ?? 0;

  // Refetch when tab gains focus (e.g. after creating a league or building a team)
  useFocusEffect(
    useCallback(() => {
      refetch();
      myTeamsQuery.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="social-screen">
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$5"
        paddingVertical="$4"
      >
        <Text fontFamily="$mono" fontSize={17} fontWeight="500" color="$color" letterSpacing={-0.5}>
          {formatUIText("my leagues")}
        </Text>
        <HeaderControls />
      </XStack>

      <SubHeader />

      <AnnouncementBanner />

      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) =>
          item.leagueId ?? item.league?.id ?? Math.random().toString()
        }
        contentContainerStyle={{ paddingHorizontal: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <Animated.View entering={FadeInDown.delay(30).springify()}>
              <XStack gap="$3" marginBottom="$6">
                <Button
                  flex={1}
                  variant="primary"
                  icon={
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color={t.textInverse}
                    />
                  }
                  onPress={() => router.push("/league/create" as any)}
                  size="md"
                >
                  {formatUIText("create league")}
                </Button>
                <Button
                  flex={1}
                  variant="secondary"
                  size="md"
                  icon={
                    <Ionicons
                      name="enter-outline"
                      size={20}
                      color={t.accent}
                    />
                  }
                  onPress={() => router.push("/league/join" as any)}
                >
                  {formatUIText("join league")}
                </Button>
              </XStack>
            </Animated.View>
            {leagueCount > 0 && teamCount === 0 && (
              <Animated.View entering={FadeInDown.delay(60).springify()}>
                <Card padding="$3" marginBottom="$4" testID="social-build-team-tip">
                  <XStack alignItems="center" gap="$2" marginBottom="$1">
                    <YStack width={20} height={20} borderRadius={10} backgroundColor="$accentBackground" alignItems="center" justifyContent="center">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={10} color="white">!</Text>
                    </YStack>
                    <Text fontFamily="$mono" fontWeight="600" fontSize={12} color="$accentBackground">
                      {formatUIText("next step")}
                    </Text>
                  </XStack>
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted" lineHeight={16}>
                    {formatUIText("tap a league below, find an open contest, and build your first team")}
                  </Text>
                </Card>
              </Animated.View>
            )}
            {leagueCount > 0 && (
              <XStack
                justifyContent="space-between"
                alignItems="center"
                marginBottom="$3"
              >
                <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$color">
                  {formatUIText("my leagues")}
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="500"
                  fontSize={11}
                  color="$accentBackground"
                  onPress={() => router.push("/league" as any)}
                  cursor="pointer"
                >
                  {formatUIText("view all")}
                </Text>
              </XStack>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <LeagueCard
            item={item}
            index={index}
            onPress={() =>
              item.league
                ? router.push(`/league/${item.league.id}` as any)
                : undefined
            }
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <Text
              fontFamily="$body"
              textAlign="center"
              marginTop="$8"
              color="$colorMuted"
            >
              {formatUIText("loading leagues...")}
            </Text>
          ) : (
            <Animated.View entering={FadeIn.delay(100)}>
              <Card gap="$4" padding="$5">
                <YStack alignItems="center" gap="$2">
                  <DraftPlayLogo size={48} />
                  <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color">
                    {formatUIText("start your fantasy journey")}
                  </Text>
                  <Text fontFamily="$mono" fontSize={11} textAlign="center" lineHeight={18} color="$colorMuted">
                    {formatUIText("leagues are where the fun happens — compete with friends across an entire tournament")}
                  </Text>
                </YStack>

                <YStack gap="$3" marginTop="$1">
                  <XStack alignItems="flex-start" gap="$3">
                    <YStack width={24} height={24} borderRadius={12} backgroundColor="$accentBackground" alignItems="center" justifyContent="center">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="white">1</Text>
                    </YStack>
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                        {formatUIText("create or join a league")}
                      </Text>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted" lineHeight={15}>
                        {formatUIText("pick a tournament and format — salary cap is great for beginners")}
                      </Text>
                    </YStack>
                  </XStack>
                  <XStack alignItems="flex-start" gap="$3" opacity={0.5}>
                    <YStack width={24} height={24} borderRadius={12} backgroundColor="$backgroundSurfaceAlt" alignItems="center" justifyContent="center">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$colorMuted">2</Text>
                    </YStack>
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$colorMuted">
                        {formatUIText("contests appear each match day")}
                      </Text>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted" lineHeight={15}>
                        {formatUIText("auto-created for every match — no setup needed")}
                      </Text>
                    </YStack>
                  </XStack>
                  <XStack alignItems="flex-start" gap="$3" opacity={0.5}>
                    <YStack width={24} height={24} borderRadius={12} backgroundColor="$backgroundSurfaceAlt" alignItems="center" justifyContent="center">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$colorMuted">3</Text>
                    </YStack>
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$colorMuted">
                        {formatUIText("build your team & compete")}
                      </Text>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted" lineHeight={15}>
                        {formatUIText("pick 11 players within budget — best fantasy team wins")}
                      </Text>
                    </YStack>
                  </XStack>
                </YStack>

                <XStack gap="$3" marginTop="$1">
                  <Button flex={1} variant="primary" size="md" onPress={() => router.push("/league/create" as any)} testID="empty-create-league-btn">
                    {formatUIText("create league")}
                  </Button>
                  <Button flex={1} variant="secondary" size="md" onPress={() => router.push("/league/join" as any)} testID="empty-join-league-btn">
                    {formatUIText("join league")}
                  </Button>
                </XStack>
              </Card>
            </Animated.View>
          )
        }
        ListFooterComponent={<YStack height={100} />}
      />
    </YStack>
  );
}
