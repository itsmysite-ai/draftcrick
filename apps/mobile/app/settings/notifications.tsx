import { ScrollView as RNScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { YStack, XStack, Text, Switch, useTheme as useTamaguiTheme } from "tamagui";
import {
  Card,
  BackButton,
  ModeToggle,
  EggLoadingSpinner,
  textStyles,
  formatUIText,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useTheme } from "../../providers/ThemeProvider";

function PrefToggle({
  icon,
  label,
  description,
  value,
  onToggle,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  value: boolean;
  onToggle: (val: boolean) => void;
  testID: string;
}) {
  const theme = useTamaguiTheme();

  return (
    <XStack
      justifyContent="space-between"
      alignItems="center"
      paddingVertical="$3"
      paddingHorizontal="$4"
      borderBottomWidth={1}
      borderBottomColor="$borderColor"
    >
      <XStack alignItems="center" gap="$3" flex={1}>
        <YStack
          width={32}
          height={32}
          borderRadius="$1"
          alignItems="center"
          justifyContent="center"
          backgroundColor="$backgroundHover"
        >
          <Ionicons name={icon} size={16} color={theme.colorMuted.val} />
        </YStack>
        <YStack flex={1}>
          <Text fontFamily="$body" fontWeight="500" fontSize={14} color="$color">
            {label}
          </Text>
          <Text fontFamily="$body" fontSize={12} color="$colorMuted">
            {description}
          </Text>
        </YStack>
      </XStack>
      <Switch
        size="$3"
        checked={value}
        onCheckedChange={onToggle}
        testID={testID}
        backgroundColor={value ? "$accentBackground" : "$backgroundSurfaceAlt"}
        borderColor={value ? "$accentBackground" : "$borderColor"}
        borderWidth={1}
      >
        <Switch.Thumb animation="quick" backgroundColor="$white" />
      </Switch>
    </XStack>
  );
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, toggleMode } = useTheme();

  const utils = trpc.useUtils();
  const prefsQuery = trpc.notification.getPreferences.useQuery();
  const updateMutation = trpc.notification.updatePreferences.useMutation({
    onMutate: async (newPrefs) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await utils.notification.getPreferences.cancel();
      const previous = utils.notification.getPreferences.getData();
      // Optimistically update the cache
      utils.notification.getPreferences.setData(undefined, (old) =>
        old ? { ...old, ...newPrefs } : old
      );
      return { previous };
    },
    onError: (_err, _newPrefs, context) => {
      // Revert on error
      if (context?.previous) {
        utils.notification.getPreferences.setData(undefined, context.previous);
      }
    },
    onSettled: () => {
      utils.notification.getPreferences.invalidate();
    },
  });

  // Show defaults while loading or on error (e.g. unauthenticated)
  const DEFAULT_PREFS = {
    deadlines: true,
    scores: true,
    statusAlerts: true,
    rankChanges: true,
    promotions: false,
    quietHoursStart: null as string | null,
    quietHoursEnd: null as string | null,
  };

  const prefs = prefsQuery.data ?? (prefsQuery.isLoading ? null : DEFAULT_PREFS);

  const toggle = (field: string, value: boolean) => {
    updateMutation.mutate({ [field]: value });
  };

  return (
    <YStack flex={1} paddingTop={insets.top} backgroundColor="$background" testID="notification-prefs-screen">
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
            {formatUIText("notification settings")}
          </Text>
        </XStack>
        <ModeToggle mode={mode} onToggle={toggleMode} />
      </XStack>

      {!prefs ? (
        <YStack alignItems="center" paddingTop={60}>
          <EggLoadingSpinner size={32} />
        </YStack>
      ) : (
        <RNScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        >
          {/* Match Alerts */}
          <Animated.View entering={FadeInDown.delay(0).springify()}>
            <Text {...textStyles.sectionHeader} paddingHorizontal="$4" paddingTop="$4" paddingBottom="$2">
              {formatUIText("match alerts")}
            </Text>
            <Card marginHorizontal="$4">
              <PrefToggle
                icon="alarm-outline"
                label={formatUIText("deadline reminders")}
                description="1 hour and 30 min before match"
                value={prefs.deadlines}
                onToggle={(v) => toggle("deadlines", v)}
                testID="pref-toggle-deadlines"
              />
              <PrefToggle
                icon="trophy-outline"
                label={formatUIText("score updates")}
                description="Match results and your team's score"
                value={prefs.scores}
                onToggle={(v) => toggle("scores", v)}
                testID="pref-toggle-scores"
              />
            </Card>
          </Animated.View>

          {/* Player & Rank Alerts */}
          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <Text {...textStyles.sectionHeader} paddingHorizontal="$4" paddingTop="$5" paddingBottom="$2">
              {formatUIText("player & rank alerts")}
            </Text>
            <Card marginHorizontal="$4">
              <PrefToggle
                icon="alert-circle-outline"
                label={formatUIText("status alerts")}
                description="Player injury, doubtful, or lineup changes"
                value={prefs.statusAlerts}
                onToggle={(v) => toggle("statusAlerts", v)}
                testID="pref-toggle-status"
              />
              <PrefToggle
                icon="trending-up-outline"
                label={formatUIText("rank changes")}
                description="When you move up in the leaderboard"
                value={prefs.rankChanges}
                onToggle={(v) => toggle("rankChanges", v)}
                testID="pref-toggle-rank"
              />
            </Card>
          </Animated.View>

          {/* Promotions */}
          <Animated.View entering={FadeInDown.delay(160).springify()}>
            <Text {...textStyles.sectionHeader} paddingHorizontal="$4" paddingTop="$5" paddingBottom="$2">
              {formatUIText("other")}
            </Text>
            <Card marginHorizontal="$4">
              <PrefToggle
                icon="megaphone-outline"
                label={formatUIText("promotions")}
                description="Offers and announcements"
                value={prefs.promotions}
                onToggle={(v) => toggle("promotions", v)}
                testID="pref-toggle-promotions"
              />
            </Card>
          </Animated.View>

          {/* Quiet Hours */}
          <Animated.View entering={FadeInDown.delay(240).springify()}>
            <Text {...textStyles.sectionHeader} paddingHorizontal="$4" paddingTop="$5" paddingBottom="$2">
              {formatUIText("quiet hours")}
            </Text>
            <Card marginHorizontal="$4" padding="$4">
              <XStack justifyContent="space-between" alignItems="center">
                <YStack flex={1}>
                  <Text fontFamily="$body" fontWeight="500" fontSize={14} color="$color">
                    {formatUIText("do not disturb")}
                  </Text>
                  <Text fontFamily="$body" fontSize={12} color="$colorMuted">
                    {prefs.quietHoursStart && prefs.quietHoursEnd
                      ? `${prefs.quietHoursStart} — ${prefs.quietHoursEnd}`
                      : "Not set"}
                  </Text>
                </YStack>
                <Switch
                  size="$3"
                  checked={!!prefs.quietHoursStart}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateMutation.mutate({
                        quietHoursStart: "22:00",
                        quietHoursEnd: "07:00",
                      });
                    } else {
                      updateMutation.mutate({
                        quietHoursStart: null,
                        quietHoursEnd: null,
                      });
                    }
                  }}
                  testID="pref-quiet-hours-toggle"
                  backgroundColor={!!prefs.quietHoursStart ? "$accentBackground" : "$backgroundSurfaceAlt"}
                  borderColor={!!prefs.quietHoursStart ? "$accentBackground" : "$borderColor"}
                  borderWidth={1}
                >
                  <Switch.Thumb animation="quick" backgroundColor="$white" />
                </Switch>
              </XStack>
              {prefs.quietHoursStart && (
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginTop="$2">
                  {formatUIText("notifications muted 10 PM — 7 AM")}
                </Text>
              )}
            </Card>
          </Animated.View>
        </RNScrollView>
      )}
    </YStack>
  );
}
