import { XStack } from "tamagui";
import { Pressable } from "react-native";
import { Text } from "../SportText";

const QUICK_EMOJIS = ["🔥", "🏏", "💀", "🚀", "😂", "👏", "🎯", "⚡", "❤️", "🤯"];

interface EmojiBarProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiBar({ onSelect, disabled }: EmojiBarProps) {
  return (
    <XStack gap="$1" paddingHorizontal="$2" paddingVertical="$1" justifyContent="space-around">
      {QUICK_EMOJIS.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => !disabled && onSelect(emoji)}
          style={({ pressed }) => ({
            opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.85 : 1 }],
            padding: 4,
          })}
        >
          <Text fontSize={20}>{emoji}</Text>
        </Pressable>
      ))}
    </XStack>
  );
}
