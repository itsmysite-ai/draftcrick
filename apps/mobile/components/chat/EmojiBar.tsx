import { ScrollView } from "react-native";
import { XStack, YStack } from "tamagui";
import { Pressable } from "react-native";
import { Text } from "../SportText";

const QUICK_EMOJIS = ["🔥", "🏏", "💀", "🚀", "😂", "👏", "🎯", "⚡", "❤️", "🤯"];

interface EmojiBarProps {
  /** Called when user taps an emoji — sends as a standalone message */
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

/**
 * EmojiBar — quick-react bar above the chat input.
 *
 * Tapping any emoji broadcasts it as a standalone chat message. Styled as
 * pill buttons (not raw glyphs) so users immediately understand they're
 * tappable broadcasts, not input shortcuts. Slack/WhatsApp-style reaction
 * pattern adapted for live cricket chat where speed matters.
 */
export function EmojiBar({ onSelect, disabled }: EmojiBarProps) {
  return (
    <YStack borderTopWidth={1} borderTopColor="$borderColor" paddingVertical="$2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8, alignItems: "center" }}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => !disabled && onSelect(emoji)}
            style={({ pressed }) => ({
              opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            })}
          >
            <XStack
              backgroundColor="$backgroundSurfaceAlt"
              borderRadius={20}
              paddingHorizontal={12}
              paddingVertical={6}
              alignItems="center"
              justifyContent="center"
              minWidth={44}
            >
              <Text fontSize={20}>{emoji}</Text>
            </XStack>
          </Pressable>
        ))}
      </ScrollView>
      <Text
        fontFamily="$body"
        fontSize={9}
        color="$colorMuted"
        textAlign="center"
        marginTop={4}
      >
        tap to send instantly
      </Text>
    </YStack>
  );
}
