import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  FilterPill,
  InitialsAvatar,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useNavigationStore } from "../../lib/navigation-store";
import { useAuth } from "../../providers/AuthProvider";
import { HeaderControls } from "../../components/HeaderControls";

type Tab = "standings" | "upcoming" | "awards";

const AWARD_ICONS: Record<string, string> = {
  manager_of_match: "🏆",
  best_captain: "👑",
  biggest_differential: "🎯",
  most_improved: "📈",
  orange_cap: "🧢",
  purple_cap: "🟣",
};

const AWARD_LABELS: Record<string, string> = {
  manager_of_match: "manager of the match",
  best_captain: "best captain pick",
  biggest_differential: "biggest differential",
  most_improved: "most improved",
  orange_cap: "orange cap",
  purple_cap: "purple cap",
};

export default function TournamentLeagueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const theme = useTamaguiTheme();

  const setMatchContext = useNavigationStore((s) => s.setMatchContext);
  const [tab, setTab] = useState<Tab>("standings");

  const { data: tl, isLoading } = trpc.tournament.getById.useQuery(
    { id: id! },
    { enabled: !!id }
  );
  const standingsQuery = trpc.tournament.standings.useQuery(
    { tournamentLeagueId: id! },
    { enabled: !!id && tab === "standings" }
  );
  const awardsQuery = trpc.tournament.getAwards.useQuery(
    { tournamentLeagueId: id! },
    { enabled: !!id && tab === "awards" }
  );
  const chipsQuery = trpc.tournament.getAvailableChips.useQuery(
    { tournamentLeagueId: id! },
    { enabled: !!id }
  );
  const tradesQuery = trpc.tournament.getTradesRemaining.useQuery(
    { tournamentLeagueId: id! },
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <EggLoadingSpinner />
        <Text {...textStyles.hint} marginTop="$3">{formatUIText("loading tournament league...")}</Text>
      </YStack>
    );
  }

  if (!tl) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
        <Text {...textStyles.hint}>{formatUIText("tournament league not found")}</Text>
      </YStack>
    );
  }

  const standings = standingsQuery.data ?? [];
  const awards = awardsQuery.data ?? [];
  const chips = chipsQuery.data ?? [];
  const trades = tradesQuery.data;

  return (
    <YStack flex={1} backgroundColor="$background" testID="tournament-league-detail">
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>
        {/* Header */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop={insets.top + 8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <SafeBackButton />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">
              {formatUIText("tournament league")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {/* League Info Card */}
        <Card padding="$4" marginBottom="$4">
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
            <Badge variant="subtle">{formatBadgeText(tl.mode)}</Badge>
            <Badge variant={tl.status === "active" ? "success" : "default"}>
              {formatBadgeText(tl.status)}
            </Badge>
          </XStack>
          <Text fontFamily="$mono" fontSize={12} color="$colorMuted">
            {formatUIText("tournament")}: {tl.tournamentId}
          </Text>
          {trades && (
            <Text fontFamily="$mono" fontSize={12} color="$colorMuted" marginTop="$1">
              {formatUIText("trades")}: {trades.used}/{trades.total} ({trades.remaining} {formatUIText("remaining")})
            </Text>
          )}
        </Card>

        {/* Chips Overview */}
        {chips.length > 0 && (
          <Card padding="$3" marginBottom="$4">
            <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" marginBottom="$2">
              {formatUIText("chips available")}
            </Text>
            <XStack flexWrap="wrap" gap="$2">
              {chips.filter((c) => c.remaining > 0).map((c) => (
                <Badge key={c.chipType} variant="subtle">
                  {formatBadgeText(c.chipType.replace(/_/g, " "))} ({c.remaining})
                </Badge>
              ))}
              {chips.every((c) => c.remaining === 0) && (
                <Text {...textStyles.hint}>{formatUIText("all chips used")}</Text>
              )}
            </XStack>
          </Card>
        )}

        {/* Tab Switcher */}
        <XStack gap="$2" marginBottom="$4">
          {(["standings", "upcoming", "awards"] as Tab[]).map((t) => (
            <FilterPill
              key={t}
              active={tab === t}
              onPress={() => setTab(t)}
            >
              {formatUIText(t)}
            </FilterPill>
          ))}
        </XStack>

        {/* Standings Tab */}
        {tab === "standings" && (
          <YStack>
            {standingsQuery.isLoading ? (
              <EggLoadingSpinner />
            ) : standings.length === 0 ? (
              <Text {...textStyles.hint} textAlign="center" marginTop="$4">
                {formatUIText("no standings yet — submit teams to start scoring")}
              </Text>
            ) : (
              standings.map((entry, i) => (
                <Animated.View key={entry.userId ?? i} entering={FadeInDown.delay(i * 30).springify()}>
                  <Card padding="$3" marginBottom="$2" testID={`standing-${i}`}>
                    <XStack alignItems="center" gap="$3">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$accentBackground" width={28} textAlign="center">
                        #{entry.rank}
                      </Text>
                      <InitialsAvatar name={entry.userId?.slice(0, 8) ?? "?"} playerRole="BAT" ovr={0} size={32} />
                      <YStack flex={1}>
                        <Text fontFamily="$mono" fontSize={13} color="$color">
                          {entry.userId?.slice(0, 8) ?? "—"}
                        </Text>
                        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                          {entry.matchesPlayed} {formatUIText("matches")}
                        </Text>
                      </YStack>
                      <Text fontFamily="$mono" fontWeight="700" fontSize={15} color="$accentBackground">
                        {entry.totalPoints.toFixed(1)}
                      </Text>
                    </XStack>
                  </Card>
                </Animated.View>
              ))
            )}
          </YStack>
        )}

        {/* Upcoming Tab */}
        {tab === "upcoming" && (
          <YStack>
            <Card padding="$4" marginBottom="$3">
              <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" marginBottom="$3">
                {formatUIText("set your team for the next match")}
              </Text>
              <Button
                variant="primary"
                size="lg"
                onPress={() => {
                  setMatchContext({ matchId: "next" });
                  router.push("/tournament-league/submit-team");
                }}
                testID="set-team-btn"
              >
                {formatUIText("set team")}
              </Button>
            </Card>
            <Text {...textStyles.hint} textAlign="center">
              {formatUIText("your team auto-carries from the previous match if you don't submit")}
            </Text>
          </YStack>
        )}

        {/* Awards Tab */}
        {tab === "awards" && (
          <YStack>
            {awardsQuery.isLoading ? (
              <EggLoadingSpinner />
            ) : awards.length === 0 ? (
              <Text {...textStyles.hint} textAlign="center" marginTop="$4">
                {formatUIText("no awards yet — awards are given after each match")}
              </Text>
            ) : (
              awards.map((award: any, i: number) => (
                <Animated.View key={award.id ?? i} entering={FadeInDown.delay(i * 30).springify()}>
                  <Card padding="$3" marginBottom="$2" testID={`award-${i}`}>
                    <XStack alignItems="center" gap="$3">
                      <Text fontSize={24}>
                        {AWARD_ICONS[award.awardType] ?? "🏅"}
                      </Text>
                      <YStack flex={1}>
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                          {formatUIText(AWARD_LABELS[award.awardType] ?? award.awardType)}
                        </Text>
                        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                          {award.matchId ? `Match: ${award.matchId.slice(0, 20)}` : ""}
                        </Text>
                      </YStack>
                      <InitialsAvatar name={award.userId?.slice(0, 8) ?? "?"} playerRole="BAT" ovr={0} size={32} />
                    </XStack>
                  </Card>
                </Animated.View>
              ))
            )}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
