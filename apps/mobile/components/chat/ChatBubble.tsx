import { useState } from "react";
import { YStack, XStack } from "tamagui";
import { Pressable } from "react-native";
import { Text } from "../SportText";

interface ChatBubbleProps {
  id: string;
  message: string;
  displayName: string | null;
  type: string;
  createdAt: Date | string;
  isOwn: boolean;
  flagged?: boolean;
  onFlag?: (messageId: string) => void;
}

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

/** Generate consistent avatar color from username */
/** Generate a unique HSL color from a name using all 3 dimensions.
 *  360 hues × 20 saturation × 15 lightness = 108,000 unique combos */
function nameToColor(name: string): string {
  let h1 = 0, h2 = 0;
  for (let i = 0; i < name.length; i++) {
    h1 = ((h1 << 5) - h1) + name.charCodeAt(i);
    h1 |= 0;
    h2 = ((h2 << 7) + h2) ^ name.charCodeAt(i);
    h2 |= 0;
  }
  const hue = Math.abs(h1) % 360;
  const sat = 45 + (Math.abs(h2) % 40);       // 45-84%
  const lit = 35 + (Math.abs(h1 ^ h2) % 25);  // 35-59%
  return `hsl(${hue}, ${sat}%, ${lit}%)`;
}

const AI_EMOJIS: Record<string, string> = {
  ai_reaction: "🏏",
  ai_hottake: "🔥",
  ai_celebration: "🎉",
  system: "📢",
};

function FlagButton({ onPress }: { onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      hitSlop={8}
      style={{
        opacity: hovered ? 1 : 0.3,
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        marginLeft: "auto",
        cursor: "pointer" as any,
      }}
    >
      <Text fontSize={10}>🚩</Text>
      <Text fontFamily="$mono" fontSize={9} color={hovered ? "$color" : "$colorMuted"}>
        flag offensive
      </Text>
    </Pressable>
  );
}

export function ChatBubble({ id, message, displayName, type, createdAt, isOwn, flagged, onFlag }: ChatBubbleProps) {
  const isAI = type.startsWith("ai_");
  const isSystem = type === "system";
  const avatarColor = nameToColor(displayName ?? "anon");

  if (isSystem) {
    return (
      <YStack alignItems="center" paddingVertical="$1">
        <Text fontFamily="$mono" fontSize={11} color="$colorMuted" textAlign="center">
          📢 {message}
        </Text>
      </YStack>
    );
  }

  return (
    <YStack
      paddingVertical="$1"
      paddingHorizontal="$2"
    >
      <XStack gap="$2" alignItems="flex-start">
        {/* Avatar / emoji */}
        <YStack
          width={28}
          height={28}
          borderRadius={14}
          backgroundColor={isAI ? "$accentBackground" : undefined}
          // @ts-ignore — dynamic HSL color for user avatars
          style={!isAI ? { backgroundColor: avatarColor } : undefined}
          alignItems="center"
          justifyContent="center"
          borderWidth={1}
          borderColor={isAI ? "$accentBackground" : "$borderColor"}
        >
          <Text fontSize={isAI ? 14 : 11} color={isAI ? undefined : "white"} fontWeight="700">
            {isAI ? (AI_EMOJIS[type] ?? "🤖") : (displayName?.[0]?.toUpperCase() ?? "?")}
          </Text>
        </YStack>

        <YStack flex={1} gap={2}>
          {/* Name + timestamp + flag */}
          <XStack gap="$2" alignItems="center">
            <Text fontFamily="$mono" fontWeight="600" fontSize={12} color={isAI ? "$accentBackground" : "$color"}>
              {isAI ? "guru" : (displayName ?? "anon")}
            </Text>
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
              {timeAgo(createdAt)}
            </Text>
            {/* Flag button — not on own messages or AI messages */}
            {!isOwn && !isAI && !flagged && onFlag && (
              <FlagButton onPress={() => onFlag(id)} />
            )}
          </XStack>

          {/* Message */}
          {flagged ? (
            <Text fontFamily="$body" fontSize={12} color="$colorMuted" fontStyle="italic">
              🚩 this message was flagged as offensive by the community
            </Text>
          ) : (
            <Text fontFamily="$body" fontSize={13} color="$color" lineHeight={18}>
              {message}
            </Text>
          )}
        </YStack>
      </XStack>
    </YStack>
  );
}
