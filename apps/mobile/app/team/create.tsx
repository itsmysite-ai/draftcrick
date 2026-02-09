import { ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  FilterPill,
  HappinessMeter,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { trpc } from "../../lib/trpc";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

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
  const createTeam = trpc.team.create.useMutation({
    onSuccess: () => { Alert.alert(formatUIText("team created!"), formatUIText("your team has been created successfully."), [{ text: formatUIText("ok"), onPress: () => router.back() }]); },
    onError: (error) => { Alert.alert(formatUIText("error"), error.message); },
  });
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
    if (!canSelectMore) { Alert.alert(formatUIText("team full"), formatUIText(`you've already selected ${TEAM_SIZE} players`)); return; }
    const roleCount = roleCounts[player.role] ?? 0; const limit = ROLE_LIMITS[player.role]; if (limit && roleCount >= limit.max) { Alert.alert(formatUIText("role limit"), formatUIText(`max ${limit.max} ${limit.label} players allowed`)); return; }
    if (player.credits > creditsRemaining) { Alert.alert(formatUIText("budget exceeded"), `${player.name} ${formatUIText("costs")} ${player.credits} ${formatUIText("credits, but you only have")} ${creditsRemaining.toFixed(1)} ${formatUIText("remaining")}`); return; }
    const playerTeamCount = teamCounts[player.team] ?? 0; if (playerTeamCount >= 7) { Alert.alert(formatUIText("team limit"), formatUIText(`max 7 players from ${player.team}`)); return; }
    setSelectedPlayers((prev) => [...prev, { playerId: player.id, role: player.role, name: player.name, team: player.team, credits: player.credits }]);
  }
  function handleContinue() { for (const [role, limits] of Object.entries(ROLE_LIMITS)) { const count = roleCounts[role] ?? 0; if (count < limits.min) { Alert.alert(formatUIText("missing roles"), formatUIText(`need at least ${limits.min} ${limits.label} player(s), have ${count}`)); return; } } setStep("captain"); }
  function handleSubmit() { if (!captainId || !viceCaptainId) { Alert.alert(formatUIText("select captain & vc"), formatUIText("please select both captain and vice-captain")); return; } if (captainId === viceCaptainId) { Alert.alert(formatUIText("invalid"), formatUIText("captain and vice-captain must be different")); return; } createTeam.mutate({ contestId: contestId || "", players: selectedPlayers.map((p) => ({ playerId: p.playerId, role: p.role as "batsman" | "bowler" | "all_rounder" | "wicket_keeper" })), captainId, viceCaptainId }); }

  if (matchPlayers.isLoading) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" gap="$3">
      <EggLoadingSpinner size={48} message={formatUIText("loading players")} />
    </YStack>
  );

  if (step === "captain") {
    return (
      <YStack flex={1} backgroundColor="$background">
        <YStack backgroundColor="$backgroundSurface" padding="$4" borderBottomWidth={1} borderBottomColor="$borderColor">
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("select captain & vice-captain")}
          </Text>
          <Text fontFamily="$body" fontSize={12} color="$colorCricket" marginTop="$1">
            {formatUIText("captain gets 2x points, vc gets 1.5x")}
          </Text>
        </YStack>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {selectedPlayers.map((player, i) => {
            const isCaptain = captainId === player.playerId; const isVC = viceCaptainId === player.playerId;
            return (
              <Animated.View key={player.playerId} entering={FadeInDown.delay(i * 30).springify()}>
                <Card marginBottom="$1" padding="$3">
                  <XStack alignItems="center">
                    <XStack alignItems="center" gap="$2" flex={1}>
                      <InitialsAvatar
                        name={player.name}
                        playerRole={((player.role ?? "BAT").toUpperCase().replace("_", "").substring(0, 4)) as RoleKey}
                        ovr={Math.round(player.credits * 10)}
                        size={32}
                      />
                      <YStack flex={1}>
                        <Text {...textStyles.playerName}>{player.name}</Text>
                        <XStack alignItems="center" gap="$2" marginTop={2}>
                          <Badge variant="role" size="sm">
                            {formatBadgeText(player.role.replace("_", " "))}
                          </Badge>
                          <Text {...textStyles.secondary}>{player.team}</Text>
                        </XStack>
                      </YStack>
                    </XStack>
                    <XStack gap="$2">
                      <YStack width={36} height={36} borderRadius={18} borderWidth={2} borderColor={isCaptain ? "$accentBackground" : "$borderColor"} backgroundColor={isCaptain ? "$accentBackground" : "transparent"} alignItems="center" justifyContent="center" onPress={() => { if (viceCaptainId === player.playerId) setViceCaptainId(null); setCaptainId(player.playerId); }} cursor="pointer">
                        <Text fontSize={12} fontWeight="800" fontFamily="$mono" color={isCaptain ? "$accentColor" : "$colorMuted"}>C</Text>
                      </YStack>
                      <YStack width={36} height={36} borderRadius={18} borderWidth={2} borderColor={isVC ? "$colorCricket" : "$borderColor"} backgroundColor={isVC ? "$colorCricket" : "transparent"} alignItems="center" justifyContent="center" onPress={() => { if (captainId === player.playerId) setCaptainId(null); setViceCaptainId(player.playerId); }} cursor="pointer">
                        <Text fontSize={12} fontWeight="800" fontFamily="$mono" color={isVC ? "$accentColor" : "$colorMuted"}>VC</Text>
                      </YStack>
                    </XStack>
                  </XStack>
                </Card>
              </Animated.View>
            );
          })}
        </ScrollView>
        <XStack padding="$4" gap="$3">
          <Button variant="secondary" size="md" flex={1} onPress={() => setStep("pick")}>
            {formatUIText("back")}
          </Button>
          <Button variant="primary" size="lg" flex={2} disabled={!captainId || !viceCaptainId || createTeam.isPending} opacity={!captainId || !viceCaptainId ? 0.4 : 1} onPress={handleSubmit}>
            {createTeam.isPending ? formatUIText("creating...") : formatUIText("create team")}
          </Button>
        </XStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Stats Header */}
      <XStack backgroundColor="$backgroundSurface" padding="$4" justifyContent="space-between" borderBottomWidth={1} borderBottomColor="$borderColor">
        <YStack>
          <Text {...textStyles.hint}>{formatBadgeText("credits remaining")}</Text>
          <Text fontFamily="$mono" fontWeight="800" fontSize={20} color={creditsRemaining < 10 ? "$error" : "$color"}>
            {creditsRemaining.toFixed(1)}
          </Text>
        </YStack>
        <YStack alignItems="center">
          <Text {...textStyles.hint}>{formatBadgeText("players")}</Text>
          <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$color">
            {selectedPlayers.length}/{TEAM_SIZE}
          </Text>
        </YStack>
        <YStack alignItems="flex-end">
          <Text {...textStyles.hint}>{formatBadgeText("credits used")}</Text>
          <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$color">
            {creditsUsed.toFixed(1)}
          </Text>
        </YStack>
      </XStack>

      {/* Progress Bar with HappinessMeter */}
      <YStack paddingHorizontal="$4" paddingVertical="$2">
        <HappinessMeter current={selectedPlayers.length} total={TEAM_SIZE} />
      </YStack>

      {/* Role Filter Tabs */}
      <XStack padding="$3" gap="$2">
        {TABS.map((tab) => {
          const count = roleCounts[tab.key] ?? 0;
          const isActive = selectedTab === tab.key;
          return (
            <FilterPill key={tab.key} active={isActive} onPress={() => setSelectedTab(tab.key)}>
              <Text fontFamily="$body" fontWeight="700" fontSize={13} color={isActive ? "$background" : "$colorSecondary"}>
                {tab.label}
              </Text>
              <Text fontFamily="$mono" fontSize={10} color={isActive ? "$background" : "$colorMuted"} marginTop={2}>
                {count}
              </Text>
            </FilterPill>
          );
        })}
      </XStack>

      {currentRoleLimit && (
        <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center" marginBottom="$2">
          {formatUIText(`pick ${currentRoleLimit.min}-${currentRoleLimit.max} ${currentRoleLimit.label} players`)}
        </Text>
      )}

      {/* Player List */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {currentRolePlayers.length > 0 ? currentRolePlayers.map((player, i) => {
          const isSelected = selectedIds.has(player.id);
          const isDisabled = !isSelected && (selectedPlayers.length >= TEAM_SIZE || player.credits > creditsRemaining);
          return (
            <Animated.View key={player.id} entering={FadeInDown.delay(i * 25).springify()}>
              <Card
                pressable
                marginBottom="$1"
                padding="$3"
                borderColor={isSelected ? "$accentBackground" : "$borderColor"}
                opacity={isDisabled && !isSelected ? 0.4 : 1}
                onPress={() => togglePlayer(player)}
              >
                <XStack alignItems="center">
                  <InitialsAvatar
                    name={player.name}
                    playerRole={((player.role ?? "BAT").toUpperCase().replace("_", "").substring(0, 4)) as RoleKey}
                    ovr={Math.round(player.credits * 10)}
                    size={32}
                  />
                  <YStack flex={1} marginLeft="$2">
                    <Text {...textStyles.playerName}>{player.name}</Text>
                    <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2}>
                      {player.team}{player.nationality !== "India" ? ` · ${formatUIText("overseas")}` : ""}
                    </Text>
                  </YStack>
                  <YStack alignItems="center" marginRight="$3">
                    <Text fontFamily="$mono" fontWeight="700" fontSize={16} color={isSelected ? "$accentBackground" : "$color"}>
                      {player.credits.toFixed(1)}
                    </Text>
                    <Text {...textStyles.hint}>{formatUIText("cr")}</Text>
                  </YStack>
                  <YStack width={24} height={24} borderRadius={12} borderWidth={2} borderColor={isSelected ? "$accentBackground" : "$borderColor"} backgroundColor={isSelected ? "$accentBackground" : "transparent"} alignItems="center" justifyContent="center">
                    {isSelected && <Text color="$accentColor" fontSize={14} fontWeight="700">✓</Text>}
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          );
        }) : (
          <Card padding="$8" alignItems="center">
            <Text fontSize={DesignSystem.emptyState.iconSize} marginBottom="$3">{DesignSystem.emptyState.icon}</Text>
            <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
              {formatUIText("players for this role will appear once seeded")}
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* Continue Button */}
      <YStack padding="$4">
        <Button variant="primary" size="lg" disabled={selectedPlayers.length < TEAM_SIZE} opacity={selectedPlayers.length < TEAM_SIZE ? 0.4 : 1} onPress={handleContinue}>
          {selectedPlayers.length < TEAM_SIZE
            ? formatUIText(`select ${TEAM_SIZE - selectedPlayers.length} more players`)
            : formatUIText("select captain & vc")}
        </Button>
      </YStack>
    </YStack>
  );
}
