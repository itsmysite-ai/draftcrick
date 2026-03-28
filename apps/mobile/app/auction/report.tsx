import { SafeBackButton } from "../../components/SafeBackButton";
import { ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Button,
  formatUIText,
  formatBadgeText,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";
import { usePaywall } from "../../hooks/usePaywall";

export default function AuctionReportCardScreen() {
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const insets = useSafeAreaInsets();
  const { gate } = usePaywall();

  const { data: report, isLoading } = trpc.auctionAi.reportCard.useQuery(
    { roomId: roomId! },
    { enabled: !!roomId },
  );

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
                <Button variant="primary" size="sm" marginTop="$3" onPress={() => gate("pro", "Full Auction Report")}>
                  Unlock Full Report
                </Button>
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
      </ScrollView>
    </YStack>
  );
}
