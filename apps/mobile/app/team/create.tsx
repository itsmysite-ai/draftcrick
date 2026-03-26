import { ScrollView, Alert, Platform, TextInput, Pressable, ActivityIndicator, PanResponder } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useState, useMemo, useEffect, useRef } from "react";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, View, styled, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  BackButton,
  InitialsAvatar,
  FilterPill,
  AnnouncementBanner,
  EggLoadingSpinner,
  TierBadge,
  Paywall,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useNavigationStore } from "../../lib/navigation-store";
import type { FlowState } from "../../lib/navigation-store";
import { HeaderControls } from "../../components/HeaderControls";
import { AIInsightsSheet } from "../../components/AIInsightsSheet";
import { usePaywall } from "../../hooks/usePaywall";
import { useAuth } from "../../providers/AuthProvider";
import { useSport } from "../../providers/ThemeProvider";

const StepperBtn = styled(XStack, {
  padding: "$2",
  paddingHorizontal: "$3",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "$borderColor",
  backgroundColor: "$backgroundSurface",
  cursor: "pointer",
  animation: "quick",
  hoverStyle: {
    borderColor: "$accentBackground",
  },
  pressStyle: {
    scale: 0.98,
  },
  variants: {
    disabled: {
      true: {
        opacity: 0.3,
        cursor: "default",
        hoverStyle: {
          borderColor: "$borderColor",
        },
        pressStyle: {
          scale: 1,
        },
      },
    },
  } as const,
});

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";

// ── Fun team name generator (mirrors backend logic) ──
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const ADJECTIVES = ["Royal","Super","Mighty","Thunder","Golden","Blazing","Savage","Electric","Cosmic","Fearless","Turbo","Phantom","Storm","Iron","Shadow","Mega","Wild","Raging","Supreme","Ultra","Mad","Flying","Atomic","Dynamic","Epic","Rebel","Wicked","Bold","Stealth","Hyper","Furious","Mystic","Lethal","Daring","Fiery","Neon","Frost","Crimson","Lucky"];
const ANIMALS = ["Wolves","Panthers","Lions","Hawks","Vipers","Stallions","Raptors","Dragons","Scorpions","Falcons","Eagles","Rhinos","Jaguars","Cobras","Sharks","Tigers","Phoenixes","Bulls","Crows","Leopards","Hornets"];
const CRICKET = ["Strikers","Warriors","Titans","Knights","Gladiators","Legends","Chargers","Spartans","Mavericks","Rovers","Crushers","Blasters","Challengers","Hurricanes","Vikings","Ninjas","Avengers","Raiders","Sixers","Spinners"];
const CITIES = ["Mumbai","Delhi","Bangalore","Chennai","Kolkata","Hyderabad","Jaipur","Lucknow","Pune","Ahmedabad"];
const SUFFIXES = ["United","XI","FC","Army","Squad","Clan","Empire","Force","Legion","Brigade","Crew"];
const FUNNY = ["No Ball Nightmares","Duck Dynasty XI","Boundary Bandits","Wicket Wizards","Spin to Win","Six Machine","Stump Mic Legends","Sledge Hammers","Night Watchmen","Free Hit Frenzy","Powerplay Pirates","Sweep Shot Society","Googly Gang","Reverse Swing Rebels","Last Over Legends","Hat Trick Heroes"];
const TEAM_SHORT: Record<string, string> = {
  "chennai super kings": "Chennai", "mumbai indians": "Mumbai", "royal challengers bengaluru": "Bengaluru",
  "kolkata knight riders": "Kolkata", "sunrisers hyderabad": "Hyderabad", "rajasthan royals": "Rajasthan",
  "delhi capitals": "Delhi", "punjab kings": "Punjab", "lucknow super giants": "Lucknow", "gujarat titans": "Gujarat",
};
function generateTeamName(teamA?: string, teamB?: string): string {
  const getCity = (t: string) => TEAM_SHORT[t.toLowerCase()] ?? t.split(" ")[0] ?? t;
  const cities = [teamA, teamB].filter(Boolean).map((t) => getCity(t!));
  if (cities.length > 0 && Math.random() < 0.5) {
    const city = pick(cities);
    return pick([() => `${city} ${pick(CRICKET)}`, () => `${city} ${pick(ANIMALS)}`, () => `${pick(ADJECTIVES)} ${city} ${pick(SUFFIXES)}`])();
  }
  return pick([
    () => `${pick(ADJECTIVES)} ${pick(ANIMALS)}`, () => `${pick(ADJECTIVES)} ${pick(CRICKET)}`,
    () => `${pick(CITIES)} ${pick(CRICKET)}`, () => `${pick(CITIES)} ${pick(ANIMALS)}`,
    () => `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${pick(SUFFIXES)}`, () => pick(FUNNY),
  ])();
}

const MAX_BUDGET = 100;
const TEAM_SIZE = 11;
const ROLE_LIMITS: Record<string, { min: number; max: number; label: string }> = { wicket_keeper: { min: 1, max: 4, label: "WK" }, batsman: { min: 1, max: 6, label: "BAT" }, all_rounder: { min: 1, max: 6, label: "AR" }, bowler: { min: 1, max: 6, label: "BOWL" } };
const TABS = [{ key: "wicket_keeper", label: "WK" }, { key: "batsman", label: "BAT" }, { key: "all_rounder", label: "AR" }, { key: "bowler", label: "BOWL" }] as const;
type SelectedPlayer = { playerId: string; role: string; name: string; team: string; credits: number; photoUrl?: string | null };

export default function TeamBuilderScreen() {
  const navCtx = useNavigationStore((s) => s.matchContext);
  const params = useLocalSearchParams<{ matchId?: string; contestId?: string }>();
  // Prefer Zustand store context, fall back to URL search params
  const matchId = navCtx?.matchId || params.matchId;
  const contestId = navCtx?.contestId || params.contestId;
  const teamA = navCtx?.teamA;
  const teamB = navCtx?.teamB;
  const format = navCtx?.format;
  const venue = navCtx?.venue;
  const tournament = navCtx?.tournament;
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTamaguiTheme();
  const insets = useSafeAreaInsets();
  const { sport } = useSport();
  const { gate, gateFeature, hasAccess, canAccess, paywallProps } = usePaywall();
  const flowState = useNavigationStore((s) => s.flowState);
  const setFlowState = useNavigationStore((s) => s.setFlowState);
  const advanceFlow = useNavigationStore((s) => s.advanceFlow);
  const resetFlow = useNavigationStore((s) => s.resetFlow);
  const [selectedTab, setSelectedTab] = useState<string>("wicket_keeper");
  const [selectedPlayers, setSelectedPlayers] = useState<SelectedPlayer[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [viceCaptainId, setViceCaptainId] = useState<string | null>(null);
  const [step, setStep] = useState<"contest_select" | "pick" | "captain" | "review">(() => {
    // Skip contest picker if contestId already set (came from contest page or H2H)
    if (contestId) return "pick";
    // Skip contest picker for deferred H2H — user already picked stake
    if (flowState?.contestType === "h2h") return "pick";
    return "contest_select";
  });
  const [teamName, setTeamName] = useState(() => generateTeamName(navCtx?.teamA, navCtx?.teamB));
  // AI team naming flow
  const [teamNameStep, setTeamNameStep] = useState<"default" | "picking" | "done">("default");
  const [teamAiNames, setTeamAiNames] = useState<string[]>([]);
  const generateTeamNames = trpc.team.generateTeamNames.useMutation();
  const createContest = trpc.contest.create.useMutation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const solverApplied = useRef(false);

  // Pre-populate from solver picks if available
  useEffect(() => {
    if (solverApplied.current) return;
    const picks = navCtx?.solverPicks;
    if (!picks || picks.length === 0) return;
    solverApplied.current = true;

    const preSelected: SelectedPlayer[] = picks.map((p) => ({
      playerId: p.playerId,
      role: p.role,
      name: p.name,
      team: p.team,
      credits: p.credits,
    }));
    setSelectedPlayers(preSelected);

    const cap = picks.find((p) => p.isCaptain);
    const vc = picks.find((p) => p.isViceCaptain);
    if (cap) setCaptainId(cap.playerId);
    if (vc) setViceCaptainId(vc.playerId);

    // Skip to captain step since all 11 are picked (also skips contest_select)
    if (picks.length === 11 && cap && vc) {
      setStep("captain");
    } else if (picks.length === 11) {
      setStep("captain");
    }
  }, [navCtx?.solverPicks]);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<"error" | "success">("error");
  const [sortBy, setSortBy] = useState<"credits" | "projected">("projected");
  const matchPlayers = trpc.player.getByMatch.useQuery({ matchId: matchId! }, { enabled: !!matchId });

  // Fetch match details as fallback for nav store context (tournament name, teams, etc.)
  const matchDetails = trpc.match.getById.useQuery(
    { id: matchId! },
    { enabled: !!matchId && !tournament, staleTime: Infinity },
  );
  // Resolve tournament: prefer nav store, fall back to DB match record
  const resolvedTournament = tournament || (matchDetails.data as any)?.tournament || null;
  const resolvedTeamA = teamA || (matchDetails.data as any)?.teamA || null;
  const resolvedTeamB = teamB || (matchDetails.data as any)?.teamB || null;

  // Contest list for contest_select step — resolve DB match UUID first
  const dbMatchUuidForContest = useMemo(() => {
    if (!matchId) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId);
    return isUuid ? matchId : null;
  }, [matchId]);
  const contestsQuery = trpc.contest.listByMatch.useQuery(
    { matchId: dbMatchUuidForContest! },
    { enabled: step === "contest_select" && !!dbMatchUuidForContest, staleTime: 60_000 },
  );

  // ── Inline League Creation State ──
  const LEAGUE_FORMATS = [
    { value: "salary_cap" as const, label: "salary cap", desc: "pick within budget each match" },
    { value: "draft" as const, label: "snake draft", desc: "take turns picking players", comingSoon: true },
    { value: "auction" as const, label: "auction", desc: "bid on players for the season", comingSoon: true },
    { value: "prediction" as const, label: "prediction", desc: "predict match outcomes", comingSoon: true },
  ];
  const LEAGUE_SIZE_PRESETS = [
    { label: "Duel", min: 2, max: 2, default: 2, desc: "1v1" },
    { label: "Huddle", min: 3, max: 4, default: 4, desc: "small group" },
    { label: "Club", min: 5, max: 10, default: 10, desc: "classic" },
    { label: "Arena", min: 11, max: 20, default: 20, desc: "big league" },
  ] as const;
  const [showLeagueForm, setShowLeagueForm] = useState(false);
  const [leagueName, setLeagueName] = useState("");
  const [leagueFormat, setLeagueFormat] = useState<"salary_cap" | "draft" | "auction" | "prediction">("salary_cap");
  // Fun questions for AI league name generation
  const [groupName, setGroupName] = useState("");
  const [dynamicQ, setDynamicQ] = useState<{ question: string; options: string[] } | null>(null);
  const [selectedVibe, setSelectedVibe] = useState("");
  const [aiNameOptions, setAiNameOptions] = useState<string[]>([]);
  const [nameGenStep, setNameGenStep] = useState<"config" | "q1" | "q2" | "picking" | "done">("config");
  const [leagueSize, setLeagueSize] = useState(10);
  const [leagueEntryFee, setLeagueEntryFee] = useState(0);
  const [leaguePrivate, setLeaguePrivate] = useState(true);
  const leagueSizePresetMatch = LEAGUE_SIZE_PRESETS.find((p) => leagueSize >= p.min && leagueSize <= p.max);

  const createLeague = trpc.league.create.useMutation({
    onSuccess: async (league: any) => {
      // Refetch contests — the new league auto-created a contest for this match
      const result = await contestsQuery.refetch();
      const leagueContest = (result.data ?? []).find((c: any) => c.leagueId === league.id);
      if (leagueContest) {
        // Auto-select the league's contest for this match
        const ctx = navCtx;
        if (ctx) {
          useNavigationStore.getState().setMatchContext({ ...ctx, contestId: leagueContest.id });
        }
        setStep("pick");
      } else {
        // League created but no contest for this match yet — proceed to pick without contest
        setAlertMessage("League created! No contest found for this match yet.");
        setAlertType("success");
        setStep("pick");
      }
      setShowLeagueForm(false);
    },
    onError: (err: any) => {
      setAlertMessage(err.message || "Failed to create league");
      setAlertType("error");
    },
  });

  const generateLeagueName = trpc.league.generateName.useMutation();
  const generateQuestion = trpc.league.generateQuestion.useMutation();

  const handleCreateLeague = () => {
    if (!leagueName.trim()) {
      setAlertMessage("Pick a league name first");
      setAlertType("error");
      return;
    }
    if (!resolvedTournament) {
      setAlertMessage("Tournament info missing");
      setAlertType("error");
      return;
    }
    const suffix = leagueSizePresetMatch?.label ?? "League";
    const trimmedLeagueName = leagueName.trim();
    const finalLeagueName = trimmedLeagueName.toLowerCase().endsWith(suffix.toLowerCase())
      ? trimmedLeagueName
      : `${trimmedLeagueName} ${suffix}`;
    createLeague.mutate({
      name: finalLeagueName,
      format: leagueFormat,
      sport: sport as "cricket" | "football" | "kabaddi" | "basketball",
      tournament: resolvedTournament,
      isPrivate: leaguePrivate,
      maxMembers: leagueSize,
      template: "casual",
    });
  };

  // Step 1: User clicks "name my league" → show Q1
  const handleStartNaming = () => {
    setNameGenStep("q1");
  };

  // Step 2: User submits Q1 (group name) → AI generates dynamic Q2
  const handleQ1Submit = () => {
    if (!groupName.trim() || !resolvedTournament) return;
    generateQuestion.mutate(
      { groupName: groupName.trim(), tournament: resolvedTournament, leagueSize },
      {
        onSuccess: (data) => {
          setDynamicQ(data);
          setNameGenStep("q2");
        },
      },
    );
  };

  // Step 3: User picks a Q2 option → AI generates league names
  const handleQ2Pick = (option: string) => {
    setSelectedVibe(option);
    if (!resolvedTournament) return;
    generateLeagueName.mutate(
      {
        format: leagueFormat,
        template: "casual",
        tournament: resolvedTournament,
        crewVibe: option,
        groupName: groupName.trim() || undefined,
        leagueSize,
      },
      {
        onSuccess: (data: { names: string[] }) => {
          if (data.names?.length) {
            setAiNameOptions(data.names);
            setLeagueName(data.names[0]);
            setNameGenStep("picking");
          }
        },
      },
    );
  };


  const navigateAfterCreate = (linkedContestId?: string | null) => {
    const cId = linkedContestId || contestId;
    if (cId) {
      router.replace(`/contest/${cId}`);
    } else if (matchId) {
      router.replace(`/match/${matchId}`);
    } else {
      router.replace("/(tabs)");
    }
  };
  const createTeam = trpc.team.create.useMutation({
    onSuccess: (data: any) => {
      setIsSubmitting(false);
      const navContestId = data?.relevantContestId || data?.contestId;
      const wasLinked = !!data?.contestId;
      const title = `${teamName.trim() || "team"} created!`;
      const message = wasLinked
        ? "your team has been entered into the contest."
        : "you can swap this team into your contest from the contest page.";
      if (Platform.OS === "web") {
        setAlertType("success");
        setAlertMessage(formatUIText(`${title} ${message}`));
        setTimeout(() => navigateAfterCreate(navContestId), 800);
      } else {
        Alert.alert(
          formatUIText(title),
          formatUIText(message),
          [{ text: formatUIText(navContestId ? "view contest" : "ok"), onPress: () => navigateAfterCreate(navContestId) }],
        );
      }
    },
    onError: (error: any) => {
      setIsSubmitting(false);
      // Parse PAYWALL errors and show upgrade modal instead of raw JSON
      // tRPC wraps server errors — the JSON message may be in error.message,
      // error.shape?.message, or error.data?.message
      const candidates = [
        error.message,
        error.shape?.message,
        error.data?.message,
      ].filter(Boolean);

      for (const msg of candidates) {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.type === "PAYWALL") {
            gate(parsed.requiredTier || "pro", parsed.title || "Upgrade Required", parsed.description || "Upgrade to unlock this feature.");
            return;
          }
        } catch { /* not JSON, try next */ }
      }

      // If FORBIDDEN but not parseable, likely a tier limit — show generic upgrade prompt
      if (error.data?.code === "FORBIDDEN" || error.message?.includes("FORBIDDEN")) {
        gate("pro", "Upgrade Required", "You've reached a limit on your current plan. Upgrade to unlock more.");
        return;
      }

      showAlert(formatUIText("error"), error.message);
    },
  });
  // Cross-platform alert — Alert.alert is a no-op on web
  function showAlert(title: string, message?: string, buttons?: Array<{ text: string; onPress?: () => void }>) {
    if (Platform.OS === "web") {
      setAlertType("error");
      setAlertMessage(message ? `${title}: ${message}` : title);
      setTimeout(() => setAlertMessage(null), 4000);
      const onPress = buttons?.find((b) => b.onPress)?.onPress;
      if (onPress) onPress();
    } else {
      Alert.alert(title, message, buttons);
    }
  }

  const creditsUsed = useMemo(() => selectedPlayers.reduce((sum, p) => sum + p.credits, 0), [selectedPlayers]);
  const creditsRemaining = MAX_BUDGET - creditsUsed;
  const roleCounts = useMemo(() => { const c: Record<string, number> = {}; for (const p of selectedPlayers) c[p.role] = (c[p.role] ?? 0) + 1; return c; }, [selectedPlayers]);
  const teamCounts = useMemo(() => { const c: Record<string, number> = {}; for (const p of selectedPlayers) c[p.team] = (c[p.team] ?? 0) + 1; return c; }, [selectedPlayers]);
  const overseasRule = (matchPlayers.data as any)?.overseasRule as { enabled: boolean; hostCountry: string } | null;
  const playersByRole = useMemo(() => {
    const list = (matchPlayers.data as any)?.players ?? matchPlayers.data ?? [];
    if (!Array.isArray(list) || list.length === 0) return {};
    const grouped: Record<string, Array<{ id: string; name: string; team: string; role: string; credits: number; nationality: string; formNote: string | null; photoUrl: string | null }>> = {};
    for (const ps of list) { const player = ps.player; if (!player) continue; const role = player.role; if (!grouped[role]) grouped[role] = []; const s = (player.stats as Record<string, unknown>) ?? {}; const credits = (s.adminCredits as number) ?? (s.calculatedCredits as number) ?? (s.geminiCredits as number) ?? (s.credits as number) ?? 8.0; const formNote = (s.formNote as string) ?? null; grouped[role].push({ id: player.id, name: player.name, team: player.team, role: player.role, credits, nationality: player.nationality ?? "", formNote, photoUrl: player.photoUrl ?? null }); }
    for (const role of Object.keys(grouped)) grouped[role]!.sort((a, b) => b.credits - a.credits);
    return grouped;
  }, [matchPlayers.data]);

  // Projections query — needs match info from URL params
  const projPlayerList = useMemo(() => {
    const all = Object.values(playersByRole).flat();
    return all.map((p) => ({ id: p.id, name: p.name, role: p.role, team: p.team }));
  }, [playersByRole]);

  const projectionsQuery = trpc.analytics.getPlayerProjections.useQuery(
    {
      matchId: matchId!,
      teamA: teamA || "",
      teamB: teamB || "",
      format: format || "T20",
      venue: venue || null,
      tournament: tournament || "unknown",
      players: projPlayerList,
    },
    { enabled: projPlayerList.length > 0 && !!teamA && !!teamB, staleTime: 60 * 60_000, retry: 1 },
  );

  const projectionsByPlayerId = useMemo(() => {
    const map = new Map<string, { projectedPoints: number; confidenceLow: number; confidenceHigh: number; captainRank: number }>();
    const players = projectionsQuery.data?.players;
    if (!players || !Array.isArray(players)) return map;
    for (const p of players) {
      map.set(p.playerId, {
        projectedPoints: Number(p.projectedPoints),
        confidenceLow: Number(p.confidenceLow),
        confidenceHigh: Number(p.confidenceHigh),
        captainRank: p.captainRank,
      });
    }
    return map;
  }, [projectionsQuery.data]);

  // Player list for AI insight queries
  const insightsPlayerList = useMemo(() => {
    const all = Object.values(playersByRole).flat();
    return all.map((p) => ({ name: p.name, role: p.role, team: p.team }));
  }, [playersByRole]);

  // ── Playing XI query — for "Likely XI" / "Bench Risk" badges ──
  const playingXIQuery = trpc.analytics.getPlayingXI.useQuery(
    { matchId: matchId!, teamA: teamA || "", teamB: teamB || "", format: format || "T20", venue: venue || null, tournament: tournament || "unknown" },
    { enabled: !!matchId && !!teamA && !!teamB && canAccess("hasPlayingXI"), staleTime: 60 * 60_000, retry: 1 },
  );

  // Build a lookup: player name → "likely" | "bench" | "unlikely"
  const playingXIStatus = useMemo(() => {
    const map = new Map<string, "likely" | "bench">();
    const data = playingXIQuery.data as any;
    if (!data) return map;
    for (const side of [data.teamA, data.teamB]) {
      if (!side) continue;
      for (const p of side.predictedXI ?? []) {
        map.set(p.name.toLowerCase(), "likely");
      }
      for (const p of side.benchPlayers ?? []) {
        map.set(p.name.toLowerCase(), "bench");
      }
    }
    return map;
  }, [playingXIQuery.data]);

  // ── Pitch/Weather query — for context banner ──
  const pitchWeatherQuery = trpc.analytics.getPitchWeather.useQuery(
    { matchId: matchId!, teamA: teamA || "", teamB: teamB || "", format: format || "T20", venue: venue || null },
    { enabled: !!matchId && !!teamA && !!teamB && canAccess("hasPitchWeather"), staleTime: 60 * 60_000, retry: 1 },
  );

  const pitchSummary = useMemo(() => {
    const data = pitchWeatherQuery.data as any;
    if (!data?.pitch) return null;
    const p = data.pitch;
    const w = data.weather;
    const tips = data.fantasyTips ?? [];
    // Build one-line summary
    const pitchLabel = p.pitchType?.replace(/-/g, " ") || "unknown";
    const advantage = p.paceVsSpinAdvantage === "pace" ? "pace bowlers favored" : p.paceVsSpinAdvantage === "spin" ? "spinners favored" : "balanced conditions";
    const headline = `${pitchLabel} pitch at ${venue || "this venue"} — ${advantage}`;
    return { headline, tips, temperature: w?.temperature, conditions: w?.conditions, paceVsSpin: p.paceVsSpinAdvantage };
  }, [pitchWeatherQuery.data, venue]);

  // ── Captain Picks query — for captain step recommendations ──
  const captainPicksQuery = trpc.analytics.getCaptainPicks.useQuery(
    { matchId: matchId!, teamA: teamA || "", teamB: teamB || "", format: format || "T20", venue: venue || null, tournament: tournament || "unknown", players: insightsPlayerList },
    { enabled: !!matchId && !!teamA && !!teamB && insightsPlayerList.length > 0 && canAccess("hasCaptainPicks") && (step === "captain" || step === "review"), staleTime: 2 * 60 * 60_000, retry: 1 },
  );

  // ── Differentials query — for filter chip + review uniqueness ──
  const differentialsQuery = trpc.analytics.getDifferentials.useQuery(
    { matchId: matchId!, teamA: teamA || "", teamB: teamB || "", format: format || "T20", venue: venue || null, tournament: tournament || "unknown", players: insightsPlayerList },
    { enabled: !!matchId && !!teamA && !!teamB && insightsPlayerList.length > 0 && canAccess("hasDifferentials"), staleTime: 2 * 60 * 60_000, retry: 1 },
  );

  // Differential player names set for filtering
  const differentialNames = useMemo(() => {
    const set = new Set<string>();
    const picks = (differentialsQuery.data as any)?.picks;
    if (Array.isArray(picks)) {
      for (const p of picks) set.add(p.playerName?.toLowerCase());
    }
    return set;
  }, [differentialsQuery.data]);

  // ── Smart filter state for player pick step ──
  const [showInsights, setShowInsights] = useState(false);

  // ── Draggable FAB state ──
  const FAB_SIZE = 48;
  const FAB_DEFAULT_BOTTOM = 100;
  const FAB_DEFAULT_RIGHT = 20;
  const [fabPos, setFabPos] = useState({ x: 0, y: 0 }); // offset from default position
  const fabDragRef = useRef({ startX: 0, startY: 0, dragged: false });
  const webDragRef = useRef({ startX: 0, startY: 0, dragging: false, moved: false });
  // Clamp FAB so it stays within the screen (with 4px margin)
  const clampFab = (x: number, y: number) => {
    // right: 20 + x → must stay >= 4 and <= screenWidth - FAB_SIZE - 4
    // bottom: 100 + y → must stay >= 4 and <= screenHeight - FAB_SIZE - 4
    // Since we use right/bottom positioning, x positive = move left, y positive = move up
    // max right offset: right edge goes to 4 → x_max = -(screenWidth - FAB_DEFAULT_RIGHT - FAB_SIZE - 4)
    // This is complex with right/bottom. Simpler: limit offset range.
    const maxOffsetX = 340; // ~screen width minus margins
    const maxOffsetY = 700; // ~screen height minus margins
    return {
      x: Math.max(-maxOffsetX, Math.min(FAB_DEFAULT_RIGHT - 4, x)),
      y: Math.max(-(FAB_DEFAULT_BOTTOM - 4), Math.min(maxOffsetY, y)),
    };
  };
  const fabPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
    onPanResponderGrant: () => {
      fabDragRef.current.startX = fabPos.x;
      fabDragRef.current.startY = fabPos.y;
      fabDragRef.current.dragged = false;
    },
    onPanResponderMove: (_, g) => {
      if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) fabDragRef.current.dragged = true;
      setFabPos(clampFab(fabDragRef.current.startX + g.dx, fabDragRef.current.startY + g.dy));
    },
    onPanResponderRelease: () => {
      if (!fabDragRef.current.dragged) setShowInsights(true);
    },
  }), [fabPos.x, fabPos.y]);
  const [smartFilter, setSmartFilter] = useState<"all" | "differentials" | "value" | "form">("all");
  const [pitchBannerExpanded, setPitchBannerExpanded] = useState(false);

  // ── Guru verdict state for review step ──
  const [guruVerdict, setGuruVerdict] = useState<string | null>(null);
  const [guruVerdictLoading, setGuruVerdictLoading] = useState(false);
  const guruMutation = trpc.guru.sendMessage.useMutation({
    onSuccess: (data: any) => {
      const msgs = data?.messages ?? [];
      const last = msgs[msgs.length - 1];
      setGuruVerdict(last?.content || "No verdict available.");
    },
    onError: () => setGuruVerdict("Could not get Guru's verdict right now. Try again later."),
    onSettled: () => setGuruVerdictLoading(false),
  });

  const selectedIds = new Set(selectedPlayers.map((p) => p.playerId));
  const currentRolePlayers = useMemo(() => {
    let list = playersByRole[selectedTab] ?? [];

    // Apply smart filter
    if (smartFilter === "differentials" && differentialNames.size > 0) {
      list = list.filter((p) => differentialNames.has(p.name.toLowerCase()));
    } else if (smartFilter === "value" && projectionsByPlayerId.size > 0) {
      list = [...list].sort((a, b) => {
        const valA = (projectionsByPlayerId.get(a.id)?.projectedPoints ?? 0) / (a.credits || 1);
        const valB = (projectionsByPlayerId.get(b.id)?.projectedPoints ?? 0) / (b.credits || 1);
        return valB - valA;
      });
    } else if (smartFilter === "form") {
      list = [...list].sort((a, b) => {
        const fA = a.formNote ? 1 : 0;
        const fB = b.formNote ? 1 : 0;
        return fB - fA;
      });
    } else if (sortBy === "projected" && projectionsByPlayerId.size > 0) {
      list = [...list].sort((a, b) => {
        const pA = projectionsByPlayerId.get(a.id)?.projectedPoints ?? 0;
        const pB = projectionsByPlayerId.get(b.id)?.projectedPoints ?? 0;
        return pB - pA;
      });
    } else if (sortBy === "credits") {
      list = [...list].sort((a, b) => b.credits - a.credits);
    }

    return list;
  }, [playersByRole, selectedTab, sortBy, projectionsByPlayerId, smartFilter, differentialNames]);
  const currentRoleLimit = ROLE_LIMITS[selectedTab];
  const canSelectMore = selectedPlayers.length < TEAM_SIZE;

  function togglePlayer(player: { id: string; name: string; team: string; role: string; credits: number; photoUrl?: string | null }) {
    if (selectedIds.has(player.id)) { setSelectedPlayers((prev) => prev.filter((p) => p.playerId !== player.id)); if (captainId === player.id) setCaptainId(null); if (viceCaptainId === player.id) setViceCaptainId(null); return; }
    if (!canSelectMore) { showAlert(formatUIText("team full"), formatUIText(`you've already selected ${TEAM_SIZE} players`)); return; }
    const roleCount = roleCounts[player.role] ?? 0; const limit = ROLE_LIMITS[player.role]; if (limit && roleCount >= limit.max) { showAlert(formatUIText("role limit"), formatUIText(`max ${limit.max} ${limit.label} players allowed`)); return; }
    if (player.credits > creditsRemaining) { showAlert(formatUIText("budget exceeded"), `${player.name} ${formatUIText("costs")} ${player.credits} ${formatUIText("credits, but you only have")} ${creditsRemaining.toFixed(1)} ${formatUIText("remaining")}`); return; }
    const playerTeamCount = teamCounts[player.team] ?? 0; if (playerTeamCount >= 7) { showAlert(formatUIText("team limit"), formatUIText(`max 7 players from ${player.team}`)); return; }
    setSelectedPlayers((prev) => [...prev, { playerId: player.id, role: player.role, name: player.name, team: player.team, credits: player.credits, photoUrl: player.photoUrl }]);
  }
  function handleContinue() { for (const [role, limits] of Object.entries(ROLE_LIMITS)) { const count = roleCounts[role] ?? 0; if (count < limits.min) { showAlert(formatUIText("missing roles"), formatUIText(`need at least ${limits.min} ${limits.label} player(s), have ${count}`)); return; } } setStep("captain"); }
  function handleGoToReview() { if (!captainId || !viceCaptainId) { showAlert(formatUIText("select captain & vc"), formatUIText("please select both captain and vice-captain")); return; } if (captainId === viceCaptainId) { showAlert(formatUIText("invalid"), formatUIText("captain and vice-captain must be different")); return; } setStep("review"); }
  async function handleSubmit() {
    if (!captainId || !viceCaptainId) return;
    const teamPayload = {
      name: teamName.trim() || undefined,
      matchId: matchId || undefined,
      players: selectedPlayers.map((p) => ({ playerId: p.playerId, role: p.role as "batsman" | "bowler" | "all_rounder" | "wicket_keeper" })),
      captainId,
      viceCaptainId,
    };

    // Deferred H2H: create contest first, then team
    if (flowState?.contestType === "h2h" && !contestId && matchId) {
      setIsSubmitting(true);
      try {
        const stake = flowState.stake ?? 0;
        const h2hContest = await createContest.mutateAsync({
          matchId,
          name: flowState.contestName || "H2H Duel",
          entryFee: stake,
          maxEntries: 2,
          contestType: "h2h",
          isGuaranteed: false,
          prizeDistribution: stake > 0 ? [{ rank: 1, amount: stake * 2 }] : [{ rank: 1, amount: 0 }],
        });
        // Now create team linked to the new contest
        createTeam.mutate({ ...teamPayload, contestId: h2hContest.id });
        resetFlow();
      } catch (e: any) {
        setIsSubmitting(false);
        showAlert(formatUIText("error"), formatUIText(e.message || "failed to create challenge"));
      }
      return;
    }

    createTeam.mutate({ ...teamPayload, ...(contestId ? { contestId } : {}) });
  }

  // Total projected points for review
  const totalProjectedPoints = useMemo(() => {
    if (projectionsByPlayerId.size === 0) return null;
    let total = 0;
    for (const p of selectedPlayers) {
      const proj = projectionsByPlayerId.get(p.playerId);
      if (proj) {
        let pts = proj.projectedPoints;
        if (p.playerId === captainId) pts *= 2;
        else if (p.playerId === viceCaptainId) pts *= 1.5;
        total += pts;
      }
    }
    return total;
  }, [selectedPlayers, projectionsByPlayerId, captainId, viceCaptainId]);

  if (matchPlayers.isLoading) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" gap="$3">
      <EggLoadingSpinner size={48} message={formatUIText("loading players")} />
    </YStack>
  );

  // Inline alert banner component for web
  const AlertBanner = alertMessage ? (
    <Animated.View entering={FadeInDown.springify()}>
      <XStack backgroundColor={alertType === "success" ? "$accentBackground" : "$error"} paddingVertical="$2" paddingHorizontal="$4" marginHorizontal="$4" marginBottom="$2" borderRadius="$2" alignItems="center" gap="$2">
        <Text fontFamily="$body" fontSize={12} fontWeight="600" color="white" flex={1}>{alertMessage}</Text>
        <Text fontSize={12} color="white" onPress={() => setAlertMessage(null)} cursor="pointer">✕</Text>
      </XStack>
    </Animated.View>
  ) : null;

  // ── Step Indicator ──
  const stepConfig = contestId
    ? [
        { key: "pick" as const, label: "players" },
        { key: "captain" as const, label: "captain" },
        { key: "review" as const, label: "review" },
      ]
    : [
        { key: "contest_select" as const, label: "contest" },
        { key: "pick" as const, label: "players" },
        { key: "captain" as const, label: "captain" },
        { key: "review" as const, label: "review" },
      ];
  const currentStepIndex = stepConfig.findIndex((s) => s.key === step);

  const StepIndicator = (
    <XStack paddingHorizontal="$4" paddingVertical="$2" gap="$1" alignItems="center" justifyContent="center">
      {stepConfig.map((s, i) => {
        const isActive = s.key === step;
        const isCompleted = i < currentStepIndex;
        const canGoBack = isCompleted && s.key !== "contest_select";
        return (
          <XStack key={s.key} alignItems="center" gap="$1" flex={1}>
            <XStack
              flex={1}
              height={3}
              borderRadius={2}
              backgroundColor={isCompleted ? "$accentBackground" : isActive ? "$accentBackground" : "$borderColor"}
              opacity={isActive ? 1 : isCompleted ? 0.7 : 0.3}
              onPress={canGoBack ? () => setStep(s.key) : undefined}
              cursor={canGoBack ? "pointer" : "default"}
            />
            <Text
              fontFamily="$mono"
              fontSize={8}
              fontWeight={isActive ? "700" : "500"}
              color={isActive ? "$accentBackground" : isCompleted ? "$color" : "$colorMuted"}
              letterSpacing={0.5}
              onPress={canGoBack ? () => setStep(s.key) : undefined}
              cursor={canGoBack ? "pointer" : "default"}
            >
              {formatBadgeText(s.label)}
            </Text>
          </XStack>
        );
      })}
    </XStack>
  );

  // ── Contest Select Step ──
  if (step === "contest_select") {
    const contests = contestsQuery.data ?? [];
    return (
      <YStack flex={1} backgroundColor="$background" testID="team-builder-contest-select">
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingHorizontal="$4"
          paddingTop={insets.top + 8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <SafeBackButton />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
              {formatUIText("build team")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {StepIndicator}
        {AlertBanner}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Text fontFamily="$body" fontWeight="600" fontSize={16} color="$color" marginBottom="$2">
            {formatUIText("choose a contest")}
          </Text>
          <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginBottom="$4">
            {formatUIText("select a contest to enter, or create one below")}
          </Text>

          {contestsQuery.isLoading ? (
            <YStack alignItems="center" paddingVertical="$6">
              <EggLoadingSpinner size={32} message={formatUIText("loading contests")} />
            </YStack>
          ) : contests.length > 0 ? (
            <YStack gap="$2">
              {contests.map((c: any) => (
                <Card
                  key={c.id}
                  pressable
                  padding="$4"
                  borderWidth={1}
                  borderColor="$borderColor"
                  onPress={() => {
                    // Set contestId in nav store and advance
                    const ctx = navCtx;
                    if (ctx) {
                      useNavigationStore.getState().setMatchContext({ ...ctx, contestId: c.id });
                    }
                    setStep("pick");
                  }}
                  testID={`contest-option-${c.id}`}
                >
                  <XStack alignItems="center" justifyContent="space-between">
                    <YStack flex={1} gap="$1">
                      <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" numberOfLines={2}>
                        {c.name}
                      </Text>
                      <XStack alignItems="center" gap="$2" flexWrap="wrap">
                        <Badge variant={c.contestType === "h2h" ? "live" : "default"} size="sm">
                          {formatBadgeText(c.contestType)}
                        </Badge>
                        {c.leagueOwnerId === user?.id && (
                          <Badge variant="live" size="sm">
                            {formatBadgeText("yours")}
                          </Badge>
                        )}
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                          {c.currentEntries}/{c.maxEntries} {formatUIText("joined")}
                        </Text>
                      </XStack>
                    </YStack>
                    <YStack alignItems="flex-end" gap="$1">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$accentBackground">
                        {c.entryFee === 0 ? formatUIText("free") : `${c.entryFee} PC`}
                      </Text>
                      {c.prizePool > 0 && (
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                          {formatUIText("prize")} {c.prizePool} PC
                        </Text>
                      )}
                    </YStack>
                  </XStack>
                </Card>
              ))}

            </YStack>
          ) : (
            <Card padding="$5" alignItems="center" gap="$3">
              <Text fontSize={32}>🏏</Text>
              <Text fontFamily="$body" fontWeight="600" fontSize={15} color="$color" textAlign="center">
                {formatUIText("no contests yet")}
              </Text>
              <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center" lineHeight={18} paddingHorizontal="$2">
                {formatUIText("create a league or challenge a friend to get started — your team needs a contest to compete in")}
              </Text>
            </Card>
          )}

          {/* ── Create a League ── */}
          <Card
            padding="$4"
            marginTop="$3"
            borderWidth={1}
            borderColor={showLeagueForm ? "$accentBackground" : "$borderColor"}
            borderStyle={showLeagueForm ? "solid" : "dashed"}
            hoverStyle={{ borderColor: "$accentBackground" }}
            testID="create-league-option"
          >
            <Pressable onPress={() => { setShowLeagueForm(!showLeagueForm); if (!showLeagueForm) setNameGenStep("config"); }}>
              <XStack alignItems="center" gap="$3">
                <Text fontSize={20}>🏆</Text>
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                    {formatUIText("create a league")}
                  </Text>
                  <Text fontFamily="$body" fontSize={11} color="$colorMuted">
                    {resolvedTournament ? resolvedTournament : formatUIText("invite friends & compete")}
                  </Text>
                </YStack>
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{showLeagueForm ? "▾" : "▸"}</Text>
              </XStack>
            </Pressable>

            {showLeagueForm && (
              <Animated.View entering={FadeInDown.duration(200)}>
                <YStack marginTop="$4" gap="$4">

                  {/* ── League Name Section (shown at top once we have a name) ── */}
                  {nameGenStep === "done" && (
                    <YStack gap="$1">
                      <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                        {formatBadgeText("league name")}
                      </Text>
                      <TextInput
                        value={leagueName}
                        onChangeText={setLeagueName}
                        maxLength={60}
                        style={{
                          fontFamily: "System",
                          fontSize: 15,
                          fontWeight: "700",
                          color: theme.accentBackground?.val,
                          backgroundColor: theme.backgroundSurface?.val,
                          borderWidth: 1,
                          borderColor: theme.accentBackground?.val,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                        }}
                      />
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted" marginTop="$1">
                        {formatUIText("tap to edit the name")}
                      </Text>
                    </YStack>
                  )}

                  {/* ── League Config (type, size, fee, visibility, format) ── */}
                  {(nameGenStep === "config" || nameGenStep === "done") && (
                    <>
                      {/* League Type Presets */}
                      <YStack gap="$1">
                        <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                          {formatBadgeText("league type")}
                        </Text>
                        <XStack gap="$2" flexWrap="wrap">
                          {LEAGUE_SIZE_PRESETS.map((preset) => {
                            const isActive = leagueSizePresetMatch?.label === preset.label;
                            return (
                            <Pressable key={preset.label} onPress={() => setLeagueSize(preset.default)} style={{ flex: 1, minWidth: 70 }}>
                              <YStack
                                paddingVertical="$2"
                                borderRadius={8}
                                borderWidth={1}
                                borderColor={isActive ? "$accentBackground" : "$borderColor"}
                                backgroundColor={isActive ? "$accentBackground" : "$backgroundSurface"}
                                alignItems="center"
                                gap={2}
                              >
                                <Text fontFamily="$mono" fontSize={12} fontWeight="700" color={isActive ? "$background" : "$color"}>
                                  {preset.label}
                                </Text>
                                <Text fontFamily="$mono" fontSize={9} color={isActive ? "$background" : "$colorMuted"}>
                                  {preset.min === preset.max ? `${preset.min} player` : `${preset.min}-${preset.max} players`}
                                </Text>
                              </YStack>
                            </Pressable>
                            );
                          })}
                        </XStack>
                      </YStack>

                      {/* Max Members Fine-tune */}
                      <XStack justifyContent="space-between" alignItems="center">
                        <YStack>
                          <Text fontFamily="$body" fontSize={13} color="$color" fontWeight="600">
                            {formatUIText("max members")}
                          </Text>
                          <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                            {leagueSizePresetMatch ? leagueSizePresetMatch.desc : `custom (${leagueSize})`}
                          </Text>
                        </YStack>
                        <XStack alignItems="center" gap="$2">
                          <StepperBtn
                            disabled={leagueSize <= 2}
                            onPress={() => leagueSize > 2 && setLeagueSize(leagueSize - 1)}
                          >
                            <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">-</Text>
                          </StepperBtn>
                          <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$color" minWidth={50} textAlign="center">
                            {leagueSize}
                          </Text>
                          <StepperBtn
                            disabled={leagueSize >= 20}
                            onPress={() => leagueSize < 20 && setLeagueSize(leagueSize + 1)}
                          >
                            <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">+</Text>
                          </StepperBtn>
                        </XStack>
                      </XStack>

                      {/* Entry Fee */}
                      <YStack gap="$1">
                        <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                          {formatBadgeText("entry fee")}
                        </Text>
                        <XStack justifyContent="space-between" alignItems="center">
                          <YStack>
                            <Text fontFamily="$body" fontSize={13} color="$color" fontWeight="600">
                              {leagueEntryFee === 0 ? formatUIText("free to join") : formatUIText(`${leagueEntryFee} coins per match`)}
                            </Text>
                            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                              {formatUIText("lower fee = more accessible")}
                            </Text>
                          </YStack>
                          <XStack alignItems="center" gap="$2">
                            <StepperBtn
                              disabled={leagueEntryFee <= 0}
                              onPress={() => leagueEntryFee > 0 && setLeagueEntryFee(leagueEntryFee - 10)}
                            >
                              <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">-</Text>
                            </StepperBtn>
                            <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$color" minWidth={50} textAlign="center">
                              {leagueEntryFee}
                            </Text>
                            <StepperBtn
                              disabled={leagueEntryFee >= 50}
                              onPress={() => leagueEntryFee < 50 && setLeagueEntryFee(leagueEntryFee + 10)}
                            >
                              <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">+</Text>
                            </StepperBtn>
                          </XStack>
                        </XStack>
                      </YStack>

                      {/* Prize Breakdown Preview */}
                      {leagueEntryFee > 0 && (
                        <YStack borderRadius={8} borderWidth={1} borderColor="$borderColor" padding="$3" gap="$2">
                          <XStack justifyContent="space-between" alignItems="center">
                            <Text fontFamily="$mono" fontWeight="600" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
                              {formatBadgeText("prize breakdown")}
                            </Text>
                            <Text fontFamily="$mono" fontSize={11} color="$accentBackground" fontWeight="700">
                              {formatUIText(`pool: ${leagueEntryFee * leagueSize} coins`)}
                            </Text>
                          </XStack>
                          {(leagueSize <= 2
                            ? [{ rank: 1, pct: 100 }]
                            : leagueSize <= 10
                            ? [{ rank: 1, pct: 60 }, { rank: 2, pct: 25 }, { rank: 3, pct: 15 }]
                            : [{ rank: 1, pct: 40 }, { rank: 2, pct: 20 }, { rank: 3, pct: 12 }, { rank: 4, pct: 8 }, { rank: 5, pct: 6 }]
                          ).map((p) => (
                            <XStack key={p.rank} justifyContent="space-between">
                              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                                {p.rank === 1 ? "1st" : p.rank === 2 ? "2nd" : p.rank === 3 ? "3rd" : `${p.rank}th`}
                              </Text>
                              <Text fontFamily="$mono" fontSize={11} color="$color" fontWeight="600">
                                {Math.floor(leagueEntryFee * leagueSize * p.pct / 100)} coins ({p.pct}%)
                              </Text>
                            </XStack>
                          ))}
                        </YStack>
                      )}

                      {/* Visibility */}
                      <YStack gap="$1">
                        <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                          {formatBadgeText("visibility")}
                        </Text>
                        <XStack gap="$2">
                          <Pressable onPress={() => setLeaguePrivate(true)} style={{ flex: 1 }}>
                            <YStack
                              paddingVertical="$2"
                              borderRadius={8}
                              borderWidth={1}
                              borderColor={leaguePrivate ? "$accentBackground" : "$borderColor"}
                              backgroundColor={leaguePrivate ? "$accentBackground" : "$backgroundSurface"}
                              alignItems="center"
                              gap={2}
                            >
                              <Text fontFamily="$mono" fontSize={12} fontWeight="700" color={leaguePrivate ? "$background" : "$color"}>
                                {formatUIText("private")}
                              </Text>
                              <Text fontFamily="$mono" fontSize={9} color={leaguePrivate ? "$background" : "$colorMuted"}>
                                {formatUIText("invite only")}
                              </Text>
                            </YStack>
                          </Pressable>
                          <Pressable onPress={() => setLeaguePrivate(false)} style={{ flex: 1 }}>
                            <YStack
                              paddingVertical="$2"
                              borderRadius={8}
                              borderWidth={1}
                              borderColor={!leaguePrivate ? "$accentBackground" : "$borderColor"}
                              backgroundColor={!leaguePrivate ? "$accentBackground" : "$backgroundSurface"}
                              alignItems="center"
                              gap={2}
                            >
                              <Text fontFamily="$mono" fontSize={12} fontWeight="700" color={!leaguePrivate ? "$background" : "$color"}>
                                {formatUIText("public")}
                              </Text>
                              <Text fontFamily="$mono" fontSize={9} color={!leaguePrivate ? "$background" : "$colorMuted"}>
                                {formatUIText("anyone can join")}
                              </Text>
                            </YStack>
                          </Pressable>
                        </XStack>
                      </YStack>

                      {/* Format */}
                      <YStack gap="$1">
                        <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                          {formatBadgeText("format")}
                        </Text>
                        <YStack gap="$2">
                          {LEAGUE_FORMATS.map((f) => (
                            <Pressable
                              key={f.value}
                              onPress={() => !f.comingSoon && setLeagueFormat(f.value)}
                              disabled={f.comingSoon}
                            >
                              <XStack
                                paddingHorizontal="$3"
                                paddingVertical="$2.5"
                                borderRadius={8}
                                borderWidth={1}
                                borderColor={leagueFormat === f.value ? "$accentBackground" : "$borderColor"}
                                backgroundColor={leagueFormat === f.value ? "$accentBackground" : "$backgroundSurface"}
                                alignItems="center"
                                justifyContent="space-between"
                                opacity={f.comingSoon ? 0.4 : 1}
                              >
                                <YStack>
                                  <XStack alignItems="center" gap="$2">
                                    <Text fontFamily="$body" fontWeight="700" fontSize={13} color={leagueFormat === f.value ? "$background" : "$color"}>
                                      {formatUIText(f.label)}
                                    </Text>
                                    {f.comingSoon && (
                                      <Badge variant="default" size="sm">{formatBadgeText("soon")}</Badge>
                                    )}
                                  </XStack>
                                  <Text fontFamily="$mono" fontSize={9} color={leagueFormat === f.value ? "$background" : "$colorMuted"} marginTop={1}>
                                    {formatUIText(f.desc)}
                                  </Text>
                                </YStack>
                              </XStack>
                            </Pressable>
                          ))}
                        </YStack>
                      </YStack>
                    </>
                  )}

                  {/* ── Q1: Who's this league for? ── */}
                  {nameGenStep === "q1" && (
                    <Animated.View entering={FadeInDown.duration(200)}>
                      <YStack gap="$3">
                        <YStack gap="$1">
                          <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                            {formatBadgeText("quick q — who's this league for?")}
                          </Text>
                          <TextInput
                            value={groupName}
                            onChangeText={setGroupName}
                            placeholder="e.g. office gang, hostel 4, family whatsapp..."
                            placeholderTextColor={theme.colorMuted?.val}
                            maxLength={60}
                            autoFocus
                            style={{
                              fontFamily: "System",
                              fontSize: 14,
                              color: theme.color?.val,
                              backgroundColor: theme.backgroundSurface?.val,
                              borderWidth: 1,
                              borderColor: theme.borderColor?.val,
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                            }}
                          />
                        </YStack>
                        <XStack gap="$2">
                          <Pressable onPress={() => setNameGenStep("config")} style={{ flex: 1 }}>
                            <XStack paddingVertical="$2" justifyContent="center">
                              <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{formatUIText("← back")}</Text>
                            </XStack>
                          </Pressable>
                          <View flex={2}>
                            <Button
                              variant="primary"
                              size="md"
                              onPress={handleQ1Submit}
                              disabled={!groupName.trim() || generateQuestion.isPending}
                            >
                              {generateQuestion.isPending ? formatUIText("thinking...") : formatUIText("next →")}
                            </Button>
                          </View>
                        </XStack>
                      </YStack>
                    </Animated.View>
                  )}

                  {/* ── Q2: Dynamic AI-generated question with selectable options ── */}
                  {nameGenStep === "q2" && dynamicQ && (
                    <Animated.View entering={FadeInDown.duration(200)}>
                      <YStack gap="$3">
                        <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                          {formatBadgeText(dynamicQ.question)}
                        </Text>
                        <YStack gap="$2">
                          {dynamicQ.options.map((option, i) => (
                            <Pressable key={i} onPress={() => handleQ2Pick(option)}>
                              <XStack
                                paddingHorizontal="$3"
                                paddingVertical="$2.5"
                                borderRadius={8}
                                borderWidth={1}
                                borderColor={selectedVibe === option ? "$accentBackground" : "$borderColor"}
                                backgroundColor={selectedVibe === option ? "$accentBackground" : "$backgroundSurface"}
                                alignItems="center"
                                gap="$2"
                                opacity={generateLeagueName.isPending && selectedVibe === option ? 0.7 : 1}
                              >
                                <Text fontFamily="$body" fontWeight="600" fontSize={14} color={selectedVibe === option ? "$background" : "$color"} flex={1}>
                                  {option}
                                </Text>
                                {generateLeagueName.isPending && selectedVibe === option && (
                                  <ActivityIndicator size="small" color={theme.background?.val} />
                                )}
                              </XStack>
                            </Pressable>
                          ))}
                        </YStack>
                        {/* No back button — prevents AI cost abuse */}
                      </YStack>
                    </Animated.View>
                  )}

                  {/* ── Picking: AI-generated name options ── */}
                  {nameGenStep === "picking" && (
                    <Animated.View entering={FadeInDown.duration(200)}>
                      <YStack gap="$2">
                        <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                          {formatBadgeText("pick your league name")}
                        </Text>
                        <YStack gap="$2">
                          {aiNameOptions.map((name, i) => (
                            <Pressable key={i} onPress={() => { setLeagueName(name); setNameGenStep("done"); }}>
                              <XStack
                                paddingHorizontal="$3"
                                paddingVertical="$2.5"
                                borderRadius={8}
                                borderWidth={1}
                                borderColor={leagueName === name ? "$accentBackground" : "$borderColor"}
                                backgroundColor={leagueName === name ? "$accentBackground" : "$backgroundSurface"}
                                alignItems="center"
                                gap="$2"
                              >
                                <Text fontFamily="$body" fontWeight="600" fontSize={14} color={leagueName === name ? "$background" : "$color"} flex={1}>
                                  {name}
                                </Text>
                              </XStack>
                            </Pressable>
                          ))}
                        </YStack>
                        {/* No regenerate/change — prevents AI cost abuse */}
                      </YStack>
                    </Animated.View>
                  )}

                  {/* ── Bottom Buttons ── */}
                  {nameGenStep === "config" && (
                    <Button
                      variant="primary"
                      size="md"
                      onPress={handleStartNaming}
                      testID="generate-name-btn"
                    >
                      {formatUIText("✨ name my league")}
                    </Button>
                  )}
                  {nameGenStep === "done" && (
                    <Button
                      variant="primary"
                      size="md"
                      onPress={handleCreateLeague}
                      disabled={createLeague.isPending || !leagueName.trim()}
                      opacity={!leagueName.trim() ? 0.5 : 1}
                      testID="create-league-btn"
                    >
                      {createLeague.isPending ? formatUIText("creating league...") : formatUIText("create & play")}
                    </Button>
                  )}
                </YStack>
              </Animated.View>
            )}
          </Card>

        </ScrollView>
        <Paywall {...paywallProps} />
      </YStack>
    );
  }

  // ── Review Step ──
  if (step === "review") {
    const captainPlayer = selectedPlayers.find((p) => p.playerId === captainId);
    const vcPlayer = selectedPlayers.find((p) => p.playerId === viceCaptainId);

    // ── Risk Flags (only show flags that actually apply) ──
    const riskFlags: Array<{ icon: string; text: string }> = [];
    // Bench risk players
    const benchRiskPlayers = selectedPlayers.filter((p) => playingXIStatus.get(p.name.toLowerCase()) === "bench");
    if (benchRiskPlayers.length > 0) {
      riskFlags.push({ icon: "⚠️", text: `${benchRiskPlayers.length} player${benchRiskPlayers.length > 1 ? "s have" : " has"} bench risk (${benchRiskPlayers.map((p) => p.name.split(" ").pop()).join(", ")})` });
    }
    // Team skew (8+ from one team)
    for (const [team, count] of Object.entries(teamCounts)) {
      if (count >= 8) riskFlags.push({ icon: "⚠️", text: `${count} players from ${team} — heavily skewed` });
    }
    // Pitch mismatch: no spinners on turning pitch, no pace on seaming
    if (pitchSummary) {
      const hasSpinner = selectedPlayers.some((p) => p.role === "bowler"); // simplified check
      if (pitchSummary.paceVsSpin === "spin") {
        const spinnerCount = selectedPlayers.filter((p) => p.role === "bowler" || p.role === "all_rounder").length;
        if (spinnerCount < 3) riskFlags.push({ icon: "🌀", text: "Spinning pitch — consider adding more spin options" });
      }
    }
    // Captain form check
    if (captainId) {
      const capProj = projectionsByPlayerId.get(captainId);
      if (capProj && capProj.projectedPoints < 25) {
        riskFlags.push({ icon: "⚠️", text: `Captain has low projected points (${capProj.projectedPoints.toFixed(0)} pts)` });
      }
    }

    // ── Differential / Uniqueness Score ──
    const uniquenessScore = (() => {
      if (differentialNames.size === 0 || selectedPlayers.length === 0) return null;
      const diffCount = selectedPlayers.filter((p) => differentialNames.has(p.name.toLowerCase())).length;
      return Math.min(95, Math.round(30 + diffCount * 15));
    })();

    // ── Ask Guru handler ──
    const handleAskGuru = () => {
      if (guruVerdictLoading || guruVerdict) return;
      setGuruVerdictLoading(true);
      const teamSummary = selectedPlayers.map((p) => {
        const isCap = p.playerId === captainId;
        const isVc = p.playerId === viceCaptainId;
        return `${p.name} (${p.role.replace("_", " ")}${isCap ? ", C" : isVc ? ", VC" : ""})`;
      }).join(", ");
      guruMutation.mutate({
        message: `Rate my fantasy team for ${teamA} vs ${teamB}: ${teamSummary}. Budget used: ${creditsUsed.toFixed(1)}/100. Quick 2-3 sentence verdict — strengths, weaknesses, and one suggestion.`,
        context: {
          upcomingMatches: matchId ? [{ id: matchId, teamA: teamA || "", teamB: teamB || "", date: new Date().toISOString(), format, venue: venue || undefined, tournament }] : undefined,
        },
      });
    };

    return (
      <YStack flex={1} backgroundColor="$background" testID="team-builder-review">
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingHorizontal="$4"
          paddingTop={insets.top + 8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <BackButton onPress={() => setStep("captain")} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
              {formatUIText("review team")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {StepIndicator}
        {AlertBanner}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Team Name */}
          <Card padding="$4" marginBottom="$3">
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5} marginBottom="$1">
              {formatBadgeText("team name")}
            </Text>
            <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color">
              {teamName || formatUIText("unnamed team")}
            </Text>
          </Card>

          {/* Summary Stats + Strength Meter */}
          <Card padding="$4" marginBottom="$3">
            <XStack justifyContent="space-around">
              <YStack alignItems="center">
                <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$color">
                  {creditsUsed.toFixed(1)}
                </Text>
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("credits")}</Text>
              </YStack>
              <YStack alignItems="center">
                <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$color">
                  {selectedPlayers.length}
                </Text>
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("players")}</Text>
              </YStack>
              {totalProjectedPoints !== null && (
                <YStack alignItems="center">
                  <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$accentBackground">
                    {totalProjectedPoints.toFixed(1)}
                  </Text>
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("proj pts")}</Text>
                </YStack>
              )}
              {uniquenessScore !== null && (
                <YStack alignItems="center">
                  <Text fontFamily="$mono" fontWeight="800" fontSize={20} color="$colorCricket">
                    {uniquenessScore}%
                  </Text>
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("unique")}</Text>
                </YStack>
              )}
            </XStack>

            {/* Team Strength Meter */}
            {totalProjectedPoints !== null && (
              <YStack marginTop="$3" gap="$1">
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("team strength")}</Text>
                  <Text fontFamily="$mono" fontSize={9} fontWeight="600" color={
                    totalProjectedPoints > 700 ? "$colorCricket" : totalProjectedPoints > 500 ? "$accentBackground" : "$error"
                  }>
                    {totalProjectedPoints > 700 ? formatUIText("excellent") : totalProjectedPoints > 500 ? formatUIText("good") : formatUIText("needs work")}
                  </Text>
                </XStack>
                <XStack height={4} borderRadius={2} backgroundColor="$borderColor" overflow="hidden">
                  <XStack
                    height={4}
                    borderRadius={2}
                    width={`${Math.min(100, Math.round((totalProjectedPoints / 900) * 100))}%`}
                    backgroundColor={totalProjectedPoints > 700 ? "$colorCricket" : totalProjectedPoints > 500 ? "$accentBackground" : "$error"}
                  />
                </XStack>
              </YStack>
            )}
          </Card>

          {/* ── Risk Flags ── */}
          {riskFlags.length > 0 && (
            <Card padding="$3" marginBottom="$3" borderColor="$error" borderWidth={1}>
              <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$error" letterSpacing={0.5} marginBottom="$2">
                {formatBadgeText("things to consider")}
              </Text>
              {riskFlags.map((flag, i) => (
                <XStack key={i} alignItems="flex-start" gap="$2" marginBottom={i < riskFlags.length - 1 ? 4 : 0}>
                  <Text fontSize={12}>{flag.icon}</Text>
                  <Text fontFamily="$body" fontSize={11} color="$color" flex={1}>{flag.text}</Text>
                </XStack>
              ))}
            </Card>
          )}

          {/* Captain & VC */}
          <XStack gap="$2" marginBottom="$3">
            {captainPlayer && (
              <Card padding="$3" flex={1} borderColor="$accentBackground" borderWidth={2}>
                <XStack alignItems="center" gap="$2">
                  <YStack width={28} height={28} borderRadius={14} backgroundColor="$accentBackground" alignItems="center" justifyContent="center">
                    <Text fontSize={11} fontWeight="800" fontFamily="$mono" color="$accentColor">C</Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{captainPlayer.name}</Text>
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("2x points")}</Text>
                  </YStack>
                </XStack>
              </Card>
            )}
            {vcPlayer && (
              <Card padding="$3" flex={1} borderColor="$colorCricket" borderWidth={2}>
                <XStack alignItems="center" gap="$2">
                  <YStack width={28} height={28} borderRadius={14} backgroundColor="$colorCricket" alignItems="center" justifyContent="center">
                    <Text fontSize={11} fontWeight="800" fontFamily="$mono" color="$accentColor">VC</Text>
                  </YStack>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{vcPlayer.name}</Text>
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("1.5x points")}</Text>
                  </YStack>
                </XStack>
              </Card>
            )}
          </XStack>

          {/* Player Grid */}
          <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5} marginBottom="$2">
            {formatBadgeText("your xi")}
          </Text>
          {selectedPlayers.map((player, i) => {
            const isCaptain = captainId === player.playerId;
            const isVC = viceCaptainId === player.playerId;
            const proj = projectionsByPlayerId.get(player.playerId);
            const roleShort = (player.role ?? "").replace("wicket_keeper", "WK").replace("all_rounder", "AR").replace("batsman", "BAT").replace("bowler", "BOWL");
            const xiStatus = playingXIStatus.get(player.name.toLowerCase());
            return (
              <XStack key={player.playerId} alignItems="center" paddingVertical="$2" borderBottomWidth={1} borderBottomColor="$borderColor" gap="$2">
                <InitialsAvatar
                  name={player.name}
                  playerRole={(({ batsman: "BAT", bowler: "BOWL", all_rounder: "AR", wicket_keeper: "WK" } as Record<string, RoleKey>)[player.role] ?? "BAT")}
                  ovr={Math.round(player.credits * 10)}
                  size={28}
                  imageUrl={player.photoUrl}
                />
                <YStack flex={1}>
                  <XStack alignItems="center" gap="$1">
                    <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{player.name}</Text>
                    {isCaptain && <Badge variant="live" size="sm">C</Badge>}
                    {isVC && <Badge variant="warning" size="sm">VC</Badge>}
                    {xiStatus === "bench" && <Badge variant="warning" size="sm"><Text fontFamily="$mono" fontSize={7} fontWeight="700">BENCH</Text></Badge>}
                  </XStack>
                  <XStack gap="$1">
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{roleShort}</Text>
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">· {player.credits.toFixed(1)} cr</Text>
                    {differentialNames.has(player.name.toLowerCase()) && (
                      <Text fontFamily="$mono" fontSize={8} color="$colorCricket" fontWeight="600">· 💎 diff</Text>
                    )}
                  </XStack>
                </YStack>
                {proj && (
                  <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$accentBackground">
                    {(proj.projectedPoints * (isCaptain ? 2 : isVC ? 1.5 : 1)).toFixed(1)}
                  </Text>
                )}
              </XStack>
            );
          })}

          {/* ── Ask Guru Quick Verdict (Elite only) ── */}
          {canAccess("hasGuruVerdict") ? (
            <Card padding="$3" marginTop="$4" marginBottom="$2">
              {guruVerdict ? (
                <YStack gap="$2">
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize={14}>🤖</Text>
                    <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$accentBackground" letterSpacing={0.5}>
                      {formatBadgeText("guru's verdict")}
                    </Text>
                  </XStack>
                  <Text fontFamily="$body" fontSize={12} color="$color" lineHeight={18}>
                    {guruVerdict}
                  </Text>
                </YStack>
              ) : (
                <Pressable onPress={handleAskGuru} disabled={guruVerdictLoading}>
                  <XStack alignItems="center" justifyContent="center" gap="$2" paddingVertical="$1">
                    {guruVerdictLoading ? (
                      <>
                        <ActivityIndicator size="small" color={theme.accentBackground?.val} />
                        <Text fontFamily="$mono" fontSize={12} color="$colorMuted">
                          {formatUIText("asking guru...")}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text fontSize={16}>🤖</Text>
                        <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$accentBackground">
                          {formatUIText("get guru's verdict")}
                        </Text>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">→</Text>
                      </>
                    )}
                  </XStack>
                </Pressable>
              )}
            </Card>
          ) : (
            <Pressable onPress={() => gateFeature("hasGuruVerdict", "elite", "Guru's Verdict", "Get AI-powered team analysis and recommendations from Cricket Guru")}>
              <Card padding="$3" marginTop="$4" marginBottom="$2" opacity={0.5}>
                <XStack alignItems="center" justifyContent="center" gap="$2" paddingVertical="$1">
                  <Text fontSize={16}>🤖</Text>
                  <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$colorMuted">
                    {formatUIText("get guru's verdict")}
                  </Text>
                  <TierBadge tier="elite" size="sm" />
                </XStack>
              </Card>
            </Pressable>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <XStack padding="$4" gap="$3">
          <Button variant="secondary" size="lg" flex={1} onPress={() => setStep("pick")}>
            {formatUIText("edit team")}
          </Button>
          <Button variant="primary" size="lg" flex={2} disabled={createTeam.isPending || isSubmitting} onPress={handleSubmit} testID="confirm-create-btn">
            {(createTeam.isPending || isSubmitting) ? formatUIText("creating...") : formatUIText("confirm & join")}
          </Button>
        </XStack>
        <Paywall {...paywallProps} />
      </YStack>
    );
  }

  if (step === "captain") {
    return (
      <YStack flex={1} backgroundColor="$background">
        {/* ── Inline Header ── */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingHorizontal="$4"
          paddingTop={insets.top + 8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <SafeBackButton />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
              {formatUIText("build team")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {StepIndicator}
        {AlertBanner}

        <YStack backgroundColor="$backgroundSurface" padding="$4" gap="$3">
          {/* Team Name — AI naming flow */}
          {teamNameStep === "default" ? (
            <XStack alignItems="center" gap="$2">
              <YStack flex={1}>
                <Text fontFamily="$mono" fontWeight="500" fontSize={11} color="$colorMuted" marginBottom="$1" letterSpacing={0.5}>
                  {formatUIText("team name")}
                </Text>
                <TextInput
                  value={teamName}
                  onChangeText={setTeamName}
                  placeholder="e.g. Dream XI, Virat's Army..."
                  placeholderTextColor={theme.colorMuted?.val}
                  maxLength={30}
                  style={{
                    fontFamily: "monospace",
                    fontSize: 14,
                    fontWeight: "600",
                    color: theme.color?.val,
                    backgroundColor: theme.background?.val,
                    borderWidth: 1,
                    borderColor: theme.borderColor?.val,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                />
              </YStack>
              <Pressable
                onPress={() => {
                  if (!resolvedTournament || !resolvedTeamA || !resolvedTeamB) return;
                  generateTeamNames.mutate(
                    { teamA: resolvedTeamA, teamB: resolvedTeamB, tournament: resolvedTournament },
                    {
                      onSuccess: (data: { names: string[] }) => {
                        if (data.names?.length) {
                          setTeamAiNames(data.names);
                          setTeamName(data.names[0]);
                          setTeamNameStep("picking");
                        }
                      },
                    },
                  );
                }}
                disabled={generateTeamNames.isPending}
                style={{ marginTop: 18 }}
              >
                <YStack
                  paddingVertical="$2"
                  paddingHorizontal="$3"
                  borderRadius={8}
                  borderWidth={1}
                  borderColor="$accentBackground"
                  backgroundColor="$backgroundSurface"
                  alignItems="center"
                  opacity={generateTeamNames.isPending ? 0.5 : 1}
                >
                  {generateTeamNames.isPending ? (
                    <ActivityIndicator size="small" color={theme.accentBackground?.val} />
                  ) : (
                    <Text fontFamily="$mono" fontSize={11} color="$accentBackground" fontWeight="600">✨</Text>
                  )}
                </YStack>
              </Pressable>
            </XStack>
          ) : teamNameStep === "picking" ? (
            <Animated.View entering={FadeInDown.duration(200)}>
              <YStack gap="$2">
                <Text fontFamily="$mono" fontSize={10} fontWeight="600" color="$colorMuted" letterSpacing={0.5}>
                  {formatBadgeText("pick your team name")}
                </Text>
                <YStack gap="$2">
                  {teamAiNames.map((n, i) => (
                    <Pressable key={i} onPress={() => { setTeamName(n); setTeamNameStep("done"); }}>
                      <XStack
                        paddingHorizontal="$3"
                        paddingVertical="$2"
                        borderRadius={8}
                        borderWidth={1}
                        borderColor={teamName === n ? "$accentBackground" : "$borderColor"}
                        backgroundColor={teamName === n ? "$accentBackground" : "$backgroundSurface"}
                        alignItems="center"
                      >
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color={teamName === n ? "$background" : "$color"} flex={1}>
                          {n}
                        </Text>
                      </XStack>
                    </Pressable>
                  ))}
                </YStack>
              </YStack>
            </Animated.View>
          ) : (
            <YStack>
              <Text fontFamily="$mono" fontWeight="500" fontSize={11} color="$colorMuted" marginBottom="$1" letterSpacing={0.5}>
                {formatUIText("team name")}
              </Text>
              <TextInput
                value={teamName}
                onChangeText={setTeamName}
                maxLength={30}
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  fontWeight: "600",
                  color: theme.accentBackground?.val,
                  backgroundColor: theme.background?.val,
                  borderWidth: 1,
                  borderColor: theme.accentBackground?.val,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              />
              <Text fontFamily="$mono" fontSize={9} color="$colorMuted" marginTop={2}>
                {formatUIText("tap to edit")}
              </Text>
            </YStack>
          )}
          <YStack>
            <Text fontFamily="$mono" fontWeight="500" fontSize={15} color="$color" letterSpacing={-0.5}>
              {formatUIText("select captain & vice-captain")}
            </Text>
            <Text fontFamily="$body" fontSize={12} color="$colorCricket" marginTop="$1">
              {formatUIText("captain gets 2x points, vc gets 1.5x")}
            </Text>
          </YStack>
        </YStack>

        {/* ── Guru Recommendation Banner ── */}
        {(() => {
          const cpData = captainPicksQuery.data as any;
          if (cpData?.captainPicks?.length) {
            const topC = cpData.captainPicks[0];
            const topVC = cpData.viceCaptainPicks?.[0];
            return (
              <Animated.View entering={FadeIn.duration(300)}>
                <XStack
                  backgroundColor="$backgroundSurface"
                  paddingVertical="$2"
                  paddingHorizontal="$4"
                  alignItems="center"
                  gap="$2"
                  borderBottomWidth={1}
                  borderBottomColor="$borderColor"
                >
                  <Text fontSize={14}>👑</Text>
                  <Text fontFamily="$body" fontSize={11} color="$color" flex={1} numberOfLines={2}>
                    {formatUIText("guru says:")} <Text fontFamily="$mono" fontWeight="700" fontSize={11} color="$accentBackground">{topC.playerName} (C{topC.projectedImpact ? `, ~${Math.round(topC.projectedImpact)} pts` : ""})</Text>
                    {topVC && <Text fontFamily="$body" fontSize={11} color="$color"> · <Text fontFamily="$mono" fontWeight="700" fontSize={11} color="$colorCricket">{topVC.playerName} (VC)</Text></Text>}
                  </Text>
                </XStack>
              </Animated.View>
            );
          }
          // Show locked teaser if user doesn't have captain picks access
          if (!canAccess("hasCaptainPicks")) {
            return (
              <Pressable onPress={() => gateFeature("hasCaptainPicks", "pro", "Captain Picks", "AI-recommended captain & vice-captain choices")}>
                <XStack
                  backgroundColor="$backgroundSurface"
                  paddingVertical="$2"
                  paddingHorizontal="$4"
                  alignItems="center"
                  gap="$2"
                  borderBottomWidth={1}
                  borderBottomColor="$borderColor"
                  opacity={0.6}
                >
                  <Text fontSize={14}>👑</Text>
                  <Text fontFamily="$body" fontSize={11} color="$colorMuted" flex={1}>
                    {formatUIText("ai captain & vc recommendations")}
                  </Text>
                  <TierBadge tier="pro" size="sm" />
                </XStack>
              </Pressable>
            );
          }
          return null;
        })()}

        {/* ── Captain Impact Preview ── */}
        {totalProjectedPoints !== null && (
          <XStack paddingHorizontal="$4" paddingVertical="$1" justifyContent="center">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
              {formatUIText("projected total:")} <Text fontFamily="$mono" fontWeight="700" fontSize={12} color="$accentBackground">{totalProjectedPoints.toFixed(1)} pts</Text>
              {(() => {
                // Calculate delta vs Guru's top C/VC pick
                const cpData = captainPicksQuery.data as any;
                if (!cpData?.captainPicks?.length || !projectionsByPlayerId.size) return null;
                const guruC = cpData.captainPicks[0]?.playerName;
                const guruVC = cpData.viceCaptainPicks?.[0]?.playerName;
                // Find guru's picks in our team
                let guruTotal = 0;
                for (const p of selectedPlayers) {
                  const proj = projectionsByPlayerId.get(p.playerId);
                  if (!proj) continue;
                  const nameMatch = p.name.toLowerCase();
                  if (guruC && nameMatch === guruC.toLowerCase()) guruTotal += proj.projectedPoints * 2;
                  else if (guruVC && nameMatch === guruVC.toLowerCase()) guruTotal += proj.projectedPoints * 1.5;
                  else guruTotal += proj.projectedPoints;
                }
                if (guruTotal === 0) return null;
                const delta = totalProjectedPoints - guruTotal;
                if (Math.abs(delta) < 1) return null;
                return (
                  <Text fontFamily="$mono" fontSize={10} color={delta > 0 ? "$colorCricket" : "$error"} marginLeft="$2">
                    ({delta > 0 ? "+" : ""}{delta.toFixed(1)} {formatUIText("vs guru pick")})
                  </Text>
                );
              })()}
            </Text>
          </XStack>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {selectedPlayers.map((player, i) => {
            const isCaptain = captainId === player.playerId; const isVC = viceCaptainId === player.playerId;
            const proj = projectionsByPlayerId.get(player.playerId);
            // Captain confidence indicator from projections
            const captainRank = proj?.captainRank;
            return (
              <Animated.View key={player.playerId} entering={FadeInDown.delay(i * 30).springify()}>
                <Card marginBottom="$1" padding="$3">
                  <XStack alignItems="center">
                    <XStack alignItems="center" gap="$2" flex={1}>
                      <InitialsAvatar
                        name={player.name}
                        playerRole={(({ batsman: "BAT", bowler: "BOWL", all_rounder: "AR", wicket_keeper: "WK" } as Record<string, RoleKey>)[player.role] ?? "BAT")}
                        ovr={Math.round(player.credits * 10)}
                        size={32}
                        imageUrl={player.photoUrl}
                      />
                      <YStack flex={1}>
                        <XStack alignItems="center" gap="$1">
                          <Text {...textStyles.playerName}>{player.name}</Text>
                          {/* Captain suitability indicator */}
                          {captainRank && captainRank <= 3 && (
                            <Text fontFamily="$mono" fontSize={9} fontWeight="700" color="$accentBackground">
                              🔥#{captainRank}
                            </Text>
                          )}
                          {captainRank && captainRank > 3 && captainRank <= 6 && (
                            <Text fontSize={9} lineHeight={11}>⭐</Text>
                          )}
                        </XStack>
                        <XStack alignItems="center" gap="$2" marginTop={2}>
                          <Badge variant="role" size="sm">
                            {formatBadgeText(player.role.replace("_", " "))}
                          </Badge>
                          <Text {...textStyles.secondary}>{player.team}</Text>
                          {proj && (
                            <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                              {proj.projectedPoints.toFixed(0)} pts
                            </Text>
                          )}
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

          {/* Differential captain nudge — if user picks a safe captain, suggest a bold pick */}
          {captainId && differentialNames.size > 0 && (() => {
            const captainPlayer = selectedPlayers.find((p) => p.playerId === captainId);
            if (!captainPlayer) return null;
            const isDifferential = differentialNames.has(captainPlayer.name.toLowerCase());
            if (isDifferential) return null; // Already a bold pick
            const diffPick = (differentialsQuery.data as any)?.picks?.find((d: any) =>
              selectedPlayers.some((p) => p.name.toLowerCase() === d.playerName?.toLowerCase() && p.playerId !== captainId)
            );
            if (!diffPick) return null;
            return (
              <Animated.View entering={FadeIn.duration(400)}>
                <Card padding="$3" marginTop="$2" borderColor="$colorCricket" borderWidth={1}>
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize={14}>💎</Text>
                    <YStack flex={1}>
                      <Text fontFamily="$body" fontSize={11} color="$color">
                        {formatUIText("bold pick:")} <Text fontFamily="$mono" fontWeight="700" fontSize={11} color="$colorCricket">{diffPick.playerName}</Text> {formatUIText("is only")} ~{diffPick.expectedOwnership}% {formatUIText("owned")}
                      </Text>
                      {diffPick.projectedPoints > 0 && (
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted" marginTop={2}>
                          {formatUIText("projected")} {diffPick.projectedPoints} pts · {diffPick.upsideReason}
                        </Text>
                      )}
                    </YStack>
                  </XStack>
                </Card>
              </Animated.View>
            );
          })()}
        </ScrollView>
        <XStack padding="$4" gap="$3">
          <Button variant="secondary" size="lg" flex={1} onPress={() => setStep("pick")}>
            {formatUIText("back")}
          </Button>
          <Button variant="primary" size="lg" flex={2} disabled={!captainId || !viceCaptainId} opacity={!captainId || !viceCaptainId ? 0.4 : 1} onPress={handleGoToReview} testID="review-team-btn">
            {formatUIText("review team")}
          </Button>
        </XStack>

        <Paywall {...paywallProps} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background" testID="team-builder-screen">
      {/* ── Inline Header ── */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <SafeBackButton />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("build team")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      {StepIndicator}
      {AlertBanner}

      {/* Stats Header */}
      <XStack backgroundColor="$backgroundSurface" padding="$4" justifyContent="space-between" alignItems="center">
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

      {/* Progress Bar */}
      <AnnouncementBanner />

      {/* ── Pitch/Weather Context Banner ── */}
      {pitchSummary ? (
        <Pressable onPress={() => setPitchBannerExpanded(!pitchBannerExpanded)}>
          <XStack
            backgroundColor="$backgroundSurface"
            paddingVertical="$2"
            paddingHorizontal="$4"
            alignItems="center"
            gap="$2"
            borderBottomWidth={1}
            borderBottomColor="$borderColor"
          >
            <Text fontSize={14}>{pitchSummary.paceVsSpin === "spin" ? "🌀" : pitchSummary.paceVsSpin === "pace" ? "💨" : "⚖️"}</Text>
            <Text fontFamily="$body" fontSize={11} color="$color" flex={1} numberOfLines={pitchBannerExpanded ? 5 : 1}>
              {pitchSummary.headline}
            </Text>
            {pitchSummary.temperature && (
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{pitchSummary.temperature}</Text>
            )}
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{pitchBannerExpanded ? "▲" : "▼"}</Text>
          </XStack>
          {pitchBannerExpanded && pitchSummary.tips.length > 0 && (
            <YStack backgroundColor="$backgroundSurface" paddingHorizontal="$4" paddingBottom="$2" gap="$1">
              {pitchSummary.tips.map((tip: string, i: number) => (
                <XStack key={i} gap="$2" alignItems="flex-start">
                  <Text fontFamily="$mono" fontSize={10} color="$accentBackground">•</Text>
                  <Text fontFamily="$body" fontSize={11} color="$colorMuted" flex={1}>{tip}</Text>
                </XStack>
              ))}
            </YStack>
          )}
        </Pressable>
      ) : !canAccess("hasPitchWeather") && venue ? (
        <Pressable onPress={() => gateFeature("hasPitchWeather", "pro", "Pitch & Weather", "See pitch conditions and weather impact on your picks")}>
          <XStack
            backgroundColor="$backgroundSurface"
            paddingVertical="$2"
            paddingHorizontal="$4"
            alignItems="center"
            gap="$2"
            borderBottomWidth={1}
            borderBottomColor="$borderColor"
            opacity={0.6}
          >
            <Text fontSize={14}>🌤️</Text>
            <Text fontFamily="$body" fontSize={11} color="$colorMuted" flex={1}>
              {formatUIText("pitch & weather conditions at")} {venue}
            </Text>
            <TierBadge tier="pro" size="sm" />
          </XStack>
        </Pressable>
      ) : null}

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

      <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$4" marginBottom="$1">
        {currentRoleLimit ? (
          <Text fontFamily="$body" fontSize={12} color="$colorMuted">
            {formatUIText(`pick ${currentRoleLimit.min}-${currentRoleLimit.max} ${currentRoleLimit.label} players`)}
          </Text>
        ) : <Text />}
        <XStack gap="$1">
          <FilterPill active={sortBy === "credits"} onPress={() => { setSortBy("credits"); setSmartFilter("all"); }}>
            <Text fontFamily="$mono" fontSize={9} fontWeight="700" color={sortBy === "credits" ? "$background" : "$colorMuted"}>
              {formatBadgeText("credits")}
            </Text>
          </FilterPill>
          {projectionsByPlayerId.size > 0 ? (
            <FilterPill active={sortBy === "projected" && smartFilter === "all"} onPress={() => { setSortBy("projected"); setSmartFilter("all"); }}>
              <Text fontFamily="$mono" fontSize={9} fontWeight="700" color={sortBy === "projected" && smartFilter === "all" ? "$background" : "$colorMuted"}>
                {formatBadgeText("projected")}
              </Text>
            </FilterPill>
          ) : !canAccess("hasProjectedPoints") ? (
            <Pressable onPress={() => gateFeature("hasProjectedPoints", "pro", "Projected Points", "AI-estimated fantasy points for each player")}>
              <XStack paddingHorizontal={10} paddingVertical={6} borderRadius={14} borderWidth={1} borderColor="$borderColor" backgroundColor="$backgroundSurface" alignItems="center" gap={4} opacity={0.5}>
                <Text fontFamily="$mono" fontSize={9} fontWeight="700" color="$colorMuted">{formatBadgeText("projected")}</Text>
                <TierBadge tier="pro" size="sm" />
              </XStack>
            </Pressable>
          ) : null}
        </XStack>
      </XStack>

      {/* ── Smart Picks Filter Strip — shows after 3+ players selected ── */}
      {selectedPlayers.length >= 3 && projectionsByPlayerId.size > 0 && (
        <XStack paddingHorizontal="$4" paddingBottom="$2" gap="$2" flexWrap="wrap">
          <Pressable onPress={() => { setSmartFilter("all"); setSortBy("projected"); }}>
            <XStack paddingHorizontal={10} paddingVertical={5} borderRadius={14} borderWidth={1} borderColor={smartFilter === "all" ? "$color" : "$borderColor"} backgroundColor={smartFilter === "all" ? "$color" : "$backgroundSurface"} alignItems="center" gap={4}>
              <Text fontSize={10}>🔮</Text>
              <Text fontFamily="$mono" fontSize={9} fontWeight="700" color={smartFilter === "all" ? "$background" : "$colorMuted"}>{formatBadgeText("ai top")}</Text>
            </XStack>
          </Pressable>
          {differentialNames.size > 0 ? (
            <Pressable onPress={() => setSmartFilter("differentials")}>
              <XStack paddingHorizontal={10} paddingVertical={5} borderRadius={14} borderWidth={1} borderColor={smartFilter === "differentials" ? "$color" : "$borderColor"} backgroundColor={smartFilter === "differentials" ? "$color" : "$backgroundSurface"} alignItems="center" gap={4}>
                <Text fontSize={10}>💎</Text>
                <Text fontFamily="$mono" fontSize={9} fontWeight="700" color={smartFilter === "differentials" ? "$background" : "$colorMuted"}>{formatBadgeText("diffs")}</Text>
              </XStack>
            </Pressable>
          ) : !canAccess("hasDifferentials") ? (
            <Pressable onPress={() => gateFeature("hasDifferentials", "pro", "Differentials", "Low-ownership high-upside picks")}>
              <XStack paddingHorizontal={10} paddingVertical={5} borderRadius={14} borderWidth={1} borderColor="$borderColor" backgroundColor="$backgroundSurface" alignItems="center" gap={4} opacity={0.5}>
                <Text fontSize={10}>💎</Text>
                <Text fontFamily="$mono" fontSize={9} fontWeight="700" color="$colorMuted">{formatBadgeText("diffs")}</Text>
                <TierBadge tier="pro" size="sm" />
              </XStack>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setSmartFilter("value")}>
            <XStack paddingHorizontal={10} paddingVertical={5} borderRadius={14} borderWidth={1} borderColor={smartFilter === "value" ? "$color" : "$borderColor"} backgroundColor={smartFilter === "value" ? "$color" : "$backgroundSurface"} alignItems="center" gap={4}>
              <Text fontSize={10}>📈</Text>
              <Text fontFamily="$mono" fontSize={9} fontWeight="700" color={smartFilter === "value" ? "$background" : "$colorMuted"}>{formatBadgeText("value")}</Text>
            </XStack>
          </Pressable>
          <Pressable onPress={() => setSmartFilter("form")}>
            <XStack paddingHorizontal={10} paddingVertical={5} borderRadius={14} borderWidth={1} borderColor={smartFilter === "form" ? "$color" : "$borderColor"} backgroundColor={smartFilter === "form" ? "$color" : "$backgroundSurface"} alignItems="center" gap={4}>
              <Text fontSize={10}>🔥</Text>
              <Text fontFamily="$mono" fontSize={9} fontWeight="700" color={smartFilter === "form" ? "$background" : "$colorMuted"}>{formatBadgeText("form")}</Text>
            </XStack>
          </Pressable>
        </XStack>
      )}

      {/* Player List */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {currentRolePlayers.length > 0 ? currentRolePlayers.map((player, i) => {
          const isSelected = selectedIds.has(player.id);
          const isDisabled = !isSelected && (selectedPlayers.length >= TEAM_SIZE || player.credits > creditsRemaining);
          const proj = projectionsByPlayerId.get(player.id);
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
                    playerRole={(({ batsman: "BAT", bowler: "BOWL", all_rounder: "AR", wicket_keeper: "WK" } as Record<string, RoleKey>)[player.role] ?? "BAT")}
                    ovr={Math.round(player.credits * 10)}
                    size={32}
                    imageUrl={player.photoUrl}
                  />
                  <YStack flex={1} marginLeft="$2">
                    <XStack alignItems="center" gap="$1" flexWrap="wrap">
                      <Text {...textStyles.playerName}>{player.name}</Text>
                      {proj && proj.captainRank <= 3 && (
                        <Text fontSize={10} lineHeight={12}>👑</Text>
                      )}
                      {/* Playing XI status badge */}
                      {(() => {
                        if (!canAccess("hasPlayingXI")) return null;
                        const xiStatus = playingXIStatus.get(player.name.toLowerCase());
                        if (xiStatus === "likely") return <Badge variant="live" size="sm"><Text fontFamily="$mono" fontSize={7} fontWeight="700" color="white">{formatBadgeText("XI")}</Text></Badge>;
                        if (xiStatus === "bench") return <Badge variant="warning" size="sm"><Text fontFamily="$mono" fontSize={7} fontWeight="700">{formatBadgeText("BENCH")}</Text></Badge>;
                        return null;
                      })()}
                    </XStack>
                    <XStack alignItems="center" gap="$1" marginTop={2}>
                      <Text fontFamily="$body" fontSize={12} color="$colorMuted">
                        {player.team}{overseasRule?.enabled && player.nationality && player.nationality !== overseasRule.hostCountry ? ` · ${formatUIText("overseas")}` : ""}
                      </Text>
                      {/* Differential indicator */}
                      {differentialNames.has(player.name.toLowerCase()) && (
                        <Text fontSize={9} lineHeight={11} color="$colorCricket" fontFamily="$mono" fontWeight="600">💎</Text>
                      )}
                    </XStack>
                    {player.formNote && (
                      <Text fontFamily="$body" fontSize={9} color="$accentBackground" opacity={0.6} marginTop={2} numberOfLines={2}>
                        {player.formNote}
                      </Text>
                    )}
                  </YStack>
                  {sortBy === "projected" && proj ? (
                    <>
                      <YStack alignItems="center" marginRight="$2">
                        <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$accentBackground">
                          {proj.projectedPoints.toFixed(1)}
                        </Text>
                        <Text fontFamily="$mono" fontSize={7} color="$colorMuted">
                          {(proj.projectedPoints / (player.credits || 1)).toFixed(1)} {formatUIText("val")}
                        </Text>
                      </YStack>
                      <YStack alignItems="center" marginRight="$3">
                        <Text fontFamily="$mono" fontWeight="500" fontSize={13} color="$colorMuted">
                          {player.credits.toFixed(1)}
                        </Text>
                        <Text {...textStyles.hint}>{formatUIText("credits")}</Text>
                      </YStack>
                    </>
                  ) : (
                    <>
                      {proj && (
                        <YStack alignItems="center" marginRight="$2">
                          <Text fontFamily="$mono" fontWeight="500" fontSize={13} color="$colorMuted">
                            {proj.projectedPoints.toFixed(1)}
                          </Text>
                          <Text fontFamily="$mono" fontSize={7} color="$colorMuted">
                            {formatUIText("pts")}
                          </Text>
                        </YStack>
                      )}
                      <YStack alignItems="center" marginRight="$3">
                        <Text fontFamily="$mono" fontWeight="700" fontSize={16} color={isSelected ? "$accentBackground" : "$color"}>
                          {player.credits.toFixed(1)}
                        </Text>
                        <Text {...textStyles.hint}>{formatUIText("credits")}</Text>
                      </YStack>
                    </>
                  )}
                  <YStack width={24} height={24} borderRadius={12} borderWidth={2} borderColor={isSelected ? "$accentBackground" : "$borderColor"} backgroundColor={isSelected ? "$accentBackground" : "transparent"} alignItems="center" justifyContent="center">
                    {isSelected && <Text color="$accentColor" fontSize={14} fontWeight="700">✓</Text>}
                  </YStack>
                </XStack>
              </Card>
            </Animated.View>
          );
        }) : (
          <Card padding="$8" alignItems="center">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text {...textStyles.hint} textAlign="center" lineHeight={20}>
              {formatUIText("players for this role will appear once seeded")}
            </Text>
          </Card>
        )}
      </ScrollView>

      {/* ── Team Solver escape hatch — shows after 60s or 5+ toggles ── */}
      {selectedPlayers.length < TEAM_SIZE && selectedPlayers.length >= 1 && matchId && canAccess("hasTeamSolver") && (
        <Pressable
          onPress={() => {
            useNavigationStore.getState().setMatchContext({
              ...(navCtx || { matchId: matchId! }),
              matchId: matchId!,
              teamA, teamB, format, venue, tournament,
            });
            router.push(`/match/${matchId}/solver` as any);
          }}
          testID="solver-escape-btn"
        >
          <XStack paddingHorizontal="$4" paddingVertical="$2" alignItems="center" justifyContent="center" gap="$2">
            <Text fontSize={12}>🤖</Text>
            <Text fontFamily="$mono" fontSize={11} color="$accentBackground" fontWeight="600">
              {formatUIText("stuck? let ai build your team")}
            </Text>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">→</Text>
          </XStack>
        </Pressable>
      )}
      {!canAccess("hasTeamSolver") && selectedPlayers.length < TEAM_SIZE && selectedPlayers.length >= 3 && (
        <Pressable onPress={() => gateFeature("hasTeamSolver", "elite", "Team Solver", "Let AI auto-pick your optimal 11 within budget")}>
          <XStack paddingHorizontal="$4" paddingVertical="$2" alignItems="center" justifyContent="center" gap="$2">
            <Text fontSize={12}>🤖</Text>
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted" fontWeight="600">
              {formatUIText("let ai build your team")}
            </Text>
            <TierBadge tier="elite" size="sm" />
          </XStack>
        </Pressable>
      )}

      {/* Continue Button */}
      <YStack padding="$4" paddingTop="$2">
        <Button variant="primary" size="lg" disabled={selectedPlayers.length < TEAM_SIZE} opacity={selectedPlayers.length < TEAM_SIZE ? 0.4 : 1} onPress={handleContinue} testID="team-continue-btn">
          {selectedPlayers.length < TEAM_SIZE
            ? formatUIText(`select ${TEAM_SIZE - selectedPlayers.length} more players`)
            : formatUIText("select captain & vc")}
        </Button>
      </YStack>

      {/* ── AI Insights FAB (draggable) ── */}
      {matchId && step === "pick" && (
        Platform.OS === "web" ? (
          <div
            data-testid="ai-insights-fab"
            onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => {
              webDragRef.current = { startX: e.clientX - fabPos.x, startY: e.clientY - fabPos.y, dragging: true, moved: false };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e: React.PointerEvent<HTMLDivElement>) => {
              if (!webDragRef.current.dragging) return;
              const dx = e.clientX - webDragRef.current.startX;
              const dy = e.clientY - webDragRef.current.startY;
              if (!webDragRef.current.moved && (Math.abs(dx - fabPos.x) > 4 || Math.abs(dy - fabPos.y) > 4)) {
                webDragRef.current.moved = true;
              }
              setFabPos(clampFab(dx, dy));
            }}
            onPointerUp={() => {
              const wasDrag = webDragRef.current.moved;
              webDragRef.current.dragging = false;
              if (!wasDrag) setShowInsights(true);
            }}
            style={{
              position: "absolute",
              bottom: 100 - fabPos.y,
              right: 20 - fabPos.x,
              borderRadius: 24,
              width: 48,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "grab",
              backgroundColor: "rgba(34,197,94,0.10)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1.5px solid rgba(34,197,94,0.45)",
              zIndex: 50,
              userSelect: "none" as const,
              touchAction: "none",
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1, pointerEvents: "none" }}>✨</span>
          </div>
        ) : (
          <View
            {...fabPanResponder.panHandlers}
            testID="ai-insights-fab"
            style={{
              position: "absolute",
              bottom: 100 - fabPos.y,
              right: 20 - fabPos.x,
              borderRadius: 24,
              width: 48,
              height: 48,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(34,197,94,0.10)",
              borderWidth: 1.5,
              borderColor: "rgba(34,197,94,0.45)",
              zIndex: 50,
            }}
          >
            <Text fontSize={22}>✨</Text>
          </View>
        )
      )}

      {/* ── AI Insights Sheet ── */}
      {matchId && teamA && teamB && (
        <AIInsightsSheet
          visible={showInsights}
          onClose={() => setShowInsights(false)}
          matchId={matchId}
          teamA={teamA}
          teamB={teamB}
          format={format || "T20"}
          venue={venue}
          tournament={tournament}
          players={insightsPlayerList}
          initialTab={step === "captain" ? "captain" : "overview"}
          onNavigate={(route) => {
            useNavigationStore.getState().setMatchContext({
              ...(navCtx || { matchId: matchId! }),
              matchId: matchId!,
              teamA, teamB, format, venue, tournament,
            });
            if (route === "compare") {
              router.push(`/match/${matchId}/compare` as any);
            } else if (route === "solver") {
              router.push(`/match/${matchId}/solver` as any);
            }
          }}
        />
      )}

      <Paywall {...paywallProps} />
    </YStack>
  );
}
