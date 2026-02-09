import { FlatList, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  StatLabel,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

export default function AuctionRoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const theme = useTamaguiTheme();
  const { data: auctionState, refetch } = trpc.draft.getAuctionState.useQuery({ roomId: roomId! }, { refetchInterval: 2000 });
  const { data: players } = trpc.player.list.useQuery(undefined);
  const nominateMutation = trpc.draft.nominate.useMutation({ onSuccess: () => refetch() });
  const bidMutation = trpc.draft.placeBid.useMutation({ onSuccess: () => refetch() });
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!auctionState?.phaseDeadline) { setCountdown(null); return; }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(auctionState.phaseDeadline!).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [auctionState?.phaseDeadline]);

  const isMyNomination = auctionState?.currentNominator === user?.id;
  const myBudget = auctionState?.budgets?.[user?.id ?? ""] ?? 0;
  const myTeamSize = auctionState?.teamSizes?.[user?.id ?? ""] ?? 0;
  const soldPlayerIds = new Set((auctionState?.soldPlayers ?? []).map((p: any) => p.playerId));
  const availablePlayers = (players ?? []).filter((p: any) => !soldPlayerIds.has(p.id));
  const currentPlayer = auctionState?.currentPlayerId ? (players ?? []).find((p: any) => p.id === auctionState.currentPlayerId) : null;
  const nextBidAmount = auctionState?.highestBid ? auctionState.highestBid.amount + 1 : 1;

  const phaseLabel = (phase: string) => {
    switch (phase) {
      case "nominating": return formatUIText("nominating...");
      case "bidding": return formatBadgeText("bidding");
      case "going_once": return formatUIText("going once...");
      case "going_twice": return formatUIText("going twice...");
      case "sold": return formatBadgeText("sold!");
      default: return formatUIText(phase);
    }
  };

  const handleNominate = (playerId: string, playerName: string) => {
    Alert.alert(
      formatUIText("nominate"),
      `${formatUIText("put")} ${playerName} ${formatUIText("up for auction?")}`,
      [
        { text: formatUIText("cancel"), style: "cancel" },
        { text: formatUIText("nominate"), onPress: () => nominateMutation.mutate({ roomId: roomId!, playerId }) },
      ],
    );
  };

  const handleBid = (amount: number) => {
    bidMutation.mutate({ roomId: roomId!, amount });
  };

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack backgroundColor="$backgroundSurface" padding="$4" borderBottomWidth={1} borderBottomColor="$borderColor">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            <Text fontFamily="$mono" fontSize={14} fontWeight="800" letterSpacing={1} color="$accentBackground">
              {phaseLabel(auctionState?.phase ?? "waiting")}
            </Text>
            <Text fontFamily="$body" fontSize={12} color="$color" marginTop={2}>
              {formatUIText("sold")}: {auctionState?.soldPlayers?.length ?? 0} {formatUIText("players")}
            </Text>
          </YStack>
          <YStack alignItems="flex-end">
            <Text {...textStyles.hint}>
              {formatBadgeText("your budget")}
            </Text>
            <Text fontFamily="$mono" fontWeight="900" fontSize={DesignSystem.fontSize["4xl"]} color="$accentBackground">
              {myBudget.toFixed(1)}
            </Text>
            <Text {...textStyles.hint}>
              {formatUIText("team")}: {myTeamSize} {formatUIText("players")}
            </Text>
          </YStack>
        </XStack>
        {countdown !== null && (
          <YStack
            marginTop="$3"
            alignSelf="center"
            backgroundColor={countdown <= 3 ? "$error" : countdown <= 5 ? "$colorCricket" : "$accentBackground"}
            borderRadius={DesignSystem.radius.md}
            paddingHorizontal="$6"
            paddingVertical="$2"
          >
            <Text fontFamily="$mono" fontWeight="900" fontSize={28} color={countdown <= 5 ? "$color" : "$accentColor"}>
              {countdown}s
            </Text>
          </YStack>
        )}
      </YStack>

      {/* Current Player Being Auctioned */}
      {currentPlayer && (
        <Card margin="$4" padding="$5" borderWidth={2} borderColor="$accentBackground">
          <Text {...textStyles.hint} letterSpacing={1}>
            {formatBadgeText("now auctioning")}
          </Text>
          <XStack alignItems="center" gap="$3" marginTop="$2">
            <InitialsAvatar
              name={(currentPlayer as any).name}
              playerRole={((currentPlayer as any).role ?? "BAT").toUpperCase() as RoleKey}
              ovr={(currentPlayer as any).credits ?? 80}
              size={46}
            />
            <YStack flex={1}>
              <Text {...textStyles.playerName} fontSize={18}>
                {(currentPlayer as any).name}
              </Text>
              <XStack alignItems="center" gap="$2" marginTop={2}>
                <Badge variant="role" size="sm">
                  {formatBadgeText((currentPlayer as any).role ?? "")}
                </Badge>
                <Text {...textStyles.secondary}>
                  {(currentPlayer as any).team}
                </Text>
              </XStack>
            </YStack>
          </XStack>
          {auctionState?.highestBid && (
            <XStack marginTop="$3" justifyContent="space-between" alignItems="center">
              <YStack>
                <Text {...textStyles.hint}>
                  {formatBadgeText("highest bid")}
                </Text>
                <Text fontFamily="$mono" fontWeight="900" fontSize={28} color="$colorCricket">
                  {auctionState.highestBid.amount}
                </Text>
              </YStack>
              <Text fontFamily="$body" fontSize={12} color="$colorMuted">
                {formatUIText("by")} {auctionState.highestBid.userId === user?.id ? formatBadgeText("you") : formatUIText("opponent")}
              </Text>
            </XStack>
          )}
          {(auctionState?.phase === "bidding" || auctionState?.phase === "going_once" || auctionState?.phase === "going_twice") && (
            <XStack gap="$2" marginTop="$4">
              {[nextBidAmount, nextBidAmount + 2, nextBidAmount + 5].map((amount) => (
                <Button
                  key={amount}
                  variant={amount > myBudget ? "secondary" : "primary"}
                  size="md"
                  flex={1}
                  onPress={() => handleBid(amount)}
                  disabled={bidMutation.isPending || amount > myBudget}
                  opacity={amount > myBudget ? 0.4 : 1}
                >
                  {String(amount)}
                </Button>
              ))}
            </XStack>
          )}
        </Card>
      )}

      {/* Nomination prompt */}
      {isMyNomination && !currentPlayer && auctionState?.phase === "nominating" && (
        <YStack padding="$4">
          <Text fontFamily="$mono" fontWeight="500" fontSize={14} color="$colorCricket" marginBottom="$3">
            {formatUIText("your turn to nominate a player!")}
          </Text>
        </YStack>
      )}

      <XStack flex={1}>
        {/* Available Players */}
        <YStack flex={1} borderRightWidth={1} borderRightColor="$borderColor">
          <Text {...textStyles.sectionHeader} padding="$3" paddingBottom="$2">
            {formatUIText("available")} ({availablePlayers.length})
          </Text>
          <FlatList
            data={availablePlayers}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item, index }: { item: any; index: number }) => (
              <Animated.View entering={FadeInDown.delay(30 + index * 20).springify()}>
                <Card
                  pressable
                  padding="$3"
                  marginHorizontal="$2"
                  marginBottom="$1"
                  opacity={isMyNomination && !currentPlayer ? 1 : 0.6}
                  onPress={() => isMyNomination && !currentPlayer ? handleNominate(item.id, item.name) : null}
                  disabled={!isMyNomination || !!currentPlayer}
                >
                  <XStack alignItems="center" gap="$2">
                    <InitialsAvatar
                      name={item.name}
                      playerRole={((item.role ?? "BAT").toUpperCase()) as RoleKey}
                      ovr={item.credits ?? 80}
                      size={32}
                    />
                    <YStack flex={1}>
                      <Text {...textStyles.playerName} fontSize={13} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <XStack alignItems="center" gap="$1">
                        <Badge variant="role" size="sm">
                          {formatBadgeText(item.role ?? "")}
                        </Badge>
                        <Text {...textStyles.secondary}>
                          {item.team}
                        </Text>
                      </XStack>
                    </YStack>
                  </XStack>
                </Card>
              </Animated.View>
            )}
            ListEmptyComponent={
              <YStack alignItems="center" paddingVertical="$8">
                <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$4">
                  {DesignSystem.emptyState.icon}
                </Text>
                <Text {...textStyles.hint} textAlign="center">
                  {formatUIText("no players remaining")}
                </Text>
              </YStack>
            }
          />
        </YStack>

        {/* Sold Players */}
        <YStack width="40%">
          <Text {...textStyles.sectionHeader} padding="$3" paddingBottom="$2">
            {formatUIText("sold")} ({auctionState?.soldPlayers?.length ?? 0})
          </Text>
          <FlatList
            data={[...(auctionState?.soldPlayers ?? [])].reverse()}
            keyExtractor={(item: any, idx: number) => `${item.playerId}-${idx}`}
            renderItem={({ item }: { item: any }) => {
              const player = (players ?? []).find((p: any) => p.id === item.playerId);
              return (
                <Card
                  padding="$3"
                  marginHorizontal="$2"
                  marginBottom="$1"
                  borderColor={item.userId === user?.id ? "$colorAccentLight" : "$borderColor"}
                >
                  <Text {...textStyles.playerName} fontSize={12} numberOfLines={1}>
                    {(player as any)?.name ?? formatUIText("unknown")}
                  </Text>
                  <StatLabel label={formatUIText("cr")} value={item.amount} />
                </Card>
              );
            }}
          />
        </YStack>
      </XStack>
    </YStack>
  );
}
