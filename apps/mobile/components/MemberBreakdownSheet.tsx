/**
 * Member Breakdown Bottom Sheet — drill-down from league standings.
 *
 * When a user taps a row on the league standings tab, this sheet slides up
 * showing every contest that member participated in within the league, with
 * their points, rank, and prize per contest. Each row is tappable and
 * navigates into /contest/[id] so the existing per-player leaderboard
 * breakdown there becomes the next drill-down level.
 *
 * Covers salary_cap / draft / auction formats. Cricket Manager has its own
 * round-based flow and uses a separate reveal screen.
 */

import { Modal, Pressable, Dimensions, FlatList, Platform } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "./SportText";
import {
  Card,
  Badge,
  InitialsAvatar,
  EggLoadingSpinner,
  formatUIText,
  formatBadgeText,
  formatTeamName,
  textStyles,
} from "@draftplay/ui";
import { trpc } from "../lib/trpc";

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface MemberBreakdownSheetProps {
  visible: boolean;
  onClose: () => void;
  leagueId: string;
  userId: string;
  displayName: string;
  rank: number;
  totalPoints: number;
  contestsPlayed: number;
  isMe: boolean;
}

function formatMatchDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export function MemberBreakdownSheet({
  visible,
  onClose,
  leagueId,
  userId,
  displayName,
  rank,
  totalPoints,
  contestsPlayed,
  isMe,
}: MemberBreakdownSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();

  const breakdownQuery = trpc.league.memberContestBreakdown.useQuery(
    { leagueId, userId },
    { enabled: visible, staleTime: 60_000 }
  );

  const rows = (breakdownQuery.data ?? []) as Array<any>;
  const totalPrize = rows.reduce(
    (sum: number, r: any) => sum + (r.prizeWon ?? 0),
    0
  );

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
          <YStack paddingHorizontal="$4" paddingBottom="$3">
            <XStack alignItems="center" gap="$3">
              <InitialsAvatar
                name={displayName}
                playerRole="BAT"
                ovr={`#${rank}`}
                size={44}
              />
              <YStack flex={1}>
                <XStack alignItems="center" gap="$2">
                  <Text {...textStyles.playerName} fontSize={16}>
                    {displayName}
                  </Text>
                  {isMe && (
                    <Badge variant="live" size="sm">
                      {formatBadgeText("you")}
                    </Badge>
                  )}
                </XStack>
                <Text
                  fontFamily="$mono"
                  fontSize={11}
                  color="$colorMuted"
                  marginTop={2}
                >
                  #{rank} · {totalPoints.toFixed(1)} pts ·{" "}
                  {contestsPlayed} contest{contestsPlayed !== 1 ? "s" : ""}
                  {totalPrize > 0 ? ` · +${totalPrize} PC won` : ""}
                </Text>
              </YStack>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text fontFamily="$mono" fontSize={20} color="$colorMuted">
                  ×
                </Text>
              </Pressable>
            </XStack>
          </YStack>

          {/* Body */}
          <YStack
            paddingHorizontal="$4"
            paddingBottom="$2"
            borderTopWidth={1}
            borderTopColor="$borderColor"
            paddingTop="$3"
          >
            <Text {...textStyles.sectionHeader} marginBottom="$2">
              {formatUIText("contest breakdown")}
            </Text>
          </YStack>

          {breakdownQuery.isLoading ? (
            <YStack paddingVertical="$6">
              <EggLoadingSpinner
                size={32}
                message={formatUIText("loading breakdown")}
              />
            </YStack>
          ) : rows.length === 0 ? (
            <YStack paddingVertical="$6" paddingHorizontal="$4">
              <Text
                fontFamily="$body"
                fontSize={13}
                color="$colorMuted"
                textAlign="center"
              >
                {formatUIText("no contests played yet")}
              </Text>
            </YStack>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(r) => r.teamId}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: 16,
              }}
              renderItem={({ item: r }) => {
                const home = formatTeamName(r.match.teamHome ?? "TBA");
                const away = formatTeamName(r.match.teamAway ?? "TBA");
                const isSettled = r.contestStatus === "settled";
                const matchLive = r.match.status === "live";
                return (
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push(`/contest/${r.contestId}`);
                    }}
                  >
                    <Card
                      marginBottom="$2"
                      padding="$3"
                      borderColor="$borderColor"
                    >
                      <XStack alignItems="center" gap="$3">
                        <YStack flex={1}>
                          <XStack alignItems="center" gap="$2">
                            <Text {...textStyles.playerName} fontSize={13}>
                              {home} {formatUIText("vs")} {away}
                            </Text>
                            {matchLive && (
                              <Badge variant="live" size="sm">
                                {formatBadgeText("live")}
                              </Badge>
                            )}
                          </XStack>
                          <Text
                            fontFamily="$mono"
                            fontSize={10}
                            color="$colorMuted"
                            marginTop={2}
                          >
                            {formatMatchDate(r.match.startTime)}
                            {" · "}
                            {r.contestName}
                            {r.rank ? ` · rank #${r.rank}` : ""}
                          </Text>
                        </YStack>
                        <YStack alignItems="flex-end">
                          <Text
                            fontFamily="$mono"
                            fontWeight="700"
                            fontSize={15}
                            color="$accentBackground"
                          >
                            {r.totalPoints.toFixed(1)}
                          </Text>
                          <Text
                            fontFamily="$mono"
                            fontSize={9}
                            color={
                              r.prizeWon > 0 ? "$colorCricket" : "$colorMuted"
                            }
                          >
                            {r.prizeWon > 0
                              ? `+${r.prizeWon} PC`
                              : isSettled
                                ? "settled"
                                : r.contestStatus}
                          </Text>
                        </YStack>
                      </XStack>
                    </Card>
                  </Pressable>
                );
              }}
            />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
