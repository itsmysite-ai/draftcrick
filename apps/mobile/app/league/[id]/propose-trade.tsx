/**
 * Propose Trade — select players to offer and request from another user's squad.
 *
 * Flow:
 *   1. Select a league member to trade with
 *   2. Pick player(s) to offer from YOUR squad
 *   3. Pick player(s) to request from THEIR squad
 *   4. See AI trade evaluation (PRO gated)
 *   5. Confirm and propose
 */

import { useState, useMemo } from "react";
import { FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { YStack, XStack } from "tamagui";
import { Text } from "../../../components/SportText";
import { SafeBackButton } from "../../../components/SafeBackButton";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  Paywall,
  TierBadge,
  AlertModal,
  DesignSystem,
  formatUIText,
  formatBadgeText,
  formatTeamName,
} from "@draftplay/ui";
import { trpc } from "../../../lib/trpc";
import { useAuth } from "../../../providers/AuthProvider";
import { usePaywall } from "../../../hooks/usePaywall";
import { HeaderControls } from "../../../components/HeaderControls";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";
const roleKey = (role: string): RoleKey => {
  const r = (role ?? "").toLowerCase();
  if (r.includes("keeper") || r === "wicket_keeper") return "WK";
  if (r.includes("all") || r === "all_rounder") return "AR";
  if (r.includes("bowl") || r === "bowler") return "BOWL";
  return "BAT";
};
const roleLabel = (role: string) => ({ wicket_keeper: "WK", all_rounder: "AR", bowler: "BOWL", batsman: "BAT" }[role] ?? "BAT");

export default function ProposeTradeScreen() {
  const { id: leagueId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { gate, paywallProps } = usePaywall();

  const [step, setStep] = useState<"member" | "offer" | "request" | "review">("member");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [offeredIds, setOfferedIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null);

  // Get DB user ID
  const { data: profile } = trpc.auth.getProfile.useQuery();
  const dbUserId = (profile as any)?.userId;

  // Get league members
  const { data: league } = trpc.league.getById.useQuery({ id: leagueId! }, { enabled: !!leagueId });
  const members = ((league as any)?.members ?? []).filter((m: any) => m.userId !== dbUserId);

  // Get draft room + all picks
  const draftRoomsQuery = trpc.draft.getRoomsByLeague.useQuery({ leagueId: leagueId! }, { enabled: !!leagueId });
  const completedRoom = (draftRoomsQuery.data ?? []).find((r: any) => r.status === "completed");
  const picksQuery = trpc.draft.getPicks.useQuery({ roomId: completedRoom?.id! }, { enabled: !!completedRoom?.id });

  // Build squads
  const myPickIds = useMemo(() => {
    if (!picksQuery.data || !dbUserId) return [];
    return (picksQuery.data as any[]).filter((p: any) => p.userId === dbUserId).map((p: any) => p.playerId);
  }, [picksQuery.data, dbUserId]);

  const theirPickIds = useMemo(() => {
    if (!picksQuery.data || !selectedMemberId) return [];
    return (picksQuery.data as any[]).filter((p: any) => p.userId === selectedMemberId).map((p: any) => p.playerId);
  }, [picksQuery.data, selectedMemberId]);

  // Fetch player details
  const myPlayersQuery = trpc.player.getByIds.useQuery({ ids: myPickIds }, { enabled: myPickIds.length > 0 });
  const theirPlayersQuery = trpc.player.getByIds.useQuery({ ids: theirPickIds }, { enabled: theirPickIds.length > 0 });

  const buildPlayerList = (data: any) => {
    if (!data) return [];
    return (data as any[]).map((p: any) => {
      const s = (p.stats as Record<string, unknown>) ?? {};
      return {
        id: p.id, name: p.name, team: p.team, role: p.role,
        credits: (s.adminCredits ?? s.calculatedCredits ?? s.geminiCredits ?? s.credits ?? 8.0) as number,
        photoUrl: p.photoUrl ?? null, nationality: p.nationality ?? "",
      };
    }).sort((a: any, b: any) => b.credits - a.credits);
  };

  const mySquad = useMemo(() => buildPlayerList(myPlayersQuery.data), [myPlayersQuery.data]);
  const theirSquad = useMemo(() => buildPlayerList(theirPlayersQuery.data), [theirPlayersQuery.data]);

  const offeredPlayers = mySquad.filter((p: any) => offeredIds.has(p.id));
  const requestedPlayers = theirSquad.filter((p: any) => requestedIds.has(p.id));

  // AI Trade Evaluation
  const evalQuery = trpc.auctionAi.evaluateTrade.useQuery(
    { leagueId: leagueId!, offeredPlayerIds: [...offeredIds], requestedPlayerIds: [...requestedIds] },
    { enabled: step === "review" && offeredIds.size > 0 && requestedIds.size > 0 },
  );
  const evaluation = evalQuery.data as any;

  // Propose mutation
  const proposeMutation = trpc.trade.propose.useMutation({
    onSuccess: () => router.back(),
    onError: (err) => setAlert({ title: "trade failed", message: err.message }),
  });

  const handlePropose = () => {
    if (!selectedMemberId || offeredIds.size === 0 || requestedIds.size === 0) return;
    proposeMutation.mutate({
      leagueId: leagueId!,
      toUserId: selectedMemberId,
      playersOffered: [...offeredIds],
      playersRequested: [...requestedIds],
    });
  };

  const selectedMember = members.find((m: any) => m.userId === selectedMemberId);
  const selectedMemberName = (selectedMember as any)?.user?.displayName ?? (selectedMember as any)?.user?.username ?? "member";

  // ── Step 1: Select member ──
  if (step === "member") {
    return (
      <YStack flex={1} backgroundColor="$background">
        <YStack backgroundColor="$backgroundSurface" paddingHorizontal="$4" paddingTop={insets.top + 8} paddingBottom="$3">
          <XStack alignItems="center" gap="$3">
            <SafeBackButton />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">{formatUIText("propose a trade")}</Text>
          </XStack>
          <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop="$2">
            {formatUIText("select a league member to trade with")}
          </Text>
        </YStack>
        <FlatList
          data={members}
          keyExtractor={(item: any) => item.userId}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }: { item: any }) => (
            <Card pressable padding="$4" marginBottom="$2" onPress={() => { setSelectedMemberId(item.userId); setStep("offer"); }}>
              <XStack alignItems="center" gap="$3">
                <InitialsAvatar name={item.user?.displayName ?? item.user?.username ?? "?"} playerRole="BAT" ovr={0} size={40} imageUrl={item.user?.avatarUrl} />
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                    {item.user?.displayName ?? item.user?.username ?? "Unknown"}
                  </Text>
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{item.role}</Text>
                </YStack>
                <Ionicons name="chevron-forward" size={18} color="#666" />
              </XStack>
            </Card>
          )}
          ListEmptyComponent={
            <Text fontFamily="$body" color="$colorMuted" textAlign="center" padding="$8">{formatUIText("no other members in this league")}</Text>
          }
        />
      </YStack>
    );
  }

  // ── Step 2: Select players to OFFER ──
  if (step === "offer") {
    return (
      <YStack flex={1} backgroundColor="$background">
        <YStack backgroundColor="$backgroundSurface" paddingHorizontal="$4" paddingTop={insets.top + 8} paddingBottom="$3">
          <XStack alignItems="center" gap="$3">
            <YStack onPress={() => setStep("member")} cursor="pointer"><Ionicons name="chevron-back" size={24} color="white" /></YStack>
            <YStack flex={1}>
              <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">{formatUIText("you offer")}</Text>
              <Text fontFamily="$body" fontSize={11} color="$colorMuted">{formatUIText("select player(s) from your squad to offer")}</Text>
            </YStack>
            <Badge variant="default" size="sm">{offeredIds.size} selected</Badge>
          </XStack>
        </YStack>
        <FlatList
          data={mySquad}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          renderItem={({ item }: { item: any }) => {
            const isSelected = offeredIds.has(item.id);
            return (
              <XStack alignItems="center" paddingVertical="$3" borderBottomWidth={1} borderBottomColor="$borderColor" gap="$2"
                onPress={() => setOfferedIds((prev) => { const n = new Set(prev); isSelected ? n.delete(item.id) : n.add(item.id); return n; })}
                cursor="pointer" pressStyle={{ backgroundColor: "$backgroundPress" }}
              >
                <YStack width={24} height={24} borderRadius={12} borderWidth={2}
                  borderColor={isSelected ? "$accentBackground" : "$borderColor"}
                  backgroundColor={isSelected ? "$accentBackground" : "transparent"}
                  alignItems="center" justifyContent="center"
                >
                  {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
                </YStack>
                <InitialsAvatar name={item.name} playerRole={roleKey(item.role)} ovr={Math.round(item.credits * 10)} size={32} imageUrl={item.photoUrl} />
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{item.name}</Text>
                  <XStack gap="$1">
                    <Badge variant="default" size="sm">{roleLabel(item.role)}</Badge>
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatTeamName(item.team)}</Text>
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">· {item.credits.toFixed(1)} Cr</Text>
                  </XStack>
                </YStack>
              </XStack>
            );
          }}
        />
        <YStack position="absolute" bottom={0} left={0} right={0} padding="$4" paddingBottom={insets.bottom + 16} backgroundColor="$background">
          <Button variant="primary" size="lg" disabled={offeredIds.size === 0} opacity={offeredIds.size === 0 ? 0.5 : 1}
            onPress={() => setStep("request")}>
            {offeredIds.size === 0 ? formatUIText("select players to offer") : formatUIText(`offer ${offeredIds.size} player(s) → next`)}
          </Button>
        </YStack>
      </YStack>
    );
  }

  // ── Step 3: Select players to REQUEST ──
  if (step === "request") {
    return (
      <YStack flex={1} backgroundColor="$background">
        <YStack backgroundColor="$backgroundSurface" paddingHorizontal="$4" paddingTop={insets.top + 8} paddingBottom="$3">
          <XStack alignItems="center" gap="$3">
            <YStack onPress={() => setStep("offer")} cursor="pointer"><Ionicons name="chevron-back" size={24} color="white" /></YStack>
            <YStack flex={1}>
              <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">{formatUIText(`you want from ${selectedMemberName}`)}</Text>
              <Text fontFamily="$body" fontSize={11} color="$colorMuted">{formatUIText("select player(s) to request")}</Text>
            </YStack>
            <Badge variant="default" size="sm">{requestedIds.size} selected</Badge>
          </XStack>
        </YStack>
        {theirSquad.length === 0 ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Text fontFamily="$body" color="$colorMuted">{formatUIText("loading their squad...")}</Text>
          </YStack>
        ) : (
          <FlatList
            data={theirSquad}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            renderItem={({ item }: { item: any }) => {
              const isSelected = requestedIds.has(item.id);
              return (
                <XStack alignItems="center" paddingVertical="$3" borderBottomWidth={1} borderBottomColor="$borderColor" gap="$2"
                  onPress={() => setRequestedIds((prev) => { const n = new Set(prev); isSelected ? n.delete(item.id) : n.add(item.id); return n; })}
                  cursor="pointer" pressStyle={{ backgroundColor: "$backgroundPress" }}
                >
                  <YStack width={24} height={24} borderRadius={12} borderWidth={2}
                    borderColor={isSelected ? "$colorCricket" : "$borderColor"}
                    backgroundColor={isSelected ? "$colorCricket" : "transparent"}
                    alignItems="center" justifyContent="center"
                  >
                    {isSelected && <Ionicons name="checkmark" size={14} color="white" />}
                  </YStack>
                  <InitialsAvatar name={item.name} playerRole={roleKey(item.role)} ovr={Math.round(item.credits * 10)} size={32} imageUrl={item.photoUrl} />
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{item.name}</Text>
                    <XStack gap="$1">
                      <Badge variant="default" size="sm">{roleLabel(item.role)}</Badge>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatTeamName(item.team)}</Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">· {item.credits.toFixed(1)} Cr</Text>
                    </XStack>
                  </YStack>
                </XStack>
              );
            }}
          />
        )}
        <YStack position="absolute" bottom={0} left={0} right={0} padding="$4" paddingBottom={insets.bottom + 16} backgroundColor="$background">
          <Button variant="primary" size="lg" disabled={requestedIds.size === 0} opacity={requestedIds.size === 0 ? 0.5 : 1}
            onPress={() => setStep("review")}>
            {requestedIds.size === 0 ? formatUIText("select players to request") : formatUIText(`request ${requestedIds.size} player(s) → review`)}
          </Button>
        </YStack>
      </YStack>
    );
  }

  // ── Step 4: Review + AI Evaluation ──
  const verdictColor: Record<string, string> = { great: "$colorAccent", good: "$colorCricket", fair: "$color", poor: "$colorCricket", bad: "$error" };

  return (
    <YStack flex={1} backgroundColor="$background">
      <YStack backgroundColor="$backgroundSurface" paddingHorizontal="$4" paddingTop={insets.top + 8} paddingBottom="$3">
        <XStack alignItems="center" gap="$3">
          <YStack onPress={() => setStep("request")} cursor="pointer"><Ionicons name="chevron-back" size={24} color="white" /></YStack>
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">{formatUIText("review trade")}</Text>
        </XStack>
      </YStack>

      <FlatList
        data={[1]} // single item list to make ScrollView-like behavior
        keyExtractor={() => "review"}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        renderItem={() => (
          <YStack gap="$4">
            {/* Trade summary */}
            <XStack gap="$3">
              {/* You offer */}
              <YStack flex={1}>
                <Text fontFamily="$mono" fontSize={10} fontWeight="700" color="$colorAccent" letterSpacing={1} marginBottom="$2">
                  {formatBadgeText("you offer")}
                </Text>
                {offeredPlayers.map((p: any) => (
                  <Card key={p.id} padding="$2" marginBottom="$1">
                    <XStack alignItems="center" gap="$2">
                      <InitialsAvatar name={p.name} playerRole={roleKey(p.role)} ovr={Math.round(p.credits * 10)} size={28} imageUrl={p.photoUrl} />
                      <YStack flex={1}>
                        <Text fontFamily="$body" fontWeight="600" fontSize={11} color="$color" numberOfLines={1}>{p.name}</Text>
                        <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{roleLabel(p.role)} · {p.credits.toFixed(1)} Cr</Text>
                      </YStack>
                    </XStack>
                  </Card>
                ))}
              </YStack>

              {/* Swap icon */}
              <YStack justifyContent="center" paddingTop="$5">
                <Text fontFamily="$body" fontSize={20} color="$colorMuted">⇄</Text>
              </YStack>

              {/* You get */}
              <YStack flex={1}>
                <Text fontFamily="$mono" fontSize={10} fontWeight="700" color="$colorCricket" letterSpacing={1} marginBottom="$2">
                  {formatBadgeText("you get")}
                </Text>
                {requestedPlayers.map((p: any) => (
                  <Card key={p.id} padding="$2" marginBottom="$1">
                    <XStack alignItems="center" gap="$2">
                      <InitialsAvatar name={p.name} playerRole={roleKey(p.role)} ovr={Math.round(p.credits * 10)} size={28} imageUrl={p.photoUrl} />
                      <YStack flex={1}>
                        <Text fontFamily="$body" fontWeight="600" fontSize={11} color="$color" numberOfLines={1}>{p.name}</Text>
                        <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{roleLabel(p.role)} · {p.credits.toFixed(1)} Cr</Text>
                      </YStack>
                    </XStack>
                  </Card>
                ))}
              </YStack>
            </XStack>

            {/* AI Trade Evaluation */}
            <Card padding="$4" borderWidth={1} borderColor="$accentBackground"
              onPress={evaluation?.gated ? () => gate("pro", "AI Trade Analysis", "Get projected points impact, salary analysis, grade change, and warnings") : undefined}
              cursor={evaluation?.gated ? "pointer" : undefined}
            >
              <XStack alignItems="center" gap="$2" marginBottom="$2">
                <Text fontFamily="$mono" fontSize={10} fontWeight="800" letterSpacing={1} color="$accentBackground">
                  {formatBadgeText("ai analysis")}
                </Text>
                {evaluation?.gated && <TierBadge tier="pro" size="sm" />}
              </XStack>

              {evalQuery.isLoading ? (
                <Text fontFamily="$body" fontSize={12} color="$colorMuted">{formatUIText("analyzing trade...")}</Text>
              ) : evaluation ? (
                <YStack gap="$2">
                  <XStack alignItems="center" gap="$2">
                    <Text fontFamily="$mono" fontWeight="700" fontSize={16} color={(verdictColor[evaluation.verdict] ?? "$color") as any}>
                      {(evaluation.verdict ?? "").toUpperCase()}
                    </Text>
                    <Text fontFamily="$body" fontSize={11} color="$colorMuted" flex={1}>{evaluation.verdictReason}</Text>
                  </XStack>

                  {!evaluation.gated && evaluation.netProjectedPoints != null && (
                    <XStack gap="$4" marginTop="$1">
                      <YStack>
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("pts impact")}</Text>
                        <Text fontFamily="$mono" fontWeight="700" fontSize={14} color={evaluation.netProjectedPoints >= 0 ? "$colorAccent" : "$error"}>
                          {evaluation.netProjectedPoints >= 0 ? "+" : ""}{evaluation.netProjectedPoints}
                        </Text>
                      </YStack>
                      {evaluation.salaryImpact != null && (
                        <YStack>
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("cap freed")}</Text>
                          <Text fontFamily="$mono" fontWeight="700" fontSize={14} color={evaluation.salaryImpact >= 0 ? "$colorAccent" : "$error"}>
                            {evaluation.salaryImpact >= 0 ? "+" : ""}{evaluation.salaryImpact}
                          </Text>
                        </YStack>
                      )}
                      {evaluation.preTradeGrade && evaluation.postTradeGrade && (
                        <YStack>
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("grade")}</Text>
                          <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color">
                            {evaluation.preTradeGrade} → {evaluation.postTradeGrade}
                          </Text>
                        </YStack>
                      )}
                    </XStack>
                  )}

                  {!evaluation.gated && evaluation.warnings?.length > 0 && (
                    <YStack marginTop="$1">
                      {evaluation.warnings.map((w: string, i: number) => (
                        <Text key={i} fontFamily="$body" fontSize={10} color="$error">{w}</Text>
                      ))}
                    </YStack>
                  )}

                  {evaluation.gated && (
                    <XStack marginTop="$1" alignItems="center" gap="$2" opacity={0.6}>
                      <TierBadge tier="pro" size="sm" />
                      <Text fontFamily="$body" fontSize={10} color="$colorMuted">
                        {formatUIText("points impact, salary analysis & grade change")}
                      </Text>
                    </XStack>
                  )}
                </YStack>
              ) : null}
            </Card>

            {/* Trading with */}
            <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center">
              {formatUIText(`trading with ${selectedMemberName} · expires in 48 hours`)}
            </Text>
          </YStack>
        )}
      />

      {/* Propose button */}
      <YStack position="absolute" bottom={0} left={0} right={0} padding="$4" paddingBottom={insets.bottom + 16} backgroundColor="$background">
        <Button variant="primary" size="lg" onPress={handlePropose} disabled={proposeMutation.isPending}>
          {proposeMutation.isPending ? formatUIText("proposing...") : formatUIText("propose trade")}
        </Button>
      </YStack>

      {alert && (
        <AlertModal visible title={alert.title} message={alert.message} onDismiss={() => setAlert(null)} actions={[{ label: "ok", onPress: () => setAlert(null) }]} />
      )}
      <Paywall {...paywallProps} />
    </YStack>
  );
}
