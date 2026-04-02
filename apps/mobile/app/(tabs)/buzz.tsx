import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, Pressable } from "react-native";
import { YStack, XStack } from "tamagui";
import { Text } from "../../components/SportText";
import { formatUIText, DraftPlayLogo } from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";
import { ChatRoom } from "../../components/chat";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

// Tab bar height (pill bar + padding) — matches CustomTabBar layout
const TAB_BAR_HEIGHT = 70;

export default function BuzzScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [activeRoom, setActiveRoom] = useState<string | null>(null); // null = general
  const { data: rooms } = trpc.chat.getActiveRooms.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const tabBarOffset = TAB_BAR_HEIGHT + Math.max(insets.bottom, 8);

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop={insets.top}>
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
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        style={{ flexGrow: 0, paddingBottom: 8 }}
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
                paddingHorizontal="$3"
                paddingVertical={6}
                borderRadius="$round"
                backgroundColor={isActive ? "$accentBackground" : "$backgroundSurface"}
                borderWidth={1}
                borderColor={isActive ? "$accentBackground" : "$borderColor"}
              >
                <Text
                  fontFamily="$mono"
                  fontWeight="500"
                  fontSize={12}
                  color={isActive ? "white" : "$color"}
                >
                  {room.type === "general" ? "💬 general" : `🏏 ${room.name}`}
                </Text>
              </XStack>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Chat room — offset by tab bar height so input isn't hidden */}
      <YStack flex={1} paddingBottom={tabBarOffset}>
        <ChatRoom matchId={activeRoom} />
      </YStack>
    </YStack>
  );
}
