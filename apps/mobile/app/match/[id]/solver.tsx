import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo, useCallback } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  BackButton,
  InitialsAvatar,
  ModeToggle,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
} from "@draftplay/ui";
import { trpc } from "../../../lib/trpc";
import { useTheme } from "../../../providers/ThemeProvider";
import { useNavigationStore } from "../../../lib/navigation-store";

export default function TeamSolverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = decodeURIComponent(id ?? "");
  const router = useRouter();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const insets = useSafeAreaInsets();
  const matchCtx = useNavigationStore((s) => s.matchContext);

  const teamA = matchCtx?.teamA ?? "Team A";
  const teamB = matchCtx?.teamB ?? "Team B";
  const format = matchCtx?.format ?? "T20";
  const venue = matchCtx?.venue ?? null;
  const tournament = matchCtx?.tournament ?? "unknown";

  const [solved, setSolved] = useState(false);

  // Fetch players
  const playersQuery = trpc.player.getByMatch.useQuery(
    { matchId },
    { enabled: !!matchId, staleTime: 60 * 60_000 },
  );

  const playerList = useMemo(() => {
    const list = (playersQuery.data as any)?.players ?? playersQuery.data ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((ps: any) => {
      const p = ps.player ?? ps;
      if (!p?.id) return null;
      const credits = p.credits ?? (p.stats?.credits ? Number(p.stats.credits) : 8);
      return { id: p.id, name: p.name, role: p.role ?? "batsman", team: p.team, credits };
    }).filter(Boolean) as { id: string; name: string; role: string; team: string; credits: number }[];
  }, [playersQuery.data]);

  // Get projections for solver input
  const projectionsQuery = trpc.analytics.getPlayerProjections.useQuery(
    { matchId, teamA, teamB, format, venue, tournament, players: playerList.map((p) => ({ id: p.id, name: p.name, role: p.role, team: p.team })) },
    { enabled: playerList.length > 0 && !!matchId, staleTime: 60 * 60_000 },
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
      projectedPoints: projMap.get(p.name.toLowerCase()) ?? Math.random() * 30 + 10, // fallback
    }));
  }, [playerList, projectionsQuery.data]);

  // Solve query
  const solverQuery = trpc.analytics.solveTeam.useQuery(
    { matchId, teamA, teamB, players: solverInput },
    { enabled: solved && solverInput.length >= 11, staleTime: 30 * 60_000 },
  );

  return (
    <ScrollView
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
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("team solver")}
          </Text>
        </XStack>
        <ModeToggle mode={mode} onToggle={toggleMode} />
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

        {/* Status info */}
        <Card padding="$4" marginBottom="$4" borderWidth={1} borderColor="$accentBackground">
          <YStack gap="$2">
            <XStack alignItems="center" gap="$2">
              <Text fontSize={16}>🤖</Text>
              <Text fontFamily="$body" fontWeight="700" fontSize={13} color="$color">
                {formatUIText("how it works")}
              </Text>
            </XStack>
            <Text fontFamily="$body" fontSize={11} color="$colorSecondary" lineHeight={18}>
              {formatUIText("the solver uses projected points to find the optimal 11 players within the 100-credit budget. it picks the best captain (2x) and vice-captain (1.5x) automatically.")}
            </Text>
            <XStack gap="$2" marginTop="$1">
              <Badge variant="default" size="sm">{formatBadgeText(`${playerList.length} players`)}</Badge>
              <Badge variant="default" size="sm">{formatBadgeText("100 cr budget")}</Badge>
              <Badge variant={projectionsQuery.data ? "role" : "default"} size="sm">
                {projectionsQuery.data ? formatBadgeText("projections ready") : formatBadgeText("loading projections")}
              </Badge>
            </XStack>
          </YStack>
        </Card>

        {/* Solve button */}
        {!solved ? (
          <Button
            variant="primary"
            size="lg"
            onPress={() => setSolved(true)}
            disabled={solverInput.length < 11}
          >
            {solverInput.length < 11
              ? formatUIText("loading players...")
              : formatUIText("solve optimal team")}
          </Button>
        ) : solverQuery.isLoading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <EggLoadingSpinner size={48} message={formatUIText("finding optimal team")} />
          </YStack>
        ) : solverQuery.data ? (
          <Animated.View entering={FadeInDown.springify()}>
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
              {formatUIText("optimal xi")}
            </Text>
            {solverQuery.data.players.map((p: any, i: number) => (
              <Animated.View key={p.id || i} entering={FadeInDown.delay(i * 30).springify()}>
                <Card marginBottom="$1" padding="$3">
                  <XStack alignItems="center">
                    <InitialsAvatar name={p.name} playerRole={p.role?.toUpperCase()} ovr={0} size={28} />
                    <YStack flex={1} marginLeft="$2">
                      <XStack alignItems="center" gap="$1">
                        <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>
                          {p.name}
                        </Text>
                        {p.isCaptain && <Badge variant="live" size="sm">C</Badge>}
                        {p.isViceCaptain && <Badge variant="role" size="sm">VC</Badge>}
                      </XStack>
                      <XStack gap="$1">
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{p.team}</Text>
                        <Badge variant="default" size="sm">{formatBadgeText(p.role)}</Badge>
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{p.credits} cr</Text>
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

            {/* Use this team button */}
            <Button
              variant="primary"
              size="lg"
              marginTop="$4"
              onPress={() => router.push("/team/create")}
            >
              {formatUIText("create team with these picks")}
            </Button>
          </Animated.View>
        ) : (
          <Card padding="$4">
            <Text {...textStyles.hint} textAlign="center">
              {formatUIText("could not find an optimal team. try again later.")}
            </Text>
            <Button variant="secondary" size="sm" marginTop="$3" onPress={() => setSolved(false)}>
              {formatUIText("retry")}
            </Button>
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
