import { SafeBackButton } from "../../../../../../components/SafeBackButton";
import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../../../../../components/SportText";
import {
  Card,
  Badge,
  InitialsAvatar,
  EggLoadingSpinner,
  textStyles,
  formatUIText,
} from "@draftplay/ui";
import { trpc } from "../../../../../../lib/trpc";
import { HeaderControls } from "../../../../../../components/HeaderControls";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

function roleToBadge(role: string): RoleKey {
  if (role === "bowler") return "BOWL";
  if (role === "all_rounder") return "AR";
  if (role === "wicket_keeper") return "WK";
  return "BAT";
}

export default function RevealScreen() {
  const { roundId, userId } = useLocalSearchParams<{
    id: string;
    roundId: string;
    userId: string;
  }>();
  const insets = useSafeAreaInsets();

  const roundQuery = trpc.cricketManager.getRound.useQuery(
    { roundId: roundId! },
    { enabled: !!roundId }
  );
  const entryQuery = trpc.cricketManager.getEntryDetail.useQuery(
    { roundId: roundId!, userId: userId! },
    { enabled: !!roundId && !!userId }
  );

  const eligibleById = useMemo(() => {
    const pool = (roundQuery.data?.eligiblePlayers ?? []) as Array<{
      playerId: string;
      name: string;
      team: string;
      role: string;
      photoUrl?: string | null;
    }>;
    return new Map(pool.map((p) => [p.playerId, p]));
  }, [roundQuery.data?.eligiblePlayers]);

  if (roundQuery.isLoading || entryQuery.isLoading) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
      >
        <EggLoadingSpinner size={48} message="loading reveal" />
      </YStack>
    );
  }

  if (entryQuery.error) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        padding="$6"
      >
        <Text {...textStyles.hint} textAlign="center">
          {entryQuery.error.message ?? "entry unavailable"}
        </Text>
      </YStack>
    );
  }

  const entry = entryQuery.data;
  const round = roundQuery.data;
  if (!entry || !round) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
      >
        <Text {...textStyles.hint}>{formatUIText("entry not found")}</Text>
      </YStack>
    );
  }

  const battingOrder = (
    (entry.battingOrder ?? []) as Array<{
      position: number;
      playerId: string;
    }>
  )
    .slice()
    .sort((a, b) => a.position - b.position);
  const bowlingPriority = (
    (entry.bowlingPriority ?? []) as Array<{
      priority: number;
      playerId: string;
    }>
  )
    .slice()
    .sort((a, b) => a.priority - b.priority);

  const battingDetails = new Map<
    string,
    {
      runs: number;
      ballsFaced: number;
      dismissed: boolean;
      status: "full" | "partial" | "didnt_bat";
    }
  >();
  for (const d of (entry.battingDetails ?? []) as Array<{
    playerId: string;
    runs: number;
    ballsFaced: number;
    dismissed: boolean;
    status: "full" | "partial" | "didnt_bat";
  }>) {
    battingDetails.set(d.playerId, d);
  }

  const bowlingDetails = new Map<
    string,
    { cappedOvers: number; runsConceded: number; wickets: number }
  >();
  for (const d of (entry.bowlingDetails ?? []) as Array<{
    playerId: string;
    cappedOvers: number;
    runsConceded: number;
    wickets: number;
  }>) {
    bowlingDetails.set(d.playerId, d);
  }

  const toss = (entry as { toss?: string }).toss ?? "bat_first";

  return (
    <YStack flex={1} backgroundColor="$background">
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
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
              {formatUIText("strategy reveal")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {/* Summary header */}
        <Animated.View entering={FadeInDown.delay(40).springify()}>
          <Card
            padding="$5"
            marginBottom="$4"
            borderWidth={1}
            borderColor="$accentBackground"
          >
            <Text
              fontFamily="$mono"
              fontSize={10}
              color="$colorMuted"
              textTransform="uppercase"
              letterSpacing={1}
            >
              {round.name}
            </Text>
            <XStack gap="$4" marginTop="$2" flexWrap="wrap">
              <YStack>
                <Text
                  fontFamily="$body"
                  fontSize={10}
                  color="$colorMuted"
                >
                  BAT
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="800"
                  fontSize={20}
                  color="$accentBackground"
                >
                  {entry.battingTotal}
                </Text>
              </YStack>
              <YStack>
                <Text
                  fontFamily="$body"
                  fontSize={10}
                  color="$colorMuted"
                >
                  BOWL
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="800"
                  fontSize={20}
                  color="$colorCricket"
                >
                  {entry.bowlingTotal}
                </Text>
              </YStack>
              <YStack>
                <Text
                  fontFamily="$body"
                  fontSize={10}
                  color="$colorMuted"
                >
                  NRR
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="800"
                  fontSize={20}
                  color="$color"
                >
                  {Number(entry.nrr).toFixed(2)}
                </Text>
              </YStack>
            </XStack>
            <XStack gap="$2" marginTop="$3" flexWrap="wrap">
              <Badge variant="role" size="sm">
                {toss === "bowl_first" ? "🎯 bowl first" : "🏏 bat first"}
              </Badge>
              <Badge variant="role" size="sm">
                {entry.battingWickets} wkts lost
              </Badge>
              <Badge variant="role" size="sm">
                {entry.bowlingWickets} wkts taken
              </Badge>
            </XStack>
          </Card>
        </Animated.View>

        {/* Batting order reveal */}
        <Text
          fontFamily="$mono"
          fontSize={11}
          color="$colorMuted"
          textTransform="uppercase"
          letterSpacing={1}
          marginBottom="$2"
        >
          {formatUIText("batting order")}
        </Text>
        {battingOrder.map((slot, i) => {
          const p = eligibleById.get(slot.playerId);
          if (!p) return null;
          const d = battingDetails.get(slot.playerId);
          return (
            <Animated.View
              key={`bat-${slot.playerId}`}
              entering={FadeInDown.delay(80 + i * 30).springify()}
            >
              <Card padding="$3" marginBottom="$2">
                <XStack alignItems="center" gap="$2">
                  <YStack width={24} alignItems="center">
                    <Text
                      fontFamily="$mono"
                      fontWeight="800"
                      fontSize={13}
                      color="$accentBackground"
                    >
                      {slot.position}
                    </Text>
                  </YStack>
                  <InitialsAvatar
                    name={p.name}
                    playerRole={roleToBadge(p.role)}
                    ovr={0}
                    size={32}
                    hideBadge
                    imageUrl={p.photoUrl ?? undefined}
                  />
                  <YStack flex={1} marginLeft="$1">
                    <Text
                      fontFamily="$body"
                      fontWeight="700"
                      fontSize={13}
                      color="$color"
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                      {p.team} · {roleToBadge(p.role)}
                    </Text>
                  </YStack>
                  <YStack alignItems="flex-end">
                    {d && d.status !== "didnt_bat" ? (
                      <>
                        <Text
                          fontFamily="$mono"
                          fontWeight="700"
                          fontSize={13}
                          color="$accentBackground"
                        >
                          {d.runs}
                          {!d.dismissed ? "*" : ""} ({d.ballsFaced})
                        </Text>
                        <Text
                          fontFamily="$mono"
                          fontSize={9}
                          color="$colorMuted"
                        >
                          {d.status === "partial" ? "partial" : d.dismissed ? "out" : "not out"}
                        </Text>
                      </>
                    ) : (
                      <Text
                        fontFamily="$mono"
                        fontSize={10}
                        color="$colorMuted"
                      >
                        {formatUIText("dnb")}
                      </Text>
                    )}
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          );
        })}

        {/* Bowling order reveal */}
        <Text
          fontFamily="$mono"
          fontSize={11}
          color="$colorMuted"
          textTransform="uppercase"
          letterSpacing={1}
          marginBottom="$2"
          marginTop="$4"
        >
          {formatUIText("bowling order")}
        </Text>
        {bowlingPriority.map((slot, i) => {
          const p = eligibleById.get(slot.playerId);
          if (!p) return null;
          const d = bowlingDetails.get(slot.playerId);
          return (
            <Animated.View
              key={`bowl-${slot.playerId}`}
              entering={FadeInDown.delay(80 + i * 30).springify()}
            >
              <Card padding="$3" marginBottom="$2">
                <XStack alignItems="center" gap="$2">
                  <YStack width={24} alignItems="center">
                    <Text
                      fontFamily="$mono"
                      fontWeight="800"
                      fontSize={13}
                      color="$colorCricket"
                    >
                      {slot.priority}
                    </Text>
                  </YStack>
                  <InitialsAvatar
                    name={p.name}
                    playerRole={roleToBadge(p.role)}
                    ovr={0}
                    size={32}
                    hideBadge
                    imageUrl={p.photoUrl ?? undefined}
                  />
                  <YStack flex={1} marginLeft="$1">
                    <Text
                      fontFamily="$body"
                      fontWeight="700"
                      fontSize={13}
                      color="$color"
                      numberOfLines={1}
                    >
                      {p.name}
                    </Text>
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                      {p.team} · {roleToBadge(p.role)}
                    </Text>
                  </YStack>
                  <YStack alignItems="flex-end">
                    {d && d.runsConceded > 0 ? (
                      <Text
                        fontFamily="$mono"
                        fontWeight="700"
                        fontSize={13}
                        color="$colorCricket"
                      >
                        {d.cappedOvers.toFixed(1)}-{d.runsConceded}-{d.wickets}
                      </Text>
                    ) : (
                      <Text
                        fontFamily="$mono"
                        fontSize={10}
                        color="$colorMuted"
                      >
                        —
                      </Text>
                    )}
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          );
        })}
      </ScrollView>
    </YStack>
  );
}
