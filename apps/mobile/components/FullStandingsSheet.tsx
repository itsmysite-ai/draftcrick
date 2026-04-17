/**
 * Full Standings Bottom Sheet — opened from the league page podium card.
 *
 * The podium shows #1 + #2 at a glance; tapping "see all standings" opens
 * this sheet with the complete leaderboard. Each row is tappable and opens
 * the existing MemberBreakdownSheet for that member's per-contest history.
 */

import { Modal, Pressable, Dimensions, FlatList, Platform } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "./SportText";
import {
  Card,
  Badge,
  InitialsAvatar,
  formatUIText,
  formatBadgeText,
  textStyles,
} from "@draftplay/ui";

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface StandingsEntry {
  userId: string;
  displayName: string;
  rank: number;
  totalPoints: number;
  contestsPlayed: number;
}

interface FullStandingsSheetProps {
  visible: boolean;
  onClose: () => void;
  rows: StandingsEntry[];
  isLeagueSettled: boolean;
  currentUserId?: string;
  /** Called when the user taps a row — parent opens MemberBreakdownSheet */
  onSelectMember: (entry: StandingsEntry) => void;
}

export function FullStandingsSheet({
  visible,
  onClose,
  rows,
  isLeagueSettled,
  currentUserId,
  onSelectMember,
}: FullStandingsSheetProps) {
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
            maxHeight: SCREEN_HEIGHT * 0.85,
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

          {/* Header */}
          <XStack
            paddingHorizontal="$4"
            paddingBottom="$3"
            alignItems="center"
            justifyContent="space-between"
            borderBottomWidth={1}
            borderBottomColor="$borderColor"
          >
            <YStack>
              <Text {...textStyles.sectionHeader}>
                {formatUIText("full standings")}
              </Text>
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginTop={2}>
                {rows.length} {rows.length === 1 ? "entry" : "entries"}
              </Text>
            </YStack>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text fontFamily="$mono" fontSize={20} color="$colorMuted">
                ×
              </Text>
            </Pressable>
          </XStack>

          {/* Body */}
          <FlatList
            data={rows}
            keyExtractor={(s) => s.userId}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 16,
            }}
            renderItem={({ item: s }) => {
              const isMe = s.userId === currentUserId;
              const rankLabel = isLeagueSettled
                ? (s.rank === 1 ? "🏆" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : `#${s.rank}`)
                : (s.rank === 1 ? "🥇" : s.rank === 2 ? "🥈" : s.rank === 3 ? "🥉" : `#${s.rank}`);
              const rankColor =
                s.rank === 1 ? "$colorCricket" : s.rank === 2 ? "$colorSecondary" : "$color";
              return (
                <Pressable
                  onPress={() => {
                    onClose();
                    onSelectMember(s);
                  }}
                >
                  <Card marginBottom="$2" padding="$3" borderColor={isMe ? "$accentBackground" : "$borderColor"} borderWidth={isMe ? 2 : 1}>
                    <XStack alignItems="center" gap="$3">
                      <YStack width={32} alignItems="center" justifyContent="center">
                        <Text fontFamily="$mono" fontWeight="800" fontSize={s.rank <= 3 ? 20 : 14} color={rankColor}>
                          {rankLabel}
                        </Text>
                      </YStack>
                      <InitialsAvatar name={s.displayName} playerRole="BAT" ovr="" size={32} hideBadge />
                      <YStack flex={1}>
                        <XStack alignItems="center" gap="$2">
                          <Text {...textStyles.playerName} numberOfLines={1}>
                            {s.displayName}
                          </Text>
                          {isMe && (
                            <Badge variant="live" size="sm">
                              {formatBadgeText("you")}
                            </Badge>
                          )}
                        </XStack>
                        <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                          {s.contestsPlayed} contest{s.contestsPlayed !== 1 ? "s" : ""}
                        </Text>
                      </YStack>
                      <Text fontFamily="$mono" fontWeight="700" fontSize={15} color="$accentBackground">
                        {s.totalPoints.toFixed(1)}
                      </Text>
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
