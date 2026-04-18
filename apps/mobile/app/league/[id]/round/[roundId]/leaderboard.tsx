import { SafeBackButton } from "../../../../../components/SafeBackButton";
import { FlatList, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../../../../components/SportText";
import {
  Card,
  Badge,
  InitialsAvatar,
  EggLoadingSpinner,
  textStyles,
  formatUIText,
} from "@draftplay/ui";
import { trpc } from "../../../../../lib/trpc";
import { useAuth } from "../../../../../providers/AuthProvider";
import { HeaderControls } from "../../../../../components/HeaderControls";

export default function RoundLeaderboardScreen() {
  const { id: leagueId, roundId } = useLocalSearchParams<{
    id: string;
    roundId: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();

  const roundQuery = trpc.cricketManager.getRound.useQuery(
    { roundId: roundId! },
    { enabled: !!roundId }
  );
  const leaderboardQuery = trpc.cricketManager.getRoundLeaderboard.useQuery(
    { roundId: roundId!, limit: 200, offset: 0 },
    { enabled: !!roundId, refetchInterval: 10000 }
  );

  // Track rank movement across refetches
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [rankDeltas, setRankDeltas] = useState<Map<string, number>>(
    new Map()
  );

  useEffect(() => {
    const rows = leaderboardQuery.data?.rows ?? [];
    const nextDeltas = new Map<string, number>();
    const nextRanks = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as any;
      const currentRank = r.rank ?? i + 1;
      nextRanks.set(r.userId, currentRank);
      const prev = prevRanksRef.current.get(r.userId);
      if (prev != null) {
        // Positive = moved up (prev was larger), negative = moved down
        nextDeltas.set(r.userId, prev - currentRank);
      }
    }
    prevRanksRef.current = nextRanks;
    setRankDeltas(nextDeltas);
  }, [leaderboardQuery.data?.rows]);

  if (roundQuery.isLoading || leaderboardQuery.isLoading) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
      >
        <EggLoadingSpinner size={48} message="loading" />
      </YStack>
    );
  }

  const round = roundQuery.data;
  const rows = leaderboardQuery.data?.rows ?? [];
  const isSettled = round?.status === "settled";

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList
        data={rows}
        keyExtractor={(item: any) => item.userId}
        contentContainerStyle={{
          padding: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
        ListHeaderComponent={
          <>
            <XStack
              justifyContent="space-between"
              alignItems="center"
              marginBottom="$4"
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
                  {formatUIText("round leaderboard")}
                </Text>
              </XStack>
              <HeaderControls />
            </XStack>

            {round && (
              <Card padding="$4" marginBottom="$4">
                <Text
                  fontFamily="$mono"
                  fontWeight="600"
                  fontSize={14}
                  color="$accentBackground"
                >
                  {round.name}
                </Text>
                <Text
                  fontFamily="$body"
                  fontSize={11}
                  color="$colorMuted"
                  marginTop="$1"
                >
                  {round.totalEntries} {formatUIText("entries")} ·{" "}
                  {round.matchesCompleted ?? 0}/{round.matchesTotal}{" "}
                  {formatUIText("matches done")}
                </Text>
                {isSettled && (
                  <Text
                    fontFamily="$body"
                    fontSize={10}
                    color="$colorMuted"
                    marginTop="$2"
                  >
                    {formatUIText("tap any entry to reveal their strategy")}
                  </Text>
                )}
              </Card>
            )}
          </>
        }
        renderItem={({ item, index }: { item: any; index: number }) => {
          const isMe = item.userId === user?.id;
          // Use the anonymous username — email can leak the user's
          // real identity, username never does.
          const label = item.username ?? "player";
          const delta = rankDeltas.get(item.userId) ?? 0;
          const rank = item.rank ?? index + 1;
          const canReveal = isSettled;

          const content = (
            <Card
              marginBottom="$2"
              padding="$3"
              borderWidth={isMe ? 2 : 1}
              borderColor={isMe ? "$accentBackground" : "$borderColor"}
            >
              <XStack alignItems="center">
                <YStack width={36} alignItems="center">
                  <Text
                    fontFamily="$mono"
                    fontWeight="800"
                    fontSize={14}
                    color={
                      index === 0
                        ? "$colorCricket"
                        : index === 1
                          ? "$colorSecondary"
                          : "$color"
                    }
                  >
                    #{rank}
                  </Text>
                  {/* Rank movement arrow */}
                  {delta !== 0 && !isSettled && (
                    <Text
                      fontFamily="$mono"
                      fontSize={9}
                      fontWeight="800"
                      color={delta > 0 ? "$accentBackground" : "$colorHatch"}
                    >
                      {delta > 0 ? "▲" : "▼"}
                      {Math.abs(delta)}
                    </Text>
                  )}
                </YStack>
                <XStack
                  alignItems="center"
                  gap="$2"
                  flex={1}
                  marginLeft="$2"
                >
                  <InitialsAvatar
                    name={label}
                    playerRole="BAT"
                    ovr={0}
                    size={32}
                    hideBadge
                  />
                  <YStack flex={1}>
                    <Text {...textStyles.playerName}>{label}</Text>
                    {isMe && (
                      <Badge
                        variant="live"
                        size="sm"
                        alignSelf="flex-start"
                      >
                        {formatUIText("you")}
                      </Badge>
                    )}
                  </YStack>
                </XStack>
                <YStack alignItems="flex-end" gap={2}>
                  <Text
                    fontFamily="$mono"
                    fontWeight="700"
                    fontSize={15}
                    color="$accentBackground"
                  >
                    NRR {Number(item.nrr).toFixed(2)}
                  </Text>
                  <XStack gap="$2">
                    <Text
                      fontFamily="$mono"
                      fontSize={10}
                      color="$colorMuted"
                    >
                      B {item.battingTotal}
                    </Text>
                    <Text
                      fontFamily="$mono"
                      fontSize={10}
                      color="$colorMuted"
                    >
                      W {item.bowlingTotal}
                    </Text>
                  </XStack>
                  {item.prizeWon > 0 && (
                    <Text
                      fontFamily="$mono"
                      fontSize={10}
                      color="$colorCricket"
                    >
                      +{item.prizeWon} PC
                    </Text>
                  )}
                </YStack>
              </XStack>
            </Card>
          );

          return (
            <Animated.View
              entering={FadeInDown.delay(Math.min(index * 25, 400)).springify()}
            >
              {canReveal ? (
                <Pressable
                  onPress={() =>
                    router.push(
                      `/league/${leagueId}/round/${roundId}/reveal/${item.userId}` as never
                    )
                  }
                >
                  {content}
                </Pressable>
              ) : (
                content
              )}
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <Card padding="$5" alignItems="center">
            <Text {...textStyles.hint}>
              {formatUIText("no entries yet — be the first to play this round")}
            </Text>
          </Card>
        }
      />
    </YStack>
  );
}
