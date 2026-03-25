import { ScrollView as RNScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useState, useMemo } from "react";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  BackButton,
  EggLoadingSpinner,
  CricketBatIcon,
  Paywall,
  TierBadge,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";
import { usePaywall } from "../../hooks/usePaywall";

const GRADE_COLORS: Record<string, string> = {
  "A+": "#1a7a3a",
  "A": "#30a46c",
  "B+": "#5db882",
  "B": "#f5a623",
  "C+": "#e5884d",
  "C": "#e5484d",
  "D": "#cc3333",
  "F": "#8b0000",
};

function getGradeColor(grade: string): string {
  return GRADE_COLORS[grade] ?? "#f5a623";
}

export default function RateMyTeamScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { gate, hasAccess, paywallProps } = usePaywall();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Fetch user's teams
  const { data: myTeams, isLoading: teamsLoading } = trpc.team.myTeams.useQuery();

  // Fetch players for the selected team's match to resolve names
  const selectedTeam = useMemo(() => myTeams?.find((t: any) => t.id === selectedTeamId), [myTeams, selectedTeamId]);
  const matchId = selectedTeam?.contest?.match?.id ?? selectedTeam?.matchId;
  const { data: matchPlayers } = trpc.team.getTeamPlayers.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );

  // Build the team data for the API
  const teamForRating = useMemo(() => {
    if (!matchPlayers || !selectedTeam) return null;
    return matchPlayers.map((p: any) => ({
      name: p.name,
      role: p.role ?? "all_rounder",
      credits: p.credits ?? 8,
      isCaptain: p.playerId === selectedTeam.captainId,
      isViceCaptain: p.playerId === selectedTeam.viceCaptainId,
    }));
  }, [matchPlayers, selectedTeam]);

  const matchInfo = useMemo(() => {
    const match = selectedTeam?.contest?.match;
    if (!match) return null;
    return {
      teamA: match.teamHome ?? "Team A",
      teamB: match.teamAway ?? "Team B",
      format: match.format ?? "T20",
      venue: match.venue ?? null,
    };
  }, [selectedTeam]);

  const rateMutation = trpc.analytics.rateMyTeam.useMutation();

  const handleRate = async () => {
    if (!teamForRating || !matchInfo) return;
    if (gate("pro", "Rate My Team", "Get AI-powered analysis of your fantasy team")) return;
    try {
      await rateMutation.mutateAsync({ team: teamForRating, matchInfo, matchId: matchId ?? undefined });
    } catch {
      // Error handled by mutation state
    }
  };

  const rating = rateMutation.data;

  // Teams grouped by match for easier selection
  const teamsByMatch = useMemo(() => {
    if (!myTeams) return [];
    const groups: Record<string, { match: any; teams: any[] }> = {};
    for (const t of myTeams as any[]) {
      const match = t.contest?.match;
      const key = match?.id ?? "unknown";
      if (!groups[key]) groups[key] = { match, teams: [] };
      groups[key].teams.push(t);
    }
    return Object.values(groups).sort((a, b) => {
      const timeA = a.match?.startTime ? new Date(a.match.startTime).getTime() : 0;
      const timeB = b.match?.startTime ? new Date(b.match.startTime).getTime() : 0;
      return timeB - timeA; // most recent first
    });
  }, [myTeams]);

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="rate-team-screen">
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("rate my team")}
          </Text>
          {!hasAccess("pro") && <TierBadge tier="pro" size="sm" />}
        </XStack>
        <HeaderControls />
      </XStack>

      <RNScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        {/* Team Picker */}
        {!selectedTeamId && !rating && (
          <Animated.View entering={FadeIn.delay(0)}>
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("pick a team to rate")}
            </Text>
            <Text fontFamily="$body" fontSize={14} color="$colorMuted" marginBottom="$4">
              {formatUIText("select one of your fantasy teams for AI analysis")}
            </Text>

            {teamsLoading && (
              <YStack alignItems="center" paddingVertical="$6">
                <EggLoadingSpinner size={40} message={formatUIText("loading your teams...")} />
              </YStack>
            )}

            {!teamsLoading && teamsByMatch.length === 0 && (
              <Card padding="$5" marginBottom="$4">
                <YStack alignItems="center" gap="$3">
                  <CricketBatIcon size={32} />
                  <Text fontFamily="$body" fontSize={14} color="$colorMuted" textAlign="center">
                    {formatUIText("no teams yet. create a team in a contest first, then come back to get it rated!")}
                  </Text>
                  <Button variant="primary" size="sm" onPress={() => router.push("/(tabs)/contests" as any)}>
                    {formatUIText("browse contests")}
                  </Button>
                </YStack>
              </Card>
            )}

            {teamsByMatch.map((group, gi) => (
              <Animated.View key={group.match?.id ?? gi} entering={FadeInDown.delay(gi * 80).springify()}>
                <Text fontFamily="$mono" fontSize={12} color="$colorMuted" marginBottom="$2" marginTop={gi > 0 ? "$3" : 0}>
                  {group.match?.teamHome ?? "?"} vs {group.match?.teamAway ?? "?"} · {group.match?.format ?? ""}
                </Text>
                {group.teams.map((team: any) => (
                  <Pressable key={team.id} onPress={() => setSelectedTeamId(team.id)}>
                    <Card padding="$3" marginBottom="$2" borderWidth={1} borderColor="$borderColor">
                      <XStack justifyContent="space-between" alignItems="center">
                        <YStack>
                          <Text fontFamily="$mono" fontWeight="600" fontSize={14} color="$color">
                            {team.name || formatUIText("my team")}
                          </Text>
                          <Text fontFamily="$body" fontSize={12} color="$colorMuted">
                            {(team.players as any[])?.length ?? 11} {formatUIText("players")} · {team.creditsUsed ?? "—"} {formatUIText("credits")}
                          </Text>
                        </YStack>
                        <Badge variant="default" size="sm">
                          {team.totalPoints > 0 ? `${team.totalPoints} pts` : formatUIText("rate")}
                        </Badge>
                      </XStack>
                    </Card>
                  </Pressable>
                ))}
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {/* Selected Team Summary */}
        {selectedTeamId && teamForRating && (
          <Animated.View entering={FadeIn.delay(0)}>
            <Card padding="$4" marginBottom="$4" testID="team-summary-card">
              <XStack alignItems="center" justifyContent="space-between" marginBottom="$3">
                <XStack alignItems="center" gap="$2">
                  <CricketBatIcon size={16} />
                  <Text {...textStyles.sectionHeader}>{selectedTeam?.name || formatUIText("your team")}</Text>
                  <Badge variant="default" size="sm">{teamForRating.length} players</Badge>
                </XStack>
                {!rating && (
                  <Pressable onPress={() => { setSelectedTeamId(null); rateMutation.reset(); }}>
                    <Text fontFamily="$mono" fontSize={12} color="$accentBackground">{formatUIText("change")}</Text>
                  </Pressable>
                )}
              </XStack>
              {matchInfo && (
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginBottom="$3">
                  {matchInfo.teamA} vs {matchInfo.teamB} · {matchInfo.format}
                </Text>
              )}
              {teamForRating.map((p: any) => (
                <XStack key={p.name} justifyContent="space-between" paddingVertical="$1">
                  <XStack alignItems="center" gap="$2">
                    <Badge variant="role" size="sm">{formatBadgeText(p.role)}</Badge>
                    <Text fontFamily="$body" fontSize={13} color="$color">{p.name}</Text>
                    {p.isCaptain && <Badge variant="captain" size="sm">{formatBadgeText("C")}</Badge>}
                    {p.isViceCaptain && <Badge variant="default" size="sm">{formatBadgeText("VC")}</Badge>}
                  </XStack>
                  <Text fontFamily="$mono" fontSize={12} color="$colorMuted">{p.credits}</Text>
                </XStack>
              ))}
            </Card>
          </Animated.View>
        )}

        {/* Rate Button */}
        {selectedTeamId && teamForRating && !rating && (
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Button
              variant="primary"
              size="lg"
              onPress={handleRate}
              disabled={rateMutation.isPending}
              marginBottom="$5"
              testID="rate-btn"
            >
              {rateMutation.isPending ? formatUIText("analyzing...") : formatUIText("rate my team")}
            </Button>
          </Animated.View>
        )}

        {rateMutation.isPending && (
          <YStack alignItems="center" gap="$3" marginBottom="$5">
            <EggLoadingSpinner size={48} message={formatUIText("ai is analyzing your team...")} />
          </YStack>
        )}

        {rateMutation.isError && (
          <Card padding="$4" marginBottom="$4">
            <Text fontFamily="$body" fontSize={13} color="$colorError">
              {rateMutation.error?.message?.includes("UNAUTHORIZED")
                ? formatUIText("you need to be logged in to rate your team")
                : rateMutation.error?.message?.includes("PAYWALL")
                ? formatUIText("upgrade to pro to use rate my team")
                : formatUIText("couldn't rate your team right now. try again?")}
            </Text>
            <Button variant="secondary" size="sm" marginTop="$3" onPress={handleRate}>
              {formatUIText("retry")}
            </Button>
          </Card>
        )}

        {/* Rating Results */}
        {rating && (
          <>
            {/* Overall Grade */}
            <Animated.View entering={FadeInDown.delay(0).springify()}>
              <Card padding="$5" marginBottom="$4" testID="overall-grade-card">
                <YStack alignItems="center" gap="$3">
                  <Text fontFamily="$mono" fontSize={48} fontWeight="900" color={getGradeColor(rating.overallGrade)}>
                    {rating.overallGrade}
                  </Text>
                  <Text fontFamily="$mono" fontSize={14} color="$colorMuted">
                    {rating.overallScore}/100
                  </Text>
                  <Text fontFamily="$body" fontSize={14} color="$color" textAlign="center" lineHeight={22}>
                    {rating.summary}
                  </Text>
                </YStack>
              </Card>
            </Animated.View>

            {/* Category Scores */}
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Text fontSize={14}>📊</Text>
                <Text {...textStyles.sectionHeader}>{formatUIText("category scores")}</Text>
              </XStack>
              {Object.entries(rating.categoryScores).map(([key, cat]: [string, any], i) => (
                <Animated.View key={key} entering={FadeInDown.delay(150 + i * 30).springify()}>
                  <Card padding="$3" marginBottom="$2" testID={`category-${key}`}>
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack flex={1}>
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">
                          {formatUIText(key.replace(/([A-Z])/g, " $1").trim())}
                        </Text>
                        <Text {...textStyles.hint} marginTop={2}>{cat.comment}</Text>
                      </YStack>
                      <YStack alignItems="center" marginLeft="$3">
                        <Text fontFamily="$mono" fontSize={18} fontWeight="900" color={getGradeColor(cat.grade)}>
                          {cat.grade}
                        </Text>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{cat.score}/100</Text>
                      </YStack>
                    </XStack>
                  </Card>
                </Animated.View>
              ))}
            </Animated.View>

            {/* Weak Spots */}
            {rating.weakSpots.length > 0 && (
              <Animated.View entering={FadeInDown.delay(350).springify()}>
                <XStack alignItems="center" gap="$2" marginTop="$3" marginBottom="$3">
                  <Text fontSize={14}>⚠️</Text>
                  <Text {...textStyles.sectionHeader}>{formatUIText("weak spots")}</Text>
                </XStack>
                {rating.weakSpots.map((spot: string, i: number) => (
                  <Card key={i} padding="$3" marginBottom="$2">
                    <Text fontFamily="$body" fontSize={13} color="$color">{spot}</Text>
                  </Card>
                ))}
              </Animated.View>
            )}

            {/* Transfer Suggestions */}
            {rating.suggestedTransfers.length > 0 && (
              <Animated.View entering={FadeInDown.delay(450).springify()}>
                <XStack alignItems="center" gap="$2" marginTop="$3" marginBottom="$3">
                  <Text fontSize={14}>🔄</Text>
                  <Text {...textStyles.sectionHeader}>{formatUIText("suggested transfers")}</Text>
                </XStack>
                {rating.suggestedTransfers.map((transfer: any, i: number) => (
                  <Card key={i} padding="$4" marginBottom="$2" testID={`transfer-${i}`}>
                    <XStack alignItems="center" gap="$3">
                      <YStack flex={1}>
                        <XStack alignItems="center" gap="$2">
                          <Badge variant="danger" size="sm">{formatBadgeText("out")}</Badge>
                          <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">{transfer.playerOut}</Text>
                        </XStack>
                        <XStack alignItems="center" gap="$2" marginTop="$1">
                          <Badge variant="success" size="sm">{formatBadgeText("in")}</Badge>
                          <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color">{transfer.playerIn}</Text>
                        </XStack>
                        <Text {...textStyles.hint} marginTop="$2">{transfer.reason}</Text>
                      </YStack>
                      <YStack alignItems="center">
                        <Text fontFamily="$mono" fontSize={16} fontWeight="700" color="$colorAccent">
                          +{transfer.projectedPointGain}
                        </Text>
                        <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatUIText("pts")}</Text>
                      </YStack>
                    </XStack>
                  </Card>
                ))}
              </Animated.View>
            )}

            {/* Rate Again / Pick Different Team */}
            <Animated.View entering={FadeInDown.delay(550).springify()}>
              <XStack gap="$3" marginTop="$4">
                <Button
                  variant="secondary"
                  size="md"
                  flex={1}
                  onPress={() => { setSelectedTeamId(null); rateMutation.reset(); }}
                >
                  {formatUIText("pick another team")}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  flex={1}
                  onPress={handleRate}
                  disabled={rateMutation.isPending}
                  testID="rate-again-btn"
                >
                  {formatUIText("rate again")}
                </Button>
              </XStack>
            </Animated.View>
          </>
        )}
      </RNScrollView>
      <Paywall {...paywallProps} />
    </YStack>
  );
}
