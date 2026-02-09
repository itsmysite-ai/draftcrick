import { View, Text, FlatList, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { trpc } from "../../../lib/trpc";
import { useAuth } from "../../../providers/AuthProvider";

const BG = "#0A1628";
const CARD = "#1A2332";
const ACCENT = "#00F5A0";
const GOLD = "#FFD600";
const RED = "#FF4C4C";
const TEXT = "#FFFFFF";
const MUTED = "#6C757D";

export default function LeagueTradesScreen() {
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: myTrades, refetch } = trpc.trade.myTrades.useQuery({ leagueId: leagueId! });
  const { data: leagueTrades } = trpc.trade.leagueTrades.useQuery({ leagueId: leagueId! });

  const acceptMutation = trpc.trade.accept.useMutation({ onSuccess: () => refetch() });
  const rejectMutation = trpc.trade.reject.useMutation({ onSuccess: () => refetch() });
  const cancelMutation = trpc.trade.cancel.useMutation({ onSuccess: () => refetch() });

  const handleAccept = (tradeId: string) => {
    Alert.alert("Accept Trade?", "This will swap the players between teams.", [
      { text: "Cancel", style: "cancel" },
      { text: "Accept", onPress: () => acceptMutation.mutate({ tradeId }) },
    ]);
  };

  const handleReject = (tradeId: string) => {
    Alert.alert("Reject Trade?", "The trade will be declined.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: () => rejectMutation.mutate({ tradeId }) },
    ]);
  };

  const handleCancel = (tradeId: string) => {
    cancelMutation.mutate({ tradeId });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "pending": return GOLD;
      case "accepted": return ACCENT;
      case "rejected": return RED;
      case "expired": return MUTED;
      default: return MUTED;
    }
  };

  const allTrades = leagueTrades ?? myTrades ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <FlatList
        data={allTrades}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: TEXT, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>Trades</Text>
            <Pressable
              onPress={() => router.push(`/league/${leagueId}/propose-trade` as any)}
              style={{ backgroundColor: ACCENT, borderRadius: 12, padding: 14, alignItems: "center", marginTop: 12 }}
            >
              <Text style={{ color: BG, fontWeight: "700", fontSize: 15 }}>Propose a Trade</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }: { item: any }) => {
          const isSender = item.fromUserId === user?.id;
          const isReceiver = item.toUserId === user?.id;
          const isPending = item.status === "pending";

          return (
            <View style={{ backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <View style={{
                  backgroundColor: statusColor(item.status) + "20",
                  paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
                }}>
                  <Text style={{ color: statusColor(item.status), fontSize: 11, fontWeight: "700" }}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: MUTED, fontSize: 11 }}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                {/* Offered */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: MUTED, fontSize: 10, fontWeight: "600", marginBottom: 4 }}>
                    {isSender ? "YOU OFFER" : "THEY OFFER"}
                  </Text>
                  {(item.playersOffered ?? []).map((pid: string, idx: number) => (
                    <View key={idx} style={{ backgroundColor: "#00F5A010", borderRadius: 6, padding: 6, marginBottom: 2 }}>
                      <Text style={{ color: ACCENT, fontSize: 12 }}>{pid.substring(0, 8)}...</Text>
                    </View>
                  ))}
                </View>

                {/* Arrow */}
                <View style={{ justifyContent: "center" }}>
                  <Text style={{ color: MUTED, fontSize: 20 }}>{"<->"}</Text>
                </View>

                {/* Requested */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: MUTED, fontSize: 10, fontWeight: "600", marginBottom: 4 }}>
                    {isSender ? "YOU WANT" : "THEY WANT"}
                  </Text>
                  {(item.playersRequested ?? []).map((pid: string, idx: number) => (
                    <View key={idx} style={{ backgroundColor: "#FFD60010", borderRadius: 6, padding: 6, marginBottom: 2 }}>
                      <Text style={{ color: GOLD, fontSize: 12 }}>{pid.substring(0, 8)}...</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Actions */}
              {isPending && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  {isReceiver && (
                    <>
                      <Pressable
                        onPress={() => handleAccept(item.id)}
                        disabled={acceptMutation.isPending}
                        style={{ flex: 1, backgroundColor: ACCENT, borderRadius: 10, padding: 10, alignItems: "center" }}
                      >
                        <Text style={{ color: BG, fontWeight: "700", fontSize: 14 }}>Accept</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleReject(item.id)}
                        disabled={rejectMutation.isPending}
                        style={{ flex: 1, backgroundColor: RED + "20", borderRadius: 10, padding: 10, alignItems: "center" }}
                      >
                        <Text style={{ color: RED, fontWeight: "700", fontSize: 14 }}>Reject</Text>
                      </Pressable>
                    </>
                  )}
                  {isSender && (
                    <Pressable
                      onPress={() => handleCancel(item.id)}
                      disabled={cancelMutation.isPending}
                      style={{ flex: 1, backgroundColor: MUTED + "20", borderRadius: 10, padding: 10, alignItems: "center" }}
                    >
                      <Text style={{ color: MUTED, fontWeight: "700", fontSize: 14 }}>Cancel Trade</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: MUTED, fontSize: 16 }}>No trades yet</Text>
            <Text style={{ color: MUTED, fontSize: 13, marginTop: 4 }}>Propose a trade to get started</Text>
          </View>
        }
      />
    </View>
  );
}
