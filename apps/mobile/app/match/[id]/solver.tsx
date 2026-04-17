import { SafeBackButton } from "../../../components/SafeBackButton";
import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../../components/SportText";
import {
  Card,
  Badge,
  Button,
  BackButton,
  InitialsAvatar,
  EggLoadingSpinner,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
} from "@draftplay/ui";
import { trpc } from "../../../lib/trpc";

import { useNavigationStore, type SolverPick } from "../../../lib/navigation-store";
import { HeaderControls } from "../../../components/HeaderControls";

const ROLE_SHORT: Record<string, string> = {
  wicket_keeper: "wk",
  all_rounder: "ar",
  batsman: "bat",
  bowler: "bowl",
};

type PlayStyle = "balanced" | "batting_heavy" | "bowling_heavy";
type RiskLevel = "safe" | "moderate" | "risky";
type BudgetStrategy = "stars" | "value" | "mixed";
type CaptainStyle = "safe_captain" | "differential";

const PLAY_STYLES: { value: PlayStyle; label: string; icon: string; desc: string }[] = [
  { value: "balanced", label: "balanced", icon: "⚖️", desc: "equal weight to all roles" },
  { value: "batting_heavy", label: "batting heavy", icon: "🏏", desc: "more batsmen & high scorers" },
  { value: "bowling_heavy", label: "bowling heavy", icon: "🎳", desc: "more bowlers & all-rounders" },
];

const RISK_LEVELS: { value: RiskLevel; label: string; icon: string; desc: string }[] = [
  { value: "safe", label: "safe", icon: "🛡️", desc: "consistent, reliable picks" },
  { value: "moderate", label: "moderate", icon: "📊", desc: "mix of safe & high-ceiling" },
  { value: "risky", label: "risky", icon: "🎲", desc: "high risk, high reward picks" },
];

const BUDGET_STRATEGIES: { value: BudgetStrategy; label: string; icon: string; desc: string }[] = [
  { value: "stars", label: "star power", icon: "⭐", desc: "spend big on premium players" },
  { value: "mixed", label: "mixed", icon: "🔀", desc: "balance stars & budget picks" },
  { value: "value", label: "value picks", icon: "💎", desc: "find hidden gems on a budget" },
];

const CAPTAIN_STYLES: { value: CaptainStyle; label: string; icon: string; desc: string }[] = [
  { value: "safe_captain", label: "safe captain", icon: "👑", desc: "obvious best pick as captain" },
  { value: "differential", label: "differential", icon: "🎯", desc: "unexpected captain for edge" },
];

export default function TeamSolverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = decodeURIComponent(id ?? "");
  const router = useRouter();
  const theme = useTamaguiTheme();

  const insets = useSafeAreaInsets();
  const matchCtx = useNavigationStore((s) => s.matchContext);
  const setMatchContext = useNavigationStore((s) => s.setMatchContext);

  const teamA = matchCtx?.teamA ?? "Team A";
  const teamB = matchCtx?.teamB ?? "Team B";
  const format = matchCtx?.format ?? "T20";
  const venue = matchCtx?.venue ?? null;
  const tournament = matchCtx?.tournament ?? "unknown";

  // Preferences state
  const [playStyle, setPlayStyle] = useState<PlayStyle>("balanced");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("moderate");
  const [budgetStrategy, setBudgetStrategy] = useState<BudgetStrategy>("mixed");
  const [captainStyle, setCaptainStyle] = useState<CaptainStyle>("safe_captain");
  const [teamBias, setTeamBias] = useState<string | undefined>(undefined);
  const [solved, setSolved] = useState(false);

  // Fetch players
  const playersQuery = trpc.player.getByMatch.useQuery(
    { matchId },
    { enabled: !!matchId, staleTime: 60 * 60_000 },
  );

  // Extract overseas rule from player query response
  const overseasRule = useMemo(() => {
    const rule = (playersQuery.data as any)?.overseasRule;
    if (!rule?.enabled) return undefined;
    return { enabled: true as const, hostCountry: rule.hostCountry as string, maxOverseas: (rule.maxOverseas as number) ?? 4 };
  }, [playersQuery.data]);

  const playerList = useMemo(() => {
    const list = (playersQuery.data as any)?.players ?? playersQuery.data ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((ps: any) => {
      const p = ps.player ?? ps;
      if (!p?.id) return null;
      const credits = p.credits ?? (p.stats?.credits ? Number(p.stats.credits) : 8);
      return { id: p.id, name: p.name, role: p.role ?? "batsman", team: p.team, credits, nationality: p.nationality ?? "", photoUrl: p.photoUrl ?? null };
    }).filter(Boolean) as { id: string; name: string; role: string; team: string; credits: number; nationality: string; photoUrl: string | null }[];
  }, [playersQuery.data]);

  // Get projections for solver input
  const projectionsQuery = trpc.analytics.getPlayerProjections.useQuery(
    { matchId, teamA, teamB, format, venue, tournament, players: [] },
    { enabled: !!matchId && !!teamA && !!teamB, staleTime: 60 * 60_000 },
  );

  // Build solver input
  const solverInput = useMemo(() => {
    if (!playerList.length) return [];
    const projections = projectionsQuery.data?.players ?? [];
    const projMap = new Map(projections.map((p: any) => [p.playerName?.toLowerCase(), p.projectedPoints ?? 0]));

    return playerList.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      role: p.role,
      credits: p.credits,
      projectedPoints: projMap.get(p.name.toLowerCase()) ?? Math.random() * 30 + 10,
      nationality: p.nationality,
    }));
  }, [playerList, projectionsQuery.data]);

  // Solve query — includes preferences + overseas rule for personalized results
  const solverQuery = trpc.analytics.solveTeam.useQuery(
    {
      matchId,
      teamA,
      teamB,
      players: solverInput,
      preferences: { playStyle, riskLevel, budgetStrategy, captainStyle, teamBias },
      overseasRule,
    },
    { enabled: solved && solverInput.length >= 11, staleTime: 30 * 60_000 },
  );

  const handleSolve = () => setSolved(true);

  const handleReset = () => {
    setSolved(false);
  };

  return (
    <ScrollView
      testID="solver-screen"
      style={{ flex: 1, backgroundColor: theme.background?.val }}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
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
            {formatUIText("team solver")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      <YStack paddingHorizontal="$4">
        {/* Match context */}
        <Card padding="$4" marginBottom="$4">
          <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
            {formatTeamName(teamA)} {formatUIText("vs")} {formatTeamName(teamB)}
          </Text>
          <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginTop={2}>
            {formatUIText("auto-pick the best 11 using ai projections")}
          </Text>
        </Card>

        {/* Preferences — shown before solving */}
        {!solved ? (
          <Animated.View entering={FadeInDown.springify()}>
            {/* Play Style */}
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("play style")}
            </Text>
            <XStack gap="$2" marginBottom="$4" flexWrap="wrap">
              {PLAY_STYLES.map((style) => (
                <Card
                  key={style.value}
                  flex={1}
                  minWidth={95}
                  pressable
                  padding="$3"
                  borderWidth={2}
                  borderColor={playStyle === style.value ? "$accentBackground" : "$borderColor"}
                  backgroundColor={playStyle === style.value ? "$accentBackground" : "transparent"}
                  opacity={playStyle === style.value ? 0.95 : 1}
                  onPress={() => setPlayStyle(style.value)}
                >
                  <YStack alignItems="center" gap={4}>
                    <Text fontSize={18}>{style.icon}</Text>
                    <Text
                      fontFamily="$mono"
                      fontWeight="700"
                      fontSize={10}
                      color={playStyle === style.value ? "white" : "$color"}
                      textAlign="center"
                    >
                      {formatUIText(style.label)}
                    </Text>
                    <Text
                      fontFamily="$mono"
                      fontSize={8}
                      color={playStyle === style.value ? "rgba(255,255,255,0.7)" : "$colorMuted"}
                      textAlign="center"
                      numberOfLines={2}
                    >
                      {style.desc}
                    </Text>
                  </YStack>
                </Card>
              ))}
            </XStack>

            {/* Risk Level */}
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("risk level")}
            </Text>
            <XStack gap="$2" marginBottom="$4" flexWrap="wrap">
              {RISK_LEVELS.map((level) => (
                <Card
                  key={level.value}
                  flex={1}
                  minWidth={95}
                  pressable
                  padding="$3"
                  borderWidth={2}
                  borderColor={riskLevel === level.value ? "$accentBackground" : "$borderColor"}
                  backgroundColor={riskLevel === level.value ? "$accentBackground" : "transparent"}
                  opacity={riskLevel === level.value ? 0.95 : 1}
                  onPress={() => setRiskLevel(level.value)}
                >
                  <YStack alignItems="center" gap={4}>
                    <Text fontSize={18}>{level.icon}</Text>
                    <Text
                      fontFamily="$mono"
                      fontWeight="700"
                      fontSize={10}
                      color={riskLevel === level.value ? "white" : "$color"}
                      textAlign="center"
                    >
                      {formatUIText(level.label)}
                    </Text>
                    <Text
                      fontFamily="$mono"
                      fontSize={8}
                      color={riskLevel === level.value ? "rgba(255,255,255,0.7)" : "$colorMuted"}
                      textAlign="center"
                      numberOfLines={2}
                    >
                      {level.desc}
                    </Text>
                  </YStack>
                </Card>
              ))}
            </XStack>

            {/* Budget Strategy */}
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("budget strategy")}
            </Text>
            <XStack gap="$2" marginBottom="$4" flexWrap="wrap">
              {BUDGET_STRATEGIES.map((strat) => (
                <Card
                  key={strat.value}
                  flex={1}
                  minWidth={95}
                  pressable
                  padding="$3"
                  borderWidth={2}
                  borderColor={budgetStrategy === strat.value ? "$accentBackground" : "$borderColor"}
                  backgroundColor={budgetStrategy === strat.value ? "$accentBackground" : "transparent"}
                  opacity={budgetStrategy === strat.value ? 0.95 : 1}
                  onPress={() => setBudgetStrategy(strat.value)}
                >
                  <YStack alignItems="center" gap={4}>
                    <Text fontSize={18}>{strat.icon}</Text>
                    <Text
                      fontFamily="$mono"
                      fontWeight="700"
                      fontSize={10}
                      color={budgetStrategy === strat.value ? "white" : "$color"}
                      textAlign="center"
                    >
                      {formatUIText(strat.label)}
                    </Text>
                    <Text
                      fontFamily="$mono"
                      fontSize={8}
                      color={budgetStrategy === strat.value ? "rgba(255,255,255,0.7)" : "$colorMuted"}
                      textAlign="center"
                      numberOfLines={2}
                    >
                      {strat.desc}
                    </Text>
                  </YStack>
                </Card>
              ))}
            </XStack>

            {/* Captain Style */}
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("captain pick")}
            </Text>
            <XStack gap="$2" marginBottom="$4">
              {CAPTAIN_STYLES.map((cs) => (
                <Card
                  key={cs.value}
                  flex={1}
                  pressable
                  padding="$3"
                  borderWidth={2}
                  borderColor={captainStyle === cs.value ? "$accentBackground" : "$borderColor"}
                  backgroundColor={captainStyle === cs.value ? "$accentBackground" : "transparent"}
                  opacity={captainStyle === cs.value ? 0.95 : 1}
                  onPress={() => setCaptainStyle(cs.value)}
                >
                  <YStack alignItems="center" gap={4}>
                    <Text fontSize={18}>{cs.icon}</Text>
                    <Text
                      fontFamily="$mono"
                      fontWeight="700"
                      fontSize={10}
                      color={captainStyle === cs.value ? "white" : "$color"}
                      textAlign="center"
                    >
                      {formatUIText(cs.label)}
                    </Text>
                    <Text
                      fontFamily="$mono"
                      fontSize={8}
                      color={captainStyle === cs.value ? "rgba(255,255,255,0.7)" : "$colorMuted"}
                      textAlign="center"
                      numberOfLines={2}
                    >
                      {cs.desc}
                    </Text>
                  </YStack>
                </Card>
              ))}
            </XStack>

            {/* Team Bias */}
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("team preference")}
            </Text>
            <XStack gap="$2" marginBottom="$4">
              <Card
                flex={1}
                pressable
                padding="$3"
                borderWidth={2}
                borderColor={!teamBias ? "$accentBackground" : "$borderColor"}
                backgroundColor={!teamBias ? "$accentBackground" : "transparent"}
                onPress={() => setTeamBias(undefined)}
              >
                <Text
                  fontFamily="$mono"
                  fontWeight="700"
                  fontSize={10}
                  color={!teamBias ? "white" : "$color"}
                  textAlign="center"
                >
                  {formatUIText("no preference")}
                </Text>
              </Card>
              <Card
                flex={1}
                pressable
                padding="$3"
                borderWidth={2}
                borderColor={teamBias === teamA ? "$accentBackground" : "$borderColor"}
                backgroundColor={teamBias === teamA ? "$accentBackground" : "transparent"}
                onPress={() => setTeamBias(teamA)}
              >
                <Text
                  fontFamily="$mono"
                  fontWeight="700"
                  fontSize={10}
                  color={teamBias === teamA ? "white" : "$color"}
                  textAlign="center"
                  numberOfLines={1}
                >
                  {formatTeamName(teamA)}
                </Text>
              </Card>
              <Card
                flex={1}
                pressable
                padding="$3"
                borderWidth={2}
                borderColor={teamBias === teamB ? "$accentBackground" : "$borderColor"}
                backgroundColor={teamBias === teamB ? "$accentBackground" : "transparent"}
                onPress={() => setTeamBias(teamB)}
              >
                <Text
                  fontFamily="$mono"
                  fontWeight="700"
                  fontSize={10}
                  color={teamBias === teamB ? "white" : "$color"}
                  textAlign="center"
                  numberOfLines={1}
                >
                  {formatTeamName(teamB)}
                </Text>
              </Card>
            </XStack>

            {/* Status badges */}
            <XStack gap="$2" marginBottom="$4" flexWrap="wrap">
              <Badge variant="default" size="sm">{formatBadgeText(`${playerList.length} players`)}</Badge>
              <Badge variant="default" size="sm">{formatBadgeText("100 credit budget")}</Badge>
              {overseasRule?.enabled && (
                <Badge variant="default" size="sm">{formatBadgeText(`max ${overseasRule.maxOverseas} overseas`)}</Badge>
              )}
              <Badge variant={projectionsQuery.data ? "role" : "default"} size="sm">
                {projectionsQuery.data ? formatBadgeText("projections ready") : formatBadgeText("loading projections")}
              </Badge>
            </XStack>

            {/* Solve button */}
            <Button
              variant="primary"
              size="lg"
              onPress={handleSolve}
              disabled={solverInput.length < 11}
            >
              {solverInput.length < 11
                ? formatUIText("loading players...")
                : formatUIText("solve my team")}
            </Button>
          </Animated.View>
        ) : solverQuery.isLoading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <EggLoadingSpinner size={48} message={formatUIText("building your personalized team")} />
          </YStack>
        ) : solverQuery.data ? (
          <Animated.View entering={FadeInDown.springify()}>
            {/* Preferences summary */}
            <XStack gap="$1" marginBottom="$3" flexWrap="wrap">
              <Badge variant="default" size="sm">{formatBadgeText(playStyle.replace("_", " "))}</Badge>
              <Badge variant="default" size="sm">{formatBadgeText(riskLevel)}</Badge>
              <Badge variant="default" size="sm">{formatBadgeText(budgetStrategy === "mixed" ? "mixed budget" : budgetStrategy)}</Badge>
              <Badge variant="default" size="sm">{formatBadgeText(captainStyle === "safe_captain" ? "safe C" : "diff C")}</Badge>
              {teamBias && <Badge variant="role" size="sm">{formatBadgeText(`favoring ${formatTeamName(teamBias)}`)}</Badge>}
              {overseasRule?.enabled && (() => {
                const osCount = solverQuery.data!.players.filter((p: any) =>
                  p.nationality && p.nationality.toLowerCase() !== overseasRule.hostCountry.toLowerCase()
                ).length;
                return <Badge variant={osCount <= overseasRule.maxOverseas ? "default" : "live"} size="sm">{formatBadgeText(`${osCount}/${overseasRule.maxOverseas} overseas`)}</Badge>;
              })()}
            </XStack>

            {/* Summary */}
            <Card padding="$4" marginBottom="$3" borderWidth={2} borderColor="$accentBackground">
              <XStack justifyContent="space-around" alignItems="center">
                <YStack alignItems="center" gap={2}>
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
                    {formatBadgeText("projected")}
                  </Text>
                  <Text fontFamily="$mono" fontWeight="800" fontSize={22} color="$accentBackground">
                    {solverQuery.data.totalProjectedPoints.toFixed(1)}
                  </Text>
                </YStack>
                <YStack width={1} height={32} backgroundColor="$borderColor" />
                <YStack alignItems="center" gap={2}>
                  <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
                    {formatBadgeText("credits")}
                  </Text>
                  <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">
                    {solverQuery.data.totalCredits.toFixed(1)}/100
                  </Text>
                </YStack>
              </XStack>
              <XStack marginTop="$3" justifyContent="center" gap="$2">
                <Badge variant="live" size="sm">C: {solverQuery.data.captain}</Badge>
                <Badge variant="role" size="sm">VC: {solverQuery.data.viceCaptain}</Badge>
              </XStack>
            </Card>

            {/* Solved player list */}
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("your optimal xi")}
            </Text>
            {solverQuery.data.players.map((p: any, i: number) => (
              <Animated.View key={p.id || i} entering={FadeInDown.delay(i * 30).springify()}>
                <Card marginBottom="$1" padding="$3">
                  <XStack alignItems="center">
                    <InitialsAvatar name={p.name} playerRole={p.role?.toUpperCase()} ovr={0} size={28} hideBadge imageUrl={playerList.find((pl) => pl.name === p.name)?.photoUrl} />
                    <YStack flex={1} marginLeft="$2">
                      <XStack alignItems="center" gap="$1">
                        <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>
                          {p.name}
                        </Text>
                        {p.isCaptain && <Badge variant="live" size="sm">C</Badge>}
                        {p.isViceCaptain && <Badge variant="role" size="sm">VC</Badge>}
                      </XStack>
                      <XStack gap="$1" alignItems="center">
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{p.team}</Text>
                        <Badge variant="default" size="sm">{formatBadgeText(ROLE_SHORT[p.role] ?? p.role)}</Badge>
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{p.credits} credits</Text>
                        {overseasRule?.enabled && p.nationality && p.nationality.toLowerCase() !== overseasRule.hostCountry.toLowerCase() && (
                          <Badge variant="role" size="sm">{formatBadgeText("os")}</Badge>
                        )}
                      </XStack>
                    </YStack>
                    <YStack alignItems="flex-end">
                      <Text fontFamily="$mono" fontWeight="700" fontSize={13} color="$accentBackground">
                        {p.contribution.toFixed(1)}
                      </Text>
                      <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                        {p.projectedPoints.toFixed(1)} {p.isCaptain ? "×2" : p.isViceCaptain ? "×1.5" : "pts"}
                      </Text>
                    </YStack>
                  </XStack>
                </Card>
              </Animated.View>
            ))}

            {/* Action buttons */}
            <XStack gap="$2" marginTop="$4">
              <Button
                variant="secondary"
                size="lg"
                flex={1}
                onPress={handleReset}
              >
                {formatUIText("try different")}
              </Button>
              <Button
                variant="primary"
                size="lg"
                flex={1}
                onPress={() => {
                  const picks: SolverPick[] = solverQuery.data!.players.map((p: any) => ({
                    playerId: p.id,
                    name: p.name,
                    team: p.team,
                    role: p.role,
                    credits: p.credits,
                    isCaptain: !!p.isCaptain,
                    isViceCaptain: !!p.isViceCaptain,
                  }));
                  // Preserve contestId / editTeamId / contestType from the
                  // inbound context — the user may have arrived here via the
                  // "join contest" flow, in which case we don't want to drop
                  // them back on the contest picker after they pick this XI.
                  setMatchContext({
                    matchId,
                    teamA,
                    teamB,
                    format,
                    venue: venue || undefined,
                    tournament: tournament || undefined,
                    solverPicks: picks,
                    ...(matchCtx?.contestId ? { contestId: matchCtx.contestId } : {}),
                    ...(matchCtx?.editTeamId ? { editTeamId: matchCtx.editTeamId } : {}),
                  });
                  router.push("/team/create");
                }}
              >
                {formatUIText("use this team")}
              </Button>
            </XStack>
          </Animated.View>
        ) : (
          <Card padding="$4">
            <Text {...textStyles.hint} textAlign="center">
              {formatUIText("could not find an optimal team. try again later.")}
            </Text>
            <Button variant="secondary" size="sm" marginTop="$3" onPress={handleReset}>
              {formatUIText("retry")}
            </Button>
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
