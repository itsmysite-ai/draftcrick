import { ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import { Card, Button } from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

const MAX_BUDGET = 100;
const TEAM_SIZE = 11;
const ROLE_LIMITS: Record<string, { min: number; max: number; label: string }> = { wicket_keeper: { min: 1, max: 4, label: "WK" }, batsman: { min: 1, max: 6, label: "BAT" }, all_rounder: { min: 1, max: 6, label: "AR" }, bowler: { min: 1, max: 6, label: "BOWL" } };
const TABS = [{ key: "wicket_keeper", label: "WK" }, { key: "batsman", label: "BAT" }, { key: "all_rounder", label: "AR" }, { key: "bowler", label: "BOWL" }] as const;
type SelectedPlayer = { playerId: string; role: string; name: string; team: string; credits: number };

export default function TeamBuilderScreen() {
  const { matchId, contestId } = useLocalSearchParams<{ matchId: string; contestId?: string }>();
  const router = useRouter();
  const theme = useTamaguiTheme();
  const [selectedTab, setSelectedTab] = useState<string>("wicket_keeper");
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "captain">("pick");
  const matchPlayers = trpc.player.getByMatch.useQuery({ matchId: matchId! }, { enabled: !!matchId });
  const createTeam = trpc.team.create.useMutation({ onSuccess: () => { Alert.alert("Team Created!", "Your team has been created successfully.", [{ text: "OK", onPress: () => router.back() }]); }, onError: (error) => { Alert.alert("Error", error.message); } });
  const creditsUsed = useMemo(() => selectedPlayers.reduce((sum, p) => sum + p.credits, 0), [selectedPlayers]);
  const creditsRemaining = MAX_BUDGET - creditsUsed;
  const roleCounts = useMemo(() => { const c: Record<string, number> = {}; for (const p of selectedPlayers) c[p.role] = (c[p.role] ?? 0) + 1; return c; }, [selectedPlayers]);
  const teamCounts = useMemo(() => { const c: Record<string, number> = {}; for (const p of selectedPlayers) c[p.team] = (c[p.team] ?? 0) + 1; return c; }, [selectedPlayers]);
  const playersByRole = useMemo(() => {
    if (!matchPlayers.data) return {};
    const grouped: Record<string, Array<{ id: string; name: string; team: string; role: string; credits: number; nationality: string }>> = {};
    for (const ps of matchPlayers.data) { const player = ps.player; if (!player) continue; const role = player.role; if (!grouped[role]) grouped[role] = []; const credits = (player.stats as Record<string, unknown>)?.credits as number ?? 8.0; grouped[role].push({ id: player.id, name: player.name, team: player.team, role: player.role, credits, nationality: player.nationality ?? "India" }); }
    for (const role of Object.keys(grouped)) grouped[role]!.sort((a, b) => b.credits - a.credits);
    return grouped;
  }, [matchPlayers.data]);
  const selectedIds = new Set(selectedPlayers.map((p) => p.playerId));
  const currentRolePlayers = playersByRole[selectedTab] ?? [];
  const currentRoleLimit = ROLE_LIMITS[selectedTab];
  const canSelectMore = selectedPlayers.length < TEAM_SIZE;

  function togglePlayer(player: { id: string; name: string; team: string; role: string; credits: number }) {
    if (selectedIds.has(player.id)) { setSelectedPlayers((prev) => prev.filter((p) => p.playerId !== player.id)); if (captainId === player.id) setCaptainId(null); if (viceCaptainId === player.id) setViceCaptainId(null); return; }
    if (!canSelectMore) { Alert.alert("Team Full", `You've already selected ${TEAM_SIZE} players`); return; }
    const roleCount = roleCounts[player.role] ?? 0; const limit = ROLE_LIMITS[player.role]; if (limit && roleCount >= limit.max) { Alert.alert("Role Limit", `Max ${limit.max} ${limit.label} players allowed`); return; }
    if (player.credits > creditsRemaining) { Alert.alert("Budget Exceeded", `${player.name} costs ${player.credits} credits, but you only have ${creditsRemaining.toFixed(1)} remaining`); return; }
    const playerTeamCount = teamCounts[player.team] ?? 0; if (playerTeamCount >= 7) { Alert.alert("Team Limit", `Max 7 players from ${player.team}`); return; }
    setSelectedPlayers((prev) => [...prev, { playerId: player.id, role: player.role, name: player.name, team: player.team, credits: player.credits }]);
  }
  function handleContinue() { for (const [role, limits] of Object.entries(ROLE_LIMITS)) { const count = roleCounts[role] ?? 0; if (count < limits.min) { Alert.alert("Missing Roles", `Need at least ${limits.min} ${limits.label} player(s), have ${count}`); return; } } setStep("captain"); }
  function handleSubmit() { if (!captainId || !viceCaptainId) { Alert.alert("Select Captain & VC", "Please select both Captain and Vice-Captain"); return; } if (captainId === viceCaptainId) { Alert.alert("Invalid", "Captain and Vice-Captain must be different"); return; } createTeam.mutate({ contestId: contestId || "", players: selectedPlayers.map((p) => ({ playerId: p.playerId, role: p.role as "batsman" | "bowler" | "all_rounder" | "wicket_keeper" })), captainId, viceCaptainId }); }

  if (matchPlayers.isLoading) return (<YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" gap="$3"><ActivityIndicator color={theme.accentBackground.val} size="large" /><Text fontFamily="$body" color="$colorMuted" fontSize={14}>Loading players...</Text></YStack>);

  if (step === "captain") {
    return (
      <YStack flex={1} backgroundColor="$background">
        <YStack backgroundColor="$backgroundSurface" padding="$4" borderBottomWidth={1} borderBottomColor="$borderColor">
          <Text fontFamily="$heading" fontWeight="700" fontSize={16} color="$color">Select Captain & Vice-Captain</Text>
          <Text fontFamily="$body" fontSize={12} color="$colorCricket" marginTop="$1">Captain gets 2x points, VC gets 1.5x</Text>
        </YStack>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {selectedPlayers.map((player) => {
            const isCaptain = captainId === player.playerId; const isVC = viceCaptainId === player.playerId;
            return (
              <Card key={player.playerId} marginBottom="$1" padding="$3">
                <XStack alignItems="center">
                  <YStack flex={1}><Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">{player.name}</Text><Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2} textTransform="capitalize">{player.team} · {player.role.replace("_", " ")}</Text></YStack>
                  <XStack gap="$2">
                    <YStack width={36} height={36} borderRadius={18} borderWidth={2} borderColor={isCaptain ? "$accentBackground" : "$borderColor"} backgroundColor={isCaptain ? "$accentBackground" : "transparent"} alignItems="center" justifyContent="center" onPress={() => { if (viceCaptainId === player.playerId) setViceCaptainId(null); setCaptainId(player.playerId); }} cursor="pointer"><Text fontSize={12} fontWeight="800" color={isCaptain ? "$accentColor" : "$colorMuted"}>C</Text></YStack>
                    <YStack width={36} height={36} borderRadius={18} borderWidth={2} borderColor={isVC ? "$colorCricket" : "$borderColor"} backgroundColor={isVC ? "$colorCricket" : "transparent"} alignItems="center" justifyContent="center" onPress={() => { if (captainId === player.playerId) setCaptainId(null); setViceCaptainId(player.playerId); }} cursor="pointer"><Text fontSize={12} fontWeight="800" color={isVC ? "$accentColor" : "$colorMuted"}>VC</Text></YStack>
                  </XStack>
                </XStack>
              </Card>
            );
          })}
        </ScrollView>
        <XStack padding="$4" gap="$3">
          <Button variant="secondary" size="md" flex={1} onPress={() => setStep("pick")}>Back</Button>
          <Button variant="primary" size="lg" flex={2} disabled={!captainId || !viceCaptainId || createTeam.isPending} opacity={!captainId || !viceCaptainId ? 0.4 : 1} onPress={handleSubmit}>{createTeam.isPending ? "Creating..." : "Create Team"}</Button>
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <XStack backgroundColor="$backgroundSurface" padding="$4" justifyContent="space-between" borderBottomWidth={1} borderBottomColor="$borderColor">
        <YStack><Text fontFamily="$mono" fontSize={11} color="$colorMuted" textTransform="uppercase" letterSpacing={0.5}>Credits Remaining</Text><Text fontFamily="$heading" fontWeight="800" fontSize={20} color={creditsRemaining < 10 ? "$error" : "$color"}>{creditsRemaining.toFixed(1)}</Text></YStack>
        <YStack alignItems="center"><Text fontFamily="$mono" fontSize={11} color="$colorMuted" textTransform="uppercase" letterSpacing={0.5}>Players</Text><Text fontFamily="$heading" fontWeight="800" fontSize={20} color="$color">{selectedPlayers.length}/{TEAM_SIZE}</Text></YStack>
        <YStack alignItems="flex-end"><Text fontFamily="$mono" fontSize={11} color="$colorMuted" textTransform="uppercase" letterSpacing={0.5}>Credits Used</Text><Text fontFamily="$heading" fontWeight="800" fontSize={20} color="$color">{creditsUsed.toFixed(1)}</Text></YStack>
      </XStack>
      <YStack height={4} backgroundColor="$borderColor"><YStack height={4} backgroundColor="$accentBackground" borderRadius={2} width={`${(selectedPlayers.length / TEAM_SIZE) * 100}%` as any} /></YStack>
      <XStack padding="$3" gap="$2">
        {TABS.map((tab) => { const count = roleCounts[tab.key] ?? 0; const isActive = selectedTab === tab.key; return (
          <YStack key={tab.key} flex={1} paddingVertical="$3" borderRadius="$2" alignItems="center" backgroundColor={isActive ? "$accentBackground" : "$backgroundSurface"} onPress={() => setSelectedTab(tab.key)} cursor="pointer" pressStyle={{ scale: 0.97, opacity: 0.9 }}>
            <Text fontFamily="$body" fontWeight="700" fontSize={13} color={isActive ? "$accentColor" : "$colorSecondary"}>{tab.label}</Text>
            <Text fontFamily="$mono" fontSize={10} color={isActive ? "$accentColor" : "$colorMuted"} marginTop={2}>{count}</Text>
          </YStack>
        ); })}
      </XStack>
      {currentRoleLimit && <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center" marginBottom="$2">Pick {currentRoleLimit.min}-{currentRoleLimit.max} {currentRoleLimit.label} players</Text>}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {currentRolePlayers.length > 0 ? currentRolePlayers.map((player) => {
          const isSelected = selectedIds.has(player.id); const isDisabled = !isSelected && (selectedPlayers.length >= TEAM_SIZE || player.credits > creditsRemaining);
          return (
            <Card key={player.id} marginBottom="$1" padding="$3" borderColor={isSelected ? "$accentBackground" : "$borderColor"} backgroundColor={isSelected ? "$colorAccentLight" : "$backgroundSurface"} opacity={isDisabled && !isSelected ? 0.4 : 1} onPress={() => togglePlayer(player)} cursor="pointer" pressStyle={{ scale: 0.98 }}>
              <XStack alignItems="center">
                <YStack flex={1}><Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">{player.name}</Text><Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2} textTransform="capitalize">{player.team}{player.nationality !== "India" ? " · Overseas" : ""}</Text></YStack>
                <YStack alignItems="center" marginRight="$3"><Text fontFamily="$mono" fontWeight="700" fontSize={16} color={isSelected ? "$accentBackground" : "$color"}>{player.credits.toFixed(1)}</Text><Text fontFamily="$mono" fontSize={10} color="$colorMuted">cr</Text></YStack>
                <YStack width={24} height={24} borderRadius={12} borderWidth={2} borderColor={isSelected ? "$accentBackground" : "$borderColor"} backgroundColor={isSelected ? "$accentBackground" : "transparent"} alignItems="center" justifyContent="center">{isSelected && <Text color="$accentColor" fontSize={14} fontWeight="700">✓</Text>}</YStack>
              </XStack>
            </Card>
          );
        }) : (<Card padding="$8" alignItems="center"><Text fontFamily="$heading" fontWeight="600" fontSize={16} color="$color" marginBottom="$2">No players available</Text><Text fontFamily="$body" fontSize={13} color="$colorMuted" textAlign="center" lineHeight={20}>Players for this role will appear once seeded</Text></Card>)}
      </ScrollView>
      <YStack padding="$4"><Button variant="primary" size="lg" disabled={selectedPlayers.length < TEAM_SIZE} opacity={selectedPlayers.length < TEAM_SIZE ? 0.4 : 1} onPress={handleContinue}>{selectedPlayers.length < TEAM_SIZE ? `Select ${TEAM_SIZE - selectedPlayers.length} More Players` : "Select Captain & VC"}</Button></YStack>
    </YStack>
  );
}
