import { FlatList, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";

export default function DraftRoomScreen() {
  const { id: roomId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTamaguiTheme();
  const { data: draftState, refetch: refetchState } = trpc.draft.getState.useQuery({ roomId: roomId! }, { refetchInterval: 3000 });
  const { data: picks, refetch: refetchPicks } = trpc.draft.getPicks.useQuery({ roomId: roomId! });
  const { data: room } = trpc.draft.getRoom.useQuery({ roomId: roomId! });
  const { data: players } = trpc.player.list.useQuery(undefined);
  const startMutation = trpc.draft.start.useMutation({ onSuccess: () => { refetchState(); refetchPicks(); } });
  const pickMutation = trpc.draft.makePick.useMutation({ onSuccess: () => { refetchState(); refetchPicks(); } });
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => { if (!draftState?.currentPickDeadline) { setCountdown(null); return; } const interval = setInterval(() => { const remaining = Math.max(0, Math.floor((new Date(draftState.currentPickDeadline!).getTime() - Date.now()) / 1000)); setCountdown(remaining); }, 1000); return () => clearInterval(interval); }, [draftState?.currentPickDeadline]);

  const isMyTurn = draftState?.currentDrafter === user?.id;
  const pickedIds = new Set(draftState?.pickedPlayerIds ?? []);
  const availablePlayers = (players ?? []).filter((p: any) => !pickedIds.has(p.id));
  const handlePick = (playerId: string, playerName: string) => { Alert.alert("Draft Pick", `Select ${playerName}?`, [{ text: "Cancel", style: "cancel" }, { text: "Pick", onPress: () => pickMutation.mutate({ roomId: roomId!, playerId }) }]); };

  return (
    <YStack flex={1} backgroundColor="$background">
      <YStack backgroundColor="$backgroundSurface" padding="$4" borderBottomWidth={1} borderBottomColor="$borderColor">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorMuted">ROUND {draftState?.currentRound ?? 0} of {draftState?.maxRounds ?? 0}</Text>
            <Text fontFamily="$heading" fontWeight="800" fontSize={18} color="$color">{draftState?.status === "waiting" ? "Waiting to start..." : draftState?.status === "completed" ? "Draft Complete!" : isMyTurn ? "YOUR PICK!" : "Waiting for pick..."}</Text>
          </YStack>
          {countdown !== null && draftState?.status === "in_progress" && (<YStack backgroundColor={countdown <= 10 ? "$error" : "$accentBackground"} borderRadius="$3" paddingHorizontal="$4" paddingVertical="$2"><Text fontFamily="$mono" fontWeight="900" fontSize={24} color={countdown <= 10 ? "$color" : "$accentColor"}>{countdown}s</Text></YStack>)}
        </XStack>
        {draftState?.status === "in_progress" && <Text fontFamily="$mono" fontSize={13} color="$accentBackground" marginTop="$1">Picks: {draftState.totalPicks} / {(draftState.maxRounds ?? 0) * (draftState.pickOrder?.length ?? 0)}</Text>}
      </YStack>
      {draftState?.status === "waiting" && (<YStack padding="$4"><Button variant="primary" size="lg" onPress={() => startMutation.mutate({ roomId: roomId! })} disabled={startMutation.isPending}>{startMutation.isPending ? "Starting..." : "Start Draft"}</Button></YStack>)}
      <XStack flex={1}>
        <YStack width="35%" borderRightWidth={1} borderRightColor="$borderColor">
          <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorMuted" padding="$3" paddingBottom="$2">PICK LOG</Text>
          <FlatList data={[...(picks ?? [])].reverse()} keyExtractor={(item: any) => item.id} renderItem={({ item }: { item: any }) => (
            <YStack backgroundColor={item.userId === user?.id ? "$colorAccentLight" : "$colorCricketLight"} padding="$3" marginHorizontal="$2" marginBottom="$1" borderRadius="$2">
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">#{item.pickNumber} - R{item.round}</Text>
              <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" numberOfLines={1}>{item.player?.name ?? "Unknown"}</Text>
              <Text fontFamily="$body" fontSize={10} color="$colorMuted" numberOfLines={1}>by {item.user?.displayName ?? item.user?.username ?? "Unknown"}</Text>
            </YStack>
          )} />
        </YStack>
        <YStack flex={1}>
          <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorMuted" padding="$3" paddingBottom="$2">AVAILABLE PLAYERS ({availablePlayers.length})</Text>
          <FlatList data={availablePlayers} keyExtractor={(item: any) => item.id} renderItem={({ item }: { item: any }) => (
            <Card marginHorizontal="$2" marginBottom="$1" padding="$3" opacity={isMyTurn ? 1 : 0.6} borderColor={isMyTurn ? "$colorAccentLight" : "$borderColor"} onPress={() => isMyTurn ? handlePick(item.id, item.name) : null} disabled={!isMyTurn || pickMutation.isPending} cursor={isMyTurn ? "pointer" : undefined} pressStyle={isMyTurn ? { scale: 0.98, backgroundColor: "$backgroundSurfaceHover" } : undefined}>
              <XStack justifyContent="space-between" alignItems="center">
                <YStack flex={1}><Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" numberOfLines={1}>{item.name}</Text><Text fontFamily="$body" fontSize={11} color="$colorMuted">{item.team} - {item.role}</Text></YStack>
                {item.credits && <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$accentBackground">{item.credits}cr</Text>}
              </XStack>
            </Card>
          )} />
        </YStack>
      </XStack>
    </YStack>
  );
}
