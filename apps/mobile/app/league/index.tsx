import { SafeBackButton } from "../../components/SafeBackButton";
import { FlatList, RefreshControl, ScrollView, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  BackButton,
  Button,
  InitialsAvatar,
  AnnouncementBanner,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";

export default function LeaguesListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { data: memberships, isLoading, refetch } = trpc.league.myLeagues.useQuery();
  const publicLeagues = trpc.league.browsePublic.useQuery();
  const joinPublic = trpc.league.joinPublic.useMutation({
    onSuccess: (league: { id: string } | undefined) => {
      publicLeagues.refetch();
      refetch();
      if (league) router.push(`/league/${league.id}` as any);
    },
  });
  // CM leagues go through joinCmLeague which charges the entry fee
  const joinCmLeagueMut = trpc.cricketManager.joinLeague.useMutation({
    onSuccess: (league: { id: string } | undefined) => {
      publicLeagues.refetch();
      refetch();
      if (league) router.push(`/league/${league.id}` as any);
    },
  });

  function joinPublicLeague(leagueId: string, format: string) {
    if (format === "cricket_manager") {
      joinCmLeagueMut.mutate({ leagueId });
    } else {
      joinPublic.mutate({ leagueId });
    }
  }
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), publicLeagues.refetch()]);
    setRefreshing(false);
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList
        data={memberships ?? []}
        keyExtractor={(item: any) => item.leagueId ?? item.league?.id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />}
        ListHeaderComponent={
          <YStack marginBottom="$4">
            <XStack
              justifyContent="space-between"
              alignItems="center"
              paddingTop={insets.top + 8}
              paddingBottom="$3"
              marginBottom="$4"
            >
              <XStack alignItems="center" gap="$3">
                <SafeBackButton />
                <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
                  {formatUIText("my leagues")}
                </Text>
              </XStack>
              <HeaderControls />
            </XStack>
            <AnnouncementBanner marginHorizontal={0} />
            <XStack gap="$3">
              <Button variant="primary" size="md" flex={1} onPress={() => router.push("/league/create" as any)}>
                {formatUIText("create league")}
              </Button>
              <Button variant="secondary" size="md" flex={1} onPress={() => router.push("/league/join" as any)}>
                {formatUIText("join league")}
              </Button>
            </XStack>
          </YStack>
        }
        renderItem={({ item, index }: { item: any; index: number }) => {
          const league = item.league;
          if (!league) return null;
          return (
            <Animated.View entering={FadeInDown.delay(index * 40).springify()}>
              <Card pressable onPress={() => router.push(`/league/${league.id}` as any)} marginBottom="$3" padding="$4">
                <XStack justifyContent="space-between" alignItems="flex-start">
                  <YStack flex={1}>
                    <Text {...textStyles.playerName} fontSize={17}>
                      {league.name}
                    </Text>
                    <Text fontFamily="$body" fontSize={13} color="$colorMuted" marginTop={2}>
                      {league.tournament}
                    </Text>
                  </YStack>
                  <YStack alignItems="flex-end">
                    <Badge variant="role" size="sm">
                      {formatBadgeText(league.format.replace("_", " "))}
                    </Badge>
                    <Text {...textStyles.hint} marginTop="$1">
                      {formatUIText(item.role === "owner" ? "owner" : item.role === "admin" ? "admin" : "member")}
                    </Text>
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <YStack alignItems="center" marginTop="$8">
              <EggLoadingSpinner size={48} message={formatUIText("loading leagues")} />
            </YStack>
          ) : null
        }
        ListFooterComponent={
          <PublicLeaguesSection
            leagues={publicLeagues.data ?? []}
            onJoin={joinPublicLeague}
            joining={joinPublic.isPending || joinCmLeagueMut.isPending}
          />
        }
      />
    </YStack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public leagues — creative discovery: hero carousel + list
// ─────────────────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_CARD_WIDTH = Math.min(300, SCREEN_WIDTH - 64);

const FORMAT_META: Record<
  string,
  { label: string; emoji: string; accent: "accent" | "cricket" | "hatch" }
> = {
  cricket_manager: { label: "cricket manager", emoji: "🏆", accent: "cricket" },
  salary_cap: { label: "salary cap", emoji: "💰", accent: "accent" },
  draft: { label: "snake draft", emoji: "🐍", accent: "accent" },
  auction: { label: "auction", emoji: "🔨", accent: "hatch" },
  prediction: { label: "prediction", emoji: "🔮", accent: "accent" },
};

function PublicLeaguesSection({
  leagues,
  onJoin,
  joining,
}: {
  leagues: any[];
  onJoin: (leagueId: string, format: string) => void;
  joining: boolean;
}) {
  if (leagues.length === 0) {
    return (
      <YStack marginTop="$6">
        <SectionLabel>open leagues to join</SectionLabel>
        <Card padding="$5" alignItems="center">
          <Text {...textStyles.hint} textAlign="center">
            {formatUIText(
              "no open leagues right now\ncheck back soon — new mega leagues drop every week"
            )}
          </Text>
        </Card>
      </YStack>
    );
  }

  // Featured = top 3 by prize pool (or first 3 if no pools)
  const featured = [...leagues]
    .sort(
      (a, b) =>
        (b.rules?.cricketManager?.prizePool ?? 0) -
        (a.rules?.cricketManager?.prizePool ?? 0)
    )
    .slice(0, 3);

  const rest = leagues.filter((l) => !featured.includes(l));

  return (
    <YStack marginTop="$6">
      <SectionLabel>🌟 featured leagues</SectionLabel>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16, paddingBottom: 8 }}
        style={{ marginHorizontal: -16, paddingHorizontal: 16 }}
      >
        {featured.map((league, i) => (
          <Animated.View
            key={league.id}
            entering={FadeInDown.delay(i * 60).springify()}
            style={{ marginRight: 12 }}
          >
            <HeroLeagueCard
              league={league}
              onJoin={() => onJoin(league.id, league.format)}
              joining={joining}
            />
          </Animated.View>
        ))}
      </ScrollView>

      {rest.length > 0 && (
        <>
          <YStack marginTop="$5">
            <SectionLabel>all public leagues</SectionLabel>
          </YStack>
          {rest.map((league, i) => (
            <Animated.View
              key={league.id}
              entering={FadeInDown.delay(i * 40).springify()}
            >
              <CompactLeagueRow
                league={league}
                onJoin={() => onJoin(league.id, league.format)}
                joining={joining}
              />
            </Animated.View>
          ))}
        </>
      )}
    </YStack>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text
      fontFamily="$mono"
      fontSize={12}
      color="$colorMuted"
      textTransform="uppercase"
      letterSpacing={1}
      marginBottom="$3"
    >
      {children}
    </Text>
  );
}

function HeroLeagueCard({
  league,
  onJoin,
  joining,
}: {
  league: any;
  onJoin: () => void;
  joining: boolean;
}) {
  const meta = FORMAT_META[league.format] ?? FORMAT_META.salary_cap!;
  const cmCfg = league.rules?.cricketManager;
  const prizePool: number = cmCfg?.prizePool ?? 0;
  const entryFee: number = cmCfg?.entryFee ?? 0;
  const accentColor =
    meta.accent === "cricket"
      ? "$colorCricket"
      : meta.accent === "hatch"
      ? "$colorHatch"
      : "$accentBackground";

  return (
    <Card
      width={HERO_CARD_WIDTH}
      padding="$5"
      borderWidth={2}
      borderColor={accentColor}
      pressable
      onPress={onJoin}
    >
      <XStack alignItems="center" gap="$2" marginBottom="$3">
        <Text fontSize={24}>{meta.emoji}</Text>
        <Badge variant="role" size="sm">
          {meta.label}
        </Badge>
      </XStack>

      <Text
        fontFamily="$mono"
        fontWeight="700"
        fontSize={20}
        color="$color"
        letterSpacing={-0.5}
        numberOfLines={2}
      >
        {league.name}
      </Text>
      <Text
        fontFamily="$body"
        fontSize={12}
        color="$colorMuted"
        marginTop={2}
        numberOfLines={1}
      >
        {league.tournament}
      </Text>

      {prizePool > 0 && (
        <YStack marginTop="$4">
          <Text fontFamily="$body" fontSize={11} color="$colorMuted">
            {formatUIText("prize pool")}
          </Text>
          <Text
            fontFamily="$mono"
            fontWeight="800"
            fontSize={28}
            color={accentColor}
            letterSpacing={-1}
          >
            {prizePool.toLocaleString()} PC
          </Text>
        </YStack>
      )}

      <XStack marginTop="$3" gap="$3" flexWrap="wrap">
        <Badge variant="role" size="sm">
          max {league.maxMembers}
        </Badge>
        <Badge variant="role" size="sm">
          {entryFee > 0 ? `${entryFee} PC entry` : "free entry"}
        </Badge>
      </XStack>

      <Button
        variant="primary"
        size="md"
        marginTop="$4"
        disabled={joining}
        onPress={onJoin}
      >
        {joining ? formatUIText("joining...") : formatUIText("join league")}
      </Button>
    </Card>
  );
}

function CompactLeagueRow({
  league,
  onJoin,
  joining,
}: {
  league: any;
  onJoin: () => void;
  joining: boolean;
}) {
  const meta = FORMAT_META[league.format] ?? FORMAT_META.salary_cap!;
  const cmCfg = league.rules?.cricketManager;
  const prizePool: number = cmCfg?.prizePool ?? 0;

  return (
    <Card marginBottom="$3" padding="$4" pressable onPress={onJoin}>
      <XStack alignItems="center" gap="$3">
        <Text fontSize={22}>{meta.emoji}</Text>
        <YStack flex={1}>
          <Text {...textStyles.playerName} fontSize={15} numberOfLines={1}>
            {league.name}
          </Text>
          <XStack gap="$2" marginTop={2} alignItems="center">
            <Text
              fontFamily="$body"
              fontSize={11}
              color="$colorMuted"
              numberOfLines={1}
            >
              {league.tournament}
            </Text>
            {prizePool > 0 && (
              <>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  ·
                </Text>
                <Text
                  fontFamily="$mono"
                  fontSize={11}
                  color="$colorCricket"
                  fontWeight="700"
                >
                  {prizePool.toLocaleString()} PC
                </Text>
              </>
            )}
          </XStack>
        </YStack>
        <Button
          variant="primary"
          size="sm"
          disabled={joining}
          onPress={onJoin}
        >
          {formatUIText("join")}
        </Button>
      </XStack>
    </Card>
  );
}
