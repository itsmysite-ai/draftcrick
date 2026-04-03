import { SafeBackButton } from "../../components/SafeBackButton";
import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { YStack, XStack } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  AlertModal,
  DesignSystem,
  Paywall,
  TierBadge,
  formatUIText,
  formatBadgeText,
  formatTeamName,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";
import { usePaywall } from "../../hooks/usePaywall";

type RoleKey = "BAT" | "BOWL" | "AR" | "WK";
const roleKey = (role: string): RoleKey => {
  const r = (role ?? "").toLowerCase();
  if (r.includes("keeper") || r === "wicket_keeper") return "WK";
  if (r.includes("all") || r === "all_rounder") return "AR";
  if (r.includes("bowl") || r === "bowler") return "BOWL";
  return "BAT";
};
const roleLabel = (role: string) => ({ wicket_keeper: "WK", all_rounder: "AR", bowler: "BOWL", batsman: "BAT" }[role] ?? "BAT");

export default function AuctionReportCardScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gate, paywallProps } = usePaywall();
  const [statsPlayer, setStatsPlayer] = useState<any>(null);

  const { data: report, isLoading } = trpc.auctionAi.reportCard.useQuery(
    { roomId: roomId! },
    { enabled: !!roomId },
  );
  const { data: draftRoom } = trpc.draft.getRoom.useQuery(
    { roomId: roomId! },
    { enabled: !!roomId },
  );
  const leagueId = draftRoom?.leagueId;

  const gradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "$colorAccent";
    if (grade.startsWith("B")) return "$colorCricket";
    if (grade.startsWith("C")) return "$color";
    return "$error";
  };

  return (
    <YStack flex={1} backgroundColor="$background" testID="auction-report-screen">
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 8, paddingBottom: 40 }}>
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$4">
          <XStack alignItems="center" gap="$3">
            <SafeBackButton />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
              {formatUIText("auction report card")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {isLoading && (
          <YStack padding="$8" alignItems="center">
            <Text fontFamily="$body" color="$colorMuted">Analyzing your auction...</Text>
          </YStack>
        )}

        {report && (
          <>
            {/* Overall Grade */}
            <Card testID="report-grade-card" padding="$5" marginBottom="$4" borderWidth={2} borderColor="$accentBackground">
              <XStack justifyContent="space-between" alignItems="center">
                <YStack>
                  <Text fontFamily="$mono" fontSize={10} fontWeight="800" letterSpacing={1} color="$accentBackground">
                    {formatBadgeText("overall grade")}
                  </Text>
                  <Text testID="report-grade" fontFamily="$mono" fontWeight="900" fontSize={48} color={gradeColor(report.overallGrade)}>
                    {report.overallGrade}
                  </Text>
                </YStack>
                {report.overallScore != null && (
                  <YStack alignItems="flex-end">
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{formatBadgeText("score")}</Text>
                    <Text fontFamily="$mono" fontWeight="700" fontSize={24} color="$color">
                      {report.overallScore}/100
                    </Text>
                  </YStack>
                )}
              </XStack>
              <Text testID="report-summary" fontFamily="$body" fontSize={13} color="$colorMuted" marginTop="$3">
                {report.summary}
              </Text>
              {report.gated && (
                <XStack
                  marginTop="$3"
                  alignItems="center"
                  gap="$2"
                  opacity={0.6}
                  onPress={() => gate("pro", "Full Auction Report", "Unlock best value picks, strengths & weaknesses, budget efficiency, and trade targets")}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.8 }}
                >
                  <TierBadge tier="pro" size="sm" />
                  <Text fontFamily="$body" fontSize={11} color="$colorMuted">
                    {formatUIText("best value, strengths, efficiency & trade targets")}
                  </Text>
                </XStack>
              )}
            </Card>

            {/* Best & Worst Value */}
            {!report.gated && report.bestValue && (
              <XStack gap="$3" marginBottom="$4">
                <Card testID="report-best-value" flex={1} padding="$3">
                  <Text fontFamily="$mono" fontSize={9} fontWeight="700" letterSpacing={1} color="$colorAccent">
                    {formatBadgeText("best value")}
                  </Text>
                  <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" marginTop="$1" numberOfLines={1}>
                    {report.bestValue.playerName}
                  </Text>
                  <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginTop={2}>
                    {report.bestValue.credits?.toFixed(1) ?? "?"} Cr player for {report.bestValue.salary.toFixed(1)} Cr
                  </Text>
                </Card>
                {report.worstValue && (
                  <Card testID="report-worst-value" flex={1} padding="$3">
                    <Text fontFamily="$mono" fontSize={9} fontWeight="700" letterSpacing={1} color="$error">
                      {formatBadgeText("most expensive")}
                    </Text>
                    <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" marginTop="$1" numberOfLines={1}>
                      {report.worstValue.playerName}
                    </Text>
                    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginTop={2}>
                      Paid {report.worstValue.salary.toFixed(1)} Cr
                    </Text>
                  </Card>
                )}
              </XStack>
            )}

            {/* Strengths & Weaknesses */}
            {!report.gated && (
              <XStack gap="$3" marginBottom="$4">
                {report.teamStrengths.length > 0 && (
                  <Card flex={1} padding="$3">
                    <Text fontFamily="$mono" fontSize={9} fontWeight="700" letterSpacing={1} color="$colorAccent" marginBottom="$2">
                      {formatBadgeText("strengths")}
                    </Text>
                    {report.teamStrengths.map((s: string, i: number) => (
                      <Text key={i} fontFamily="$body" fontSize={11} color="$color" marginBottom={2}>{s}</Text>
                    ))}
                  </Card>
                )}
                {report.teamWeaknesses.length > 0 && (
                  <Card flex={1} padding="$3">
                    <Text fontFamily="$mono" fontSize={9} fontWeight="700" letterSpacing={1} color="$error" marginBottom="$2">
                      {formatBadgeText("weaknesses")}
                    </Text>
                    {report.teamWeaknesses.map((w: string, i: number) => (
                      <Text key={i} fontFamily="$body" fontSize={11} color="$color" marginBottom={2}>{w}</Text>
                    ))}
                  </Card>
                )}
              </XStack>
            )}

            {/* Budget Efficiency */}
            {!report.gated && report.budgetEfficiency != null && (
              <Card testID="report-budget-efficiency" padding="$3" marginBottom="$4">
                <Text fontFamily="$mono" fontSize={9} fontWeight="700" letterSpacing={1} color="$accentBackground" marginBottom="$2">
                  {formatBadgeText("budget efficiency")}
                </Text>
                <XStack alignItems="center" gap="$3">
                  <YStack flex={1} height={8} borderRadius={4} backgroundColor="$backgroundSurfaceAlt" overflow="hidden">
                    <YStack
                      height={8}
                      borderRadius={4}
                      width={`${Math.min(100, report.budgetEfficiency)}%`}
                      backgroundColor={
                        report.budgetEfficiency >= 70 ? "$colorAccent" :
                        report.budgetEfficiency >= 40 ? "$colorCricket" : "$error"
                      }
                    />
                  </YStack>
                  <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color">
                    {report.budgetEfficiency}%
                  </Text>
                </XStack>
              </Card>
            )}

            {/* Suggested Trade Targets */}
            {!report.gated && report.suggestedTradeTargets.length > 0 && (
              <Card testID="report-trade-targets" padding="$3" marginBottom="$4">
                <Text fontFamily="$mono" fontSize={9} fontWeight="700" letterSpacing={1} color="$colorCricket" marginBottom="$2">
                  {formatBadgeText("suggested trade targets")}
                </Text>
                {report.suggestedTradeTargets.map((t: string, i: number) => (
                  <Text key={i} fontFamily="$body" fontSize={12} color="$color" marginBottom={2}>{t}</Text>
                ))}
              </Card>
            )}

          </>
        )}

        {/* Squad List — visible to all users, matches team builder style */}
        {report && report.squad && report.squad.length > 0 && (
          <YStack marginBottom="$4">
            <Text fontFamily="$mono" fontSize={9} fontWeight="700" letterSpacing={1} color="$accentBackground" marginBottom="$3">
              {formatBadgeText(`your squad (${report.squad.length})`)}
            </Text>
            {report.squad.map((p: any, i: number) => (
              <XStack key={i} alignItems="center" paddingVertical="$2" borderBottomWidth={1} borderBottomColor="$borderColor" gap="$2">
                <InitialsAvatar
                  name={p.name}
                  playerRole={roleKey(p.role)}
                  ovr={Math.round((p.credits ?? 8) * 10)}
                  size={36}
                  imageUrl={p.photoUrl}
                />
                <YStack flex={1}>
                  <XStack alignItems="center" gap="$1">
                    <Text fontFamily="$body" fontWeight="600" fontSize={12} color="$color" numberOfLines={1}>{p.name}</Text>
                    <YStack onPress={() => setStatsPlayer(p)} cursor="pointer" pressStyle={{ opacity: 0.7 }} padding={2}>
                      <Ionicons name="stats-chart" size={12} color="#5DB882" />
                    </YStack>
                  </XStack>
                  <XStack gap="$1" alignItems="center">
                    <Badge variant="default" size="sm">{roleLabel(p.role)}</Badge>
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatTeamName(p.team ?? "")}</Text>
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">· {p.credits?.toFixed(1)} Cr</Text>
                    {p.salary != null && p.salary !== p.credits && (
                      <Text fontFamily="$mono" fontSize={8} color={p.salary < p.credits ? "$colorAccent" : "$error"}>
                        {p.salary < p.credits ? "↓" : "↑"}{p.salary?.toFixed(1)}
                      </Text>
                    )}
                  </XStack>
                </YStack>
                {p.recentForm != null && (
                  <YStack alignItems="center" minWidth={30}>
                    <Text fontFamily="$mono" fontWeight="700" fontSize={12} color={
                      p.recentForm >= 7 ? "$colorAccent" : p.recentForm >= 4 ? "$colorCricket" : "$error"
                    }>{p.recentForm}</Text>
                    <Text fontFamily="$mono" fontSize={7} color="$colorMuted">form</Text>
                  </YStack>
                )}
              </XStack>
            ))}
          </YStack>
        )}

        {/* Stats Popup */}
        {statsPlayer && (
          <YStack
            style={{ position: "fixed" as any, top: 0, left: 0, right: 0, bottom: 0 }}
            zIndex={200} alignItems="center" justifyContent="center"
            backgroundColor="$colorOverlay" onPress={() => setStatsPlayer(null)}
          >
            <YStack
              backgroundColor="$backgroundSurface" borderRadius={20} padding="$5"
              width="90%" maxWidth={340} borderWidth={1} borderColor="$borderColor"
              shadowColor="$shadowColor" shadowOffset={{ width: 0, height: 16 }} shadowOpacity={0.25} shadowRadius={32}
              onPress={(e: any) => e.stopPropagation()}
            >
              <XStack justifyContent="space-between" alignItems="flex-start" marginBottom="$3">
                <XStack gap="$3" flex={1} alignItems="center">
                  <InitialsAvatar name={statsPlayer.name} playerRole={roleKey(statsPlayer.role)} ovr={Math.round((statsPlayer.credits ?? 8) * 10)} size={40} imageUrl={statsPlayer.photoUrl} />
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="700" fontSize={16} color="$color">{statsPlayer.name}</Text>
                    <XStack alignItems="center" gap="$2">
                      <Badge variant="default" size="sm">{roleLabel(statsPlayer.role)}</Badge>
                      <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{formatTeamName(statsPlayer.team ?? "")}</Text>
                      {statsPlayer.nationality && <Text fontFamily="$mono" fontSize={10} color="$colorMuted">{statsPlayer.nationality}</Text>}
                    </XStack>
                  </YStack>
                </XStack>
                <YStack alignItems="center">
                  <Text fontFamily="$mono" fontWeight="900" fontSize={20} color="$accentBackground">{statsPlayer.credits?.toFixed(1)}</Text>
                  <Text fontFamily="$mono" fontSize={8} color="$colorMuted">Cr</Text>
                </YStack>
              </XStack>
              <XStack marginBottom="$3" gap="$2">
                {statsPlayer.matchesPlayed != null && (
                  <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("matches")}</Text>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{statsPlayer.matchesPlayed}</Text>
                  </YStack>
                )}
                {statsPlayer.average != null && statsPlayer.average > 0 && (
                  <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("avg")}</Text>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{statsPlayer.average.toFixed(1)}</Text>
                  </YStack>
                )}
                {statsPlayer.strikeRate != null && statsPlayer.strikeRate > 0 && (
                  <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("sr")}</Text>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{statsPlayer.strikeRate.toFixed(0)}</Text>
                  </YStack>
                )}
              </XStack>
              {(statsPlayer.economyRate ?? 0) > 0 && (
                <XStack marginBottom="$3" gap="$2">
                  <YStack flex={1} backgroundColor="$backgroundPress" borderRadius={8} padding="$2" alignItems="center">
                    <Text fontFamily="$mono" fontSize={8} color="$colorMuted">{formatBadgeText("econ")}</Text>
                    <Text fontFamily="$mono" fontWeight="800" fontSize={18} color="$color">{statsPlayer.economyRate.toFixed(1)}</Text>
                  </YStack>
                </XStack>
              )}
              <XStack gap="$3" alignItems="center" marginBottom="$2">
                {statsPlayer.recentForm != null && (
                  <XStack alignItems="center" gap="$1">
                    <Text fontFamily="$mono" fontSize={9} color="$colorMuted">{formatBadgeText("form")}</Text>
                    <Text fontFamily="$mono" fontWeight="700" fontSize={14} color={
                      statsPlayer.recentForm >= 7 ? "$colorAccent" : statsPlayer.recentForm >= 4 ? "$colorCricket" : "$error"
                    }>{statsPlayer.recentForm}/10</Text>
                  </XStack>
                )}
                {statsPlayer.injuryStatus && (
                  <Badge variant="default" size="sm" backgroundColor={statsPlayer.injuryStatus === "fit" ? "$colorAccent" : "$error"}>
                    {statsPlayer.injuryStatus.toUpperCase()}
                  </Badge>
                )}
                <Text fontFamily="$mono" fontSize={9} color="$colorMuted">paid {statsPlayer.salary?.toFixed(1)} Cr</Text>
              </XStack>
              {statsPlayer.formNote && (
                <Text fontFamily="$body" fontSize={11} color="$colorSecondary" lineHeight={16}>{statsPlayer.formNote}</Text>
              )}
            </YStack>
          </YStack>
        )}

        {/* Next steps */}
        <YStack padding="$4" gap="$2" marginTop="$4" marginBottom="$6">
          <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color" marginBottom="$1">
            {formatUIText("what's next?")}
          </Text>
          {leagueId && (
            <Button
              variant="primary"
              size="md"
              onPress={() => router.push(`/league/${leagueId}` as any)}
            >
              <XStack alignItems="center" gap="$2">
                <Ionicons name="trophy-outline" size={16} color="#fff" />
                <Text fontFamily="$mono" fontSize={13} fontWeight="700" color="white">
                  {formatUIText("go to league")}
                </Text>
              </XStack>
            </Button>
          )}
          <Button
            variant="secondary"
            size="md"
            onPress={() => router.push("/(tabs)/contests" as any)}
          >
            <XStack alignItems="center" gap="$2">
              <Ionicons name="list-outline" size={16} color="currentColor" />
              <Text fontFamily="$mono" fontSize={13} fontWeight="700">
                {formatUIText("view contests")}
              </Text>
            </XStack>
          </Button>
          <Button
            variant="secondary"
            size="md"
            onPress={() => router.push("/(tabs)" as any)}
          >
            <XStack alignItems="center" gap="$2">
              <Ionicons name="home-outline" size={16} color="currentColor" />
              <Text fontFamily="$mono" fontSize={13} fontWeight="700">
                {formatUIText("back to home")}
              </Text>
            </XStack>
          </Button>
        </YStack>
      </ScrollView>
      <Paywall {...paywallProps} />
    </YStack>
  );
}
