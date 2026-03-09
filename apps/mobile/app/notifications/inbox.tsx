import { FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { YStack, XStack, Text, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  Button,
  BackButton,
  ModeToggle,
  DesignSystem,
  textStyles,
  formatUIText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  deadline_reminder: "alarm-outline",
  urgent_deadline: "alarm-outline",
  score_update: "trophy-outline",
  status_alert: "alert-circle-outline",
  rank_change: "trending-up-outline",
  match_reminder: "alarm-outline",
  score_milestone: "trophy-outline",
  contest_result: "medal-outline",
  social: "people-outline",
  system: "settings-outline",
};

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationInboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { mode, toggleMode } = useTheme();
  const utils = trpc.useUtils();

  const inboxQuery = trpc.notification.getInbox.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    }
  );

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.getInbox.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.getInbox.invalidate();
      utils.notification.getUnreadCount.invalidate();
    },
  });

  const items = inboxQuery.data?.pages.flatMap((p) => p.items) ?? [];

  const handleTap = (item: any) => {
    if (!item.isRead) {
      markReadMutation.mutate({ id: item.id });
    }
    // Navigate based on notification data
    const data = item.data as Record<string, unknown> | null;
    if (data?.matchId) {
      router.push(`/match/${data.matchId}` as never);
    } else if (data?.contestId) {
      router.push(`/contest/${data.contestId}` as never);
    }
  };

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="notification-inbox-screen">
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("notifications")}
          </Text>
        </XStack>
        <XStack alignItems="center" gap="$3">
          {items.some((i) => !i.isRead) && (
            <Text
              fontFamily="$mono"
              fontSize={12}
              color="$colorAccent"
              onPress={() => markAllReadMutation.mutate()}
              cursor="pointer"
              testID="notification-mark-all-read"
            >
              {formatUIText("mark all read")}
            </Text>
          )}
          <ModeToggle mode={mode} onToggle={toggleMode} />
        </XStack>
      </XStack>

      <XStack
        paddingHorizontal="$4"
        paddingBottom="$2"
        justifyContent="flex-end"
      >
        <Text
          fontFamily="$mono"
          fontSize={11}
          color="$colorMuted"
          onPress={() => router.push("/settings/notifications" as never)}
          cursor="pointer"
          testID="notification-settings-link"
        >
          {formatUIText("settings")}
        </Text>
      </XStack>

      {items.length === 0 && !inboxQuery.isLoading ? (
        <Animated.View entering={FadeIn.delay(100)}>
          <YStack alignItems="center" justifyContent="center" paddingTop={80} gap="$4" testID="notification-empty-state">
            <DraftPlayLogo size={48} />
            <Text fontFamily="$mono" fontSize={15} color="$colorMuted">
              {formatUIText("no notifications yet")}
            </Text>
            <Text fontFamily="$body" fontSize={13} color="$colorMuted" textAlign="center" paddingHorizontal="$6">
              {formatUIText("you'll see match reminders, score updates, and alerts here")}
            </Text>
          </YStack>
        </Animated.View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 20).springify()}>
              <XStack
                paddingHorizontal="$4"
                paddingVertical="$3"
                gap="$3"
                borderBottomWidth={1}
                borderBottomColor="$borderColor"
                backgroundColor={item.isRead ? "transparent" : "$backgroundSurface"}
                onPress={() => handleTap(item)}
                cursor="pointer"
                pressStyle={{ backgroundColor: "$backgroundPress" }}
                testID={`notification-item-${item.id}`}
              >
                {/* Unread dot */}
                <YStack justifyContent="center" width={8}>
                  {!item.isRead && (
                    <YStack
                      width={8}
                      height={8}
                      borderRadius={4}
                      backgroundColor="$colorAccent"
                    />
                  )}
                </YStack>

                {/* Icon */}
                <YStack
                  width={36}
                  height={36}
                  borderRadius="$2"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor="$backgroundHover"
                >
                  <Ionicons
                    name={ICON_MAP[item.type] ?? "notifications-outline"}
                    size={18}
                    color={theme.colorMuted.val}
                  />
                </YStack>

                {/* Content */}
                <YStack flex={1} gap={2}>
                  <Text
                    fontFamily="$body"
                    fontWeight={item.isRead ? "400" : "600"}
                    fontSize={14}
                    color="$color"
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text fontFamily="$body" fontSize={13} color="$colorSecondary" numberOfLines={2}>
                    {item.body}
                  </Text>
                </YStack>

                {/* Time */}
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {getRelativeTime(item.createdAt as string)}
                </Text>
              </XStack>
            </Animated.View>
          )}
          onEndReached={() => {
            if (inboxQuery.hasNextPage && !inboxQuery.isFetchingNextPage) {
              inboxQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          testID="notification-list"
        />
      )}
    </YStack>
  );
}
