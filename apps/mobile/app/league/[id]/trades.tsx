import { SafeBackButton } from "../../../components/SafeBackButton";
import { FlatList, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../../components/SportText";
import { Card, Badge, BackButton, Button, DesignSystem, formatUIText, formatBadgeText } from "@draftplay/ui";
import { trpc } from "../../../lib/trpc";
import { useAuth } from "../../../providers/AuthProvider";
import { HeaderControls } from "../../../components/HeaderControls";
import { usePaywall } from "../../../hooks/usePaywall";

export default function LeagueTradesScreen() {
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: myTrades, refetch } = trpc.trade.myTrades.useQuery({ leagueId: leagueId! });
  const { data: leagueTrades } = trpc.trade.leagueTrades.useQuery({ leagueId: leagueId! });
  const { data: players } = trpc.player.list.useQuery(undefined);
  const acceptMutation = trpc.trade.accept.useMutation({ onSuccess: () => refetch() });
  const rejectMutation = trpc.trade.reject.useMutation({ onSuccess: () => refetch() });
  const cancelMutation = trpc.trade.cancel.useMutation({ onSuccess: () => refetch() });
  const { gate } = usePaywall();

  // Waiver recommendations for this league
  const { data: waiverData } = trpc.auctionAi.waiverRecommendations.useQuery(
    { leagueId: leagueId! },
    { enabled: !!leagueId },
  );

  /** Build player ID → name lookup map */
  const playerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of players ?? []) {
      map[(p as any).id] = (p as any).name;
    }
    return map;
  }, [players]);

  const getPlayerName = (pid: string) => playerNames[pid] ?? `Player ${pid.slice(0, 6)}`;

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
  const handleCancel = (tradeId: string) => { cancelMutation.mutate({ tradeId }); };

  const statusConfig: Record<string, { color: string; bg: string }> = {
    pending: { color: "$colorCricket", bg: "$colorCricketLight" },
    accepted: { color: "$colorAccent", bg: "$colorAccentLight" },
    rejected: { color: "$error", bg: "$errorLight" },
    expired: { color: "$colorMuted", bg: "$backgroundSurface" },
  };
  const allTrades = leagueTrades ?? myTrades ?? [];

  return (
    <YStack flex={1} backgroundColor="$background" testID="trades-screen">
      <FlatList
        data={allTrades}
        keyExtractor={(item: any) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <YStack marginBottom="$4">
            <XStack
              justifyContent="space-between"
              alignItems="center"
              paddingTop={insets.top + 8}
              paddingBottom="$3"
            >
              <XStack alignItems="center" gap="$3">
                <SafeBackButton />
                <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
                  {formatUIText("trades")}
                </Text>
              </XStack>
              <HeaderControls />
            </XStack>
            <Button testID="propose-trade-btn" variant="primary" size="md" marginTop="$3" onPress={() => router.push(`/league/${leagueId}/propose-trade` as any)}>
              Propose a Trade
            </Button>
          </YStack>
        }
        renderItem={({ item }: { item: any }) => {
          const isSender = item.fromUserId === user?.id;
          const isReceiver = item.toUserId === user?.id;
          const isPending = item.status === "pending";
          const cfg = statusConfig[item.status] ?? statusConfig.expired!;
          return (
            <Card testID={`trade-card-${item.id}`} marginBottom="$3" padding="$4">
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <Badge testID={`trade-status-${item.id}`} backgroundColor={cfg.bg as any} color={cfg.color as any} size="sm" fontWeight="700">
                  {item.status.toUpperCase()}
                </Badge>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </XStack>
              <XStack gap="$3">
                <YStack flex={1}>
                  <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" marginBottom="$1">
                    {isSender ? "YOU OFFER" : "THEY OFFER"}
                  </Text>
                  {(item.playersOffered ?? []).map((pid: string, idx: number) => (
                    <YStack key={idx} backgroundColor="$colorAccentLight" borderRadius="$2" padding="$2" marginBottom={2}>
                      <Text fontFamily="$mono" fontSize={12} color="$colorAccent" numberOfLines={1}>
                        {getPlayerName(pid)}
                      </Text>
                    </YStack>
                  ))}
                </YStack>
                <YStack justifyContent="center">
                  <Text fontFamily="$body" fontSize={18} color="$colorMuted">{"⇄"}</Text>
                </YStack>
                <YStack flex={1}>
                  <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" marginBottom="$1">
                    {isSender ? "YOU WANT" : "THEY WANT"}
                  </Text>
                  {(item.playersRequested ?? []).map((pid: string, idx: number) => (
                    <YStack key={idx} backgroundColor="$colorCricketLight" borderRadius="$2" padding="$2" marginBottom={2}>
                      <Text fontFamily="$mono" fontSize={12} color="$colorCricket" numberOfLines={1}>
                        {getPlayerName(pid)}
                      </Text>
                    </YStack>
                  ))}
                </YStack>
              </XStack>
              {/* AI Trade Evaluation */}
              {isPending && (isReceiver || isSender) && (
                <TradeEvalCard
                  leagueId={leagueId!}
                  offeredPlayerIds={item.playersOffered ?? []}
                  requestedPlayerIds={item.playersRequested ?? []}
                  isSender={isSender}
                  gate={gate}
                />
              )}
              {isPending && (
                <XStack gap="$2" marginTop="$3">
                  {isReceiver && (
                    <>
                      <Button testID={`trade-accept-btn-${item.id}`} variant="primary" size="sm" flex={1} onPress={() => handleAccept(item.id)} disabled={acceptMutation.isPending}>
                        Accept
                      </Button>
                      <Button testID={`trade-reject-btn-${item.id}`} variant="danger" size="sm" flex={1} onPress={() => handleReject(item.id)} disabled={rejectMutation.isPending}>
                        Reject
                      </Button>
                    </>
                  )}
                  {isSender && (
                    <Button testID={`trade-cancel-btn-${item.id}`} variant="secondary" size="sm" flex={1} onPress={() => handleCancel(item.id)} disabled={cancelMutation.isPending}>
                      Cancel Trade
                    </Button>
                  )}
                </XStack>
              )}
            </Card>
          );
        }}
        ListEmptyComponent={
          <YStack testID="trades-empty" padding="$8" alignItems="center">
            <Text fontFamily="$body" color="$colorMuted" fontSize={16}>No trades yet</Text>
            <Text fontFamily="$body" color="$colorMuted" fontSize={13} marginTop="$1">Propose a trade to get started</Text>
          </YStack>
        }
        ListFooterComponent={
          waiverData ? (
            <YStack testID="waiver-section" marginTop="$4" marginBottom="$8">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color" letterSpacing={-0.5}>
                  {formatUIText("waiver wire")}
                </Text>
                <Badge variant="default" size="sm">AI</Badge>
                {waiverData.gated && (
                  <Badge variant="default" size="sm" onPress={() => gate("pro", "Waiver Recommendations")}>
                    PRO
                  </Badge>
                )}
              </XStack>
              <Text fontFamily="$body" fontSize={11} color="$colorMuted" marginBottom="$3">
                {formatUIText("unclaimed players ranked by projected impact")}
              </Text>
              {waiverData.recommendations.length === 0 && (
                <Card testID="waiver-empty" padding="$4" marginBottom="$2">
                  <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
                    {formatUIText("no recommendations yet — projections will populate during live matches")}
                  </Text>
                </Card>
              )}
              {waiverData.recommendations.map((rec: any, idx: number) => (
                <Card key={rec.playerId ?? idx} testID={`waiver-rec-${idx}`} marginBottom="$2" padding="$3">
                  <XStack justifyContent="space-between" alignItems="center">
                    <YStack flex={1}>
                      <XStack alignItems="center" gap="$2">
                        <Text fontFamily="$mono" fontWeight="800" fontSize={14} color="$accentBackground">
                          #{rec.priority}
                        </Text>
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                          {rec.playerName}
                        </Text>
                        <Badge variant="default" size="sm">{rec.role?.toUpperCase().slice(0, 4) ?? ""}</Badge>
                      </XStack>
                      <Text fontFamily="$body" fontSize={11} color="$colorMuted" marginTop={2}>
                        {rec.reason}
                      </Text>
                    </YStack>
                    <YStack alignItems="flex-end">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$colorCricket">
                        {rec.projectedPointsNext3} pts
                      </Text>
                      <Text fontFamily="$body" fontSize={9} color="$colorMuted">
                        next 3 matches
                      </Text>
                    </YStack>
                  </XStack>
                  <Text fontFamily="$body" fontSize={10} color={
                    rec.fdrAdvantage.includes("Easy") ? "$colorAccent" :
                    rec.fdrAdvantage.includes("Tough") ? "$error" : "$colorMuted"
                  } marginTop={2}>
                    {rec.fdrAdvantage}
                  </Text>
                </Card>
              ))}
              {waiverData.gated && waiverData.totalAvailable > waiverData.recommendations.length && (
                <Button variant="secondary" size="sm" marginTop="$2" onPress={() => gate("pro", "Waiver Recommendations")}>
                  {`View ${waiverData.totalAvailable - waiverData.recommendations.length} more recommendations`}
                </Button>
              )}
            </YStack>
          ) : null
        }
      />
    </YStack>
  );
}

/** AI Trade Evaluation Card — shown on pending trades */
function TradeEvalCard({
  leagueId,
  offeredPlayerIds,
  requestedPlayerIds,
  isSender,
  gate,
}: {
  leagueId: string;
  offeredPlayerIds: string[];
  requestedPlayerIds: string[];
  isSender: boolean;
  gate: (requiredTier: "pro" | "elite", featureName: string, description?: string) => boolean;
}) {
  const { data: evaluation, isLoading, error } = trpc.auctionAi.evaluateTrade.useQuery(
    {
      leagueId,
      offeredPlayerIds: isSender ? offeredPlayerIds : requestedPlayerIds,
      requestedPlayerIds: isSender ? requestedPlayerIds : offeredPlayerIds,
    },
    { enabled: offeredPlayerIds.length > 0 && requestedPlayerIds.length > 0 },
  );

  if (isLoading) {
    return (
      <YStack testID="trade-eval-loading" marginTop="$3" padding="$3" backgroundColor="$backgroundSurface" borderRadius={DesignSystem.radius.md}>
        <Text fontFamily="$mono" fontSize={10} color="$accentBackground">{formatBadgeText("analyzing trade...")}</Text>
      </YStack>
    );
  }

  if (!evaluation) return null;

  const verdictColor = {
    great: "$colorAccent",
    good: "$colorCricket",
    fair: "$color",
    poor: "$colorCricket",
    bad: "$error",
  }[evaluation.verdict] ?? "$color";

  return (
    <YStack
      testID="trade-eval-card"
      marginTop="$3"
      backgroundColor="$backgroundSurface"
      borderRadius={DesignSystem.radius.md}
      padding="$3"
      borderWidth={1}
      borderColor="$accentBackground"
    >
      <XStack alignItems="center" gap="$2" marginBottom="$2">
        <Text fontFamily="$mono" fontSize={10} fontWeight="800" letterSpacing={1} color="$accentBackground">
          {formatBadgeText("ai analysis")}
        </Text>
        {evaluation.gated && (
          <Badge variant="default" size="sm" onPress={() => gate("pro", "AI Trade Analysis")}>
            PRO
          </Badge>
        )}
      </XStack>
      <XStack alignItems="center" gap="$2">
        <Text fontFamily="$mono" fontWeight="700" fontSize={14} color={verdictColor as any}>
          {evaluation.verdict.toUpperCase()}
        </Text>
        <Text fontFamily="$body" fontSize={11} color="$colorMuted" flex={1}>
          {evaluation.verdictReason}
        </Text>
      </XStack>
      {!evaluation.gated && evaluation.netProjectedPoints != null && (
        <XStack marginTop="$2" gap="$4">
          <YStack>
            <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("pts impact")}</Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={13} color={evaluation.netProjectedPoints >= 0 ? "$colorAccent" : "$error"}>
              {evaluation.netProjectedPoints >= 0 ? "+" : ""}{evaluation.netProjectedPoints}
            </Text>
          </YStack>
          {evaluation.salaryImpact != null && (
            <YStack>
              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("cap freed")}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={13} color={evaluation.salaryImpact >= 0 ? "$colorAccent" : "$error"}>
                {evaluation.salaryImpact >= 0 ? "+" : ""}{evaluation.salaryImpact}
              </Text>
            </YStack>
          )}
          {evaluation.preTradeGrade && evaluation.postTradeGrade && (
            <YStack>
              <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("grade")}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$color">
                {evaluation.preTradeGrade} → {evaluation.postTradeGrade}
              </Text>
            </YStack>
          )}
        </XStack>
      )}
      {!evaluation.gated && evaluation.warnings && evaluation.warnings.length > 0 && (
        <YStack marginTop="$2">
          {evaluation.warnings.map((w: string, i: number) => (
            <Text key={i} fontFamily="$body" fontSize={10} color="$error">{w}</Text>
          ))}
        </YStack>
      )}
    </YStack>
  );
}
