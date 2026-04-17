import { useRef, useEffect, useCallback, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { YStack } from "tamagui";
import { Text } from "../SportText";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";
import { EmojiBar } from "./EmojiBar";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";
import { formatUIText } from "@draftplay/ui";

interface ChatRoomProps {
  matchId?: string | null;
  /** Compact mode for web sidebar */
  compact?: boolean;
  /** Override keyboard offset (default 90) */
  keyboardOffset?: number;
  /** Skip internal KeyboardAvoidingView (when parent handles it) */
  skipKeyboard?: boolean;
}

export function ChatRoom({ matchId = null, compact = false, keyboardOffset, skipKeyboard = false }: ChatRoomProps) {
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [flaggedByMe, setFlaggedByMe] = useState<Set<string>>(new Set());

  // Poll for messages every 4 seconds
  const { data: messages, refetch } = trpc.chat.getMessages.useQuery(
    { matchId, limit: 50 },
    { refetchInterval: 4000 }
  );

  // Show toast for 3 seconds then clear
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      if (data && !data.ok && data.error) {
        showToast(data.error);
      } else {
        refetch();
      }
    },
  });

  const flagMutation = trpc.chat.flag.useMutation({
    onSuccess: (data, variables) => {
      if (data && !data.ok && data.error) {
        showToast(data.error);
      } else {
        setFlaggedByMe((prev) => new Set(prev).add(variables.messageId));
        refetch();
      }
    },
  });

  const handleFlag = useCallback(
    (messageId: string) => {
      flagMutation.mutate({ messageId });
    },
    [flagMutation]
  );

  const handleSend = useCallback(
    (message: string) => {
      sendMutation.mutate({ matchId, message });
    },
    [matchId, sendMutation]
  );

  const handleEmoji = useCallback(
    (emoji: string) => {
      sendMutation.mutate({ matchId, message: emoji });
    },
    [matchId, sendMutation]
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages?.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages?.length]);

  const isLoggedIn = !!user;

  const inner = (
    <YStack flex={1}>
      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatBubble
            id={item.id}
            message={item.message}
            displayName={item.displayName}
            type={item.type}
            createdAt={item.createdAt}
            flagged={item.flagged}
            onFlag={isLoggedIn && !flaggedByMe.has(item.id) ? handleFlag : undefined}
            isOwn={item.userId === user?.id}
          />
        )}
        contentContainerStyle={{
          paddingVertical: 8,
          flexGrow: 1,
          justifyContent: messages?.length ? "flex-end" : "center",
        }}
        ListEmptyComponent={
          <YStack flex={1} alignItems="center" justifyContent="center" padding="$4" gap="$2">
            <Text fontSize={36} marginBottom="$2">🏏</Text>
            <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="$color" textAlign="center">
              {formatUIText("be the first to say something")}
            </Text>
            <Text fontFamily="$body" fontSize={12} color="$colorMuted" textAlign="center" maxWidth={240} lineHeight={16}>
              {matchId
                ? formatUIText("trash-talk this match with everyone watching")
                : formatUIText("everyone in your contests can see this — say hi, drop predictions, share heat")}
            </Text>
          </YStack>
        }
      />

      {/* Error toast — above input */}
      {toast && (
        <YStack
          backgroundColor="#4a1c1c"
          paddingHorizontal="$3"
          paddingVertical="$2"
          marginHorizontal="$2"
          marginBottom="$1"
          borderRadius={8}
          borderWidth={1}
          borderColor="#d93025"
        >
          <Text fontFamily="$body" fontSize={12} color="#ff6b6b">
            ⚠️ {toast}
          </Text>
        </YStack>
      )}

      {/* Emoji quick bar */}
      {isLoggedIn && <EmojiBar onSelect={handleEmoji} disabled={sendMutation.isPending} />}

      {/* Input */}
      {isLoggedIn ? (
        <ChatInput
          onSend={handleSend}
          disabled={sendMutation.isPending}
        />
      ) : (
        <YStack padding="$3" alignItems="center" borderTopWidth={1} borderColor="$borderColor">
          <Text fontFamily="$body" fontSize={13} color="$colorMuted">
            {formatUIText("sign in to chat")}
          </Text>
        </YStack>
      )}
    </YStack>
  );

  if (skipKeyboard) return inner;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={compact ? 0 : (keyboardOffset ?? 90)}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}
