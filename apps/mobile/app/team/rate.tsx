import { ScrollView as RNScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  BackButton,
  ModeToggle,
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
import { useNavigationStore } from "../../lib/navigation-store";
import { useTheme } from "../../providers/ThemeProvider";
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
  const navCtx = useNavigationStore((s) => s.matchContext);
  const params = {
    matchId: navCtx?.matchId,
    teamA: navCtx?.teamA,
    teamB: navCtx?.teamB,
    format: navCtx?.format,
  };
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const { gate, hasAccess, paywallProps } = usePaywall();

  // Demo team for display purposes — in production this comes from team builder state
  const [demoTeam] = useState([
    { name: "Virat Kohli", role: "BAT", credits: 10.5, isCaptain: true, isViceCaptain: false },
    { name: "Rohit Sharma", role: "BAT", credits: 10, isCaptain: false, isViceCaptain: true },
    { name: "Shubman Gill", role: "BAT", credits: 9, isCaptain: false, isViceCaptain: false },
    { name: "KL Rahul", role: "WK", credits: 9, isCaptain: false, isViceCaptain: false },
    { name: "Hardik Pandya", role: "AR", credits: 9.5, isCaptain: false, isViceCaptain: false },
    { name: "Ravindra Jadeja", role: "AR", credits: 9, isCaptain: false, isViceCaptain: false },
    { name: "Jasprit Bumrah", role: "BOWL", credits: 9, isCaptain: false, isViceCaptain: false },
    { name: "Mohammed Shami", role: "BOWL", credits: 8.5, isCaptain: false, isViceCaptain: false },
    { name: "Ravichandran Ashwin", role: "BOWL", credits: 8.5, isCaptain: false, isViceCaptain: false },
    { name: "Kuldeep Yadav", role: "BOWL", credits: 8, isCaptain: false, isViceCaptain: false },
    { name: "Mohammed Siraj", role: "BOWL", credits: 8, isCaptain: false, isViceCaptain: false },
  ]);

  const rateMutation = trpc.analytics.rateMyTeam.useMutation();

  const handleRate = async () => {
    if (gate("pro", "Rate My Team", "Get AI-powered analysis of your fantasy team")) return;
    try {
      await rateMutation.mutateAsync({
        team: demoTeam,
        matchInfo: {
          teamA: params.teamA ?? "India",
          teamB: params.teamB ?? "Australia",
          format: params.format ?? "T20",
          venue: null,
        },
      });
    } catch {
      // Error handled by mutation state
    }
  };

  const rating = rateMutation.data;

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
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      <RNScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        {/* Team Summary */}
        <Animated.View entering={FadeIn.delay(0)}>
          <Card padding="$4" marginBottom="$4" testID="team-summary-card">
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <CricketBatIcon size={16} />
              <Text {...textStyles.sectionHeader}>{formatUIText("your team")}</Text>
              <Badge variant="default" size="sm">{demoTeam.length} players</Badge>
            </XStack>
            {demoTeam.map((p) => (
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

        {/* Rate Button */}
        {!rating && (
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
              {Object.entries(rating.categoryScores).map(([key, cat], i) => (
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
                {rating.weakSpots.map((spot, i) => (
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
                {rating.suggestedTransfers.map((transfer, i) => (
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

            {/* Rate Again */}
            <Animated.View entering={FadeInDown.delay(550).springify()}>
              <Button
                variant="secondary"
                size="md"
                marginTop="$4"
                onPress={handleRate}
                disabled={rateMutation.isPending}
                testID="rate-again-btn"
              >
                {formatUIText("rate again")}
              </Button>
            </Animated.View>
          </>
        )}
      </RNScrollView>
      <Paywall {...paywallProps} />
    </YStack>
  );
}
