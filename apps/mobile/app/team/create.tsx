import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { trpc } from "../../lib/trpc";

const MAX_BUDGET = 100;
const TEAM_SIZE = 11;
const ROLE_LIMITS: Record<string, { min: number; max: number; label: string }> = {
  wicket_keeper: { min: 1, max: 4, label: "WK" },
  batsman: { min: 1, max: 6, label: "BAT" },
  all_rounder: { min: 1, max: 6, label: "AR" },
  bowler: { min: 1, max: 6, label: "BOWL" },
};

const TABS = [
  { key: "wicket_keeper", label: "WK" },
  { key: "batsman", label: "BAT" },
  { key: "all_rounder", label: "AR" },
  { key: "bowler", label: "BOWL" },
] as const;

type SelectedPlayer = {
  playerId: string;
  role: string;
  name: string;
  team: string;
  credits: number;
};

export default function TeamBuilderScreen() {
  const { matchId, contestId } = useLocalSearchParams<{
    matchId: string;
    contestId?: string;
  }>();
  const router = useRouter();

  const [selectedTab, setSelectedTab] = useState<string>("wicket_keeper");
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "captain">("pick");

  const matchPlayers = trpc.player.getByMatch.useQuery(
    { matchId: matchId! },
    { enabled: !!matchId }
  );

  const createTeam = trpc.team.create.useMutation({
    onSuccess: (data) => {
      Alert.alert("Team Created!", "Your team has been created successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  // Compute credits used and remaining
  const creditsUsed = useMemo(
    () => selectedPlayers.reduce((sum, p) => sum + p.credits, 0),
    [selectedPlayers]
  );
  const creditsRemaining = MAX_BUDGET - creditsUsed;

  // Compute role counts
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of selectedPlayers) {
      counts[p.role] = (counts[p.role] ?? 0) + 1;
    }
    return counts;
  }, [selectedPlayers]);

  // Team counts (max 7 from one team)
  const teamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of selectedPlayers) {
      counts[p.team] = (counts[p.team] ?? 0) + 1;
    }
    return counts;
  }, [selectedPlayers]);

  // Process players from API into usable format
  const playersByRole = useMemo(() => {
    if (!matchPlayers.data) return {};
    const grouped: Record<string, Array<{
      id: string;
      name: string;
      team: string;
      role: string;
      credits: number;
      nationality: string;
    }>> = {};

    for (const ps of matchPlayers.data) {
      const player = ps.player;
      if (!player) continue;
      const role = player.role;
      if (!grouped[role]) grouped[role] = [];
      const credits = (player.stats as Record<string, unknown>)?.credits as number ?? 8.0;
      grouped[role].push({
        id: player.id,
        name: player.name,
        team: player.team,
        role: player.role,
        credits,
        nationality: player.nationality ?? "India",
      });
    }

    // Sort by credits descending within each role
    for (const role of Object.keys(grouped)) {
      grouped[role]!.sort((a, b) => b.credits - a.credits);
    }

    return grouped;
  }, [matchPlayers.data]);

  const selectedIds = new Set(selectedPlayers.map((p) => p.playerId));
  const currentRolePlayers = playersByRole[selectedTab] ?? [];
  const currentRoleLimit = ROLE_LIMITS[selectedTab];

  const canSelectMore = selectedPlayers.length < TEAM_SIZE;

  function togglePlayer(player: {
    id: string;
    name: string;
    team: string;
    role: string;
    credits: number;
  }) {
    if (selectedIds.has(player.id)) {
      // Deselect
      setSelectedPlayers((prev) => prev.filter((p) => p.playerId !== player.id));
      if (captainId === player.id) setCaptainId(null);
      if (viceCaptainId === player.id) setViceCaptainId(null);
      return;
    }

    // Check limits
    if (!canSelectMore) {
      Alert.alert("Team Full", `You've already selected ${TEAM_SIZE} players`);
      return;
    }

    const roleCount = roleCounts[player.role] ?? 0;
    const limit = ROLE_LIMITS[player.role];
    if (limit && roleCount >= limit.max) {
      Alert.alert("Role Limit", `Max ${limit.max} ${limit.label} players allowed`);
      return;
    }

    if (player.credits > creditsRemaining) {
      Alert.alert(
        "Budget Exceeded",
        `${player.name} costs ${player.credits} credits, but you only have ${creditsRemaining.toFixed(1)} remaining`
      );
      return;
    }

    const playerTeamCount = teamCounts[player.team] ?? 0;
    if (playerTeamCount >= 7) {
      Alert.alert("Team Limit", `Max 7 players from ${player.team}`);
      return;
    }

    setSelectedPlayers((prev) => [
      ...prev,
      {
        playerId: player.id,
        role: player.role,
        name: player.name,
        team: player.team,
        credits: player.credits,
      },
    ]);
  }

  function handleContinue() {
    // Validate minimum role requirements
    for (const [role, limits] of Object.entries(ROLE_LIMITS)) {
      const count = roleCounts[role] ?? 0;
      if (count < limits.min) {
        Alert.alert(
          "Missing Roles",
          `Need at least ${limits.min} ${limits.label} player(s), have ${count}`
        );
        return;
      }
    }
    setStep("captain");
  }

  function handleSubmit() {
    if (!captainId || !viceCaptainId) {
      Alert.alert("Select Captain & VC", "Please select both Captain and Vice-Captain");
      return;
    }
    if (captainId === viceCaptainId) {
      Alert.alert("Invalid", "Captain and Vice-Captain must be different");
      return;
    }

    createTeam.mutate({
      contestId: contestId || "",
      players: selectedPlayers.map((p) => ({
        playerId: p.playerId,
        role: p.role as "batsman" | "bowler" | "all_rounder" | "wicket_keeper",
      })),
      captainId,
      viceCaptainId,
    });
  }

  if (matchPlayers.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#5DB882" size="large" />
        <Text style={styles.loadingText}>Loading players...</Text>
      </View>
    );
  }

  // Captain/VC selection step
  if (step === "captain") {
    return (
      <View style={styles.container}>
        <View style={styles.budgetBar}>
          <View>
            <Text style={styles.budgetLabel}>Select Captain & Vice-Captain</Text>
            <Text style={styles.budgetSubtext}>Captain gets 2x points, VC gets 1.5x</Text>
          </View>
        </View>

        <ScrollView style={styles.playerList}>
          {selectedPlayers.map((player) => {
            const isCaptain = captainId === player.playerId;
            const isVC = viceCaptainId === player.playerId;
            return (
              <View key={player.playerId} style={styles.captainRow}>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerMeta}>
                    {player.team} · {player.role.replace("_", " ")}
                  </Text>
                </View>
                <View style={styles.captainButtons}>
                  <TouchableOpacity
                    style={[
                      styles.captainBadge,
                      isCaptain && styles.captainBadgeActive,
                    ]}
                    onPress={() => {
                      if (viceCaptainId === player.playerId) setViceCaptainId(null);
                      setCaptainId(player.playerId);
                    }}
                  >
                    <Text
                      style={[
                        styles.captainBadgeText,
                        isCaptain && styles.captainBadgeTextActive,
                      ]}
                    >
                      C
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.captainBadge,
                      isVC && styles.vcBadgeActive,
                    ]}
                    onPress={() => {
                      if (captainId === player.playerId) setCaptainId(null);
                      setViceCaptainId(player.playerId);
                    }}
                  >
                    <Text
                      style={[
                        styles.captainBadgeText,
                        isVC && styles.vcBadgeTextActive,
                      ]}
                    >
                      VC
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep("pick")}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!captainId || !viceCaptainId || createTeam.isPending) && {
                opacity: 0.4,
              },
            ]}
            disabled={!captainId || !viceCaptainId || createTeam.isPending}
            onPress={handleSubmit}
          >
            <Text style={styles.submitText}>
              {createTeam.isPending ? "Creating..." : "Create Team"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Player selection step
  return (
    <View style={styles.container}>
      {/* Budget bar */}
      <View style={styles.budgetBar}>
        <View>
          <Text style={styles.budgetLabel}>Credits Remaining</Text>
          <Text
            style={[
              styles.budgetValue,
              creditsRemaining < 10 && { color: "#E5484D" },
            ]}
          >
            {creditsRemaining.toFixed(1)}
          </Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.budgetLabel}>Players</Text>
          <Text style={styles.budgetValue}>
            {selectedPlayers.length}/{TEAM_SIZE}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.budgetLabel}>Credits Used</Text>
          <Text style={styles.budgetValue}>{creditsUsed.toFixed(1)}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${(selectedPlayers.length / TEAM_SIZE) * 100}%`,
            },
          ]}
        />
      </View>

      {/* Role tabs */}
      <View style={styles.tabs}>
        {TABS.map((tab) => {
          const count = roleCounts[tab.key] ?? 0;
          const isActive = selectedTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setSelectedTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              <Text
                style={[styles.tabCount, isActive && styles.tabCountActive]}
              >
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Role requirement hint */}
      {currentRoleLimit && (
        <Text style={styles.roleHint}>
          Pick {currentRoleLimit.min}-{currentRoleLimit.max}{" "}
          {currentRoleLimit.label} players
        </Text>
      )}

      {/* Player list */}
      <ScrollView style={styles.playerList}>
        {currentRolePlayers.length > 0 ? (
          currentRolePlayers.map((player) => {
            const isSelected = selectedIds.has(player.id);
            const isDisabled =
              !isSelected &&
              (selectedPlayers.length >= TEAM_SIZE ||
                player.credits > creditsRemaining);
            return (
              <TouchableOpacity
                key={player.id}
                style={[
                  styles.playerRow,
                  isSelected && styles.playerRowSelected,
                  isDisabled && !isSelected && styles.playerRowDisabled,
                ]}
                onPress={() => togglePlayer(player)}
                disabled={isDisabled && !isSelected}
              >
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.name}</Text>
                  <Text style={styles.playerMeta}>
                    {player.team}
                    {player.nationality !== "India" ? " · Overseas" : ""}
                  </Text>
                </View>
                <View style={styles.playerCredits}>
                  <Text
                    style={[
                      styles.creditsValue,
                      isSelected && { color: "#5DB882" },
                    ]}
                  >
                    {player.credits.toFixed(1)}
                  </Text>
                  <Text style={styles.creditsLabel}>cr</Text>
                </View>
                <View
                  style={[
                    styles.selectCircle,
                    isSelected && styles.selectCircleActive,
                  ]}
                >
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No players available</Text>
            <Text style={styles.emptySubtitle}>
              Players for this role will appear once seeded
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Continue button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          selectedPlayers.length < TEAM_SIZE && { opacity: 0.4 },
        ]}
        disabled={selectedPlayers.length < TEAM_SIZE}
        onPress={handleContinue}
      >
        <Text style={styles.submitText}>
          {selectedPlayers.length < TEAM_SIZE
            ? `Select ${TEAM_SIZE - selectedPlayers.length} More Players`
            : "Select Captain & VC"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111210",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#111210",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#5E5D5A",
    fontSize: 14,
  },
  budgetBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#1C1D1B",
    borderBottomWidth: 1,
    borderBottomColor: "#333432",
  },
  budgetLabel: {
    fontSize: 11,
    color: "#5E5D5A",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  budgetSubtext: {
    fontSize: 12,
    color: "#D4A43D",
    marginTop: 4,
  },
  budgetValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#EDECEA",
  },
  progressBar: {
    height: 4,
    backgroundColor: "#333432",
  },
  progressFill: {
    height: 4,
    backgroundColor: "#5DB882",
    borderRadius: 2,
  },
  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#1C1D1B",
  },
  tabActive: {
    backgroundColor: "#5DB882",
  },
  tabText: {
    color: "#9A9894",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#111210",
  },
  tabCount: {
    color: "#5E5D5A",
    fontSize: 10,
    marginTop: 2,
  },
  tabCountActive: {
    color: "#111210",
  },
  roleHint: {
    fontSize: 12,
    color: "#5E5D5A",
    textAlign: "center",
    marginBottom: 8,
  },
  playerList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1D1B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#333432",
  },
  playerRowSelected: {
    borderColor: "#5DB882",
    backgroundColor: "rgba(93, 184, 130, 0.03)",
  },
  playerRowDisabled: {
    opacity: 0.4,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EDECEA",
  },
  playerMeta: {
    fontSize: 12,
    color: "#5E5D5A",
    marginTop: 2,
    textTransform: "capitalize",
  },
  playerCredits: {
    alignItems: "center",
    marginRight: 12,
  },
  creditsValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EDECEA",
  },
  creditsLabel: {
    fontSize: 10,
    color: "#5E5D5A",
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#333432",
    alignItems: "center",
    justifyContent: "center",
  },
  selectCircleActive: {
    backgroundColor: "#5DB882",
    borderColor: "#5DB882",
  },
  checkmark: {
    color: "#111210",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyState: {
    backgroundColor: "#1C1D1B",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333432",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#EDECEA",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#5E5D5A",
    textAlign: "center",
    lineHeight: 20,
  },
  // Captain step
  captainRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1D1B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#333432",
    marginHorizontal: 12,
  },
  captainButtons: {
    flexDirection: "row",
    gap: 8,
  },
  captainBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#333432",
    alignItems: "center",
    justifyContent: "center",
  },
  captainBadgeActive: {
    backgroundColor: "#5DB882",
    borderColor: "#5DB882",
  },
  captainBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#5E5D5A",
  },
  captainBadgeTextActive: {
    color: "#111210",
  },
  vcBadgeActive: {
    backgroundColor: "#D4A43D",
    borderColor: "#D4A43D",
  },
  vcBadgeTextActive: {
    color: "#111210",
  },
  // Bottom actions
  bottomActions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: "#1C1D1B",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333432",
  },
  backButtonText: {
    color: "#EDECEA",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    flex: 2,
    backgroundColor: "#5DB882",
    margin: 16,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitText: {
    color: "#111210",
    fontSize: 16,
    fontWeight: "700",
  },
});
