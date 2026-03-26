import { SafeBackButton } from "../../components/SafeBackButton";
import { ScrollView, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useCallback } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  BackButton,
  InitialsAvatar,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";

function formatRoleShort(role?: string): string {
  if (!role) return "";
  const r = role.toUpperCase().replace(/[\s-]/g, "_");
  switch (r) {
    case "BATSMAN": case "BAT": return "BAT";
    case "BOWLER": case "BOWL": return "BOWL";
    case "ALL_ROUNDER": case "ALLROUNDER": case "AR": return "AR";
    case "WICKET_KEEPER": case "WICKETKEEPER": case "WK": return "WK";
    default: return role.substring(0, 4).toUpperCase();
  }
}

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTamaguiTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const team = trpc.team.getById.useQuery({ teamId: id! }, { enabled: !!id });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await team.refetch();
    setRefreshing(false);
  }, [team]);

  if (team.isLoading) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <EggLoadingSpinner size={48} message={formatUIText("loading team")} />
    </YStack>
  );

  const t = team.data;
  if (!t) return (
    <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
      <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
      <Text {...textStyles.hint}>{formatUIText("team not found")}</Text>
    </YStack>
  );

  const match = t.match;
  const matchStatus = match?.status ?? "upcoming";
  const isCompleted = matchStatus === "completed";
  const hasScores = (t.playerDetails ?? []).some((p: any) => p.fantasyPoints > 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background?.val }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground?.val} />}
      testID="team-detail-screen"
    >
      {/* Header */}
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
            {formatUIText("my team")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      {/* Match Info */}
      {match && (
        <YStack padding="$5" paddingBottom="$3">
          <Text fontFamily="$body" fontWeight="600" fontSize={15} color="$color">
            {formatTeamName(match.teamHome)} {formatUIText("vs")} {formatTeamName(match.teamAway)}
          </Text>
          {match.result && (
            <Text fontFamily="$body" fontWeight="700" fontSize={11} color="$accentBackground" marginTop={2}>
              {match.result}
            </Text>
          )}
          {match.scoreSummary && (
            <Text fontFamily="$mono" fontWeight="800" fontSize={13} color="$colorCricket" marginTop={4}>
              {match.scoreSummary}
            </Text>
          )}
        </YStack>
      )}

      {/* Team Summary Card */}
      <Card marginHorizontal="$4" marginBottom="$4" padding="$4" borderWidth={2} borderColor="$accentBackground">
        <XStack justifyContent="space-around" alignItems="center">
          <YStack alignItems="center" gap={2}>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
              {formatBadgeText("points")}
            </Text>
            <Text fontFamily="$mono" fontWeight="800" fontSize={22} color="$accentBackground">
              {t.totalPoints.toFixed(1)}
            </Text>
          </YStack>
          <YStack width={1} height={32} backgroundColor="$borderColor" />
          <YStack alignItems="center" gap={2}>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
              {formatBadgeText("credits")}
            </Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">
              {t.creditsUsed.toFixed(1)}/100
            </Text>
          </YStack>
          <YStack width={1} height={32} backgroundColor="$borderColor" />
          <YStack alignItems="center" gap={2}>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted" letterSpacing={0.5}>
              {formatBadgeText("players")}
            </Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">
              {(t.playerDetails ?? []).length}
            </Text>
          </YStack>
        </XStack>

        {t.contest && (
          <XStack marginTop="$3" justifyContent="center" gap="$2" alignItems="center">
            <Badge variant="role" size="sm">{formatBadgeText(t.contest.status ?? "")}</Badge>
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{t.contest.name}</Text>
          </XStack>
        )}
        {!t.contest && (
          <XStack marginTop="$3" justifyContent="center">
            <Badge variant="default" size="sm">{formatBadgeText("free play")}</Badge>
          </XStack>
        )}
      </Card>

      {/* Player List */}
      <YStack paddingHorizontal="$4" marginBottom="$6">
        <Text {...textStyles.sectionHeader} marginBottom="$3">
          {formatUIText("players")}
        </Text>
        {(t.playerDetails ?? []).map((p: any, i: number) => {
          const multiplier = p.isCaptain ? "2x" : p.isViceCaptain ? "1.5x" : "";
          return (
            <Animated.View key={p.id || i} entering={FadeInDown.delay(i * 30).springify()}>
              <Card marginBottom="$1" padding="$3">
                <XStack alignItems="center">
                  <InitialsAvatar name={p.name} playerRole={p.role?.toUpperCase()} ovr={0} size={32} imageUrl={p.photoUrl} />
                  <YStack flex={1} marginLeft="$2">
                    <XStack alignItems="center" gap="$1">
                      <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" numberOfLines={1}>
                        {p.name}
                      </Text>
                      {p.isCaptain && <Badge variant="live" size="sm">C</Badge>}
                      {p.isViceCaptain && <Badge variant="role" size="sm">VC</Badge>}
                    </XStack>
                    <XStack alignItems="center" gap="$1">
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{formatTeamName(p.team)}</Text>
                      <Badge variant="default" size="sm">{formatRoleShort(p.role)}</Badge>
                    </XStack>
                  </YStack>
                  <YStack alignItems="flex-end">
                    {hasScores ? (
                      <>
                        <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$accentBackground">
                          {(p.contribution ?? p.fantasyPoints ?? 0).toFixed(1)}
                        </Text>
                        {multiplier ? (
                          <Text fontFamily="$mono" fontSize={9} color="$colorMuted">
                            {(p.fantasyPoints ?? 0).toFixed(1)} {multiplier}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Text fontFamily="$mono" fontWeight="600" fontSize={12} color="$colorMuted">
                        {p.credits} credits
                      </Text>
                    )}
                  </YStack>
                </XStack>

                {/* Batting/Bowling stats row for completed matches */}
                {hasScores && (p.runs > 0 || p.wickets > 0 || p.catches > 0) && (
                  <XStack marginTop="$2" gap="$3" paddingLeft={44}>
                    {p.runs > 0 && (
                      <Text fontFamily="$mono" fontSize={10} color="$colorSecondary">
                        {p.runs} runs
                      </Text>
                    )}
                    {p.wickets > 0 && (
                      <Text fontFamily="$mono" fontSize={10} color="$colorSecondary">
                        {p.wickets}w
                      </Text>
                    )}
                    {p.catches > 0 && (
                      <Text fontFamily="$mono" fontSize={10} color="$colorSecondary">
                        {p.catches} catches
                      </Text>
                    )}
                  </XStack>
                )}
              </Card>
            </Animated.View>
          );
        })}
      </YStack>
    </ScrollView>
  );
}
