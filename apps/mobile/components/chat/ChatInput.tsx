import { useState } from "react";
import { TextInput, Pressable, Platform } from "react-native";
import { XStack } from "tamagui";
import { Text } from "../SportText";
import { useTheme } from "../../providers/ThemeProvider";
import { FontFamily } from "../../lib/design";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [text, setText] = useState("");
  const { t } = useTheme();

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  return (
    <XStack
      gap="$2"
      paddingHorizontal="$2"
      paddingVertical="$2"
      alignItems="center"
      borderTopWidth={1}
      borderColor="$borderColor"
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder ?? "say something..."}
        placeholderTextColor={t.textMuted}
        maxLength={280}
        multiline={false}
        onSubmitEditing={handleSend}
        returnKeyType="send"
        editable={!disabled}
        style={{
          flex: 1,
          // iOS Safari auto-zooms focused inputs whose font-size is
          // < 16px. Bump to 16 on web only; native stays at 14.
          fontSize: Platform.OS === "web" ? 16 : 14,
          fontFamily: FontFamily.body,
          color: t.text,
          backgroundColor: t.bgSurface,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: t.border,
        }}
      />
      <Pressable
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        style={({ pressed }) => ({
          opacity: !text.trim() || disabled ? 0.4 : pressed ? 0.7 : 1,
          backgroundColor: t.accent,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingVertical: 8,
        })}
      >
        <Text fontFamily="$mono" fontWeight="600" fontSize={13} color="white">
          send
        </Text>
      </Pressable>
    </XStack>
  );
}
