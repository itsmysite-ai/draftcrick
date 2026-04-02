import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import { formatUIText, DraftPlayLogo } from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";
import { ChatRoom } from "../../components/chat";
import { trpc } from "../../lib/trpc";

// Tab bar height (pill bar + outer padding)
const TAB_BAR_HEIGHT = 70;

export default function BuzzScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const [activeRoom, setActiveRoom] = useState<string | null>(null); // null = general
  const { data: rooms } = trpc.chat.getActiveRooms.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const tabBarOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 8);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={tabBarOffset}
    >
      <YStack flex={1} paddingTop={insets.top}>
        {/* Header */}
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <XStack alignItems="center" gap="$2">
            <DraftPlayLogo size={24} />
            <Text fontFamily="$mono" fontWeight="700" fontSize={18} color="$color">
              {formatUIText("buzz")}
            </Text>
          </XStack>
          <HeaderControls />
        </XStack>

        {/* Room tabs — horizontally scrollable */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10, alignItems: "center" }}
          style={{ flexGrow: 0, marginBottom: 4 }}
        >
          {(rooms ?? [{ id: null, name: "general", type: "general" as const }]).map((room) => {
            const isActive = activeRoom === room.id;
            return (
              <Pressable
                key={room.id ?? "general"}
                onPress={() => setActiveRoom(room.id)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <XStack
                  paddingHorizontal={14}
                  paddingVertical={8}
                  borderRadius={20}
                  backgroundColor={isActive ? "$accentBackground" : "$backgroundSurface"}
                  borderWidth={1}
                  borderColor={isActive ? "$accentBackground" : "$borderColor"}
                  alignItems="center"
                  gap={6}
                >
                  <Text fontSize={14}>
                    {room.type === "general" ? "💬" : "🏏"}
                  </Text>
                  <Text
                    fontFamily="$mono"
                    fontWeight={isActive ? "700" : "500"}
                    fontSize={13}
                    color={isActive ? "white" : "$color"}
                    numberOfLines={1}
                  >
                    {room.type === "general" ? "general" : room.name}
                  </Text>
                </XStack>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Chat room — skipKeyboard since KAV wraps entire screen */}
        <YStack flex={1} paddingBottom={tabBarOffset}>
          <ChatRoom matchId={activeRoom} skipKeyboard />
        </YStack>
      </YStack>
    </KeyboardAvoidingView>
  );
}
