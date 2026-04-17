/**
 * Room Picker Sheet — bottom sheet for switching buzz rooms.
 *
 * Replaces the horizontal pill chip strip that was truncating room names.
 * Header on the buzz screen now shows just the current room with a chevron;
 * tap → this sheet opens with a clean vertical list of all rooms, each
 * showing its type, name, and last activity if available.
 */

import { Modal, Pressable, Dimensions, FlatList, Platform } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../SportText";
import { Card, formatUIText, formatBadgeText, textStyles } from "@draftplay/ui";

const SCREEN_HEIGHT = Dimensions.get("window").height;

export interface BuzzRoom {
  id: string | null;
  name: string;
  type: "general" | "match";
}

interface RoomPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  rooms: BuzzRoom[];
  activeRoomId: string | null;
  onSelect: (roomId: string | null) => void;
}

export function RoomPickerSheet({
  visible,
  onClose,
  rooms,
  activeRoomId,
  onSelect,
}: RoomPickerSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        entering={FadeIn.duration(150)}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(220).springify().damping(18)}
          style={{
            backgroundColor: theme.background?.val,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: SCREEN_HEIGHT * 0.7,
            paddingTop: 8,
            paddingBottom: Platform.OS === "ios" ? insets.bottom : 20,
          }}
        >
          {/* Drag handle */}
          <YStack alignItems="center" paddingVertical="$2">
            <YStack
              width={40}
              height={4}
              borderRadius={2}
              backgroundColor="$borderColor"
            />
          </YStack>

          <XStack
            paddingHorizontal="$4"
            paddingBottom="$3"
            alignItems="center"
            justifyContent="space-between"
            borderBottomWidth={1}
            borderBottomColor="$borderColor"
          >
            <Text {...textStyles.sectionHeader}>{formatUIText("rooms")}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text fontFamily="$mono" fontSize={20} color="$colorMuted">
                ×
              </Text>
            </Pressable>
          </XStack>

          <FlatList
            data={rooms}
            keyExtractor={(r) => r.id ?? "general"}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 16,
            }}
            renderItem={({ item: room }) => {
              const isActive = activeRoomId === room.id;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(room.id);
                    onClose();
                  }}
                >
                  <Card
                    marginBottom="$2"
                    padding="$3"
                    borderColor={isActive ? "$accentBackground" : "$borderColor"}
                    borderWidth={isActive ? 2 : 1}
                  >
                    <XStack alignItems="center" gap="$3">
                      <Text fontSize={22}>
                        {room.type === "general" ? "💬" : "🏏"}
                      </Text>
                      <YStack flex={1}>
                        <Text {...textStyles.playerName} numberOfLines={1}>
                          {room.type === "general" ? "general" : room.name}
                        </Text>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop={2}>
                          {room.type === "general"
                            ? formatUIText("league-wide chat")
                            : formatUIText("match chat")}
                        </Text>
                      </YStack>
                      {isActive && (
                        <Text fontFamily="$mono" fontSize={10} color="$accentBackground" fontWeight="700">
                          {formatBadgeText("active")}
                        </Text>
                      )}
                    </XStack>
                  </Card>
                </Pressable>
              );
            }}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
