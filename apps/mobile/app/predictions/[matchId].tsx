import { ScrollView, Alert, Platform, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  Badge,
  BackButton,
  Button,
  FilterPill,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useNavigationStore } from "../../lib/navigation-store";
import { HeaderControls } from "../../components/HeaderControls";

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

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "success",
  medium: "default",
  hard: "error",
};

export default function PredictionQuestionsScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();

  const navCtx = useNavigationStore((s) => s.matchContext);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const questionsQuery = trpc.prediction.getQuestions.useQuery(
    { matchId: matchId! },
    { enabled: !!matchId }
  );

  const submitMutation = trpc.prediction.submitAnswer.useMutation({
    onError: (err: any) => setAlertMessage(err.message),
  });

  const questions = questionsQuery.data ?? [];
  const answeredCount = Object.keys(answers).length;

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmitAll = async () => {
    setSubmitting(true);
    try {
      for (const q of questions) {
        const answer = answers[q.id];
        if (!answer) continue;
        await submitMutation.mutateAsync({
          questionId: q.id,
          leagueId: "00000000-0000-0000-0000-000000000000", // default league
          answer,
        });
      }
      if (Platform.OS === "web") {
        setAlertMessage(formatUIText("predictions submitted!"));
        setTimeout(() => router.back(), 1500);
      } else {
        Alert.alert(
          formatUIText("predictions submitted!"),
          formatUIText(`${answeredCount} predictions saved.`),
          [{ text: formatUIText("ok"), onPress: () => router.back() }]
        );
      }
    } catch {
      // Error handled by mutation onError
    } finally {
      setSubmitting(false);
    }
  };

  if (questionsQuery.isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <EggLoadingSpinner />
        <Text {...textStyles.hint} marginTop="$3">{formatUIText("loading questions...")}</Text>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background" testID="prediction-questions-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>
        {/* Header */}
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingTop={insets.top + 8}
          paddingBottom="$3"
        >
          <XStack alignItems="center" gap="$3">
            <SafeBackButton />
            <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color">
              {formatUIText("predict")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {/* Match Info */}
        {navCtx && (
          <Card padding="$3" marginBottom="$3">
            <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color" textAlign="center">
              {navCtx.teamA} {formatUIText("vs")} {navCtx.teamB}
            </Text>
          </Card>
        )}

        {/* Progress */}
        <XStack justifyContent="space-between" marginBottom="$3">
          <Text fontFamily="$mono" fontSize={12} color="$colorMuted">
            {answeredCount}/{questions.length} {formatUIText("answered")}
          </Text>
          <Badge variant="subtle">
            {formatBadgeText(`${questions.length} questions`)}
          </Badge>
        </XStack>

        {/* Alert */}
        {alertMessage && (
          <Card padding="$3" marginBottom="$3" borderColor="$error">
            <Text fontFamily="$body" fontSize={13} color="$error" textAlign="center">
              {alertMessage}
            </Text>
          </Card>
        )}

        {/* Questions */}
        {questions.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text {...textStyles.hint} marginTop="$3">
              {formatUIText("no prediction questions available for this match yet")}
            </Text>
          </YStack>
        ) : (
          questions.map((q: any, i: number) => (
            <Animated.View key={q.id} entering={FadeInDown.delay(i * 30).springify()}>
              <Card padding="$4" marginBottom="$3" testID={`question-${i}`}>
                {/* Question Header */}
                <XStack alignItems="center" gap="$2" marginBottom="$2">
                  <Text fontSize={20}>
                    {QUESTION_TYPE_ICONS[q.questionType] ?? "❓"}
                  </Text>
                  <YStack flex={1}>
                    <Text fontFamily="$body" fontWeight="600" fontSize={14} color="$color">
                      {q.questionText}
                    </Text>
                  </YStack>
                </XStack>

                {/* Metadata */}
                <XStack gap="$2" marginBottom="$3">
                  <Badge variant={(DIFFICULTY_COLORS[q.difficulty] ?? "default") as any}>
                    {formatBadgeText(q.difficulty ?? "medium")}
                  </Badge>
                  <Badge variant="subtle">
                    {q.pointsValue ?? 10} {formatBadgeText("pts")}
                  </Badge>
                  {q.bonusForExact && (
                    <Badge variant="subtle">{formatBadgeText("exact bonus")}</Badge>
                  )}
                </XStack>

                {/* Answer Options */}
                {renderAnswerInput(q, answers[q.id], (val: string) => setAnswer(q.id, val), theme)}
              </Card>
            </Animated.View>
          ))
        )}

        {/* Submit Button */}
        {questions.length > 0 && (
          <Button
            variant="primary"
            size="lg"
            marginTop="$4"
            onPress={handleSubmitAll}
            disabled={submitting || answeredCount === 0}
            opacity={answeredCount === 0 ? 0.4 : 1}
            testID="submit-predictions-btn"
          >
            {submitting
              ? formatUIText("submitting...")
              : formatUIText(`submit ${answeredCount} prediction${answeredCount !== 1 ? "s" : ""}`)}
          </Button>
        )}
      </ScrollView>
    </YStack>
  );
}

function renderAnswerInput(
  question: any,
  currentAnswer: string | undefined,
  onChange: (val: string) => void,
  theme: any
) {
  const options = (question.options ?? []) as string[];
  const qType = question.questionType as string;

  // For yes/no questions
  if (qType === "custom_yes_no" || qType === "century_scored") {
    const yesNoOptions = options.length > 0 ? options : ["Yes", "No"];
    return (
      <XStack gap="$2" flexWrap="wrap">
        {yesNoOptions.map((opt: string) => (
          <FilterPill
            key={opt}
            active={currentAnswer === opt}
            onPress={() => onChange(opt)}
          >
            {opt}
          </FilterPill>
        ))}
      </XStack>
    );
  }

  // For multi-choice / winner / range options
  if (options.length > 0) {
    return (
      <XStack gap="$2" flexWrap="wrap">
        {options.map((opt: string) => (
          <FilterPill
            key={opt}
            active={currentAnswer === opt}
            onPress={() => onChange(opt)}
          >
            {opt}
          </FilterPill>
        ))}
      </XStack>
    );
  }

  // For numeric/free-text input
  return (
    <TextInput
      value={currentAnswer ?? ""}
      onChangeText={onChange}
      placeholder={formatUIText("enter your prediction")}
      placeholderTextColor={theme.colorMuted?.val ?? "#888"}
      style={{
        borderWidth: 1,
        borderColor: theme.borderColor?.val ?? "#333",
        borderRadius: 8,
        padding: 12,
        color: theme.color?.val ?? "#fff",
        fontFamily: "monospace",
        fontSize: 14,
      }}
      testID={`answer-input-${question.id}`}
    />
  );
}
