import { TextInput, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useState } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Badge,
  Button,
  ModeToggle,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
import { useTheme } from "../../providers/ThemeProvider";

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
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "guru",
      content: "hi! i'm your cricket guru. ask me anything about fantasy cricket — team picks, rule explanations, match previews, or player comparisons.",
    },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input.trim() };
    const guruMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: "guru",
      content: "i'm not connected to the AI backend yet. once the AI service is integrated, i'll be able to answer your cricket questions with real-time data!",
    };

    setMessages((prev) => [...prev, userMsg, guruMsg]);
    setInput("");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <XStack justifyContent="flex-end" paddingHorizontal="$4" paddingTop="$3" paddingBottom="$1">
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>
      <FlatList
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
                  <Text fontSize={14}>{DesignSystem.emptyState.icon}</Text>
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
      />

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
              onPress={() => setInput(s)}
              cursor="pointer"
              pressStyle={{ scale: 0.97, backgroundColor: "$backgroundSurfaceHover" }}
            >
              <Text fontFamily="$body" fontSize={13} color="$colorSecondary">{s}</Text>
            </XStack>
          ))}
        </XStack>
      )}

      {/* Input */}
      <XStack
        padding="$3"
        paddingBottom="$6"
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
          onSubmitEditing={sendMessage}
          returnKeyType="send"
        />
        <Button
          variant="primary"
          size="md"
          borderRadius={24}
          paddingHorizontal="$5"
          onPress={sendMessage}
        >
          {formatUIText("send")}
        </Button>
      </XStack>
    </KeyboardAvoidingView>
  );
}
