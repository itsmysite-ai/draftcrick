import { View, Text, FlatList, Pressable, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";

const BG = "#0A1628";
const CARD = "#1A2332";
const ACCENT = "#00F5A0";
const GOLD = "#FFD600";
const RED = "#FF4C4C";
const TEXT = "#FFFFFF";
const MUTED = "#6C757D";

export default function AuctionRoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const { data: auctionState, refetch } = trpc.draft.getAuctionState.useQuery(
    { roomId: roomId! },
    { refetchInterval: 2000 }
  );
  const { data: players } = trpc.player.list.useQuery(undefined);

  const nominateMutation = trpc.draft.nominate.useMutation({ onSuccess: () => refetch() });
  const bidMutation = trpc.draft.placeBid.useMutation({ onSuccess: () => refetch() });

  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!auctionState?.phaseDeadline) {
      setCountdown(null);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor(
        (new Date(auctionState.phaseDeadline!).getTime() - Date.now()) / 1000
      ));
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [auctionState?.phaseDeadline]);

  const isMyNomination = auctionState?.currentNominator === user?.id;
  const myBudget = auctionState?.budgets?.[user?.id ?? ""] ?? 0;
  const myTeamSize = auctionState?.teamSizes?.[user?.id ?? ""] ?? 0;
  const soldPlayerIds = new Set((auctionState?.soldPlayers ?? []).map((p: any) => p.playerId));
  const availablePlayers = (players ?? []).filter((p: any) => !soldPlayerIds.has(p.id));

  const currentPlayer = auctionState?.currentPlayerId
    ? (players ?? []).find((p: any) => p.id === auctionState.currentPlayerId)
    : null;

  const nextBidAmount = auctionState?.highestBid
    ? auctionState.highestBid.amount + 1
    : 1;

  const phaseLabel = (phase: string) => {
    switch (phase) {
      case "nominating": return "Nominating...";
      case "bidding": return "BIDDING";
      case "going_once": return "Going Once...";
      case "going_twice": return "Going Twice...";
      case "sold": return "SOLD!";
      default: return phase;
    }
  };

  const phaseColor = (phase: string) => {
    switch (phase) {
      case "bidding": return ACCENT;
      case "going_once": return GOLD;
      case "going_twice": return RED;
      case "sold": return ACCENT;
      default: return MUTED;
    }
  };

  const handleNominate = (playerId: string, playerName: string) => {
    Alert.alert("Nominate", `Put ${playerName} up for auction?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Nominate", onPress: () => nominateMutation.mutate({ roomId: roomId!, playerId }) },
    ]);
  };

  const handleBid = (amount: number) => {
    bidMutation.mutate({ roomId: roomId!, amount });
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Auction Status Header */}
      <View style={{ backgroundColor: CARD, padding: 16, borderBottomWidth: 1, borderBottomColor: "#2A3442" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: phaseColor(auctionState?.phase ?? ""), fontSize: 14, fontWeight: "800", letterSpacing: 1 }}>
              {phaseLabel(auctionState?.phase ?? "waiting")}
            </Text>
            <Text style={{ color: TEXT, fontSize: 12, marginTop: 2 }}>
              Sold: {auctionState?.soldPlayers?.length ?? 0} players
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: MUTED, fontSize: 11 }}>YOUR BUDGET</Text>
            <Text style={{ color: ACCENT, fontSize: 22, fontWeight: "900" }}>{myBudget.toFixed(1)}</Text>
            <Text style={{ color: MUTED, fontSize: 10 }}>Team: {myTeamSize} players</Text>
          </View>
        </View>

        {/* Countdown */}
        {countdown !== null && (
          <View style={{
            marginTop: 10, alignSelf: "center",
            backgroundColor: countdown <= 3 ? RED : countdown <= 5 ? GOLD : ACCENT,
            borderRadius: 12, paddingHorizontal: 24, paddingVertical: 8,
          }}>
            <Text style={{ color: countdown <= 5 ? TEXT : BG, fontSize: 28, fontWeight: "900" }}>
              {countdown}s
            </Text>
          </View>
        )}
      </View>

      {/* Current Player Being Auctioned */}
      {currentPlayer && (
        <View style={{
          backgroundColor: "#00F5A010", margin: 16, borderRadius: 16, padding: 20,
          borderWidth: 2, borderColor: ACCENT,
        }}>
          <Text style={{ color: MUTED, fontSize: 11, fontWeight: "600", letterSpacing: 1 }}>NOW AUCTIONING</Text>
          <Text style={{ color: TEXT, fontSize: 22, fontWeight: "800", marginTop: 4 }}>
            {(currentPlayer as any).name}
          </Text>
          <Text style={{ color: MUTED, fontSize: 14, marginTop: 2 }}>
            {(currentPlayer as any).team} - {(currentPlayer as any).role}
          </Text>

          {auctionState?.highestBid && (
            <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: MUTED, fontSize: 11 }}>HIGHEST BID</Text>
                <Text style={{ color: GOLD, fontSize: 28, fontWeight: "900" }}>
                  {auctionState.highestBid.amount}
                </Text>
              </View>
              <Text style={{ color: MUTED, fontSize: 12 }}>
                by {auctionState.highestBid.userId === user?.id ? "YOU" : "opponent"}
              </Text>
            </View>
          )}

          {/* Bid Buttons */}
          {(auctionState?.phase === "bidding" || auctionState?.phase === "going_once" || auctionState?.phase === "going_twice") && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
              {[nextBidAmount, nextBidAmount + 2, nextBidAmount + 5].map((amount) => (
                <Pressable
                  key={amount}
                  onPress={() => handleBid(amount)}
                  disabled={bidMutation.isPending || amount > myBudget}
                  style={{
                    flex: 1, backgroundColor: amount > myBudget ? MUTED : ACCENT,
                    borderRadius: 10, padding: 12, alignItems: "center",
                  }}
                >
                  <Text style={{ color: BG, fontWeight: "800", fontSize: 16 }}>{amount}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Nominate Section (when it's your turn to nominate) */}
      {isMyNomination && !currentPlayer && auctionState?.phase === "nominating" && (
        <View style={{ padding: 16 }}>
          <Text style={{ color: GOLD, fontSize: 16, fontWeight: "800", marginBottom: 12 }}>
            Your turn to nominate a player!
          </Text>
        </View>
      )}

      {/* Available Players / Sold Players */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Available */}
        <View style={{ flex: 1, borderRightWidth: 1, borderRightColor: "#2A3442" }}>
          <Text style={{ color: MUTED, fontSize: 12, fontWeight: "600", padding: 12, paddingBottom: 8 }}>
            AVAILABLE ({availablePlayers.length})
          </Text>
          <FlatList
            data={availablePlayers}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }: { item: any }) => (
              <Pressable
                onPress={() => isMyNomination && !currentPlayer ? handleNominate(item.id, item.name) : null}
                disabled={!isMyNomination || !!currentPlayer}
                style={{
                  backgroundColor: CARD, padding: 10, marginHorizontal: 8, marginBottom: 4, borderRadius: 8,
                  opacity: isMyNomination && !currentPlayer ? 1 : 0.6,
                }}
              >
                <Text style={{ color: TEXT, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ color: MUTED, fontSize: 10 }}>{item.team} - {item.role}</Text>
              </Pressable>
            )}
          />
        </View>

        {/* Sold */}
        <View style={{ width: "40%" }}>
          <Text style={{ color: MUTED, fontSize: 12, fontWeight: "600", padding: 12, paddingBottom: 8 }}>
            SOLD ({auctionState?.soldPlayers?.length ?? 0})
          </Text>
          <FlatList
            data={[...(auctionState?.soldPlayers ?? [])].reverse()}
            keyExtractor={(item: any, idx: number) => `${item.playerId}-${idx}`}
            renderItem={({ item }: { item: any }) => {
              const player = (players ?? []).find((p: any) => p.id === item.playerId);
              return (
                <View style={{
                  backgroundColor: item.userId === user?.id ? MY_PICK : OTHER_PICK,
                  padding: 10, marginHorizontal: 8, marginBottom: 4, borderRadius: 8,
                }}>
                  <Text style={{ color: TEXT, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                    {(player as any)?.name ?? "Unknown"}
                  </Text>
                  <Text style={{ color: GOLD, fontSize: 11, fontWeight: "700" }}>{item.amount} cr</Text>
                </View>
              );
            }}
          />
        </View>
      </View>
    </View>
  );
}

const MY_PICK = "#00F5A020";
const OTHER_PICK = "#FFD60020";
