/**
 * LivePredictionFeed — community-driven prediction cards during live matches.
 *
 * Shows in the contest detail page. League members create questions,
 * vote on outcomes, and earn/lose fantasy points based on results.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { TextInput, ActivityIndicator, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { YStack, XStack, useTheme } from "tamagui";
import { Text } from "../components/SportText";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  DesignSystem,
  formatUIText,
} from "@draftplay/ui";
import { trpc } from "../lib/trpc";

// ─── Types ──────────────────────────────────────────────────────────

interface LivePredictionFeedProps {
  contestId: string;
  matchId: string;
  matchContext?: {
    teamA?: string;
    teamB?: string;
    format?: string;
    score?: string;
    overs?: string;
  };
  isLive: boolean;
  currentUserId?: string | null;
  onScoreUpdate?: () => void;
}

// ─── Create Prediction Form ─────────────────────────────────────────

function CreatePredictionForm({
  contestId,
  matchId,
  matchContext,
  onCreated,
}: {
  contestId: string;
  matchId: string;
  matchContext?: LivePredictionFeedProps["matchContext"];
  onCreated: () => void;
}) {
  const theme = useTheme();
  const textColor = (theme.color?.val as string) ?? "#fff";
  const placeholderColor = (theme.placeholderColor?.val as string) ?? (theme.colorMuted?.val as string) ?? "#888";
  const surfaceColor = (theme.backgroundSurface?.val as string) ?? "transparent";
  const borderColorVal = (theme.borderColor?.val as string) ?? "#333";

  // Shared input style matching login page pattern but compact
  const inputStyle = {
    backgroundColor: surfaceColor,
    borderRadius: DesignSystem.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: textColor,
    fontSize: DesignSystem.fontSize.lg,
    borderWidth: 1,
    borderColor: borderColorVal,
    outlineColor: "#3D9968",
  } as const;

  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [deadlineType, setDeadlineType] = useState<"end_of_over" | "end_of_innings" | "end_of_match">("end_of_over");
  const [suggestions, setSuggestions] = useState<Array<{ question: string; optionA: string; optionB: string }>>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const createMutation = trpc.prediction.liveCreate.useMutation({
    onSuccess: () => {
      setShowForm(false);
      setQuestion("");
      setOptionA("");
      setOptionB("");
      setCreateError(null);
      onCreated();
    },
    onError: (err: any) => {
      const msg = err.message;
      if (msg.includes("only create")) {
        setCreateError("you've used all 5 predictions for this contest");
      } else if (msg.includes("must have a team")) {
        setCreateError("join this contest first to create predictions");
      } else {
        setCreateError("something went wrong — try again");
      }
    },
  });

  // AI suggestion usage tracker
  const usageQuery = trpc.prediction.liveSuggestUsage.useQuery(
    { matchId },
    { enabled: showForm, staleTime: 30_000 }
  );

  // AI suggestion generator (mutation — each call = 1 attempt = 3 questions)
  const suggestMutation = trpc.prediction.liveSuggest.useMutation({
    onSuccess: (data: any) => {
      setSuggestions((prev) => [...prev, ...data.suggestions]);
      usageQuery.refetch();
    },
  });

  const used = usageQuery.data?.used ?? 0;
  const limit = usageQuery.data?.limit ?? 2;
  const tier = usageQuery.data?.tier ?? "basic";
  const canGenerate = used < limit;

  if (!showForm) {
    return (
      <XStack
        testID="create-prediction-btn"
        backgroundColor="$backgroundSurface"
        borderRadius={DesignSystem.radius["2xl"]}
        padding="$3"
        alignItems="center"
        justifyContent="center"
        borderWidth={1}
        borderColor="$borderColor"
        borderStyle="dashed"
        cursor="pointer"
        pressStyle={{ opacity: 0.7 }}
        onPress={() => setShowForm(true)}
      >
        <Text fontSize={DesignSystem.fontSize.md} fontFamily="$mono" color="$colorSecondary">
          {formatUIText("+ create prediction")}
        </Text>
      </XStack>
    );
  }

  return (
    <Card
      padding="$4"
      gap="$3"
      borderRadius={DesignSystem.radius["2xl"]}
      borderWidth={1}
      borderColor="$borderColor"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="700" fontSize={DesignSystem.fontSize.lg} fontFamily="$mono">
          {formatUIText("ask your league a question")}
        </Text>
        <Text fontSize={DesignSystem.fontSize.xs} fontFamily="$mono" color="$colorSecondary">
          {formatUIText("5 per contest")}
        </Text>
      </XStack>

      {/* AI Generate Button + Usage */}
      <YStack gap="$2">
        <XStack gap="$2" alignItems="center">
          <XStack
            testID="ai-generate-btn"
            flex={1}
            backgroundColor={canGenerate ? "$accentBackground" : "$backgroundSurface"}
            borderRadius={DesignSystem.radius.md}
            padding="$2"
            paddingHorizontal="$3"
            alignItems="center"
            justifyContent="center"
            gap="$2"
            cursor={canGenerate ? "pointer" : "default"}
            opacity={canGenerate && !suggestMutation.isPending ? 1 : 0.5}
            pressStyle={{ opacity: 0.8, scale: 0.98 }}
            onPress={() => {
              if (!canGenerate || suggestMutation.isPending || !matchContext?.teamA) return;
              suggestMutation.mutate({
                matchId,
                teamA: matchContext?.teamA ?? "",
                teamB: matchContext?.teamB ?? "",
                format: matchContext?.format ?? "T20",
                score: matchContext?.score,
                overs: matchContext?.overs,
              });
            }}
          >
            {suggestMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text fontSize={DesignSystem.fontSize.xs} color={canGenerate ? "#fff" : "$colorSecondary"}>✨</Text>
            )}
            <Text fontSize={DesignSystem.fontSize.md} fontFamily="$mono" fontWeight="600" color={canGenerate ? "#fff" : "$colorSecondary"}>
              {formatUIText(suggestMutation.isPending ? "generating..." : "generate ai questions")}
            </Text>
          </XStack>
          <YStack alignItems="flex-end">
            <Text
              fontSize={DesignSystem.fontSize.sm}
              fontFamily="$mono"
              fontWeight="600"
              color={canGenerate ? "$colorSecondary" : "$red10"}
            >
              {used}/{limit}
            </Text>
            <Text fontSize={DesignSystem.fontSize.xs} fontFamily="$mono" color="$colorSecondary">
              {formatUIText("used")}
            </Text>
          </YStack>
        </XStack>

        {!canGenerate && tier !== "elite" && (
          <XStack
            backgroundColor="$backgroundSurface"
            borderRadius={DesignSystem.radius.sm}
            padding="$2"
            justifyContent="center"
          >
            <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color="$colorSecondary" textAlign="center">
              {formatUIText(`upgrade to ${tier === "basic" ? "pro" : "elite"} for more ai generations`)}
            </Text>
          </XStack>
        )}

        {/* Generated suggestions */}
        {suggestions.length > 0 && (
          <YStack gap="$2">
            <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color="$colorSecondary">
              {formatUIText("tap to use:")}
            </Text>
            {suggestions.map((s: any, i: number) => (
              <XStack
                key={i}
                testID={`suggestion-card-${i}`}
                backgroundColor="$backgroundSurface"
                borderRadius={DesignSystem.radius.md}
                padding="$2"
                paddingHorizontal="$3"
                borderWidth={1}
                borderColor="$borderColor"
                cursor="pointer"
                pressStyle={{ opacity: 0.7, scale: 0.98, borderColor: "$color" }}
                onPress={() => {
                  setQuestion(s.question);
                  setOptionA(s.optionA);
                  setOptionB(s.optionB);
                }}
              >
                <Text fontSize={DesignSystem.fontSize.md} flex={1}>{s.question}</Text>
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>

      {/* Divider */}
      <XStack height={1} backgroundColor="$borderColor" marginVertical="$1" />

      {/* Manual form */}
      <YStack gap="$2">
        <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color="$colorSecondary">
          {formatUIText("or type your own:")}
        </Text>
        <TextInput
          style={{ ...inputStyle, borderColor: question ? textColor : borderColorVal }}
          placeholder="will kohli hit a six this over?"
          placeholderTextColor={placeholderColor}
          value={question}
          onChangeText={setQuestion}
          maxLength={120}
        />

        {question.length > 0 && (
          <YStack gap="$3">
            {/* Options A vs B */}
            <XStack gap="$2" alignItems="center">
              <TextInput
                style={{ ...inputStyle, flex: 1, borderColor: optionA ? "#30a46c" : borderColorVal }}
                placeholder="yes"
                placeholderTextColor={placeholderColor}
                value={optionA}
                onChangeText={setOptionA}
                maxLength={60}
              />
              <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color="$colorSecondary" fontWeight="600">
                {formatUIText("vs")}
              </Text>
              <TextInput
                style={{ ...inputStyle, flex: 1, borderColor: optionB ? "#e5484d" : borderColorVal }}
                placeholder="no"
                placeholderTextColor={placeholderColor}
                value={optionB}
                onChangeText={setOptionB}
                maxLength={60}
              />
            </XStack>

            {/* Info — creator closes manually via "close voting" button */}
            <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color="$colorSecondary">
              {formatUIText("you control when voting closes")}
            </Text>

            {/* Error message */}
            {createError && (
              <XStack
                backgroundColor="#fef2f2"
                borderRadius={DesignSystem.radius.md}
                padding="$2"
                paddingHorizontal="$3"
                borderWidth={1}
                borderColor="#fca5a5"
              >
                <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" fontWeight="700" color="#dc2626">
                  {formatUIText(createError)}
                </Text>
              </XStack>
            )}

            {/* Action buttons */}
            <XStack gap="$2">
              <Button
                variant="outlined"
                size="sm"
                flex={1}
                onPress={() => {
                  setShowForm(false);
                  setQuestion("");
                  setOptionA("");
                  setOptionB("");
                  setSuggestions([]);
                }}
              >
                {formatUIText("cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                flex={2}
                disabled={!question || !optionA || !optionB || createMutation.isPending || !!createError}
                onPress={() => {
                  setCreateError(null);
                  createMutation.mutate({
                    contestId,
                    matchId,
                    question,
                    optionA,
                    optionB,
                    deadlineType,
                    matchContext,
                  });
                }}
              >
                {formatUIText(createError ? "limit reached" : createMutation.isPending ? "posting..." : "post to league")}
              </Button>
            </XStack>
          </YStack>
        )}
      </YStack>
    </Card>
  );
}

// ─── Prediction Card ────────────────────────────────────────────────

function PredictionCard({
  prediction,
  onVote,
  onClose,
  onResolve,
  onAbandon,
  isVoting,
  currentUserId,
  resolveError,
}: {
  prediction: any;
  onVote: (predictionId: string, option: "a" | "b") => void;
  onClose: (predictionId: string) => void;
  onResolve: (predictionId: string, option: "a" | "b") => void;
  onAbandon: (predictionId: string) => void;
  isVoting: boolean;
  currentUserId: string | null;
  resolveError: string | null;
}) {
  const [selectedResolve, setSelectedResolve] = useState<"a" | "b" | null>(null);
  const isOpen = prediction.status === "open";
  const isClosed = prediction.status === "closed";
  const isResolved = prediction.status === "resolved";
  const isAbandoned = prediction.status === "abandoned";
  const isCreator = currentUserId === prediction.creatorId;
  const hasVoted = !!prediction.myVote;
  const totalVotes = prediction.totalVotes;

  // Auto-expand: unanswered questions or creator's unclosed questions
  const needsAction = (isOpen && !hasVoted) || (isClosed && isCreator);
  const [expanded, setExpanded] = useState(needsAction);

  // ── Unread comment tracking ──
  const storageKey = `pred_read_${prediction.id}`;
  const [lastReadCount, setLastReadCount] = useState<number>(prediction.commentCount);
  const hasUnread = prediction.commentCount > lastReadCount;

  // Load persisted read count on mount
  useEffect(() => {
    AsyncStorage.getItem(storageKey).then((val) => {
      if (val !== null) setLastReadCount(Number(val));
      else setLastReadCount(0); // never opened = all unread
    });
  }, [storageKey]);

  // When expanded, mark all comments as read
  useEffect(() => {
    if (expanded && prediction.commentCount > 0) {
      setLastReadCount(prediction.commentCount);
      AsyncStorage.setItem(storageKey, String(prediction.commentCount));
    }
  }, [expanded, prediction.commentCount, storageKey]);

  const difficultyColor = prediction.difficulty === "hard"
    ? "#E5484D"
    : prediction.difficulty === "medium"
    ? "#F5A623"
    : "#30A46C";

  // ── Status badge logic ──
  const statusBadge = (() => {
    if (isOpen && !hasVoted) return { label: "vote", color: "#F5A623", variant: "warning" as const };
    if (isClosed && isCreator) return { label: "resolve", color: "#E5484D", variant: "destructive" as const };
    if (isResolved && prediction.myVote) {
      const won = (prediction.myVote.pointsAwarded ?? 0) > 0;
      return won
        ? { label: `+${prediction.myVote.pointsAwarded}`, color: "#30A46C", variant: "default" as const }
        : { label: `${prediction.myVote.pointsAwarded}`, color: "#E5484D", variant: "destructive" as const };
    }
    if (isOpen && hasVoted) return { label: "voted", color: "#30A46C", variant: "default" as const };
    if (isClosed) return { label: "closed", color: "#888", variant: "outlined" as const };
    if (isAbandoned) return { label: "abandoned", color: "#888", variant: "outlined" as const };
    return null;
  })();

  // ── Collapsed view ──
  if (!expanded) {
    return (
      <Card
        padding="$3"
        borderRadius={DesignSystem.radius["2xl"]}
        borderWidth={1}
        borderColor="$borderColor"
        cursor="pointer"
        pressStyle={{ opacity: 0.85, scale: 0.98 }}
        onPress={() => setExpanded(true)}
      >
        <XStack justifyContent="space-between" alignItems="center" gap="$2">
          <XStack alignItems="center" gap="$2" flex={1}>
            <InitialsAvatar name={prediction.creatorName} playerRole="BAT" ovr={0} size={20} hideBadge />
            <Text fontSize={DesignSystem.fontSize.md} fontWeight="600" flex={1} numberOfLines={1}>
              {prediction.question}
            </Text>
          </XStack>
          <XStack gap="$2" alignItems="center">
            {/* Comment count + unread indicator */}
            {prediction.commentCount > 0 && (
              <XStack alignItems="center" gap={3}>
                {hasUnread && (
                  <YStack width={7} height={7} borderRadius={4} backgroundColor="#E5484D" />
                )}
                <Text fontSize={10}>💬</Text>
                <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.xs} fontWeight="700" color={hasUnread ? "#E5484D" : "$color"}>
                  {hasUnread ? `${prediction.commentCount - lastReadCount} new` : prediction.commentCount}
                </Text>
              </XStack>
            )}
            {statusBadge && (
              <Text
                fontFamily="$mono"
                fontSize={DesignSystem.fontSize.sm}
                fontWeight="700"
                color={statusBadge.color as any}
              >
                {statusBadge.label}
              </Text>
            )}
            <Text fontSize={DesignSystem.fontSize.xs} color="$colorMuted">▼</Text>
          </XStack>
        </XStack>
      </Card>
    );
  }

  // ── Expanded view ──
  return (
    <Card
      padding="$4"
      gap="$3"
      borderRadius={DesignSystem.radius["2xl"]}
      borderWidth={1}
      borderColor="$borderColor"
    >
      {/* Collapse handle */}
      <XStack
        justifyContent="space-between"
        alignItems="center"
        cursor="pointer"
        pressStyle={{ opacity: 0.7 }}
        onPress={() => setExpanded(false)}
      >
        <XStack alignItems="center" gap="$2">
          <InitialsAvatar name={prediction.creatorName} playerRole="BAT" ovr={0} size={24} hideBadge />
          <YStack>
            <Text fontSize={DesignSystem.fontSize.md} fontWeight="600">
              {prediction.creatorName}
            </Text>
            {prediction.creatorTitle && (
              <Text fontSize={DesignSystem.fontSize.xs} fontFamily="$mono" color="$colorSecondary">
                {prediction.creatorTitle}
              </Text>
            )}
          </YStack>
        </XStack>
        <XStack gap="$2" alignItems="center">
          <Badge
            size="xs"
            variant={prediction.difficulty === "hard" ? "destructive" : prediction.difficulty === "medium" ? "warning" : "default"}
          >
            {formatUIText(prediction.difficulty)}
          </Badge>
          <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color={difficultyColor} fontWeight="600">
            +{prediction.ptsCorrect}/-{Math.abs(prediction.ptsWrong)}
          </Text>
          <Text fontSize={DesignSystem.fontSize.xs} color="$colorMuted">▲</Text>
        </XStack>
      </XStack>

      {/* Question */}
      <Text fontSize={DesignSystem.fontSize.xl} fontWeight="600" lineHeight={20}>
        {prediction.question}
      </Text>

      {/* Options / Voting — open and hasn't voted */}
      {isOpen && !hasVoted && (
        <XStack gap="$2">
          <XStack
            flex={1}
            backgroundColor="$backgroundSurface"
            borderRadius={DesignSystem.radius.md}
            padding="$3"
            alignItems="center"
            justifyContent="center"
            borderWidth={1}
            borderColor="$borderColor"
            opacity={isVoting ? 0.5 : 1}
            cursor="pointer"
            hoverStyle={{ borderColor: "$colorAccent", backgroundColor: "$backgroundSurfaceHover" }}
            pressStyle={{ opacity: 0.85, scale: 0.97, borderColor: "$colorAccent" }}
            onPress={() => !isVoting && onVote(prediction.id, "a")}
          >
            <Text fontSize={DesignSystem.fontSize.md} fontFamily="$mono" fontWeight="600">
              {formatUIText(prediction.optionA)}
            </Text>
          </XStack>
          <XStack
            flex={1}
            backgroundColor="$backgroundSurface"
            borderRadius={DesignSystem.radius.md}
            padding="$3"
            alignItems="center"
            justifyContent="center"
            borderWidth={1}
            borderColor="$borderColor"
            opacity={isVoting ? 0.5 : 1}
            cursor="pointer"
            hoverStyle={{ borderColor: "$colorAccent", backgroundColor: "$backgroundSurfaceHover" }}
            pressStyle={{ opacity: 0.85, scale: 0.97, borderColor: "$colorAccent" }}
            onPress={() => !isVoting && onVote(prediction.id, "b")}
          >
            <Text fontSize={DesignSystem.fontSize.md} fontFamily="$mono" fontWeight="600">
              {formatUIText(prediction.optionB)}
            </Text>
          </XStack>
        </XStack>
      )}

      {/* Poll bars — shown after voting or when resolved */}
      {(hasVoted || isResolved) && (
        <YStack gap="$2">
          <PollBar
            label={prediction.optionA}
            pct={prediction.pctA}
            isWinner={isResolved && prediction.result === "a"}
            isLoser={isResolved && prediction.result === "b"}
            isMyPick={prediction.myVote?.pickedOption === "a"}
            isResolved={isResolved}
          />
          {prediction.votersA?.length > 0 && (
            <Text fontSize={DesignSystem.fontSize.xs} fontFamily="$mono" color="$colorSecondary" paddingLeft="$3">
              {prediction.votersA.join(", ")}
            </Text>
          )}
          <PollBar
            label={prediction.optionB}
            pct={prediction.pctB}
            isWinner={isResolved && prediction.result === "b"}
            isLoser={isResolved && prediction.result === "a"}
            isMyPick={prediction.myVote?.pickedOption === "b"}
            isResolved={isResolved}
          />
          {prediction.votersB?.length > 0 && (
            <Text fontSize={DesignSystem.fontSize.xs} fontFamily="$mono" color="$colorSecondary" paddingLeft="$3">
              {prediction.votersB.join(", ")}
            </Text>
          )}
          <Text
            fontSize={DesignSystem.fontSize.sm}
            fontFamily="$mono"
            color="$colorSecondary"
            textAlign="center"
            marginTop="$1"
          >
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
          </Text>
        </YStack>
      )}

      {/* Resolved — show result + points (roast moved to chat) */}
      {isResolved && prediction.myVote && (() => {
        const won = (prediction.myVote.pointsAwarded ?? 0) > 0;
        const accentColor = won ? "#30A46C" : "#E5484D";
        return (
          <XStack
            backgroundColor={won ? "rgba(48, 164, 108, 0.10)" : "rgba(229, 72, 77, 0.08)"}
            borderRadius={DesignSystem.radius.md}
            padding="$3"
            alignItems="center"
            gap="$3"
            borderWidth={1}
            borderColor={won ? "rgba(48, 164, 108, 0.25)" : "rgba(229, 72, 77, 0.20)"}
          >
            <Text fontSize={DesignSystem.fontSize.lg} fontFamily="$mono" fontWeight="800" color={accentColor}>
              {won ? "+" : ""}{prediction.myVote.pointsAwarded} pts
            </Text>
            <Text fontSize={DesignSystem.fontSize.md} fontWeight="600" color={accentColor} flex={1}>
              {won ? "nice call!" : "wrong call"}
            </Text>
          </XStack>
        );
      })()}

      {/* Resolved — no vote (spectator) */}
      {isResolved && !prediction.myVote && prediction.aiExplanation && (
        <Text fontSize={DesignSystem.fontSize.base} color="$colorSecondary" lineHeight={16}>
          {prediction.aiExplanation}
        </Text>
      )}

      {/* Resolve button — only creator can pick the winner after closing */}
      {isClosed && isCreator && (
        <ResolveSection
          prediction={prediction}
          selectedResolve={selectedResolve}
          setSelectedResolve={setSelectedResolve}
          resolveError={resolveError}
          onResolve={onResolve}
          onAbandon={onAbandon}
        />
      )}

      {/* Abandoned — no votes were cast */}
      {isAbandoned && (
        <XStack justifyContent="center" paddingTop="$1">
          <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color="$colorSecondary">
            {formatUIText("abandoned — no votes were cast")}
          </Text>
        </XStack>
      )}

      {/* Status — watching + close button for creator */}
      {isOpen && (
        <XStack justifyContent="space-between" alignItems="center" paddingTop="$1">
          <Text
            fontSize={DesignSystem.fontSize.sm}
            fontFamily="$mono"
            color="$colorSecondary"
          >
            {formatUIText(hasVoted ? "watching \u2022 voting open" : "voting open")}
          </Text>
          {isCreator && (
            <XStack
              backgroundColor="$backgroundSurface"
              borderRadius={DesignSystem.radius.md}
              paddingVertical="$1"
              paddingHorizontal="$2"
              borderWidth={1}
              borderColor="$borderColor"
              cursor="pointer"
              pressStyle={{ opacity: 0.7 }}
              onPress={() => onClose(prediction.id)}
            >
              <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" fontWeight="600" color="#E5484D">
                {formatUIText("close voting")}
              </Text>
            </XStack>
          )}
        </XStack>
      )}

      {/* Closed — waiting for creator to resolve */}
      {isClosed && !isCreator && (
        <XStack justifyContent="center" paddingTop="$1">
          <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color="$colorSecondary">
            {formatUIText("voting closed \u2022 waiting for result")}
          </Text>
        </XStack>
      )}

      {/* Chat thread — always visible when expanded (no toggle) */}
      {(hasVoted || isResolved || isClosed) && (
        <CommentThread predictionId={prediction.id} currentUserId={currentUserId} alwaysOpen />
      )}
    </Card>
  );
}

// ─── Comment Thread ─────────────────────────────────────────────────

function CommentThread({
  predictionId,
  currentUserId,
  alwaysOpen,
}: {
  predictionId: string;
  currentUserId: string | null;
  alwaysOpen?: boolean;
}) {
  const theme = useTheme();
  const inputTextColor = (theme.color?.val as string) ?? "#eee";
  const inputBorderColor = (theme.borderColor?.val as string) ?? "#333";
  const inputPlaceholderColor = (theme.placeholderColor?.val as string) ?? "#888";
  const [expanded, setExpanded] = useState(!!alwaysOpen);
  const [text, setText] = useState("");
  const utils = trpc.useUtils();

  const commentsQuery = trpc.prediction.getComments.useQuery(
    { predictionId },
    { enabled: expanded || !!alwaysOpen, refetchInterval: 5_000 }
  );

  const addComment = trpc.prediction.addComment.useMutation({
    onSuccess: () => {
      setText("");
      utils.prediction.getComments.invalidate({ predictionId });
      // Also refresh prediction list so collapsed card comment count updates
      utils.prediction.liveList.invalidate();
    },
  });

  const comments = commentsQuery.data ?? [];
  const commentCount = comments.length;

  function getTimeAgo(d: Date | string): string {
    const ms = Date.now() - new Date(d).getTime();
    const mins = Math.floor(ms / 60_000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h`;
  }

  return (
    <YStack gap="$1" borderTopWidth={1} borderTopColor="$borderColor" paddingTop="$2" marginTop="$1">
      {/* Toggle — hidden when alwaysOpen */}
      {!alwaysOpen && (
        <XStack
          alignItems="center"
          gap="$2"
          cursor="pointer"
          pressStyle={{ opacity: 0.7 }}
          onPress={() => setExpanded(!expanded)}
        >
          <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.sm} fontWeight="600" color="$colorAccent">
            {formatUIText(expanded ? "hide chat" : commentCount > 0 ? `chat (${commentCount})` : "chat")}
          </Text>
          <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.xs} color="$colorSecondary">
            {expanded ? "▲" : "▼"}
          </Text>
        </XStack>
      )}

      {/* Chat label when always open */}
      {alwaysOpen && (
        <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.sm} fontWeight="600" color="$colorAccent">
          {formatUIText(commentCount > 0 ? `chat (${commentCount})` : "chat")}
        </Text>
      )}

      {/* Thread content */}
      {(expanded || alwaysOpen) && (
        <YStack gap="$2" marginTop="$1">
          {/* Comments list */}
          {commentsQuery.isLoading ? (
            <ActivityIndicator size="small" />
          ) : comments.length > 0 ? (
            <YStack gap="$2">
              {comments.map((c: any) => {
                const isMe = !!currentUserId && c.userId === currentUserId;
                const isSys = !!c.isSystem;

                // System messages — centered, italic
                if (isSys) {
                  return (
                    <YStack key={c.id} alignItems="center" paddingVertical="$1">
                      <YStack
                        backgroundColor="rgba(245, 166, 35, 0.08)"
                        borderRadius={DesignSystem.radius.md}
                        paddingVertical="$1"
                        paddingHorizontal="$3"
                        maxWidth="90%"
                      >
                        <Text
                          fontSize={DesignSystem.fontSize.base}
                          fontStyle="italic"
                          color="$colorAccent"
                          textAlign="center"
                          lineHeight={15}
                        >
                          {c.message}
                        </Text>
                        <Text fontFamily="$mono" fontSize={8} color="$colorMuted" textAlign="center" marginTop={2}>
                          {c.displayName} {"\u2022"} {getTimeAgo(c.createdAt)}
                        </Text>
                      </YStack>
                    </YStack>
                  );
                }

                // My messages — right aligned
                if (isMe) {
                  return (
                    <XStack key={c.id} justifyContent="flex-end" paddingLeft="$6">
                      <YStack
                        backgroundColor="$accentBackground"
                        borderRadius={12}
                        borderBottomRightRadius={4}
                        paddingVertical={6}
                        paddingHorizontal={10}
                        gap={2}
                      >
                        <Text fontSize={DesignSystem.fontSize.base} color="$accentColor" lineHeight={18}>
                          {c.message}
                        </Text>
                        <Text fontFamily="$mono" fontSize={8} color="$accentColor" opacity={0.6} textAlign="right">
                          {getTimeAgo(c.createdAt)}
                        </Text>
                      </YStack>
                    </XStack>
                  );
                }

                // Others' messages — left aligned with avatar, bubble flows from avatar
                return (
                  <XStack key={c.id} justifyContent="flex-start" alignItems="flex-end" gap={4} paddingRight="$6">
                    <InitialsAvatar
                      name={c.displayName}
                      playerRole="BAT"
                      ovr={0}
                      size={22}
                      hideBadge
                    />
                    <YStack
                      backgroundColor="$backgroundSurfaceAlt"
                      borderRadius={12}
                      borderBottomLeftRadius={2}
                      paddingVertical={6}
                      paddingHorizontal={10}
                      maxWidth="75%"
                      gap={2}
                    >
                      <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.xs} fontWeight="700" color="$colorAccent">
                        {c.displayName}
                      </Text>
                      <Text fontSize={DesignSystem.fontSize.base} color="$color" lineHeight={18}>
                        {c.message}
                      </Text>
                      <Text fontFamily="$mono" fontSize={8} color="$colorMuted">
                        {getTimeAgo(c.createdAt)}
                      </Text>
                    </YStack>
                  </XStack>
                );
              })}
            </YStack>
          ) : (
            <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.xs} color="$colorMuted">
              {formatUIText("no comments yet — be the first!")}
            </Text>
          )}

          {/* Input */}
          {currentUserId && (
            <XStack gap="$2" alignItems="center">
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="say something..."
                placeholderTextColor={inputPlaceholderColor}
                maxLength={200}
                style={{
                  flex: 1,
                  fontFamily: "DMMono_400Regular",
                  fontSize: 11,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: inputBorderColor,
                  color: inputTextColor,
                }}
              />
              <XStack
                backgroundColor="$accentBackground"
                borderRadius={DesignSystem.radius.md}
                paddingVertical="$1"
                paddingHorizontal="$2"
                opacity={text.trim().length === 0 || addComment.isPending ? 0.4 : 1}
                cursor="pointer"
                pressStyle={{ opacity: 0.7, scale: 0.97 }}
                onPress={() => {
                  if (text.trim().length > 0 && !addComment.isPending) {
                    addComment.mutate({ predictionId, message: text.trim() });
                  }
                }}
              >
                <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.sm} fontWeight="600" color="$accentColor">
                  {addComment.isPending ? "..." : "send"}
                </Text>
              </XStack>
            </XStack>
          )}
        </YStack>
      )}
    </YStack>
  );
}

// ─── Resolve Section ────────────────────────────────────────────────

function ResolveSection({
  prediction,
  selectedResolve,
  setSelectedResolve,
  resolveError,
  onResolve,
  onAbandon,
}: {
  prediction: any;
  selectedResolve: "a" | "b" | null;
  setSelectedResolve: (v: "a" | "b" | null) => void;
  resolveError: string | null;
  onResolve: (predictionId: string, option: "a" | "b") => void;
  onAbandon: (predictionId: string) => void;
}) {
  const theme = useTheme();
  const isDark = theme.background?.val?.toString().startsWith("#0") || theme.background?.val?.toString().startsWith("#1");

  const selectedBg = isDark ? "rgba(48, 164, 108, 0.20)" : "rgba(48, 164, 108, 0.12)";
  const selectedBorder = "#30A46C";
  const hoverBg = isDark ? "rgba(48, 164, 108, 0.12)" : "rgba(48, 164, 108, 0.08)";

  return (
    <YStack
      gap="$2"
      backgroundColor="$backgroundSurface"
      borderRadius={DesignSystem.radius.md}
      padding="$3"
    >
      {resolveError && (
        <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color="#E5484D">
          {resolveError}
        </Text>
      )}
      <Text fontSize={DesignSystem.fontSize.base} fontFamily="$mono" color="$colorSecondary">
        {formatUIText(selectedResolve ? "confirm your pick:" : "what happened? tap the winner:")}
      </Text>
      <XStack gap="$2">
        <XStack
          flex={1}
          backgroundColor={selectedResolve === "a" ? selectedBg : undefined}
          borderRadius={DesignSystem.radius.md}
          padding="$3"
          alignItems="center"
          justifyContent="center"
          borderWidth={selectedResolve === "a" ? 2 : 1}
          borderColor={selectedResolve === "a" ? selectedBorder : "$borderColor"}
          cursor="pointer"
          hoverStyle={{ borderColor: selectedBorder, backgroundColor: hoverBg }}
          pressStyle={{ opacity: 0.85, scale: 0.97, borderColor: selectedBorder }}
          onPress={() => setSelectedResolve(selectedResolve === "a" ? null : "a")}
        >
          <Text fontSize={DesignSystem.fontSize.md} fontFamily="$mono" fontWeight={selectedResolve === "a" ? "700" : "600"} color={selectedResolve === "a" ? selectedBorder : "$color"}>
            {selectedResolve === "a" ? "✓ " : ""}{formatUIText(prediction.optionA)}
          </Text>
        </XStack>
        <XStack
          flex={1}
          backgroundColor={selectedResolve === "b" ? selectedBg : undefined}
          borderRadius={DesignSystem.radius.md}
          padding="$3"
          alignItems="center"
          justifyContent="center"
          borderWidth={selectedResolve === "b" ? 2 : 1}
          borderColor={selectedResolve === "b" ? selectedBorder : "$borderColor"}
          cursor="pointer"
          hoverStyle={{ borderColor: selectedBorder, backgroundColor: hoverBg }}
          pressStyle={{ opacity: 0.85, scale: 0.97, borderColor: selectedBorder }}
          onPress={() => setSelectedResolve(selectedResolve === "b" ? null : "b")}
        >
          <Text fontSize={DesignSystem.fontSize.md} fontFamily="$mono" fontWeight={selectedResolve === "b" ? "700" : "600"} color={selectedResolve === "b" ? selectedBorder : "$color"}>
            {selectedResolve === "b" ? "✓ " : ""}{formatUIText(prediction.optionB)}
          </Text>
        </XStack>
      </XStack>
      {selectedResolve && (
        <Button variant="primary" size="sm" onPress={() => onResolve(prediction.id, selectedResolve)}>
          {formatUIText(`confirm — ${selectedResolve === "a" ? prediction.optionA : prediction.optionB} wins`)}
        </Button>
      )}
      <XStack
        justifyContent="center"
        paddingTop="$1"
        cursor="pointer"
        hoverStyle={{ opacity: 0.8 }}
        pressStyle={{ opacity: 0.7 }}
        onPress={() => onAbandon(prediction.id)}
      >
        <Text fontSize={DesignSystem.fontSize.sm} fontFamily="$mono" color="$colorSecondary" textDecorationLine="underline">
          {formatUIText("abandon prediction")}
        </Text>
      </XStack>
    </YStack>
  );
}

// ─── Poll Bar ───────────────────────────────────────────────────────

function PollBar({
  label,
  pct,
  isWinner,
  isLoser,
  isMyPick,
  isResolved,
}: {
  label: string;
  pct: number;
  isWinner?: boolean;
  isLoser?: boolean;
  isMyPick?: boolean;
  isResolved?: boolean;
}) {
  const theme = useTheme();
  const isDark = theme.background?.val?.toString().startsWith("#0") || theme.background?.val?.toString().startsWith("#1");

  // ── Determine visual state ──
  // 1. Resolved winner: green
  // 2. Resolved loser: red/muted
  // 3. My pick (voted, not resolved): accent/prominent
  // 4. Not my pick (voted, not resolved): muted/neutral
  let bgColor: string;
  let fillColor: string;
  let borderCol: string;
  let textColor: string;
  let pctColor: string;

  if (isWinner) {
    // Resolved — winning option
    bgColor = isDark ? "rgba(48, 164, 108, 0.15)" : "rgba(48, 164, 108, 0.10)";
    fillColor = isDark ? "rgba(48, 164, 108, 0.40)" : "rgba(48, 164, 108, 0.25)";
    borderCol = "#30A46C";
    textColor = "#30A46C";
    pctColor = "#30A46C";
  } else if (isLoser) {
    // Resolved — losing option
    bgColor = isDark ? "rgba(229, 72, 77, 0.08)" : "rgba(229, 72, 77, 0.05)";
    fillColor = isDark ? "rgba(229, 72, 77, 0.20)" : "rgba(229, 72, 77, 0.12)";
    borderCol = isDark ? "rgba(229, 72, 77, 0.4)" : "rgba(229, 72, 77, 0.3)";
    textColor = isDark ? "rgba(229, 72, 77, 0.7)" : "rgba(229, 72, 77, 0.6)";
    pctColor = isDark ? "rgba(229, 72, 77, 0.7)" : "rgba(229, 72, 77, 0.6)";
  } else if (isMyPick) {
    // Voted but not yet resolved — MY pick (prominent)
    bgColor = isDark ? "rgba(48, 164, 108, 0.10)" : "rgba(48, 164, 108, 0.06)";
    fillColor = isDark ? "rgba(48, 164, 108, 0.30)" : "rgba(48, 164, 108, 0.18)";
    borderCol = isDark ? "rgba(48, 164, 108, 0.6)" : "rgba(48, 164, 108, 0.5)";
    textColor = "#30A46C";
    pctColor = "#30A46C";
  } else {
    // Voted but not yet resolved — the OTHER option (neutral/muted)
    bgColor = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";
    fillColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
    borderCol = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    textColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)";
    pctColor = isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)";
  }

  return (
    <XStack
      backgroundColor={bgColor as any}
      borderRadius={DesignSystem.radius.md}
      overflow="hidden"
      height={36}
      alignItems="center"
      borderWidth={isMyPick || isWinner ? 2 : 1}
      borderColor={borderCol as any}
    >
      {/* Fill bar */}
      <XStack
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        width={`${Math.max(pct > 0 ? 8 : 0, pct)}%`}
        backgroundColor={fillColor as any}
        borderRadius={DesignSystem.radius.md}
      />
      <XStack flex={1} paddingHorizontal="$3" justifyContent="space-between" alignItems="center" zIndex={1}>
        <Text
          fontSize={DesignSystem.fontSize.md}
          fontWeight={isMyPick || isWinner ? "700" : "500"}
          color={textColor as any}
        >
          {isWinner ? "✓ " : isMyPick ? "▸ " : ""}{label}
        </Text>
        <Text
          fontSize={DesignSystem.fontSize.md}
          fontFamily="$mono"
          fontWeight="700"
          color={pctColor as any}
        >
          {pct}%
        </Text>
      </XStack>
    </XStack>
  );
}

// ─── Deadline Countdown ─────────────────────────────────────────────

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState(() => {
    const ms = new Date(deadline).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = new Date(deadline).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(ms / 1000));
      setRemaining(secs);
      if (secs <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (remaining <= 0) {
    return (
      <YStack
        backgroundColor="rgba(229, 72, 77, 0.12)"
        borderRadius={DesignSystem.radius.lg}
        padding="$3"
        alignItems="center"
      >
        <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.sm} fontWeight="700" color="#E5484D">
          {formatUIText("time's up — finalizing results...")}
        </Text>
      </YStack>
    );
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining <= 300; // 5 min

  return (
    <YStack
      backgroundColor={isUrgent ? "rgba(229, 72, 77, 0.12)" : "rgba(245, 166, 35, 0.10)"}
      borderRadius={DesignSystem.radius.lg}
      padding="$3"
      gap="$1"
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.sm} fontWeight="700" color={isUrgent ? "#E5484D" : "$colorAccent"}>
          {formatUIText("resolve your predictions!")}
        </Text>
        <XStack alignItems="center" gap={4}>
          <Text fontSize={DesignSystem.fontSize.xs}>⏰</Text>
          <Text
            fontFamily="$mono"
            fontSize={DesignSystem.fontSize.lg}
            fontWeight="800"
            color={isUrgent ? "#E5484D" : "$colorAccent"}
          >
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </Text>
        </XStack>
      </XStack>
      <Text fontFamily="$mono" fontSize={DesignSystem.fontSize.xs} color="$colorMuted">
        {formatUIText("unresolved predictions will be auto-abandoned when time runs out")}
      </Text>
    </YStack>
  );
}

// ─── Main Feed ──────────────────────────────────────────────────────

export function LivePredictionFeed({ contestId, matchId, matchContext, isLive, currentUserId, onScoreUpdate }: LivePredictionFeedProps) {
  const utils = trpc.useUtils();

  const listQuery = trpc.prediction.liveList.useQuery(
    { contestId, matchId },
    { enabled: !!contestId && !!matchId, refetchInterval: isLive ? 5_000 : 10_000 }
  );

  const voteMutation = trpc.prediction.liveVote.useMutation({
    onSuccess: () => utils.prediction.liveList.invalidate({ contestId, matchId }),
  });

  const closeMutation = trpc.prediction.liveClose.useMutation({
    onSuccess: () => utils.prediction.liveList.invalidate({ contestId, matchId }),
  });

  const [resolveError, setResolveError] = useState<string | null>(null);

  const resolveMutation = trpc.prediction.liveResolve.useMutation({
    onSuccess: () => {
      setResolveError(null);
      utils.prediction.liveList.invalidate({ contestId, matchId });
      utils.prediction.getComments.invalidate();
      onScoreUpdate?.();
    },
    onError: (err: any) => {
      // Show threshold error inline
      setResolveError(err.message);
    },
  });

  const abandonMutation = trpc.prediction.liveAbandon.useMutation({
    onSuccess: () => {
      setResolveError(null);
      utils.prediction.liveList.invalidate({ contestId, matchId });
      utils.prediction.getComments.invalidate();
    },
  });

  const handleVote = useCallback((predictionId: string, option: "a" | "b") => {
    voteMutation.mutate({ predictionId, pickedOption: option });
  }, [voteMutation]);

  const handleClose = useCallback((predictionId: string) => {
    closeMutation.mutate({ predictionId });
  }, [closeMutation]);

  const handleResolve = useCallback((predictionId: string, option: "a" | "b") => {
    setResolveError(null);
    resolveMutation.mutate({ predictionId, winningOption: option });
  }, [resolveMutation]);

  const handleAbandon = useCallback((predictionId: string) => {
    abandonMutation.mutate({ predictionId });
  }, [abandonMutation]);

  const predictions = listQuery.data?.predictions ?? [];
  const myTitle = listQuery.data?.myTitle;
  const dbUserId = listQuery.data?.myUserId ?? null;
  const predictionDeadline = listQuery.data?.predictionDeadline ?? null;

  if (!isLive && predictions.length === 0) return null;

  return (
    <YStack gap="$3">
      {/* Section header */}
      <XStack justifyContent="space-between" alignItems="center">
        <XStack alignItems="center" gap="$2">
          <Text fontWeight="700" fontSize={DesignSystem.fontSize["2xl"]} fontFamily="$mono">
            {formatUIText("predictions")}
          </Text>
          {myTitle && (
            <Badge size="xs" variant="outlined">{myTitle}</Badge>
          )}
        </XStack>
        {predictions.length > 0 && (
          <Text fontSize={DesignSystem.fontSize.base} fontFamily="$mono" color="$colorSecondary">
            {predictions.length} active
          </Text>
        )}
      </XStack>

      {/* Deadline countdown — shown after match ends during 15-min grace period */}
      {predictionDeadline && <DeadlineCountdown deadline={predictionDeadline} />}

      {/* Create button (only during live) */}
      {isLive && (
        <CreatePredictionForm
          contestId={contestId}
          matchId={matchId}
          matchContext={matchContext}
          onCreated={() => utils.prediction.liveList.invalidate({ contestId, matchId })}
        />
      )}

      {/* Prediction cards */}
      {predictions.map((p: any) => (
        <PredictionCard
          key={p.id}
          prediction={p}
          onVote={handleVote}
          onClose={handleClose}
          onResolve={handleResolve}
          onAbandon={handleAbandon}
          isVoting={voteMutation.isPending}
          currentUserId={dbUserId}
          resolveError={resolveError}
        />
      ))}

      {isLive && predictions.length === 0 && (
        <Card
          padding="$4"
          alignItems="center"
          borderRadius={DesignSystem.radius["2xl"]}
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Text
            fontSize={DesignSystem.fontSize.md}
            fontFamily="$mono"
            color="$colorSecondary"
            textAlign="center"
          >
            {formatUIText("no predictions yet — be the first to ask your league a question!")}
          </Text>
        </Card>
      )}
    </YStack>
  );
}
