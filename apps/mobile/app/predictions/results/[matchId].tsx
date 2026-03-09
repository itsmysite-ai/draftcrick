import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../../components/SportText";
import {
  Card,
  Badge,
  BackButton,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../../lib/trpc";
import { HeaderControls } from "../../../components/HeaderControls";

const QUESTION_TYPE_ICONS: Record<string, string> = {
  match_winner: "🏏",
  victory_margin: "📊",
  top_scorer: "🏃",
  top_wicket_taker: "🎳",
  century_scored: "💯",
  first_innings_total: "📈",
  player_performance: "⭐",
  sixes_count: "6️⃣",
  custom_yes_no: "❓",
  custom_range: "🔢",
  custom_multi_choice: "📋",
};

export default function PredictionResultsScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();


  const answersQuery = trpc.prediction.getUserAnswers.useQuery(
    { matchId: matchId!, leagueId: "00000000-0000-0000-0000-000000000000" },
    { enabled: !!matchId }
  );

  const questions = answersQuery.data?.questions ?? [];
  const answers = answersQuery.data?.answers ?? [];

  const answerMap = new Map<string, any>(answers.map((a: any) => [a.questionId, a]));
  const correctCount = answers.filter((a: any) => a.isCorrect === true).length;
  const totalAnswered = answers.length;
  const totalPoints = answers.reduce((sum: number, a: any) => sum + (a.pointsAwarded ?? 0), 0);

  if (answersQuery.isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <EggLoadingSpinner />
        <Text {...textStyles.hint} marginTop="$3">{formatUIText("loading results...")}</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background" testID="prediction-results-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>
        {/* Header */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop={insets.top + 8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <BackButton onPress={() => router.back()} />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">
              {formatUIText("results")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {/* Summary Card */}
        <Card padding="$4" marginBottom="$4">
          <Text fontFamily="$body" fontWeight="600" fontSize={16} color="$color" textAlign="center" marginBottom="$3">
            {totalAnswered > 0
              ? `${formatUIText("you got")} ${correctCount}/${totalAnswered} ${formatUIText("right!")}`
              : formatUIText("no predictions submitted for this match")}
          </Text>
          {totalAnswered > 0 && (
            <XStack justifyContent="space-around">
              <YStack alignItems="center">
                <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$accentBackground">
                  {correctCount}
                </Text>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {formatUIText("correct")}
                </Text>
              </YStack>
              <YStack alignItems="center">
                <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$color">
                  {totalAnswered}
                </Text>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {formatUIText("answered")}
                </Text>
              </YStack>
              <YStack alignItems="center">
                <Text fontFamily="$mono" fontWeight="700" fontSize={20} color="$accentBackground">
                  +{totalPoints}
                </Text>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {formatUIText("points")}
                </Text>
              </YStack>
            </XStack>
          )}
        </Card>

        {/* Question Results */}
        {questions.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text {...textStyles.hint} marginTop="$3">
              {formatUIText("no questions found for this match")}
            </Text>
          </YStack>
        ) : (
          questions.map((q: any, i: number) => {
            const answer = answerMap.get(q.id);
            const isCorrect = answer?.isCorrect === true;
            const isWrong = answer?.isCorrect === false;
            const notAnswered = !answer;
            const isPending = answer && answer.isCorrect === null;

            return (
              <Animated.View key={q.id} entering={FadeInDown.delay(i * 30).springify()}>
                <Card
                  padding="$3"
                  marginBottom="$2"
                  borderColor={isCorrect ? "$success" : isWrong ? "$error" : "$borderColor"}
                  testID={`result-${i}`}
                >
                  <XStack alignItems="center" gap="$3">
                    {/* Status Icon */}
                    <Text fontSize={24}>
                      {isCorrect ? "✅" : isWrong ? "❌" : isPending ? "⏳" : "➖"}
                    </Text>

                    <YStack flex={1}>
                      <XStack alignItems="center" gap="$2" marginBottom="$1">
                        <Text fontSize={16}>
                          {QUESTION_TYPE_ICONS[q.questionType] ?? "❓"}
                        </Text>
                        <Text fontFamily="$body" fontWeight="600" fontSize={13} color="$color" flex={1}>
                          {q.questionText}
                        </Text>
                      </XStack>

                      {/* User's answer */}
                      {answer && (
                        <Text fontFamily="$mono" fontSize={11} color={isCorrect ? "$success" : isWrong ? "$error" : "$colorMuted"}>
                          {formatUIText("your answer")}: {answer.answer}
                        </Text>
                      )}

                      {/* Correct answer (if graded) */}
                      {q.correctAnswer && (
                        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                          {formatUIText("correct")}: {q.correctAnswer}
                        </Text>
                      )}

                      {notAnswered && (
                        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                          {formatUIText("not answered")}
                        </Text>
                      )}
                    </YStack>

                    {/* Points */}
                    {answer?.pointsAwarded != null && answer.pointsAwarded > 0 && (
                      <Badge variant="success">
                        +{answer.pointsAwarded}
                      </Badge>
                    )}
                  </XStack>
                </Card>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
