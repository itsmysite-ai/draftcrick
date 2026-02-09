import { FlatList, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { YStack, XStack, Text } from "tamagui";
import { Card, Badge, Button } from "@draftcrick/ui";
import { trpc } from "../../../lib/trpc";
import { useAuth } from "../../../providers/AuthProvider";

export default function LeagueTradesScreen() {
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data: myTrades, refetch } = trpc.trade.myTrades.useQuery({ leagueId: leagueId! });
  const { data: leagueTrades } = trpc.trade.leagueTrades.useQuery({ leagueId: leagueId! });
  const acceptMutation = trpc.trade.accept.useMutation({ onSuccess: () => refetch() });
  const rejectMutation = trpc.trade.reject.useMutation({ onSuccess: () => refetch() });
  const cancelMutation = trpc.trade.cancel.useMutation({ onSuccess: () => refetch() });
  const handleAccept = (tradeId: string) => { Alert.alert("Accept Trade?", "This will swap the players between teams.", [{ text: "Cancel", style: "cancel" }, { text: "Accept", onPress: () => acceptMutation.mutate({ tradeId }) }]); };
  const handleReject = (tradeId: string) => { Alert.alert("Reject Trade?", "The trade will be declined.", [{ text: "Cancel", style: "cancel" }, { text: "Reject", style: "destructive", onPress: () => rejectMutation.mutate({ tradeId }) }]); };
  const handleCancel = (tradeId: string) => { cancelMutation.mutate({ tradeId }); };
  const statusConfig: Record<string, { color: string; bg: string }> = {
    pending: { color: "$colorCricket", bg: "$colorCricketLight" },
    accepted: { color: "$colorAccent", bg: "$colorAccentLight" },
    rejected: { color: "$error", bg: "$errorLight" },
    expired: { color: "$colorMuted", bg: "$backgroundSurface" },
  };
  const allTrades = leagueTrades ?? myTrades ?? [];

  return (
    <YStack flex={1} backgroundColor="$background">
      <FlatList data={allTrades} keyExtractor={(item: any) => item.id} contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <YStack marginBottom="$4">
            <Text fontFamily="$heading" fontWeight="800" fontSize={22} color="$color" marginBottom="$1">Trades</Text>
            <Button variant="primary" size="md" marginTop="$3" onPress={() => router.push(`/league/${leagueId}/propose-trade` as any)}>Propose a Trade</Button>
          </YStack>
        }
        renderItem={({ item }: { item: any }) => {
          const isSender = item.fromUserId === user?.id;
          const isReceiver = item.toUserId === user?.id;
          const isPending = item.status === "pending";
          const cfg = statusConfig[item.status] ?? statusConfig.expired!;
          return (
            <Card marginBottom="$3" padding="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <Badge backgroundColor={cfg.bg as any} color={cfg.color as any} size="sm" fontWeight="700">{item.status.toUpperCase()}</Badge>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{new Date(item.createdAt).toLocaleDateString()}</Text>
              </XStack>
              <XStack gap="$3">
                <YStack flex={1}>
                  <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" marginBottom="$1">{isSender ? "YOU OFFER" : "THEY OFFER"}</Text>
                  {(item.playersOffered ?? []).map((pid: string, idx: number) => (
                    <YStack key={idx} backgroundColor="$colorAccentLight" borderRadius="$2" padding="$1" marginBottom={2}><Text fontFamily="$mono" fontSize={12} color="$colorAccent">{pid.substring(0, 8)}...</Text></YStack>
                  ))}
                </YStack>
                <YStack justifyContent="center"><Text fontFamily="$body" fontSize={20} color="$colorMuted">{"<->"}</Text></YStack>
                <YStack flex={1}>
                  <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" marginBottom="$1">{isSender ? "YOU WANT" : "THEY WANT"}</Text>
                  {(item.playersRequested ?? []).map((pid: string, idx: number) => (
                    <YStack key={idx} backgroundColor="$colorCricketLight" borderRadius="$2" padding="$1" marginBottom={2}><Text fontFamily="$mono" fontSize={12} color="$colorCricket">{pid.substring(0, 8)}...</Text></YStack>
                  ))}
                </YStack>
              </XStack>
              {isPending && (
                <XStack gap="$2" marginTop="$3">
                  {isReceiver && (<><Button variant="primary" size="sm" flex={1} onPress={() => handleAccept(item.id)} disabled={acceptMutation.isPending}>Accept</Button><Button variant="danger" size="sm" flex={1} onPress={() => handleReject(item.id)} disabled={rejectMutation.isPending}>Reject</Button></>)}
                  {isSender && (<Button variant="secondary" size="sm" flex={1} onPress={() => handleCancel(item.id)} disabled={cancelMutation.isPending}>Cancel Trade</Button>)}
                </XStack>
              )}
            </Card>
          );
        }}
        ListEmptyComponent={<YStack padding="$8" alignItems="center"><Text fontFamily="$body" color="$colorMuted" fontSize={16}>No trades yet</Text><Text fontFamily="$body" color="$colorMuted" fontSize={13} marginTop="$1">Propose a trade to get started</Text></YStack>}
      />
    </YStack>
  );
}
