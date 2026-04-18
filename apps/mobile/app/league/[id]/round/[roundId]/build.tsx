import { SafeBackButton } from "../../../../../components/SafeBackButton";
import { ScrollView, Alert, Pressable, TextInput, Modal, View, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo, useEffect } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../../../../components/SportText";
import {
  Card,
  Badge,
  Button,
  FilterPill,
  InitialsAvatar,
  EggLoadingSpinner,
  AlertModal,
  TierBadge,
  Paywall,
  textStyles,
  formatUIText,
  formatBadgeText,
  DesignSystem,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../../../../lib/trpc";
import { HeaderControls } from "../../../../../components/HeaderControls";
import { usePaywall } from "../../../../../hooks/usePaywall";

type Step = "squad" | "batting" | "bowling" | "review";
type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

type EligiblePlayer = {
  playerId: string;
  name: string;
  team: string;
  role: string;
  photoUrl?: string | null;
  nationality?: string | null;
  battingStyle?: string;
  bowlingStyle?: string;
  recentSr?: number;
  recentAvg?: number;
  recentEcon?: number;
  recentBowlSr?: number;
  formNote?: string | null;
  recentForm?: number | null;
};

const TEAM_SIZE = 11;

// Mirrors salary_cap role tabs, but CM doesn't impose per-role max caps — only min bowlers.
// "picked" is a special tab handled separately that shows only the selected squad.
const ROLE_TABS: Array<{ key: string; label: string; match: (r: string) => boolean }> = [
  { key: "picked", label: "picked", match: () => true },
  { key: "all", label: "all", match: () => true },
  { key: "wicket_keeper", label: "keeper", match: (r) => r === "wicket_keeper" },
  { key: "batsman", label: "batter", match: (r) => r === "batsman" },
  { key: "all_rounder", label: "all-rounder", match: (r) => r === "all_rounder" },
  { key: "bowler", label: "bowler", match: (r) => r === "bowler" },
];

function roleToBadge(role: string): RoleKey {
  if (role === "bowler") return "BOWL";
  if (role === "all_rounder") return "AR";
  if (role === "wicket_keeper") return "WK";
  return "BAT";
}

function canBowl(role: string) {
  return role === "bowler" || role === "all_rounder";
}

// Normalize "Right Handed Bat" → "RH bat", "Left Handed Bat" → "LH bat"
function shortBatStyle(style?: string): string | null {
  if (!style) return null;
  const lower = style.toLowerCase();
  if (lower.includes("left")) return "LH";
  if (lower.includes("right")) return "RH";
  return null;
}

// Normalize "Right-arm fast" → "RA pace", "Slow Left-arm orthodox" → "SLA"
function shortBowlStyle(style?: string): string | null {
  if (!style) return null;
  const lower = style.toLowerCase();
  if (lower.includes("offbreak")) return "OB";
  if (lower.includes("legbreak") || lower.includes("leg-break")) return "LB";
  if (lower.includes("orthodox")) return "SLA";
  if (lower.includes("chinaman")) return "SLC";
  if (lower.includes("fast") || lower.includes("medium")) {
    return lower.includes("left") ? "LA pace" : "RA pace";
  }
  return null;
}

// "Royal Challengers Bengaluru" → "RCB", "India" → "IND", "Mumbai Indians" → "MI"
function teamShortCode(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.substring(0, 3).toUpperCase();
  return parts
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

// Aggregated stats from playerMatchScores for the matches in this round.
// We fetch these server-side and use them to rank by recent form.
type Projection = {
  projectedPoints: number;
  captainRank: number;
};

export default function EntryBuilderScreen() {
  const { id: leagueId, roundId } = useLocalSearchParams<{
    id: string;
    roundId: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { canAccess, gateFeature, paywallProps } = usePaywall();

  // ── Round data ────────────────────────────────────────────────────
  const roundQuery = trpc.cricketManager.getRound.useQuery(
    { roundId: roundId! },
    { enabled: !!roundId }
  );

  const submit = trpc.cricketManager.submitEntry.useMutation({
    onSuccess: () => {
      setAlert({
        title: "entry saved",
        message:
          "your squad is in. you can come back and update it anytime until the round locks.",
        onConfirm: () => {
          // Navigate explicitly to the round hub so the user can review the
          // saved entry and re-enter the builder if needed. router.back() is
          // unreliable on web when the entry screen was opened directly.
          if (leagueId && roundId) {
            router.replace(
              `/league/${leagueId}/round/${roundId}` as never
            );
          }
        },
      });
    },
    onError: (err: { message?: string }) => {
      Alert.alert("Error", err.message ?? "Failed to submit");
    },
  });

  // ── Step + local state ────────────────────────────────────────────
  const [step, setStep] = useState<Step>("squad");
  const [selectedTab, setSelectedTab] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"form" | "projected">("form");
  const [smartFilter, setSmartFilter] = useState<
    "all" | "differentials" | "value" | "form"
  >("all");
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [battingOrder, setBattingOrder] = useState<string[]>([]);
  const [bowlingPriority, setBowlingPriority] = useState<string[]>([]);
  const [toss, setToss] = useState<"bat_first" | "bowl_first">("bat_first");
  const [showExplainer, setShowExplainer] = useState(false);
  const [showGuru, setShowGuru] = useState(false);

  // Auto-show on first visit was causing a renderer crash on iOS Chrome
  // ("Can't open this page") — the modal racing with initial render +
  // 247-player projection load was hitting WebKit's memory ceiling.
  // Now strictly user-initiated via the help icons in the header and
  // toss row.
  function dismissExplainer() {
    setShowExplainer(false);
    try {
      // Wrap in try/catch in addition to .catch — some WebKit
      // contexts throw synchronously from AsyncStorage backends.
      AsyncStorage.setItem("cm_explainer_seen", "1").catch(() => {});
    } catch {
      // ignore — explainer dismissal is best-effort
    }
  }

  const [alert, setAlert] = useState<{
    title: string;
    message: string;
    onConfirm?: () => void;
  } | null>(null);

  // Hydrate from existing entry (if any)
  useEffect(() => {
    const entry = roundQuery.data?.myEntry;
    if (entry && selectedIds.length === 0) {
      const ids = (entry.players as Array<{ playerId: string }>).map(
        (p) => p.playerId
      );
      setSelectedIds(ids);
      const ordered = [
        ...(entry.battingOrder as Array<{ position: number; playerId: string }>),
      ]
        .sort((a, b) => a.position - b.position)
        .map((b) => b.playerId);
      setBattingOrder(ordered);
      const priority = [
        ...(entry.bowlingPriority as Array<{
          priority: number;
          playerId: string;
        }>),
      ]
        .sort((a, b) => a.priority - b.priority)
        .map((b) => b.playerId);
      setBowlingPriority(priority);
      const savedToss = (entry as { toss?: string }).toss;
      if (savedToss === "bat_first" || savedToss === "bowl_first") {
        setToss(savedToss);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundQuery.data?.myEntry]);

  // ── Derive first match — used as AI context for projections, XI, pitch ──
  const round = roundQuery.data;
  const eligible: EligiblePlayer[] = (round?.eligiblePlayers ?? []) as EligiblePlayer[];
  const byId = useMemo(() => new Map(eligible.map((p) => [p.playerId, p])), [eligible]);

  const firstMatch = useMemo(() => {
    const matches = (round?.matches ?? []) as Array<{
      id: string;
      teamHome: string;
      teamAway: string;
      venue: string | null;
      tournament: string;
      format: string;
      startTime: string | Date;
    }>;
    if (matches.length === 0) return null;
    return [...matches].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )[0]!;
  }, [round?.matches]);

  // Opponent lookup — for each team in the round, who does it play against?
  // A round typically has each team playing once, but handles multi-match teams too.
  const opponentsByTeam = useMemo(() => {
    const map = new Map<string, string[]>();
    const matches = (round?.matches ?? []) as Array<{
      teamHome: string;
      teamAway: string;
    }>;
    for (const m of matches) {
      if (!map.has(m.teamHome)) map.set(m.teamHome, []);
      if (!map.has(m.teamAway)) map.set(m.teamAway, []);
      map.get(m.teamHome)!.push(m.teamAway);
      map.get(m.teamAway)!.push(m.teamHome);
    }
    return map;
  }, [round?.matches]);

  // ── Round-level projections ────────────────────────────────────────
  // Covers every eligible player across every match in the round. The
  // server merges AI projections (when cached — usually after the round
  // is composed via prewarmRoundProjections) with a stats baseline for
  // any player the AI didn't cover. Result: every player gets a number;
  // no bias between cached-vs-uncached matches.
  const projectionsQuery = trpc.cricketManager.getRoundProjections.useQuery(
    { roundId: roundId ?? "" },
    {
      enabled: !!roundId && canAccess("hasProjectedPoints"),
      staleTime: 60 * 60_000,
      retry: 1,
    }
  );

  const projectionsByPlayerId = useMemo(() => {
    const map = new Map<string, Projection & { source?: "ai" | "baseline" }>();
    const rows = (projectionsQuery.data as any)?.projections;
    if (!Array.isArray(rows)) return map;
    for (const p of rows) {
      map.set(p.playerId, {
        projectedPoints: Number(p.projectedPoints),
        captainRank: Number(p.captainRank ?? 999),
        source: p.source,
      });
    }
    return map;
  }, [projectionsQuery.data]);

  const playingXIQuery = trpc.analytics.getPlayingXI.useQuery(
    {
      matchId: firstMatch?.id ?? "",
      teamA: firstMatch?.teamHome ?? "",
      teamB: firstMatch?.teamAway ?? "",
      format: firstMatch?.format ?? "T20",
      venue: firstMatch?.venue ?? null,
      tournament: firstMatch?.tournament ?? "unknown",
    },
    {
      enabled: !!firstMatch && canAccess("hasPlayingXI"),
      staleTime: 60 * 60_000,
      retry: 1,
    }
  );

  const playingXIStatus = useMemo(() => {
    const map = new Map<string, "likely" | "bench">();
    const data = playingXIQuery.data as any;
    if (!data) return map;
    for (const side of [data.teamA, data.teamB]) {
      if (!side) continue;
      for (const p of side.predictedXI ?? [])
        map.set(p.name?.toLowerCase?.() ?? "", "likely");
      for (const p of side.benchPlayers ?? [])
        map.set(p.name?.toLowerCase?.() ?? "", "bench");
    }
    return map;
  }, [playingXIQuery.data]);

  const differentialsQuery = trpc.analytics.getDifferentials.useQuery(
    {
      matchId: firstMatch?.id ?? "",
      teamA: firstMatch?.teamHome ?? "",
      teamB: firstMatch?.teamAway ?? "",
      format: firstMatch?.format ?? "T20",
      venue: firstMatch?.venue ?? null,
      tournament: firstMatch?.tournament ?? "unknown",
      players: [],
    },
    {
      enabled: !!firstMatch && canAccess("hasDifferentials"),
      staleTime: 2 * 60 * 60_000,
      retry: 1,
    }
  );

  const differentialNames = useMemo(() => {
    const set = new Set<string>();
    const picks = (differentialsQuery.data as any)?.picks;
    if (Array.isArray(picks)) {
      for (const p of picks) set.add(p.playerName?.toLowerCase?.() ?? "");
    }
    return set;
  }, [differentialsQuery.data]);

  // ── Player list filtered + sorted by current tab / smart filter ───
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of selectedIds) {
      const p = byId.get(id);
      if (p) counts[p.role] = (counts[p.role] ?? 0) + 1;
    }
    return counts;
  }, [selectedIds, byId]);

  const currentRolePlayers = useMemo(() => {
    let list: EligiblePlayer[];
    if (selectedTab === "picked") {
      // Preserve selection order so users can see their pick sequence
      const selectedSet = new Set(selectedIds);
      list = selectedIds
        .map((id) => byId.get(id))
        .filter((p): p is EligiblePlayer => !!p && selectedSet.has(p.playerId));
    } else {
      const tab = ROLE_TABS.find((t) => t.key === selectedTab) ?? ROLE_TABS[1]!;
      list = eligible.filter((p) => tab.match(p.role));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q)
      );
    }

    // Picked tab preserves selection order — no sort/smart-filter applied
    if (selectedTab === "picked") {
      return list;
    }

    if (smartFilter === "differentials" && differentialNames.size > 0) {
      list = list.filter((p) => differentialNames.has(p.name.toLowerCase()));
    } else if (smartFilter === "value" && projectionsByPlayerId.size > 0) {
      list = [...list].sort((a, b) => {
        const pA = projectionsByPlayerId.get(a.playerId)?.projectedPoints ?? 0;
        const pB = projectionsByPlayerId.get(b.playerId)?.projectedPoints ?? 0;
        return pB - pA;
      });
    } else if (smartFilter === "form") {
      // Sort by recent SR (for batters) / 1/ER (for bowlers) as a form proxy
      list = [...list].sort((a, b) => {
        const fA =
          canBowl(a.role) && a.recentEcon
            ? 10 - a.recentEcon
            : a.recentSr ?? 0;
        const fB =
          canBowl(b.role) && b.recentEcon
            ? 10 - b.recentEcon
            : b.recentSr ?? 0;
        return fB - fA;
      });
    } else if (sortBy === "projected" && projectionsByPlayerId.size > 0) {
      list = [...list].sort((a, b) => {
        const pA = projectionsByPlayerId.get(a.playerId)?.projectedPoints ?? 0;
        const pB = projectionsByPlayerId.get(b.playerId)?.projectedPoints ?? 0;
        return pB - pA;
      });
    } else {
      // Default: sort by strike rate / inverse economy (form proxy)
      list = [...list].sort((a, b) => {
        const fA = a.recentSr ?? 0;
        const fB = b.recentSr ?? 0;
        return fB - fA;
      });
    }

    return list;
  }, [
    eligible,
    selectedTab,
    selectedIds,
    byId,
    search,
    smartFilter,
    sortBy,
    projectionsByPlayerId,
    differentialNames,
  ]);

  // ── Actions ───────────────────────────────────────────────────────
  const bowlerCount = useMemo(
    () =>
      selectedIds.filter((id) => {
        const p = byId.get(id);
        return p && canBowl(p.role);
      }).length,
    [selectedIds, byId]
  );

  function showAlert(title: string, message?: string, onConfirm?: () => void) {
    setAlert({ title, message: message ?? "", onConfirm });
  }

  function togglePlayer(playerId: string) {
    const player = byId.get(playerId);
    if (!player) return;

    if (selectedIds.includes(playerId)) {
      setSelectedIds(selectedIds.filter((id) => id !== playerId));
      setBattingOrder(battingOrder.filter((id) => id !== playerId));
      setBowlingPriority(bowlingPriority.filter((id) => id !== playerId));
      return;
    }
    if (selectedIds.length >= TEAM_SIZE) {
      showAlert("squad full", `max ${TEAM_SIZE} players allowed`);
      return;
    }
    const newIds = [...selectedIds, playerId];
    setSelectedIds(newIds);
    setBattingOrder([...battingOrder, playerId]);
    if (canBowl(player.role)) {
      setBowlingPriority([...bowlingPriority, playerId]);
    }
  }

  function moveUp(list: string[], setList: (l: string[]) => void, i: number) {
    if (i === 0) return;
    const copy = [...list];
    [copy[i - 1]!, copy[i]!] = [copy[i]!, copy[i - 1]!];
    setList(copy);
  }

  function moveDown(list: string[], setList: (l: string[]) => void, i: number) {
    if (i === list.length - 1) return;
    const copy = [...list];
    [copy[i + 1]!, copy[i]!] = [copy[i]!, copy[i + 1]!];
    setList(copy);
  }

  function gotoStep(next: Step) {
    if (!round) return;
    if (next === "batting") {
      if (selectedIds.length !== TEAM_SIZE) {
        showAlert(
          "squad incomplete",
          `pick exactly ${TEAM_SIZE} players (you have ${selectedIds.length})`
        );
        return;
      }
      if (bowlerCount < round.minBowlers) {
        showAlert(
          "not enough bowlers",
          `need at least ${round.minBowlers} bowlers or all-rounders (you have ${bowlerCount})`
        );
        return;
      }
    }
    if (next === "bowling" && battingOrder.length !== 11) {
      showAlert("set batting order", "arrange all 11 players in batting order");
      return;
    }
    if (next === "review" && bowlingPriority.length === 0) {
      showAlert("set bowling order", "add at least one bowler to the bowling order");
      return;
    }
    setStep(next);
  }

  function handleSubmit() {
    if (selectedIds.length !== TEAM_SIZE) return;
    submit.mutate({
      roundId: roundId!,
      players: selectedIds.map((playerId) => ({ playerId })),
      battingOrder: battingOrder.map((playerId, i) => ({
        position: i + 1,
        playerId,
      })),
      bowlingPriority: bowlingPriority.map((playerId, i) => ({
        priority: i + 1,
        playerId,
      })),
      toss,
    });
  }

  // ── Projected NRR for review step ─────────────────────────────────
  const projectedTotals = useMemo(() => {
    if (projectionsByPlayerId.size === 0) return null;
    let total = 0;
    let withData = 0;
    for (const id of selectedIds) {
      const p = byId.get(id);
      const proj = projectionsByPlayerId.get(id);
      if (!p || !proj) continue;
      total += proj.projectedPoints;
      withData += 1;
    }
    if (withData === 0) return null;
    return { total, withData, total_squad: selectedIds.length };
  }, [selectedIds, byId, projectionsByPlayerId]);

  // ── Estimated bat/bowl totals for scenario preview ────────────────
  // Uses the same projections AI gives us, partitioned by role. These are
  // rough — the real engine runs against live match data on settlement —
  // but they're directionally correct and give the user a feel for how
  // their toss call shifts the scenario.
  const scenarioEstimate = useMemo(() => {
    if (projectionsByPlayerId.size === 0) return null;
    let batPts = 0;
    let bowlPts = 0;
    for (const id of battingOrder) {
      const p = byId.get(id);
      const proj = projectionsByPlayerId.get(id);
      if (!p || !proj) continue;
      batPts += proj.projectedPoints;
    }
    for (const id of bowlingPriority) {
      const p = byId.get(id);
      const proj = projectionsByPlayerId.get(id);
      if (!p || !proj) continue;
      bowlPts += proj.projectedPoints;
    }
    if (batPts === 0 && bowlPts === 0) return null;
    // Scale projected points into "feels like" run totals.
    // A 30-pt projected batter ≈ 30-40 runs in a T20; 25-pt bowler ≈ economy 8 over 4 overs ≈ 32 conceded.
    // Keep the scaling visible but not wildly off.
    const battingTotal = Math.round(batPts * 0.9);
    const bowlingTotal = Math.round(bowlPts * 0.75);
    return { battingTotal, bowlingTotal };
  }, [battingOrder, bowlingPriority, byId, projectionsByPlayerId]);

  // NrrScenarioPreview — closure over the live squad state
  function NrrScenarioPreview({ toss }: { toss: "bat_first" | "bowl_first" }) {
    if (!scenarioEstimate) {
      return (
        <Card
          padding="$3"
          backgroundColor="$backgroundSurfaceAlt"
          borderWidth={0}
        >
          <Text
            fontFamily="$body"
            fontSize={10}
            color="$colorMuted"
            textAlign="center"
          >
            {formatUIText("projection preview unavailable for this squad")}
          </Text>
        </Card>
      );
    }

    const batRaw = scenarioEstimate.battingTotal;
    const bowlRaw = scenarioEstimate.bowlingTotal;

    // bat_first: batters bat freely, bowl total is whatever they concede
    // bowl_first: bowlers go first, batters chase bowlRaw + 1 (cap at what they can reach)
    const isBatFirst = toss === "bat_first";
    const finalBat = isBatFirst
      ? batRaw
      : Math.min(batRaw, bowlRaw + 1);
    const finalBowl = bowlRaw;
    const nrr = finalBat / 20 - finalBowl / 20;
    const maxTotal = Math.max(finalBat, finalBowl, 1);

    return (
      <YStack gap="$2">
        <Text
          fontFamily="$mono"
          fontSize={9}
          color="$colorMuted"
          textTransform="uppercase"
          letterSpacing={1}
        >
          {formatUIText("projected for your squad")}
        </Text>

        {/* Bat bar */}
        <ScenarioBar
          label="your batting"
          value={finalBat}
          max={maxTotal}
          color="$accentBackground"
          capped={!isBatFirst && batRaw > bowlRaw + 1}
        />
        {/* Bowl bar */}
        <ScenarioBar
          label="opposition runs"
          value={finalBowl}
          max={maxTotal}
          color="$colorCricket"
        />

        {/* NRR equation */}
        <XStack
          marginTop="$2"
          padding="$2"
          backgroundColor="$backgroundSurfaceAlt"
          borderRadius={8}
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
        >
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {finalBat}/20 − {finalBowl}/20
          </Text>
          <Text
            fontFamily="$mono"
            fontWeight="800"
            fontSize={16}
            color={nrr >= 0 ? "$accentBackground" : "$colorHatch"}
          >
            NRR {nrr >= 0 ? "+" : ""}
            {nrr.toFixed(2)}
          </Text>
        </XStack>

        {!isBatFirst && batRaw > bowlRaw + 1 && (
          <Text
            fontFamily="$body"
            fontSize={10}
            color="$colorMuted"
            lineHeight={13}
          >
            {formatUIText(
              `chasing stops at ${bowlRaw + 1} — your extra ${batRaw - (bowlRaw + 1)} batting runs don't count`
            )}
          </Text>
        )}
      </YStack>
    );
  }

  // ── Risk flags (review step) ──────────────────────────────────────
  const riskFlags = useMemo(() => {
    const flags: Array<{ icon: string; text: string }> = [];

    // Bench risk
    const benchCount = selectedIds.filter(
      (id) =>
        playingXIStatus.get(byId.get(id)?.name.toLowerCase() ?? "") === "bench"
    ).length;
    if (benchCount > 0) {
      flags.push({
        icon: "⚠️",
        text: `${benchCount} player${benchCount > 1 ? "s have" : " has"} bench risk`,
      });
    }

    // Team skew
    const teamCounts: Record<string, number> = {};
    for (const id of selectedIds) {
      const p = byId.get(id);
      if (p) teamCounts[p.team] = (teamCounts[p.team] ?? 0) + 1;
    }
    for (const [team, c] of Object.entries(teamCounts)) {
      if (c >= 8) {
        flags.push({
          icon: "⚠️",
          text: `${c} players from ${team} — heavily skewed`,
        });
      }
    }

    return flags;
  }, [selectedIds, byId, playingXIStatus]);

  // ── Loading ──
  if (roundQuery.isLoading || !round) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
      >
        <EggLoadingSpinner size={48} message="loading" />
      </YStack>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <YStack flex={1} backgroundColor="$background">
      {/* ── Header ─────────────────────────────────────────────── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3" flex={1}>
          <SafeBackButton />
          <Text
            fontFamily="$mono"
            fontWeight="500"
            fontSize={17}
            color="$color"
            letterSpacing={-0.5}
          >
            {formatUIText("build entry")}
          </Text>
        </XStack>
        <XStack alignItems="center" gap="$2">
          <Pressable
            onPress={() => setShowGuru(true)}
            hitSlop={8}
            style={{ padding: 4 }}
            testID="cm-guru-btn"
          >
            <Text fontSize={20}>✨</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowExplainer(true)}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Ionicons
              name="help-circle-outline"
              size={22}
              color={theme.colorMuted?.val ?? "#888"}
            />
          </Pressable>
          <HeaderControls />
        </XStack>
      </XStack>

      {/* ── Step indicator ─────────────────────────────────────── */}
      <StepIndicator step={step} />

      {/* ── Round summary bar ──────────────────────────────────── */}
      {step === "squad" && (
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$2"
          gap="$3"
          borderBottomWidth={1}
          borderBottomColor="$borderColor"
          backgroundColor="$backgroundSurface"
        >
          <Text
            fontFamily="$mono"
            fontSize={11}
            color="$accentBackground"
            fontWeight="700"
          >
            {round.name}
          </Text>
          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
            {round.matchesTotal} {formatUIText("matches")}
          </Text>
          <Text
            fontFamily="$mono"
            fontSize={10}
            color={
              selectedIds.length === TEAM_SIZE
                ? "$accentBackground"
                : "$colorMuted"
            }
          >
            {selectedIds.length}/{TEAM_SIZE}
          </Text>
          <Text
            fontFamily="$mono"
            fontSize={10}
            color={
              bowlerCount >= round.minBowlers
                ? "$accentBackground"
                : "$colorMuted"
            }
          >
            {bowlerCount}/{round.minBowlers} bowl
          </Text>
        </XStack>
      )}

      {/* ── STEP: SQUAD ─────────────────────────────────────────── */}
      {step === "squad" && (
        <>
          {/* Selected squad strip — always visible for quick review + deselect */}
          {selectedIds.length > 0 && (
            <YStack
              paddingVertical="$2"
              backgroundColor="$backgroundSurface"
              borderBottomWidth={1}
              borderBottomColor="$borderColor"
            >
              <XStack
                paddingHorizontal="$4"
                marginBottom="$2"
                alignItems="center"
                justifyContent="space-between"
              >
                <Text
                  fontFamily="$mono"
                  fontSize={10}
                  color="$colorMuted"
                  textTransform="uppercase"
                  letterSpacing={1}
                >
                  {formatUIText("your squad")} · {selectedIds.length}/{TEAM_SIZE}
                </Text>
                <Pressable
                  onPress={() =>
                    setSelectedTab(selectedTab === "picked" ? "all" : "picked")
                  }
                  hitSlop={6}
                >
                  <Text
                    fontFamily="$mono"
                    fontSize={10}
                    color="$accentBackground"
                    fontWeight="700"
                  >
                    {selectedTab === "picked"
                      ? formatUIText("show all →")
                      : formatUIText("view all →")}
                  </Text>
                </Pressable>
              </XStack>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 16,
                  gap: 10,
                  alignItems: "center",
                }}
              >
                {selectedIds.map((pid) => {
                  const p = byId.get(pid);
                  if (!p) return null;
                  return (
                    <Pressable
                      key={pid}
                      onPress={() => togglePlayer(pid)}
                      hitSlop={4}
                    >
                      <YStack alignItems="center" width={44}>
                        <YStack position="relative">
                          <InitialsAvatar
                            name={p.name}
                            playerRole={roleToBadge(p.role)}
                            ovr={0}
                            size={36}
                            hideBadge
                            imageUrl={p.photoUrl ?? undefined}
                          />
                          {/* tiny × overlay to signal tap-to-remove */}
                          <YStack
                            position="absolute"
                            top={-4}
                            right={-4}
                            width={16}
                            height={16}
                            borderRadius={8}
                            backgroundColor="$backgroundSurface"
                            borderWidth={1}
                            borderColor="$borderColor"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Text
                              fontFamily="$mono"
                              fontSize={10}
                              fontWeight="700"
                              color="$colorMuted"
                              lineHeight={10}
                            >
                              ×
                            </Text>
                          </YStack>
                        </YStack>
                        <Text
                          fontFamily="$body"
                          fontSize={9}
                          color="$color"
                          numberOfLines={1}
                          marginTop={4}
                          textAlign="center"
                        >
                          {p.name.split(" ").pop() ?? p.name}
                        </Text>
                      </YStack>
                    </Pressable>
                  );
                })}
                {/* Empty slots placeholder */}
                {Array.from({ length: TEAM_SIZE - selectedIds.length }).map(
                  (_, i) => (
                    <YStack
                      key={`empty-${i}`}
                      width={36}
                      height={36}
                      borderRadius={10}
                      borderWidth={1}
                      borderColor="$borderColor"
                      borderStyle="dashed"
                      alignItems="center"
                      justifyContent="center"
                      opacity={0.4}
                    >
                      <Text
                        fontFamily="$mono"
                        fontSize={10}
                        color="$colorMuted"
                      >
                        {selectedIds.length + i + 1}
                      </Text>
                    </YStack>
                  )
                )}
              </ScrollView>
            </YStack>
          )}

          {/* Search bar */}
          <XStack
            paddingHorizontal="$3"
            paddingVertical="$2"
            backgroundColor="$backgroundSurface"
            borderBottomWidth={1}
            borderBottomColor="$borderColor"
          >
            <XStack
              flex={1}
              backgroundColor="$backgroundSurfaceAlt"
              borderRadius={10}
              paddingHorizontal="$3"
              paddingVertical="$2"
              alignItems="center"
              gap="$2"
            >
              <Ionicons
                name="search"
                size={14}
                color={theme.colorMuted?.val ?? "#999"}
              />
              <TextInput
                placeholder="search players..."
                placeholderTextColor={theme.colorMuted?.val ?? "#999"}
                value={search}
                onChangeText={setSearch}
                style={{
                  flex: 1,
                  color: theme.color?.val ?? "#000",
                  fontSize: 13,
                  padding: 0,
                }}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={8}>
                  <Ionicons
                    name="close-circle"
                    size={16}
                    color={theme.colorMuted?.val ?? "#666"}
                  />
                </Pressable>
              )}
            </XStack>
          </XStack>

          {/* Role tabs */}
          <XStack
            paddingHorizontal="$3"
            paddingVertical="$2"
            gap="$2"
            flexWrap="wrap"
          >
            {ROLE_TABS.map((tab) => {
              const count =
                tab.key === "picked"
                  ? selectedIds.length
                  : tab.key === "all"
                  ? 0
                  : roleCounts[tab.key] ?? 0;
              const isActive = selectedTab === tab.key;
              // Don't show "picked" tab at all until something is selected
              if (tab.key === "picked" && count === 0) return null;
              return (
                <FilterPill
                  key={tab.key}
                  active={isActive}
                  onPress={() => setSelectedTab(tab.key)}
                >
                  <Text
                    fontFamily="$body"
                    fontWeight="700"
                    fontSize={13}
                    color={isActive ? "$background" : "$colorSecondary"}
                  >
                    {tab.label}
                    {count > 0 ? ` · ${count}` : ""}
                  </Text>
                </FilterPill>
              );
            })}
          </XStack>

          {/* Sort toggles */}
          <XStack
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal="$4"
            marginBottom="$1"
          >
            <Text fontFamily="$body" fontSize={12} color="$colorMuted">
              {formatUIText(`min ${round.minBowlers} bowlers (bowler or all-rounder)`)}
            </Text>
            <XStack gap="$1">
              <FilterPill
                active={sortBy === "form"}
                onPress={() => {
                  setSortBy("form");
                  setSmartFilter("all");
                }}
              >
                <Text
                  fontFamily="$mono"
                  fontSize={9}
                  fontWeight="700"
                  color={sortBy === "form" ? "$background" : "$colorMuted"}
                >
                  {formatBadgeText("form")}
                </Text>
              </FilterPill>
              {projectionsByPlayerId.size > 0 ? (
                <FilterPill
                  active={sortBy === "projected" && smartFilter === "all"}
                  onPress={() => {
                    setSortBy("projected");
                    setSmartFilter("all");
                  }}
                >
                  <Text
                    fontFamily="$mono"
                    fontSize={9}
                    fontWeight="700"
                    color={
                      sortBy === "projected" && smartFilter === "all"
                        ? "$background"
                        : "$colorMuted"
                    }
                  >
                    {formatBadgeText("projected")}
                  </Text>
                </FilterPill>
              ) : !canAccess("hasProjectedPoints") ? (
                <Pressable
                  onPress={() =>
                    gateFeature(
                      "hasProjectedPoints",
                      "pro",
                      "Projected Points",
                      "AI-estimated fantasy points for each player"
                    )
                  }
                >
                  <XStack
                    paddingHorizontal={10}
                    paddingVertical={6}
                    borderRadius={14}
                    borderWidth={1}
                    borderColor="$borderColor"
                    backgroundColor="$backgroundSurface"
                    alignItems="center"
                    gap={4}
                    opacity={0.5}
                  >
                    <Text
                      fontFamily="$mono"
                      fontSize={9}
                      fontWeight="700"
                      color="$colorMuted"
                    >
                      {formatBadgeText("projected")}
                    </Text>
                    <TierBadge tier="pro" size="sm" />
                  </XStack>
                </Pressable>
              ) : null}
            </XStack>
          </XStack>

          {/* Smart Picks filter strip */}
          {selectedIds.length >= 3 && projectionsByPlayerId.size > 0 && (
            <XStack
              paddingHorizontal="$4"
              paddingBottom="$2"
              gap="$2"
              flexWrap="wrap"
            >
              <SmartPill
                emoji="🔮"
                label="ai top"
                active={smartFilter === "all" && sortBy === "projected"}
                onPress={() => {
                  setSmartFilter("all");
                  setSortBy("projected");
                }}
              />
              {differentialNames.size > 0 ? (
                <SmartPill
                  emoji="💎"
                  label="diffs"
                  active={smartFilter === "differentials"}
                  onPress={() => setSmartFilter("differentials")}
                />
              ) : !canAccess("hasDifferentials") ? (
                <Pressable
                  onPress={() =>
                    gateFeature(
                      "hasDifferentials",
                      "pro",
                      "Differentials",
                      "Low-ownership high-upside picks"
                    )
                  }
                >
                  <XStack
                    paddingHorizontal={10}
                    paddingVertical={5}
                    borderRadius={14}
                    borderWidth={1}
                    borderColor="$borderColor"
                    backgroundColor="$backgroundSurface"
                    alignItems="center"
                    gap={4}
                    opacity={0.5}
                  >
                    <Text fontSize={10}>💎</Text>
                    <Text
                      fontFamily="$mono"
                      fontSize={9}
                      fontWeight="700"
                      color="$colorMuted"
                    >
                      {formatBadgeText("diffs")}
                    </Text>
                    <TierBadge tier="pro" size="sm" />
                  </XStack>
                </Pressable>
              ) : null}
              <SmartPill
                emoji="📈"
                label="value"
                active={smartFilter === "value"}
                onPress={() => setSmartFilter("value")}
              />
              <SmartPill
                emoji="🔥"
                label="form"
                active={smartFilter === "form"}
                onPress={() => setSmartFilter("form")}
              />
            </XStack>
          )}

          {/* Player list — virtualized via FlatList. Previously this was a
              ScrollView mapping all 247 eligible players at once, which
              hit iOS WebKit's per-tab memory ceiling and crashed the
              tab ("Can't open this page"). FlatList only mounts the
              visible window plus a small buffer, so memory stays
              constant regardless of pool size. Drops the row-by-row
              FadeInDown animation too — staggering 247 reanimated
              springs was its own memory tax. */}
          <FlatList
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
            data={currentRolePlayers}
            keyExtractor={(p) => p.playerId}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews
            ListEmptyComponent={
              <Card padding="$8" alignItems="center">
                <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
                <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
                  {selectedTab === "picked"
                    ? formatUIText(
                        "no players picked yet — switch to any tab to start selecting"
                      )
                    : search.trim()
                    ? formatUIText("no players match your search")
                    : formatUIText(
                        "player pool not populated yet — check back closer to match time"
                      )}
                </Text>
              </Card>
            }
            renderItem={({ item: player }: { item: EligiblePlayer }) => {
              const isSelected = selectedIds.includes(player.playerId);
              const isDisabled =
                !isSelected && selectedIds.length >= TEAM_SIZE;
              const proj = projectionsByPlayerId.get(player.playerId);
              const xiStatus = playingXIStatus.get(player.name.toLowerCase());
              const isDiff = differentialNames.has(player.name.toLowerCase());
              return (
                <View>
                    <Card
                      marginBottom="$1"
                      padding={0}
                      borderColor={
                        isSelected ? "$accentBackground" : "$borderColor"
                      }
                      borderWidth={isSelected ? 2 : 1}
                      backgroundColor={
                        isSelected
                          ? "$backgroundSurfaceAlt"
                          : "$backgroundSurface"
                      }
                      opacity={isDisabled && !isSelected ? 0.4 : 1}
                    >
                      <XStack alignItems="center">
                        {/* Main row — tap to select */}
                        <Pressable
                          onPress={() => togglePlayer(player.playerId)}
                          disabled={isDisabled && !isSelected}
                          style={{ flex: 1 }}
                        >
                          <XStack
                            alignItems="center"
                            paddingVertical={12}
                            paddingLeft={12}
                            paddingRight={8}
                          >
                            <InitialsAvatar
                              name={player.name}
                              playerRole={roleToBadge(player.role)}
                              ovr={0}
                              size={40}
                              hideBadge
                              imageUrl={player.photoUrl ?? undefined}
                            />
                            <YStack flex={1} marginLeft="$3">
                              {/* Line 1: Name + badges */}
                              <XStack
                                alignItems="center"
                                gap="$1"
                                flexWrap="wrap"
                              >
                                <Text {...textStyles.playerName} numberOfLines={1}>
                                  {player.name}
                                </Text>
                                {proj && proj.captainRank <= 3 && (
                                  <Text fontSize={10} lineHeight={12}>
                                    👑
                                  </Text>
                                )}
                                {isDiff && (
                                  <Text
                                    fontSize={10}
                                    lineHeight={12}
                                    color="$colorCricket"
                                  >
                                    💎
                                  </Text>
                                )}
                                {xiStatus === "likely" && (
                                  <Badge variant="live" size="sm">
                                    <Text
                                      fontFamily="$mono"
                                      fontSize={7}
                                      fontWeight="700"
                                      color="white"
                                    >
                                      {formatBadgeText("XI")}
                                    </Text>
                                  </Badge>
                                )}
                                {xiStatus === "bench" && (
                                  <Badge variant="warning" size="sm">
                                    <Text
                                      fontFamily="$mono"
                                      fontSize={7}
                                      fontWeight="700"
                                    >
                                      {formatBadgeText("BENCH")}
                                    </Text>
                                  </Badge>
                                )}
                              </XStack>

                              {/* Line 2: team · role · vs opponent */}
                              <XStack alignItems="center" gap={6} marginTop={2}>
                                <Text
                                  fontFamily="$mono"
                                  fontSize={11}
                                  fontWeight="600"
                                  color="$colorMuted"
                                >
                                  {teamShortCode(player.team)} · {roleToBadge(player.role)}
                                  {(() => {
                                    const bat = shortBatStyle(player.battingStyle);
                                    const bowl = shortBowlStyle(player.bowlingStyle);
                                    if (canBowl(player.role) && bowl) return ` · ${bowl}`;
                                    if (bat) return ` · ${bat}`;
                                    return "";
                                  })()}
                                </Text>
                                {(() => {
                                  const opponents =
                                    opponentsByTeam.get(player.team) ?? [];
                                  if (opponents.length === 0) return null;
                                  const shortList = opponents
                                    .slice(0, 2)
                                    .map(teamShortCode)
                                    .join(", ");
                                  const suffix =
                                    opponents.length > 2
                                      ? ` +${opponents.length - 2}`
                                      : "";
                                  return (
                                    <Text
                                      fontFamily="$mono"
                                      fontSize={11}
                                      color="$accentBackground"
                                      fontWeight="700"
                                    >
                                      vs {shortList}
                                      {suffix}
                                    </Text>
                                  );
                                })()}
                              </XStack>

                              {/* Line 3: form note (AI commentary on recent form) */}
                              {player.formNote && (
                                <Text
                                  fontFamily="$body"
                                  fontSize={10}
                                  color="$accentBackground"
                                  opacity={0.75}
                                  marginTop={3}
                                  numberOfLines={2}
                                  lineHeight={13}
                                >
                                  {player.formNote}
                                </Text>
                              )}
                            </YStack>
                            {sortBy === "projected" && proj && (
                              <YStack
                                alignItems="center"
                                marginRight="$2"
                              >
                                <Text
                                  fontFamily="$mono"
                                  fontWeight="800"
                                  fontSize={17}
                                  color="$accentBackground"
                                >
                                  {proj.projectedPoints.toFixed(1)}
                                </Text>
                                <Text {...textStyles.hint}>
                                  {/* "ai" badge marks AI-enhanced
                                      projections; plain "pts" means the
                                      row is using the stats-based
                                      baseline fallback. Plain text
                                      instead of an emoji because some
                                      WebKit contexts hitched on it. */}
                                  {(proj as any).source === "ai" ? "ai pts" : formatUIText("pts")}
                                </Text>
                              </YStack>
                            )}
                            {player.recentForm != null && sortBy !== "projected" && (
                              <YStack
                                alignItems="center"
                                marginRight="$2"
                              >
                                <Text
                                  fontFamily="$mono"
                                  fontWeight="800"
                                  fontSize={15}
                                  color={
                                    player.recentForm >= 7
                                      ? "$accentBackground"
                                      : player.recentForm >= 4
                                      ? "$colorCricket"
                                      : "$colorMuted"
                                  }
                                >
                                  {player.recentForm}
                                </Text>
                                <Text {...textStyles.hint}>form</Text>
                              </YStack>
                            )}
                          </XStack>
                        </Pressable>

                        {/* Separated stats icon — its own tap target with vertical divider */}
                        <YStack
                          width={1}
                          alignSelf="stretch"
                          backgroundColor="$borderColor"
                          marginVertical={8}
                        />
                        <Pressable
                          onPress={() => setStatsPlayerId(player.playerId)}
                          hitSlop={6}
                          style={{
                            paddingVertical: 12,
                            paddingHorizontal: 14,
                          }}
                        >
                          <Ionicons
                            name="stats-chart"
                            size={18}
                            color="#5DB882"
                          />
                        </Pressable>
                      </XStack>
                    </Card>
                  </View>
                );
            }}
          />
        </>
      )}

      {/* ── STEP: BATTING ORDER ─────────────────────────────────── */}
      {step === "batting" && (() => {
        // Compute the "ball usage cutoff" — at which batting position does the
        // 120-ball budget run out, given each batter's typical balls faced.
        // Heuristic: high-SR players face ~20 balls, low-SR ~30. Default 25.
        const ballEstimate = (sr?: number) => {
          if (!sr || sr === 0) return 25;
          if (sr >= 160) return 18;
          if (sr >= 130) return 23;
          if (sr >= 100) return 28;
          return 35;
        };
        let cumBalls = 0;
        let cutoffIdx = -1;
        for (let i = 0; i < battingOrder.length; i++) {
          const p = byId.get(battingOrder[i]!);
          cumBalls += ballEstimate(p?.recentSr);
          if (cumBalls >= 120 && cutoffIdx === -1) {
            cutoffIdx = i;
            break;
          }
        }

        return (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
          >
            <Text
              fontFamily="$body"
              fontSize={12}
              color="$colorMuted"
              paddingVertical="$3"
            >
              {formatUIText(
                "tap arrows to reorder. high-SR openers at top — players below the cutoff line may not face balls."
              )}
            </Text>
            {battingOrder.map((pid, i) => {
              const p = byId.get(pid);
              if (!p) return null;
              const proj = projectionsByPlayerId.get(pid);
              const opponents = opponentsByTeam.get(p.team) ?? [];
              const opponentStr =
                opponents.length > 0
                  ? opponents.slice(0, 2).map(teamShortCode).join(", ") +
                    (opponents.length > 2 ? ` +${opponents.length - 2}` : "")
                  : undefined;
              return (
                <YStack key={pid}>
                  <OrderRow
                    player={p}
                    position={i + 1}
                    accentColor="$accentBackground"
                    projected={proj?.projectedPoints}
                    opponent={opponentStr}
                    onUp={() => moveUp(battingOrder, setBattingOrder, i)}
                    onDown={() => moveDown(battingOrder, setBattingOrder, i)}
                    upDisabled={i === 0}
                    downDisabled={i === battingOrder.length - 1}
                  />
                  {i === cutoffIdx && (
                    <XStack
                      alignItems="center"
                      gap="$2"
                      marginVertical="$2"
                      paddingHorizontal="$2"
                    >
                      <YStack
                        flex={1}
                        height={1}
                        backgroundColor="$colorCricket"
                        opacity={0.4}
                      />
                      <Text
                        fontFamily="$mono"
                        fontSize={9}
                        fontWeight="700"
                        color="$colorCricket"
                        textTransform="uppercase"
                        letterSpacing={1}
                      >
                        ⚡ ~120 balls used here
                      </Text>
                      <YStack
                        flex={1}
                        height={1}
                        backgroundColor="$colorCricket"
                        opacity={0.4}
                      />
                    </XStack>
                  )}
                </YStack>
              );
            })}
          </ScrollView>
        );
      })()}

      {/* ── STEP: BOWLING PRIORITY ──────────────────────────────── */}
      {step === "bowling" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
        >
          <Text
            fontFamily="$body"
            fontSize={12}
            color="$colorMuted"
            paddingVertical="$3"
          >
            {formatUIText(
              "tap arrows to reorder. bowlers bowl in this order. each capped at 4 overs. bowling stops if 10 wickets fall."
            )}
          </Text>
          {bowlingPriority.map((pid, i) => {
            const p = byId.get(pid);
            if (!p) return null;
            const proj = projectionsByPlayerId.get(pid);
            const opponents = opponentsByTeam.get(p.team) ?? [];
            const opponentStr =
              opponents.length > 0
                ? opponents.slice(0, 2).map(teamShortCode).join(", ") +
                  (opponents.length > 2 ? ` +${opponents.length - 2}` : "")
                : undefined;
            return (
              <OrderRow
                key={pid}
                player={p}
                position={i + 1}
                accentColor="$colorCricket"
                projected={proj?.projectedPoints}
                opponent={opponentStr}
                onUp={() =>
                  moveUp(bowlingPriority, setBowlingPriority, i)
                }
                onDown={() =>
                  moveDown(bowlingPriority, setBowlingPriority, i)
                }
                upDisabled={i === 0}
                downDisabled={i === bowlingPriority.length - 1}
              />
            );
          })}
        </ScrollView>
      )}

      {/* ── STEP: REVIEW ─────────────────────────────────────────── */}
      {step === "review" && (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
          style={{ flex: 1 }}
        >
          {/* Toss call — live squad-based preview of the chosen scenario */}
          <Card padding="$4" marginBottom="$4">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
              <Text
                fontFamily="$mono"
                fontSize={10}
                color="$colorMuted"
                textTransform="uppercase"
                letterSpacing={1}
              >
                {formatUIText("toss call")}
              </Text>
              <Pressable
                onPress={() => setShowExplainer(true)}
                hitSlop={8}
              >
                <XStack alignItems="center" gap={4}>
                  <Ionicons
                    name="help-circle-outline"
                    size={14}
                    color={theme.colorMuted?.val ?? "#888"}
                  />
                  <Text fontFamily="$body" fontSize={10} color="$colorMuted">
                    {formatUIText("how it works")}
                  </Text>
                </XStack>
              </Pressable>
            </XStack>

            <XStack gap="$2" marginBottom="$3">
              <Pressable
                onPress={() => setToss("bat_first")}
                style={{ flex: 1 }}
              >
                <YStack
                  padding="$3"
                  borderRadius={10}
                  borderWidth={toss === "bat_first" ? 2 : 1}
                  borderColor={
                    toss === "bat_first"
                      ? "$accentBackground"
                      : "$borderColor"
                  }
                  backgroundColor={
                    toss === "bat_first"
                      ? "$backgroundSurfaceAlt"
                      : "$backgroundSurface"
                  }
                  alignItems="center"
                  gap={4}
                >
                  <Text fontSize={22}>🏏</Text>
                  <Text
                    fontFamily="$body"
                    fontWeight="700"
                    fontSize={13}
                    color={
                      toss === "bat_first" ? "$accentBackground" : "$color"
                    }
                  >
                    {formatUIText("bat first")}
                  </Text>
                  <Text
                    fontFamily="$body"
                    fontSize={10}
                    color="$colorMuted"
                    textAlign="center"
                    lineHeight={13}
                  >
                    {formatUIText("post a total, defend it")}
                  </Text>
                </YStack>
              </Pressable>
              <Pressable
                onPress={() => setToss("bowl_first")}
                style={{ flex: 1 }}
              >
                <YStack
                  padding="$3"
                  borderRadius={10}
                  borderWidth={toss === "bowl_first" ? 2 : 1}
                  borderColor={
                    toss === "bowl_first"
                      ? "$colorCricket"
                      : "$borderColor"
                  }
                  backgroundColor={
                    toss === "bowl_first"
                      ? "$backgroundSurfaceAlt"
                      : "$backgroundSurface"
                  }
                  alignItems="center"
                  gap={4}
                >
                  <Text fontSize={22}>🎯</Text>
                  <Text
                    fontFamily="$body"
                    fontWeight="700"
                    fontSize={13}
                    color={
                      toss === "bowl_first" ? "$colorCricket" : "$color"
                    }
                  >
                    {formatUIText("bowl first")}
                  </Text>
                  <Text
                    fontFamily="$body"
                    fontSize={10}
                    color="$colorMuted"
                    textAlign="center"
                    lineHeight={13}
                  >
                    {formatUIText("restrict them, then chase")}
                  </Text>
                </YStack>
              </Pressable>
            </XStack>

            {/* Scenario preview using the user's actual squad */}
            <NrrScenarioPreview toss={toss} />
          </Card>

          {/* AI projection — scoped to round's opening fixture, so partial by design */}
          {projectedTotals && projectedTotals.withData >= 3 && (
            <Card
              padding="$4"
              marginBottom="$4"
              borderWidth={1}
              borderColor="$accentBackground"
            >
              <XStack alignItems="center" justifyContent="space-between">
                <YStack flex={1}>
                  <Text
                    fontFamily="$mono"
                    fontSize={10}
                    color="$colorMuted"
                    textTransform="uppercase"
                    letterSpacing={1}
                  >
                    {formatUIText("ai projection")}
                  </Text>
                  <Text
                    fontFamily="$body"
                    fontSize={10}
                    color="$colorMuted"
                    marginTop={2}
                  >
                    {formatUIText("based on the round's opening fixture")} ·{" "}
                    {projectedTotals.withData}/{projectedTotals.total_squad}{" "}
                    {formatUIText("players")}
                  </Text>
                </YStack>
                <YStack alignItems="flex-end">
                  <Text
                    fontFamily="$mono"
                    fontWeight="800"
                    fontSize={24}
                    color="$accentBackground"
                    letterSpacing={-0.5}
                  >
                    {projectedTotals.total.toFixed(0)}
                  </Text>
                  <Text
                    fontFamily="$mono"
                    fontSize={9}
                    color="$colorMuted"
                  >
                    {formatUIText("proj. pts")}
                  </Text>
                </YStack>
              </XStack>
            </Card>
          )}

          {/* Risk flags */}
          {riskFlags.length > 0 && (
            <Card padding="$4" marginBottom="$4">
              <Text
                fontFamily="$mono"
                fontSize={11}
                color="$colorMuted"
                textTransform="uppercase"
                letterSpacing={1}
                marginBottom="$2"
              >
                {formatUIText("risk flags")}
              </Text>
              {riskFlags.map((f, i) => (
                <XStack key={i} gap="$2" marginTop="$1">
                  <Text fontSize={12}>{f.icon}</Text>
                  <Text
                    fontFamily="$body"
                    fontSize={12}
                    color="$color"
                    flex={1}
                  >
                    {f.text}
                  </Text>
                </XStack>
              ))}
            </Card>
          )}

          {/* Batting order recap */}
          <Text
            fontFamily="$mono"
            fontSize={12}
            color="$colorMuted"
            textTransform="uppercase"
            letterSpacing={1}
            marginBottom="$2"
          >
            {formatUIText("batting order")}
          </Text>
          {battingOrder.map((pid, i) => {
            const p = byId.get(pid);
            if (!p) return null;
            const proj = projectionsByPlayerId.get(pid);
            const opponents = opponentsByTeam.get(p.team) ?? [];
            const opponentStr =
              opponents.length > 0
                ? opponents.slice(0, 2).map(teamShortCode).join(", ") +
                  (opponents.length > 2 ? ` +${opponents.length - 2}` : "")
                : undefined;
            return (
              <OrderRow
                key={pid}
                player={p}
                position={i + 1}
                accentColor="$accentBackground"
                projected={proj?.projectedPoints}
                opponent={opponentStr}
                readonly
              />
            );
          })}

          {/* Bowling priority recap */}
          <Text
            fontFamily="$mono"
            fontSize={12}
            color="$colorMuted"
            textTransform="uppercase"
            letterSpacing={1}
            marginBottom="$2"
            marginTop="$4"
          >
            {formatUIText("bowling order")}
          </Text>
          {bowlingPriority.map((pid, i) => {
            const p = byId.get(pid);
            if (!p) return null;
            const proj = projectionsByPlayerId.get(pid);
            const opponents = opponentsByTeam.get(p.team) ?? [];
            const opponentStr =
              opponents.length > 0
                ? opponents.slice(0, 2).map(teamShortCode).join(", ") +
                  (opponents.length > 2 ? ` +${opponents.length - 2}` : "")
                : undefined;
            return (
              <OrderRow
                key={pid}
                player={p}
                position={i + 1}
                accentColor="$colorCricket"
                projected={proj?.projectedPoints}
                opponent={opponentStr}
                readonly
              />
            );
          })}
        </ScrollView>
      )}

      {/* ── Sticky footer ───────────────────────────────────────── */}
      <XStack
        padding="$4"
        paddingBottom={insets.bottom + 16}
        gap="$3"
        backgroundColor="$background"
        borderTopWidth={1}
        borderTopColor="$borderColor"
      >
        {step !== "squad" && (
          <Button
            variant="secondary"
            size="lg"
            flex={1}
            onPress={() => {
              if (step === "batting") setStep("squad");
              else if (step === "bowling") setStep("batting");
              else if (step === "review") setStep("bowling");
            }}
          >
            {formatUIText("back")}
          </Button>
        )}
        {step === "squad" && (
          <Button
            variant="primary"
            size="lg"
            flex={1}
            disabled={selectedIds.length !== TEAM_SIZE}
            opacity={selectedIds.length !== TEAM_SIZE ? 0.4 : 1}
            onPress={() => gotoStep("batting")}
            testID="cm-squad-continue"
          >
            {selectedIds.length < TEAM_SIZE
              ? formatUIText(
                  `select ${TEAM_SIZE - selectedIds.length} more players`
                )
              : formatUIText("set batting order")}
          </Button>
        )}
        {step === "batting" && (
          <Button
            variant="primary"
            size="lg"
            flex={2}
            onPress={() => gotoStep("bowling")}
            testID="cm-batting-continue"
          >
            {formatUIText("set bowling order")}
          </Button>
        )}
        {step === "bowling" && (
          <Button
            variant="primary"
            size="lg"
            flex={2}
            onPress={() => gotoStep("review")}
            testID="cm-bowling-continue"
          >
            {formatUIText("review")}
          </Button>
        )}
        {step === "review" && (
          <Button
            variant="primary"
            size="lg"
            flex={2}
            disabled={submit.isPending}
            opacity={submit.isPending ? 0.4 : 1}
            onPress={handleSubmit}
            testID="cm-entry-submit-btn"
          >
            {submit.isPending
              ? formatUIText("submitting...")
              : formatUIText("submit entry")}
          </Button>
        )}
      </XStack>

      {alert && (
        <AlertModal
          visible
          title={alert.title}
          message={alert.message}
          onDismiss={() => {
            const cb = alert.onConfirm;
            setAlert(null);
            cb?.();
          }}
          actions={[
            {
              label: "ok",
              variant: "primary",
              onPress: () => {
                const cb = alert.onConfirm;
                setAlert(null);
                cb?.();
              },
            },
          ]}
        />
      )}

      {/* ── Player stats modal ──────────────────────────────────── */}
      {statsPlayerId && (
        <PlayerStatsModal
          playerId={statsPlayerId}
          onClose={() => setStatsPlayerId(null)}
        />
      )}

      {/* ── NRR explainer modal ─────────────────────────────────── */}
      <NrrExplainerModal visible={showExplainer} onClose={dismissExplainer} />

      {/* Guru AI sheet — Rate My XI / Suggest orders / What If */}
      {showGuru && roundId && (
        <GuruSheet
          roundId={roundId}
          step={step}
          eligibleById={byId}
          onApplyBatting={(order: string[]) => {
            // Filter to only ids in current squad — preserve user's actual picks
            const inSquad = order.filter((id: string) =>
              selectedIds.includes(id)
            );
            if (inSquad.length === selectedIds.length) {
              setBattingOrder(inSquad);
              setShowGuru(false);
            }
          }}
          onApplyBowling={(order: string[]) => {
            const inSquad = order.filter((id: string) =>
              selectedIds.includes(id)
            );
            if (inSquad.length > 0) {
              setBowlingPriority(inSquad);
              setShowGuru(false);
            }
          }}
          onClose={() => setShowGuru(false)}
        />
      )}

      <Paywall {...paywallProps} />
    </YStack>
  );
}

// ─── Guru AI sheet — Rate My XI, Suggest orders, What If ──────────────

function GuruSheet({
  roundId,
  step,
  eligibleById,
  onApplyBatting,
  onApplyBowling,
  onClose,
}: {
  roundId: string;
  step: Step;
  eligibleById: Map<string, EligiblePlayer>;
  onApplyBatting: (order: string[]) => void;
  onApplyBowling: (order: string[]) => void;
  onClose: () => void;
}) {
  const rateQuery = trpc.cricketManager.rateMyXi.useQuery({ roundId });
  const battingQuery = trpc.cricketManager.suggestBattingOrder.useQuery(
    { roundId },
    { enabled: step !== "review" }
  );
  const bowlingQuery = trpc.cricketManager.suggestBowlingOrder.useQuery(
    { roundId },
    { enabled: step !== "review" }
  );
  const whatIfQuery = trpc.cricketManager.whatIf.useQuery(
    { roundId },
    { enabled: step === "review" }
  );

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={250}
      backgroundColor="rgba(0,0,0,0.6)"
      alignItems="center"
      justifyContent="center"
      padding="$4"
    >
      <Pressable
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        onPress={onClose}
      />
      <YStack
        width="100%"
        maxWidth={420}
        maxHeight="92%"
        backgroundColor="$backgroundSurface"
        borderRadius={20}
        borderWidth={1}
        borderColor="$borderColor"
        overflow="hidden"
      >
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Header */}
          <XStack alignItems="center" gap="$2" marginBottom="$3">
            <Text fontSize={22}>✨</Text>
            <Text
              fontFamily="$mono"
              fontWeight="700"
              fontSize={18}
              color="$color"
              letterSpacing={-0.5}
            >
              {formatUIText("guru analysis")}
            </Text>
          </XStack>

          {/* Rate My XI — always shown */}
          {rateQuery.isLoading ? (
            <YStack padding="$4" alignItems="center">
              <EggLoadingSpinner size={32} />
            </YStack>
          ) : rateQuery.data ? (
            <YStack
              padding="$4"
              backgroundColor="$backgroundSurfaceAlt"
              borderRadius={12}
              marginBottom="$3"
            >
              <XStack
                justifyContent="space-between"
                alignItems="center"
                marginBottom="$2"
              >
                <Text
                  fontFamily="$mono"
                  fontSize={10}
                  color="$colorMuted"
                  textTransform="uppercase"
                  letterSpacing={1}
                >
                  {formatUIText("rate my xi")}
                </Text>
                <YStack
                  width={44}
                  height={44}
                  borderRadius={22}
                  backgroundColor="$accentBackground"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text
                    fontFamily="$mono"
                    fontWeight="800"
                    fontSize={16}
                    color="$background"
                  >
                    {rateQuery.data.grade}
                  </Text>
                </YStack>
              </XStack>
              <Text
                fontFamily="$body"
                fontWeight="700"
                fontSize={14}
                color="$color"
              >
                {rateQuery.data.headline}
              </Text>
              <Text
                fontFamily="$mono"
                fontSize={10}
                color="$colorMuted"
                marginTop="$1"
              >
                score {rateQuery.data.score}/100
              </Text>

              {rateQuery.data.strengths.length > 0 && (
                <YStack marginTop="$3">
                  <Text
                    fontFamily="$mono"
                    fontSize={9}
                    color="$accentBackground"
                    fontWeight="700"
                    textTransform="uppercase"
                    letterSpacing={1}
                  >
                    {formatUIText("strengths")}
                  </Text>
                  {rateQuery.data.strengths.map((s: string, i: number) => (
                    <XStack key={i} gap="$2" marginTop={4} alignItems="flex-start">
                      <Text fontSize={10} color="$accentBackground">
                        ✓
                      </Text>
                      <Text
                        fontFamily="$body"
                        fontSize={11}
                        color="$color"
                        flex={1}
                        lineHeight={15}
                      >
                        {s}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              )}

              {rateQuery.data.weaknesses.length > 0 && (
                <YStack marginTop="$3">
                  <Text
                    fontFamily="$mono"
                    fontSize={9}
                    color="$colorHatch"
                    fontWeight="700"
                    textTransform="uppercase"
                    letterSpacing={1}
                  >
                    {formatUIText("weaknesses")}
                  </Text>
                  {rateQuery.data.weaknesses.map((s: string, i: number) => (
                    <XStack key={i} gap="$2" marginTop={4} alignItems="flex-start">
                      <Text fontSize={10} color="$colorHatch">
                        !
                      </Text>
                      <Text
                        fontFamily="$body"
                        fontSize={11}
                        color="$color"
                        flex={1}
                        lineHeight={15}
                      >
                        {s}
                      </Text>
                    </XStack>
                  ))}
                </YStack>
              )}

              {rateQuery.data.suggestions.length > 0 && (
                <YStack marginTop="$3">
                  <Text
                    fontFamily="$mono"
                    fontSize={9}
                    color="$colorCricket"
                    fontWeight="700"
                    textTransform="uppercase"
                    letterSpacing={1}
                  >
                    {formatUIText("suggestions")}
                  </Text>
                  {rateQuery.data.suggestions.map((s: string, i: number) => (
                    <Text
                      key={i}
                      fontFamily="$body"
                      fontSize={11}
                      color="$colorMuted"
                      marginTop={4}
                      lineHeight={15}
                    >
                      → {s}
                    </Text>
                  ))}
                </YStack>
              )}
            </YStack>
          ) : null}

          {/* Suggest batting order */}
          {step === "batting" && battingQuery.data && (
            <SuggestionBlock
              title="suggested batting order"
              accent="$accentBackground"
              suggestions={battingQuery.data}
              eligibleById={eligibleById}
              onApply={() =>
                onApplyBatting(
                  battingQuery.data!.map(
                    (s: { playerId: string }) => s.playerId
                  )
                )
              }
            />
          )}

          {/* Suggest bowling order */}
          {step === "bowling" && bowlingQuery.data && (
            <SuggestionBlock
              title="suggested bowling order"
              accent="$colorCricket"
              suggestions={bowlingQuery.data}
              eligibleById={eligibleById}
              onApply={() =>
                onApplyBowling(
                  bowlingQuery.data!.map(
                    (s: { playerId: string }) => s.playerId
                  )
                )
              }
            />
          )}

          {/* What If — review step */}
          {step === "review" && whatIfQuery.data && (
            <YStack
              padding="$4"
              backgroundColor="$backgroundSurfaceAlt"
              borderRadius={12}
              marginBottom="$3"
            >
              <Text
                fontFamily="$mono"
                fontSize={10}
                color="$colorMuted"
                textTransform="uppercase"
                letterSpacing={1}
                marginBottom="$2"
              >
                {formatUIText("what if")}
              </Text>
              <XStack
                justifyContent="space-between"
                alignItems="baseline"
                marginBottom="$2"
              >
                <Text fontFamily="$body" fontSize={11} color="$colorMuted">
                  your top-7 projected
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="700"
                  fontSize={14}
                  color="$color"
                >
                  {whatIfQuery.data.actualEstimate} pts
                </Text>
              </XStack>
              <XStack
                justifyContent="space-between"
                alignItems="baseline"
                marginBottom="$2"
              >
                <Text fontFamily="$body" fontSize={11} color="$colorMuted">
                  guru's top-7 projected
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="700"
                  fontSize={14}
                  color="$accentBackground"
                >
                  {whatIfQuery.data.suggestedEstimate} pts
                </Text>
              </XStack>
              <YStack
                marginTop="$2"
                paddingTop="$2"
                borderTopWidth={1}
                borderTopColor="$borderColor"
              >
                <Text
                  fontFamily="$mono"
                  fontWeight="800"
                  fontSize={16}
                  color={
                    whatIfQuery.data.deltaPoints > 0
                      ? "$colorCricket"
                      : "$accentBackground"
                  }
                  textAlign="center"
                >
                  {whatIfQuery.data.deltaPoints > 0
                    ? `you could gain +${whatIfQuery.data.deltaPoints} pts`
                    : whatIfQuery.data.deltaPoints < 0
                      ? "your order is already optimal"
                      : "tied with guru's order"}
                </Text>
              </YStack>
            </YStack>
          )}

          <Button variant="secondary" size="md" onPress={onClose}>
            {formatUIText("close")}
          </Button>
        </ScrollView>
      </YStack>
    </YStack>
  );
}

function SuggestionBlock({
  title,
  accent,
  suggestions,
  eligibleById,
  onApply,
}: {
  title: string;
  accent: "$accentBackground" | "$colorCricket";
  suggestions: Array<{
    playerId: string;
    suggestedPosition: number;
    reason: string;
  }>;
  eligibleById: Map<string, EligiblePlayer>;
  onApply: () => void;
}) {
  return (
    <YStack
      padding="$4"
      backgroundColor="$backgroundSurfaceAlt"
      borderRadius={12}
      marginBottom="$3"
    >
      <Text
        fontFamily="$mono"
        fontSize={10}
        color="$colorMuted"
        textTransform="uppercase"
        letterSpacing={1}
        marginBottom="$3"
      >
        {formatUIText(title)}
      </Text>
      {suggestions.slice(0, 7).map((s, i) => {
        const p = eligibleById.get(s.playerId);
        if (!p) return null;
        return (
          <XStack
            key={s.playerId}
            alignItems="center"
            gap="$2"
            paddingVertical={6}
            borderBottomWidth={i < Math.min(6, suggestions.length - 1) ? 1 : 0}
            borderBottomColor="$borderColor"
          >
            <Text
              fontFamily="$mono"
              fontWeight="800"
              fontSize={13}
              color={accent}
              width={20}
            >
              {s.suggestedPosition}
            </Text>
            <YStack flex={1}>
              <Text
                fontFamily="$body"
                fontWeight="700"
                fontSize={12}
                color="$color"
                numberOfLines={1}
              >
                {p.name}
              </Text>
              <Text
                fontFamily="$body"
                fontSize={9}
                color="$colorMuted"
                numberOfLines={1}
              >
                {s.reason}
              </Text>
            </YStack>
          </XStack>
        );
      })}
      <Button
        variant="primary"
        size="sm"
        marginTop="$3"
        onPress={onApply}
      >
        {formatUIText("apply this order")}
      </Button>
    </YStack>
  );
}

// ─── Player stats modal — reused from auction draft pattern ────────────

function PlayerStatsModal({
  playerId,
  onClose,
}: {
  playerId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.auctionAi.playerStats.useQuery(
    { playerId },
    { staleTime: 60 * 60_000 }
  );

  return (
    <YStack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={200}
      alignItems="center"
      justifyContent="center"
      backgroundColor="rgba(0,0,0,0.55)"
    >
      <Pressable
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        onPress={onClose}
      />
      <YStack
        backgroundColor="$backgroundSurface"
        borderRadius={20}
        padding="$5"
        width="88%"
        maxWidth={360}
        borderWidth={1}
        borderColor="$borderColor"
      >
        {isLoading || !data ? (
          <YStack alignItems="center" padding="$4">
            <EggLoadingSpinner size={32} />
          </YStack>
        ) : (
          <>
            {/* Header */}
            <XStack
              justifyContent="space-between"
              alignItems="flex-start"
              marginBottom="$3"
            >
              <YStack flex={1}>
                <Text
                  fontFamily="$body"
                  fontWeight="700"
                  fontSize={18}
                  color="$color"
                >
                  {data.name}
                </Text>
                <XStack alignItems="center" gap="$2" marginTop={2} flexWrap="wrap">
                  <Badge variant="default" size="sm">
                    {roleToBadge(data.role ?? "batsman")}
                  </Badge>
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                    {data.team}
                  </Text>
                  {data.nationality && (
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                      {data.nationality}
                    </Text>
                  )}
                </XStack>
              </YStack>
            </XStack>

            {/* Primary stats grid */}
            {(data.matchesPlayed != null ||
              (data.average != null && data.average > 0) ||
              (data.strikeRate != null && data.strikeRate > 0)) && (
              <XStack marginBottom="$3" gap="$2">
                {data.matchesPlayed != null && (
                  <StatCell label="MATCHES" value={String(data.matchesPlayed)} />
                )}
                {data.average != null && data.average > 0 && (
                  <StatCell label="AVG" value={data.average.toFixed(1)} />
                )}
                {data.strikeRate != null && data.strikeRate > 0 && (
                  <StatCell label="SR" value={data.strikeRate.toFixed(0)} />
                )}
              </XStack>
            )}

            {/* Bowling stats (conditional) */}
            {(data.economyRate ?? 0) > 0 && (
              <XStack marginBottom="$3" gap="$2">
                <StatCell label="ECON" value={(data.economyRate ?? 0).toFixed(1)} />
                {data.bowlingAverage != null && data.bowlingAverage > 0 && (
                  <StatCell
                    label="B.AVG"
                    value={data.bowlingAverage.toFixed(1)}
                  />
                )}
                {data.bowlingStrikeRate != null && data.bowlingStrikeRate > 0 && (
                  <StatCell
                    label="B.SR"
                    value={data.bowlingStrikeRate.toFixed(0)}
                  />
                )}
              </XStack>
            )}

            {/* Form + injury status */}
            {(data.recentForm != null || data.injuryStatus) && (
              <XStack
                gap="$3"
                alignItems="center"
                marginBottom={data.formNote ? "$2" : 0}
              >
                {data.recentForm != null && (
                  <XStack alignItems="center" gap="$1">
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                      FORM
                    </Text>
                    <Text
                      fontFamily="$mono"
                      fontWeight="700"
                      fontSize={14}
                      color={
                        data.recentForm >= 7
                          ? "$accentBackground"
                          : data.recentForm >= 4
                          ? "$colorCricket"
                          : "$colorHatch"
                      }
                    >
                      {data.recentForm}/10
                    </Text>
                  </XStack>
                )}
                {data.injuryStatus && data.injuryStatus !== "fit" && (
                  <Badge variant="danger" size="sm">
                    {data.injuryStatus.toUpperCase()}
                  </Badge>
                )}
                {data.battingStyle && (
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                    {data.battingStyle}
                  </Text>
                )}
              </XStack>
            )}

            {data.formNote && (
              <Text
                fontFamily="$body"
                fontSize={11}
                color="$colorSecondary"
                lineHeight={16}
                marginTop="$2"
              >
                {data.formNote}
              </Text>
            )}

            {/* Close button */}
            <Button variant="secondary" size="sm" marginTop="$4" onPress={onClose}>
              {formatUIText("close")}
            </Button>
          </>
        )}
      </YStack>
    </YStack>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <YStack
      flex={1}
      backgroundColor="$backgroundSurfaceAlt"
      borderRadius={8}
      padding="$2"
      alignItems="center"
    >
      <Text fontFamily="$mono" fontSize={8} color="$colorMuted">
        {label}
      </Text>
      <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">
        {value}
      </Text>
    </YStack>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: "squad", label: "squad" },
    { key: "batting", label: "batting" },
    { key: "bowling", label: "bowling" },
    { key: "review", label: "review" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);
  return (
    <YStack paddingHorizontal="$4" paddingBottom="$3" gap="$2">
      {/* Progress bar */}
      <XStack gap="$1">
        {steps.map((_, i) => {
          const isDone = i < currentIdx;
          const isActive = i === currentIdx;
          return (
            <YStack
              key={i}
              flex={1}
              height={3}
              borderRadius={2}
              backgroundColor={
                isDone || isActive ? "$accentBackground" : "$borderColor"
              }
            />
          );
        })}
      </XStack>
      {/* Labels row */}
      <XStack>
        {steps.map((s, i) => {
          const isActive = i === currentIdx;
          return (
            <YStack key={s.key} flex={1} alignItems="center">
              <Text
                fontFamily="$mono"
                fontSize={9}
                fontWeight={isActive ? "700" : "500"}
                color={isActive ? "$accentBackground" : "$colorMuted"}
                textTransform="uppercase"
                letterSpacing={0.6}
              >
                {s.label}
              </Text>
            </YStack>
          );
        })}
      </XStack>
    </YStack>
  );
}

function OrderRow({
  player,
  position,
  accentColor,
  projected,
  opponent,
  onUp,
  onDown,
  upDisabled,
  downDisabled,
  readonly,
}: {
  player: EligiblePlayer;
  position: number;
  accentColor: "$accentBackground" | "$colorCricket";
  projected?: number;
  opponent?: string;
  onUp?: () => void;
  onDown?: () => void;
  upDisabled?: boolean;
  downDisabled?: boolean;
  readonly?: boolean;
}) {
  return (
    <Card
      padding="$3"
      marginBottom="$2"
      borderWidth={1}
      borderColor="$borderColor"
      backgroundColor="$backgroundSurface"
    >
      <XStack alignItems="center" gap="$2">
        {/* Position number */}
        <YStack width={28} alignItems="center">
          <Text
            fontFamily="$mono"
            fontWeight="800"
            fontSize={16}
            color={accentColor}
          >
            {position}
          </Text>
        </YStack>

        {/* Avatar */}
        <InitialsAvatar
          name={player.name}
          playerRole={roleToBadge(player.role)}
          ovr={0}
          size={36}
          hideBadge
          imageUrl={player.photoUrl ?? undefined}
        />

        {/* Name + team/role + opponent */}
        <YStack flex={1} marginLeft="$2">
          <Text {...textStyles.playerName} numberOfLines={1}>
            {player.name}
          </Text>
          <XStack alignItems="center" gap={6}>
            <Text
              fontFamily="$mono"
              fontSize={11}
              color="$colorMuted"
              numberOfLines={1}
            >
              {teamShortCode(player.team)} · {roleToBadge(player.role)}
            </Text>
            {opponent && (
              <Text
                fontFamily="$mono"
                fontSize={11}
                color="$accentBackground"
                fontWeight="700"
                numberOfLines={1}
              >
                vs {opponent}
              </Text>
            )}
          </XStack>
        </YStack>

        {/* Projected pts — fixed width column so rows align whether data exists or not */}
        <YStack alignItems="center" width={42} marginRight="$2">
          {projected != null ? (
            <>
              <Text
                fontFamily="$mono"
                fontWeight="700"
                fontSize={14}
                color={accentColor}
              >
                {projected.toFixed(0)}
              </Text>
              <Text {...textStyles.hint}>pts</Text>
            </>
          ) : (
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
              —
            </Text>
          )}
        </YStack>

        {/* Arrows — hidden in readonly (review) mode */}
        {!readonly && (
          <XStack gap="$1">
            <Button
              size="sm"
              variant="secondary"
              disabled={upDisabled}
              onPress={onUp}
            >
              ↑
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={downDisabled}
              onPress={onDown}
            >
              ↓
            </Button>
          </XStack>
        )}
      </XStack>
    </Card>
  );
}

function SmartPill({
  emoji,
  label,
  active,
  onPress,
}: {
  emoji: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <XStack
        paddingHorizontal={10}
        paddingVertical={5}
        borderRadius={14}
        borderWidth={1}
        borderColor={active ? "$color" : "$borderColor"}
        backgroundColor={active ? "$color" : "$backgroundSurface"}
        alignItems="center"
        gap={4}
      >
        <Text fontSize={10}>{emoji}</Text>
        <Text
          fontFamily="$mono"
          fontSize={9}
          fontWeight="700"
          color={active ? "$background" : "$colorMuted"}
        >
          {formatBadgeText(label)}
        </Text>
      </XStack>
    </Pressable>
  );
}

// ─── ScenarioBar — reusable bar-graph row for scenario preview ──────────
function ScenarioBar({
  label,
  value,
  max,
  color,
  capped,
}: {
  label: string;
  value: number;
  max: number;
  color: "$accentBackground" | "$colorCricket";
  capped?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <YStack gap={2}>
      <XStack justifyContent="space-between" alignItems="baseline">
        <Text fontFamily="$body" fontSize={10} color="$colorMuted">
          {label}
          {capped ? " (capped)" : ""}
        </Text>
        <Text
          fontFamily="$mono"
          fontWeight="800"
          fontSize={14}
          color={color}
        >
          {value}
        </Text>
      </XStack>
      <YStack
        height={8}
        borderRadius={4}
        backgroundColor="$backgroundSurfaceAlt"
        overflow="hidden"
      >
        <YStack
          width={(`${pct}%` as unknown) as number}
          height={8}
          borderRadius={4}
          backgroundColor={color}
        />
      </YStack>
    </YStack>
  );
}

// ─── NrrExplainerModal — mobile-responsive how-it-works overlay
//
// Uses a native RN Modal with plain View style props (not Tamagui
// shorthand) because Tamagui props like `marginTop={insets.top + 24}`
// can resolve to NaN on web before SafeAreaProvider hydrates, which
// crashed the page on iOS Chrome with "Can't open this page". The
// MemberBreakdownSheet pattern (plain style objects with explicit
// numeric values) renders consistently across iOS, Android, and web.
function NrrExplainerModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Defensive: insets can be undefined on web before SafeAreaProvider
  // hydrates. Coalesce to 0 so we never compute NaN.
  const safeTop = typeof insets?.top === "number" ? insets.top : 0;
  const safeBottom = typeof insets?.bottom === "number" ? insets.bottom : 0;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          paddingTop: safeTop + 24,
          paddingBottom: safeBottom + 24,
        }}
      >
        <Pressable
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          onPress={onClose}
        />
        <View
          style={{
            width: "100%",
            maxWidth: 420,
            flexShrink: 1,
            backgroundColor: "#1a1a1a",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#333",
            overflow: "hidden",
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            {/* Title */}
          <Text
            fontFamily="$mono"
            fontWeight="700"
            fontSize={20}
            color="$color"
            letterSpacing={-0.5}
            marginBottom="$1"
          >
            {formatUIText("how you win")}
          </Text>
          <Text
            fontFamily="$body"
            fontSize={12}
            color="$colorMuted"
            marginBottom="$4"
            lineHeight={17}
          >
            {formatUIText(
              "your 11 players play a mini cricket match against themselves. we calculate your NRR — higher wins the round."
            )}
          </Text>

          {/* Step 1 — batting */}
          <YStack
            padding="$4"
            backgroundColor="$backgroundSurfaceAlt"
            borderRadius={12}
            marginBottom="$3"
          >
            <XStack alignItems="center" gap="$2" marginBottom="$2">
              <YStack
                width={24}
                height={24}
                borderRadius={12}
                backgroundColor="$accentBackground"
                alignItems="center"
                justifyContent="center"
              >
                <Text
                  fontFamily="$mono"
                  fontWeight="800"
                  fontSize={12}
                  color="$background"
                >
                  1
                </Text>
              </YStack>
              <Text
                fontFamily="$body"
                fontWeight="700"
                fontSize={14}
                color="$color"
              >
                {formatUIText("your batters bat")}
              </Text>
            </XStack>
            <Text
              fontFamily="$body"
              fontSize={11}
              color="$colorMuted"
              lineHeight={15}
              marginBottom="$2"
            >
              {formatUIText(
                "your batting order plays until 120 balls are used or 10 wickets fall. runs scored in real matches become your batting total."
              )}
            </Text>
            <XStack
              padding="$2"
              backgroundColor="$background"
              borderRadius={6}
              alignItems="center"
              gap="$2"
            >
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText("example")}
              </Text>
              <Text
                fontFamily="$mono"
                fontWeight="700"
                fontSize={12}
                color="$accentBackground"
              >
                190 runs
              </Text>
            </XStack>
          </YStack>

          {/* Step 2 — bowling */}
          <YStack
            padding="$4"
            backgroundColor="$backgroundSurfaceAlt"
            borderRadius={12}
            marginBottom="$3"
          >
            <XStack alignItems="center" gap="$2" marginBottom="$2">
              <YStack
                width={24}
                height={24}
                borderRadius={12}
                backgroundColor="$colorCricket"
                alignItems="center"
                justifyContent="center"
              >
                <Text
                  fontFamily="$mono"
                  fontWeight="800"
                  fontSize={12}
                  color="$background"
                >
                  2
                </Text>
              </YStack>
              <Text
                fontFamily="$body"
                fontWeight="700"
                fontSize={14}
                color="$color"
              >
                {formatUIText("your bowlers bowl")}
              </Text>
            </XStack>
            <Text
              fontFamily="$body"
              fontSize={11}
              color="$colorMuted"
              lineHeight={15}
              marginBottom="$2"
            >
              {formatUIText(
                "your bowling order takes over — each bowler capped at 4 overs. runs they concede in real matches become your bowling total."
              )}
            </Text>
            <XStack
              padding="$2"
              backgroundColor="$background"
              borderRadius={6}
              alignItems="center"
              gap="$2"
            >
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {formatUIText("example")}
              </Text>
              <Text
                fontFamily="$mono"
                fontWeight="700"
                fontSize={12}
                color="$colorCricket"
              >
                136 runs conceded
              </Text>
            </XStack>
          </YStack>

          {/* Step 3 — NRR */}
          <YStack
            padding="$4"
            backgroundColor="$backgroundSurfaceAlt"
            borderRadius={12}
            marginBottom="$4"
            borderWidth={1}
            borderColor="$accentBackground"
          >
            <XStack alignItems="center" gap="$2" marginBottom="$2">
              <YStack
                width={24}
                height={24}
                borderRadius={12}
                backgroundColor="$color"
                alignItems="center"
                justifyContent="center"
              >
                <Text
                  fontFamily="$mono"
                  fontWeight="800"
                  fontSize={12}
                  color="$background"
                >
                  3
                </Text>
              </YStack>
              <Text
                fontFamily="$body"
                fontWeight="700"
                fontSize={14}
                color="$color"
              >
                {formatUIText("we calculate NRR")}
              </Text>
            </XStack>
            <Text
              fontFamily="$body"
              fontSize={11}
              color="$colorMuted"
              lineHeight={15}
              marginBottom="$3"
            >
              {formatUIText(
                "net run rate = your run rate minus their run rate. divide both totals by 20 overs."
              )}
            </Text>
            <YStack
              padding="$3"
              backgroundColor="$background"
              borderRadius={8}
              gap={4}
            >
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  190 ÷ 20
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="700"
                  fontSize={13}
                  color="$accentBackground"
                >
                  = 9.50
                </Text>
              </XStack>
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  136 ÷ 20
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="700"
                  fontSize={13}
                  color="$colorCricket"
                >
                  = 6.80
                </Text>
              </XStack>
              <YStack
                height={1}
                backgroundColor="$borderColor"
                marginVertical={4}
              />
              <XStack justifyContent="space-between" alignItems="center">
                <Text
                  fontFamily="$mono"
                  fontWeight="700"
                  fontSize={11}
                  color="$color"
                >
                  9.50 − 6.80
                </Text>
                <Text
                  fontFamily="$mono"
                  fontWeight="800"
                  fontSize={18}
                  color="$accentBackground"
                >
                  NRR +2.70
                </Text>
              </XStack>
            </YStack>
          </YStack>

          {/* Toss split */}
          <Text
            fontFamily="$mono"
            fontSize={11}
            color="$colorMuted"
            textTransform="uppercase"
            letterSpacing={1}
            marginBottom="$2"
          >
            {formatUIText("bat first vs bowl first")}
          </Text>
          <Text
            fontFamily="$body"
            fontSize={11}
            color="$color"
            lineHeight={16}
            marginBottom="$3"
          >
            {formatUIText(
              "you also decide if your squad bats first or bowls first. this changes the math:"
            )}
          </Text>

          <YStack gap="$2" marginBottom="$4">
            <YStack
              padding="$3"
              backgroundColor="$backgroundSurfaceAlt"
              borderRadius={10}
              borderLeftWidth={3}
              borderLeftColor="$accentBackground"
            >
              <XStack alignItems="center" gap="$2" marginBottom={2}>
                <Text fontSize={14}>🏏</Text>
                <Text
                  fontFamily="$body"
                  fontWeight="700"
                  fontSize={12}
                  color="$accentBackground"
                >
                  {formatUIText("bat first")}
                </Text>
              </XStack>
              <Text
                fontFamily="$body"
                fontSize={10}
                color="$colorMuted"
                lineHeight={14}
              >
                {formatUIText(
                  "your batters swing freely for the full 120 balls. aim: post the biggest total possible."
                )}
              </Text>
            </YStack>

            <YStack
              padding="$3"
              backgroundColor="$backgroundSurfaceAlt"
              borderRadius={10}
              borderLeftWidth={3}
              borderLeftColor="$colorCricket"
            >
              <XStack alignItems="center" gap="$2" marginBottom={2}>
                <Text fontSize={14}>🎯</Text>
                <Text
                  fontFamily="$body"
                  fontWeight="700"
                  fontSize={12}
                  color="$colorCricket"
                >
                  {formatUIText("bowl first")}
                </Text>
              </XStack>
              <Text
                fontFamily="$body"
                fontSize={10}
                color="$colorMuted"
                lineHeight={14}
              >
                {formatUIText(
                  "your bowlers restrict them, then your batters chase the target. stops the moment you win — so strong bowling + modest batting can beat a bigger squad."
                )}
              </Text>
            </YStack>
          </YStack>

          <Button variant="primary" size="lg" onPress={onClose}>
            {formatUIText("got it, let's play")}
          </Button>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
