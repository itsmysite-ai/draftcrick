import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack } from "tamagui";
import { Text } from "../../components/SportText";
import { formatUIText, DraftPlayLogo } from "@draftplay/ui";
import { HeaderControls } from "../../components/HeaderControls";
import { ChatRoom } from "../../components/chat";
import { trpc } from "../../lib/trpc";
import { Pressable } from "react-native";
import { useTheme } from "../../providers/ThemeProvider";

export default function BuzzScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTheme();
  const [activeRoom, setActiveRoom] = useState<string | null>(null); // null = general
  const { data: rooms } = trpc.chat.getActiveRooms.useQuery(undefined, {
    refetchInterval: 30000,
  });

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

      {/* Room tabs */}
      <XStack
        paddingHorizontal="$3"
        paddingBottom="$2"
        gap="$2"
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
                paddingVertical="$1.5"
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
      </XStack>

      {/* Chat room */}
      <YStack flex={1} paddingBottom={80}>
        <ChatRoom matchId={activeRoom} />
      </YStack>
    </YStack>
  );
}
