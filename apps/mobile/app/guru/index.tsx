import { TextInput, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useState, useRef, useCallback } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Badge,
  BackButton,
  Button,
  EggLoadingSpinner,
  CricketBatIcon,
  Paywall,
  TierBadge,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  formatTeamName,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useNavigationStore } from "../../lib/navigation-store";
import { HeaderControls } from "../../components/HeaderControls";
import { usePaywall } from "../../hooks/usePaywall";

interface Message {
  id: string;
  role: "user" | "guru";
  content: string;
}

const SUGGESTIONS = [
  "who should i captain for IND vs AUS?",
  "build me a team under 100 credits",
  "what does waiver wire mean?",
  "preview of CSK vs MI",
];

export default function GuruScreen() {
  const router = useRouter();
  const navCtx = useNavigationStore((s) => s.matchContext);
  const params = {
    matchId: navCtx?.matchId,
    teamA: navCtx?.teamA,
    teamB: navCtx?.teamB,
  };
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();

  const flatListRef = useRef<FlatList>(null);
  const { gate, hasAccess, paywallProps } = usePaywall();
  const [userMessageCount, setUserMessageCount] = useState(0);
  const FREE_DAILY_LIMIT = 3;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "guru",
      content: "hi! i'm your cricket guru. ask me anything about fantasy cricket — team picks, rule explanations, match previews, or player comparisons.",
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const sendMutation = trpc.guru.sendMessage.useMutation();

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isSending) return;

    // Free tier: gate after daily limit
    if (!hasAccess("pro") && userMessageCount >= FREE_DAILY_LIMIT) {
      gate("pro", "Unlimited Guru", "Free users get 3 questions per day. Upgrade for unlimited access.");
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setUserMessageCount((c) => c + 1);
    setInput("");
    setIsSending(true);

    // Build context from URL params
    const context: any = {};
    if (params.matchId && params.teamA && params.teamB) {
      context.upcomingMatches = [{ id: params.matchId, teamA: params.teamA, teamB: params.teamB, date: "upcoming" }];
    }

    try {
      const result = await sendMutation.mutateAsync({
        conversationId,
        message: msg,
        context,
      });

      if (result.conversationId) {
        setConversationId(result.conversationId);
      }

      const guruMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "guru",
        content: result.response.content,
      };
      setMessages((prev) => [...prev, guruMsg]);
    } catch (error: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "guru",
        content: error?.message?.includes("UNAUTHORIZED")
          ? "you need to be logged in to chat with me. please sign in first!"
          : "sorry, i'm having a moment. could you try that question again?",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, isSending, conversationId, params, sendMutation, hasAccess, userMessageCount, gate]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
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
            {formatUIText("cricket guru")}
          </Text>
        </XStack>
        <XStack alignItems="center" gap="$2">
          {!hasAccess("pro") && (
            <XStack alignItems="center" gap="$1">
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {Math.max(0, FREE_DAILY_LIMIT - userMessageCount)}/{FREE_DAILY_LIMIT}
              </Text>
              <TierBadge tier="pro" size="sm" />
            </XStack>
          )}
          <HeaderControls />
        </XStack>
      </XStack>

      {/* Match context banner */}
      {params.teamA && params.teamB && (
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$2"
          gap="$2"
          alignItems="center"
          backgroundColor="$backgroundSurface"
          borderBottomWidth={1}
          borderBottomColor="$borderColor"
        >
          <CricketBatIcon size={12} />
          <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
            {formatUIText(`context: ${formatTeamName(params.teamA ?? "")} vs ${formatTeamName(params.teamB ?? "")}`)}
          </Text>
        </XStack>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 30).springify()}>
            <YStack
              maxWidth="85%"
              padding="$4"
              borderRadius="$4"
              alignSelf={item.role === "user" ? "flex-end" : "flex-start"}
              backgroundColor={item.role === "user" ? "$accentBackground" : "$backgroundSurface"}
              borderBottomRightRadius={item.role === "user" ? 4 : "$4"}
              borderBottomLeftRadius={item.role === "guru" ? 4 : "$4"}
              borderWidth={item.role === "guru" ? 1 : 0}
              borderColor={item.role === "guru" ? "$borderColor" : "transparent"}
            >
              {item.role === "guru" && (
                <XStack alignItems="center" gap="$2" marginBottom="$1">
                  <DraftPlayLogo size={14} />
                  <Badge variant="role" size="sm">
                    {formatBadgeText("cricket guru")}
                  </Badge>
                </XStack>
              )}
              <Text
                fontFamily="$body"
                fontSize={15}
                lineHeight={22}
                color={item.role === "user" ? "$accentColor" : "$color"}
              >
                {item.content}
              </Text>
            </YStack>
          </Animated.View>
        )}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        testID="guru-messages"
      />

      {/* Typing indicator */}
      {isSending && (
        <XStack paddingHorizontal="$4" paddingBottom="$2" gap="$2" alignItems="center">
          <EggLoadingSpinner size={16} />
          <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
            {formatUIText("guru is thinking...")}
          </Text>
        </XStack>
      )}

      {/* Suggestion chips */}
      {messages.length <= 1 && (
        <XStack flexWrap="wrap" gap="$2" paddingHorizontal="$4" paddingBottom="$3">
          {SUGGESTIONS.map((s) => (
            <XStack
              key={s}
              backgroundColor="$backgroundSurface"
              borderRadius="$round"
              paddingHorizontal="$4"
              paddingVertical="$2"
              borderWidth={1}
              borderColor="$borderColor"
              onPress={() => sendMessage(s)}
              cursor="pointer"
              pressStyle={{ scale: 0.97, backgroundColor: "$backgroundSurfaceHover" }}
              testID={`suggestion-${s.slice(0, 10)}`}
            >
              <Text fontFamily="$body" fontSize={13} color="$colorSecondary">{s}</Text>
            </XStack>
          ))}
        </XStack>
      )}

      {/* Input */}
      <XStack
        padding="$3"
        paddingBottom={insets.bottom + 8}
        gap="$2"
        borderTopWidth={1}
        borderTopColor="$borderColor"
      >
        <TextInput
          style={{
            flex: 1,
            backgroundColor: theme.backgroundSurface.val,
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: theme.color.val,
            fontSize: 15,
          }}
          placeholder={formatUIText("ask cricket guru...")}
          placeholderTextColor={theme.placeholderColor.val}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
          editable={!isSending}
          testID="guru-input"
        />
        <Button
          variant="primary"
          size="md"
          borderRadius={24}
          paddingHorizontal="$5"
          onPress={() => sendMessage()}
          disabled={isSending || !input.trim()}
          opacity={isSending || !input.trim() ? 0.5 : 1}
          testID="guru-send-btn"
        >
          {formatUIText("send")}
        </Button>
      </XStack>

      <Paywall {...paywallProps} />
    </KeyboardAvoidingView>
  );
}
