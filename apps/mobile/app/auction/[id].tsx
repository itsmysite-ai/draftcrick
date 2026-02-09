import { FlatList, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";

export default function AuctionRoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const theme = useTamaguiTheme();
  const { data: auctionState, refetch } = trpc.draft.getAuctionState.useQuery({ roomId: roomId! }, { refetchInterval: 2000 });
  const { data: players } = trpc.player.list.useQuery(undefined);
  const nominateMutation = trpc.draft.nominate.useMutation({ onSuccess: () => refetch() });
  const bidMutation = trpc.draft.placeBid.useMutation({ onSuccess: () => refetch() });
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => { if (!auctionState?.phaseDeadline) { setCountdown(null); return; } const interval = setInterval(() => { const remaining = Math.max(0, Math.floor((new Date(auctionState.phaseDeadline!).getTime() - Date.now()) / 1000)); setCountdown(remaining); }, 1000); return () => clearInterval(interval); }, [auctionState?.phaseDeadline]);

  const isMyNomination = auctionState?.currentNominator === user?.id;
  const myBudget = auctionState?.budgets?.[user?.id ?? ""] ?? 0;
  const myTeamSize = auctionState?.teamSizes?.[user?.id ?? ""] ?? 0;
  const soldPlayerIds = new Set((auctionState?.soldPlayers ?? []).map((p: any) => p.playerId));
  const availablePlayers = (players ?? []).filter((p: any) => !soldPlayerIds.has(p.id));
  const currentPlayer = auctionState?.currentPlayerId ? (players ?? []).find((p: any) => p.id === auctionState.currentPlayerId) : null;
  const nextBidAmount = auctionState?.highestBid ? auctionState.highestBid.amount + 1 : 1;
  const phaseLabel = (phase: string) => { switch (phase) { case "nominating": return "Nominating..."; case "bidding": return "BIDDING"; case "going_once": return "Going Once..."; case "going_twice": return "Going Twice..."; case "sold": return "SOLD!"; default: return phase; } };
  const handleNominate = (playerId: string, playerName: string) => { Alert.alert("Nominate", `Put ${playerName} up for auction?`, [{ text: "Cancel", style: "cancel" }, { text: "Nominate", onPress: () => nominateMutation.mutate({ roomId: roomId!, playerId }) }]); };
  const handleBid = (amount: number) => { bidMutation.mutate({ roomId: roomId!, amount }); };

  return (
    <YStack flex={1} backgroundColor="$background">
      <YStack backgroundColor="$backgroundSurface" padding="$4" borderBottomWidth={1} borderBottomColor="$borderColor">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            <Text fontFamily="$mono" fontSize={14} fontWeight="800" letterSpacing={1} color="$accentBackground">{phaseLabel(auctionState?.phase ?? "waiting")}</Text>
            <Text fontFamily="$body" fontSize={12} color="$color" marginTop={2}>Sold: {auctionState?.soldPlayers?.length ?? 0} players</Text>
          </YStack>
          <YStack alignItems="flex-end">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">YOUR BUDGET</Text>
            <Text fontFamily="$mono" fontWeight="900" fontSize={22} color="$accentBackground">{myBudget.toFixed(1)}</Text>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">Team: {myTeamSize} players</Text>
          </YStack>
        </XStack>
        {countdown !== null && (<YStack marginTop="$3" alignSelf="center" backgroundColor={countdown <= 3 ? "$error" : countdown <= 5 ? "$colorCricket" : "$accentBackground"} borderRadius="$3" paddingHorizontal="$6" paddingVertical="$2"><Text fontFamily="$mono" fontWeight="900" fontSize={28} color={countdown <= 5 ? "$color" : "$accentColor"}>{countdown}s</Text></YStack>)}
      </YStack>
      {currentPlayer && (
        <YStack backgroundColor="$colorAccentLight" margin="$4" borderRadius="$4" padding="$5" borderWidth={2} borderColor="$accentBackground">
          <Text fontFamily="$mono" fontSize={11} fontWeight="600" color="$colorMuted" letterSpacing={1}>NOW AUCTIONING</Text>
          <Text fontFamily="$heading" fontWeight="800" fontSize={22} color="$color" marginTop="$1">{(currentPlayer as any).name}</Text>
          <Text fontFamily="$body" fontSize={14} color="$colorMuted" marginTop={2}>{(currentPlayer as any).team} - {(currentPlayer as any).role}</Text>
          {auctionState?.highestBid && (<XStack marginTop="$3" justifyContent="space-between" alignItems="center"><YStack><Text fontFamily="$mono" fontSize={11} color="$colorMuted">HIGHEST BID</Text><Text fontFamily="$mono" fontWeight="900" fontSize={28} color="$colorCricket">{auctionState.highestBid.amount}</Text></YStack><Text fontFamily="$body" fontSize={12} color="$colorMuted">by {auctionState.highestBid.userId === user?.id ? "YOU" : "opponent"}</Text></XStack>)}
          {(auctionState?.phase === "bidding" || auctionState?.phase === "going_once" || auctionState?.phase === "going_twice") && (
            <XStack gap="$2" marginTop="$4">{[nextBidAmount, nextBidAmount + 2, nextBidAmount + 5].map((amount) => (<Button key={amount} variant={amount > myBudget ? "secondary" : "primary"} size="md" flex={1} onPress={() => handleBid(amount)} disabled={bidMutation.isPending || amount > myBudget} opacity={amount > myBudget ? 0.4 : 1}>{String(amount)}</Button>))}</XStack>
          )}
        </YStack>
      )}
      {isMyNomination && !currentPlayer && auctionState?.phase === "nominating" && (<YStack padding="$4"><Text fontFamily="$heading" fontWeight="800" fontSize={16} color="$colorCricket" marginBottom="$3">Your turn to nominate a player!</Text></YStack>)}
      <XStack flex={1}>
        <YStack flex={1} borderRightWidth={1} borderRightColor="$borderColor">
          <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorMuted" padding="$3" paddingBottom="$2">AVAILABLE ({availablePlayers.length})</Text>
          <FlatList data={availablePlayers} keyExtractor={(item: any) => item.id} renderItem={({ item }: { item: any }) => (
            <YStack backgroundColor="$backgroundSurface" padding="$3" marginHorizontal="$2" marginBottom="$1" borderRadius="$2" opacity={isMyNomination && !currentPlayer ? 1 : 0.6} onPress={() => isMyNomination && !currentPlayer ? handleNominate(item.id, item.name) : null} disabled={!isMyNomination || !!currentPlayer} cursor={isMyNomination && !currentPlayer ? "pointer" : undefined} pressStyle={isMyNomination && !currentPlayer ? { scale: 0.98, backgroundColor: "$backgroundSurfaceHover" } : undefined}>
              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" numberOfLines={1}>{item.name}</Text>
              <Text fontFamily="$body" fontSize={10} color="$colorMuted">{item.team} - {item.role}</Text>
            </YStack>
          )} />
        </YStack>
        <YStack width="40%">
          <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorMuted" padding="$3" paddingBottom="$2">SOLD ({auctionState?.soldPlayers?.length ?? 0})</Text>
          <FlatList data={[...(auctionState?.soldPlayers ?? [])].reverse()} keyExtractor={(item: any, idx: number) => `${item.playerId}-${idx}`} renderItem={({ item }: { item: any }) => { const player = (players ?? []).find((p: any) => p.id === item.playerId); return (
            <YStack backgroundColor={item.userId === user?.id ? "$colorAccentLight" : "$colorCricketLight"} padding="$3" marginHorizontal="$2" marginBottom="$1" borderRadius="$2">
              <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{(player as any)?.name ?? "Unknown"}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={11} color="$colorCricket">{item.amount} cr</Text>
            </YStack>
          ); }} />
        </YStack>
      </XStack>
    </YStack>
  );
}
