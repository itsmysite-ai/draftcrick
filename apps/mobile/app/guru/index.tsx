import { TextInput, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
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

/** Typewriter effect — reveals text character by character */
function TypewriterText({
  content,
  onComplete,
  ...textProps
}: { content: string; onComplete?: () => void } & Record<string, any>) {
  const [displayedLength, setDisplayedLength] = useState(0);
  const contentRef = useRef(content);

  useEffect(() => {
    contentRef.current = content;
    setDisplayedLength(0);
  }, [content]);

  useEffect(() => {
    if (displayedLength >= contentRef.current.length) {
      onComplete?.();
      return;
    }
    // Natural typing speed with slight randomness
    const char = contentRef.current[displayedLength];
    const base = char === " " ? 18 : char === "\n" ? 80 : char === "." || char === "," || char === "!" || char === "?" ? 60 : 25;
    const jitter = Math.random() * 15; // slight randomness for natural feel
    const timer = setTimeout(() => setDisplayedLength((l) => l + 1), base + jitter);
    return () => clearTimeout(timer);
  }, [displayedLength, onComplete]);

  return (
    <Text {...textProps}>
      {contentRef.current.slice(0, displayedLength)}
      {displayedLength < contentRef.current.length ? "▍" : ""}
    </Text>
  );
}

const GENERIC_SUGGESTIONS = [
  "how does the auction draft work?",
  "what are player credits based on?",
  "explain the fantasy scoring system",
  "how do leagues and contests work?",
];

export default function GuruScreen() {
  const router = useRouter();
  const navCtx = useNavigationStore((s) => s.matchContext);
  const params = {
    matchId: navCtx?.matchId,
    teamA: navCtx?.teamA,
    teamB: navCtx?.teamB,
    format: navCtx?.format,
    venue: navCtx?.venue,
    tournament: navCtx?.tournament,
  };
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();

  const suggestions = useMemo(() => {
    if (!params.teamA || !params.teamB) return GENERIC_SUGGESTIONS;
    const shortA = formatTeamName(params.teamA).split(" ").pop() ?? params.teamA;
    const shortB = formatTeamName(params.teamB).split(" ").pop() ?? params.teamB;
    const vs = `${shortA} vs ${shortB}`;
    return [
      `tell me about the ${vs} venue — pitch and conditions`,
      `head-to-head history of ${vs}`,
      `key players to watch in ${vs}`,
      `what's the current form of both teams?`,
    ];
  }, [params.teamA, params.teamB]);

  const flatListRef = useRef<FlatList>(null);
  const { tier, gate, hasAccess, paywallProps } = usePaywall();
  const usageQuery = trpc.guru.getUsageToday.useQuery(undefined, { staleTime: 60_000 });
  const serverUsed = usageQuery.data?.used ?? 0;
  const serverLimit = usageQuery.data?.limit ?? null;
  const [localSentCount, setLocalSentCount] = useState(0); // tracks sends this session
  const totalUsed = serverUsed + localSentCount;
  const isAtLimit = serverLimit !== null && totalUsed >= serverLimit;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "guru",
      content: "hi! i'm your cricket guru. ask me about match conditions, player form, scoring rules, or how features in the app work. for team building and captain picks, check out projected points and captain picks on the match page!",
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>("welcome");

  const sendMutation = trpc.guru.sendMessage.useMutation();

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isSending) return;

    // Daily limit gate — all tiers have a limit
    if (isAtLimit) {
      if (hasAccess("elite")) {
        // Elite users: no upgrade path, just come back tomorrow
        gate("elite", "Daily Limit Reached", `You've used all ${serverLimit} Guru questions for today. Your limit resets tomorrow!`);
      } else if (hasAccess("pro")) {
        // Pro users: suggest Elite upgrade
        gate("elite", "More Guru Questions", `You've used all ${serverLimit} Guru questions for today. Upgrade to Elite for ${100} questions/day.`);
      } else {
        // Basic users: suggest Pro upgrade
        gate("pro", "More Guru Questions", `You've used all ${serverLimit} Guru questions for today. Upgrade to Pro for ${25} questions/day.`);
      }
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLocalSentCount((c) => c + 1);
    setInput("");
    setIsSending(true);

    // Build context from match params
    const context: any = {};
    if (params.matchId && params.teamA && params.teamB) {
      context.upcomingMatches = [{
        id: params.matchId,
        teamA: params.teamA,
        teamB: params.teamB,
        date: "upcoming",
        ...(params.format && { format: params.format }),
        ...(params.venue && { venue: params.venue }),
        ...(params.tournament && { tournament: params.tournament }),
      }];
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

      const guruMsgId = (Date.now() + 1).toString();
      const guruMsg: Message = {
        id: guruMsgId,
        role: "guru",
        content: result.response.content,
      };
      setTypingMessageId(guruMsgId);
      setMessages((prev) => [...prev, guruMsg]);
    } catch (error: any) {
      const errMsgId = (Date.now() + 1).toString();
      const errorMsg: Message = {
        id: errMsgId,
        role: "guru",
        content: error?.message?.includes("UNAUTHORIZED")
          ? "you need to be logged in to chat with me. please sign in first!"
          : "sorry, i'm having a moment. could you try that question again?",
      };
      setTypingMessageId(errMsgId);
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [input, isSending, conversationId, params, sendMutation, isAtLimit, serverLimit, gate]);

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
          {serverLimit !== null && (
            <XStack alignItems="center" gap="$1">
              <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                {Math.max(0, serverLimit - totalUsed)}/{serverLimit}
              </Text>
              <TierBadge tier={tier ?? "basic"} size="sm" />
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
          <Text fontFamily="$mono" fontSize={11} color="$colorMuted" flex={1}>
            {formatUIText(`${formatTeamName(params.teamA ?? "")} vs ${formatTeamName(params.teamB ?? "")}${params.format ? ` · ${params.format}` : ""}${params.venue ? ` · ${params.venue}` : ""}`)}
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
              {item.role === "guru" && item.id === typingMessageId ? (
                <TypewriterText
                  content={item.content}
                  onComplete={() => setTypingMessageId(null)}
                  fontFamily="$body"
                  fontSize={15}
                  lineHeight={22}
                  color="$color"
                />
              ) : (
                <Text
                  fontFamily="$body"
                  fontSize={15}
                  lineHeight={22}
                  color={item.role === "user" ? "$accentColor" : "$color"}
                >
                  {item.content}
                </Text>
              )}
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
          {suggestions.map((s) => (
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
