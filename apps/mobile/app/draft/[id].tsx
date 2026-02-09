import { View, Text, FlatList, Pressable, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";

const BG = "#111210";
const CARD = "#1C1D1B";
const ACCENT = "#5DB882";
const TEXT = "#EDECEA";
const MUTED = "#5E5D5A";
const MY_PICK = "rgba(93, 184, 130, 0.12)";
const OTHER_PICK = "rgba(212, 164, 61, 0.12)";

export default function DraftRoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const { data: draftState, refetch: refetchState } = trpc.draft.getState.useQuery(
    { roomId: roomId! },
    { refetchInterval: 3000 }
  );
  const { data: picks, refetch: refetchPicks } = trpc.draft.getPicks.useQuery({ roomId: roomId! });
  const { data: room } = trpc.draft.getRoom.useQuery({ roomId: roomId! });

  // Get available players for the league's tournament
  const { data: players } = trpc.player.list.useQuery(undefined);

  const startMutation = trpc.draft.start.useMutation({
    onSuccess: () => { refetchState(); refetchPicks(); },
  });
  const pickMutation = trpc.draft.makePick.useMutation({
    onSuccess: () => { refetchState(); refetchPicks(); },
  });

  const [countdown, setCountdown] = useState<number | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!draftState?.currentPickDeadline) {
      setCountdown(null);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor(
        (new Date(draftState.currentPickDeadline!).getTime() - Date.now()) / 1000
      ));
      setCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [draftState?.currentPickDeadline]);

  const isMyTurn = draftState?.currentDrafter === user?.id;
  const pickedIds = new Set(draftState?.pickedPlayerIds ?? []);
  const availablePlayers = (players ?? []).filter((p: any) => !pickedIds.has(p.id));

  const handlePick = (playerId: string, playerName: string) => {
    Alert.alert("Draft Pick", `Select ${playerName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Pick", onPress: () => pickMutation.mutate({ roomId: roomId!, playerId }) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Status Bar */}
      <View style={{ backgroundColor: CARD, padding: 16, borderBottomWidth: 1, borderBottomColor: "#333432" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: MUTED, fontSize: 12, fontWeight: "600" }}>
              ROUND {draftState?.currentRound ?? 0} of {draftState?.maxRounds ?? 0}
            </Text>
            <Text style={{ color: TEXT, fontSize: 18, fontWeight: "800" }}>
              {draftState?.status === "waiting"
                ? "Waiting to start..."
                : draftState?.status === "completed"
                  ? "Draft Complete!"
                  : isMyTurn
                    ? "YOUR PICK!"
                    : "Waiting for pick..."}
            </Text>
          </View>
          {countdown !== null && draftState?.status === "in_progress" && (
            <View style={{
              backgroundColor: countdown <= 10 ? "#E5484D" : ACCENT,
              borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8,
            }}>
              <Text style={{ color: countdown <= 10 ? TEXT : BG, fontSize: 24, fontWeight: "900" }}>
                {countdown}s
              </Text>
            </View>
          )}
        </View>
        {draftState?.status === "in_progress" && (
          <Text style={{ color: ACCENT, fontSize: 13, marginTop: 4 }}>
            Picks: {draftState.totalPicks} / {(draftState.maxRounds ?? 0) * (draftState.pickOrder?.length ?? 0)}
          </Text>
        )}
      </View>

      {/* Start Button (for waiting state) */}
      {draftState?.status === "waiting" && (
        <View style={{ padding: 16 }}>
          <Pressable
            onPress={() => startMutation.mutate({ roomId: roomId! })}
            disabled={startMutation.isPending}
            style={{ backgroundColor: ACCENT, borderRadius: 14, padding: 16, alignItems: "center" }}
          >
            <Text style={{ color: BG, fontSize: 18, fontWeight: "800" }}>
              {startMutation.isPending ? "Starting..." : "Start Draft"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Two-column layout: picks log + available players */}
      <View style={{ flex: 1, flexDirection: "row" }}>
        {/* Picks Log (left column) */}
        <View style={{ width: "35%", borderRightWidth: 1, borderRightColor: "#333432" }}>
          <Text style={{ color: MUTED, fontSize: 12, fontWeight: "600", padding: 12, paddingBottom: 8 }}>
            PICK LOG
          </Text>
          <FlatList
            data={[...(picks ?? [])].reverse()}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }: { item: any }) => (
              <View style={{
                backgroundColor: item.userId === user?.id ? MY_PICK : OTHER_PICK,
                padding: 10, marginHorizontal: 8, marginBottom: 4, borderRadius: 8,
              }}>
                <Text style={{ color: MUTED, fontSize: 10 }}>#{item.pickNumber} - R{item.round}</Text>
                <Text style={{ color: TEXT, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>
                  {item.player?.name ?? "Unknown"}
                </Text>
                <Text style={{ color: MUTED, fontSize: 10 }} numberOfLines={1}>
                  by {item.user?.displayName ?? item.user?.username ?? "Unknown"}
                </Text>
              </View>
            )}
          />
        </View>

        {/* Available Players (right column) */}
        <View style={{ flex: 1 }}>
          <Text style={{ color: MUTED, fontSize: 12, fontWeight: "600", padding: 12, paddingBottom: 8 }}>
            AVAILABLE PLAYERS ({availablePlayers.length})
          </Text>
          <FlatList
            data={availablePlayers}
            keyExtractor={(item: any) => item.id}
            renderItem={({ item }: { item: any }) => (
              <Pressable
                onPress={() => isMyTurn ? handlePick(item.id, item.name) : null}
                disabled={!isMyTurn || pickMutation.isPending}
                style={{
                  backgroundColor: CARD, padding: 12, marginHorizontal: 8, marginBottom: 4, borderRadius: 10,
                  opacity: isMyTurn ? 1 : 0.6,
                  borderWidth: isMyTurn ? 1 : 0, borderColor: ACCENT + "40",
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: TEXT, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: MUTED, fontSize: 11 }}>
                      {item.team} - {item.role}
                    </Text>
                  </View>
                  {item.credits && (
                    <Text style={{ color: ACCENT, fontSize: 13, fontWeight: "700" }}>
                      {item.credits}cr
                    </Text>
                  )}
                </View>
              </Pressable>
            )}
          />
        </View>
      </View>
    </View>
  );
}
