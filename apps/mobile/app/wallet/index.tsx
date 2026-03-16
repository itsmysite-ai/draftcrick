import { ScrollView, RefreshControl, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  BackButton,
  Button,
  AnnouncementBanner,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
  DraftPlayLogo,
} from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { useAuth } from "../../providers/AuthProvider";
import { HeaderControls } from "../../components/HeaderControls";

const TXN_LABELS: Record<string, string> = {
  daily_claim: "daily reward",
  contest_entry: "contest entry",
  contest_win: "contest win",
  prediction_win: "prediction win",
  referral_bonus: "referral bonus",
  pack_purchase: "coin pack",
  streak_bonus: "streak bonus",
  achievement: "achievement",
};

const CREDIT_TYPES = new Set([
  "daily_claim",
  "contest_win",
  "prediction_win",
  "referral_bonus",
  "streak_bonus",
  "achievement",
]);

function StreakPulseDot({ day, isMilestone }: { day: number; isMilestone: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <YStack
        width={28}
        height={28}
        borderRadius={14}
        backgroundColor="$backgroundSurface"
        borderWidth={isMilestone ? 2 : 1}
        borderColor={isMilestone ? "$colorCricket" : "$accentBackground"}
        alignItems="center"
        justifyContent="center"
      >
        <Text fontFamily="$mono" fontSize={10} fontWeight="700" color="$accentBackground">
          {day}
        </Text>
      </YStack>
    </Animated.View>
  );
}

export default function WalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();
  const { isLoading: authLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Don't fire queries until auth has rehydrated from IndexedDB
  const wallet = trpc.wallet.getBalance.useQuery(undefined, { retry: false, enabled: !authLoading });
  const txns = trpc.wallet.getTransactions.useQuery({ limit: 20 }, { retry: false, enabled: !authLoading });

  const claimDaily = trpc.wallet.claimDaily.useMutation({
    onSuccess: (data) => {
      wallet.refetch();
      txns.refetch();
      Alert.alert(
        formatUIText("daily reward claimed!"),
        `+${data.coinsAwarded} PC${data.streakBonus > 0 ? ` (includes +${data.streakBonus} streak bonus)` : ""}\nStreak: ${data.newStreak} day${data.newStreak > 1 ? "s" : ""}`
      );
    },
    onError: (error) => {
      Alert.alert(formatUIText("already claimed"), error.message);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([wallet.refetch(), txns.refetch()]);
    setRefreshing(false);
  }, [wallet, txns]);

  if (authLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <EggLoadingSpinner size={48} message={formatUIText("loading wallet")} />
      </YStack>
    );
  }

  if (wallet.error?.data?.code === "UNAUTHORIZED") {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center" padding="$5">
        <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
        <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5} marginBottom="$2">
          {formatUIText("sign in required")}
        </Text>
        <Text fontFamily="$body" fontSize={14} color="$colorMuted" marginBottom="$5">
          {formatUIText("sign in to access your wallet")}
        </Text>
        <Button variant="primary" size="md" onPress={() => router.push("/auth/login")}>
          {formatUIText("sign in")}
        </Button>
      </YStack>
    );
  }

  if (wallet.isLoading) {
    return (
      <YStack flex={1} backgroundColor="$background" justifyContent="center" alignItems="center">
        <EggLoadingSpinner size={48} message={formatUIText("loading wallet")} />
      </YStack>
    );
  }

  const w = wallet.data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.val }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accentBackground.val} />}
      testID="wallet-screen"
    >
      <XStack
        justifyContent="space-between"
        alignItems="center"
        paddingHorizontal="$4"
        paddingTop={insets.top + 8}
        paddingBottom="$3"
      >
        <XStack alignItems="center" gap="$3">
          <BackButton onPress={() => router.back()} />
          <Text fontFamily="$mono" fontWeight="500" fontSize={17} color="$color" letterSpacing={-0.5}>
            {formatUIText("pop coins")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      <AnnouncementBanner />

      {/* Balance Card */}
      {w && (
        <Card margin="$4" marginTop="$2" padding="$5" borderColor="$colorAccentLight">
          <Text fontFamily="$mono" fontSize={12} color="$colorMuted" letterSpacing={0.5}>
            {formatBadgeText("pop coins balance")}
          </Text>
          <XStack alignItems="baseline" gap="$2" marginTop="$1" marginBottom="$4">
            <Text testID="wallet-balance-total" fontFamily="$mono" fontWeight="800" fontSize={36} color="$accentBackground">
              {w.coinBalance.toLocaleString()}
            </Text>
            <Text fontFamily="$mono" fontWeight="600" fontSize={16} color="$accentBackground">
              PC
            </Text>
          </XStack>
          <XStack borderTopWidth={1} borderTopColor="$borderColor" paddingTop="$4">
            <YStack flex={1} alignItems="center">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{formatUIText("earned")}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
                {w.totalEarned.toLocaleString()}
              </Text>
            </YStack>
            <YStack width={1} backgroundColor="$borderColor" />
            <YStack flex={1} alignItems="center">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{formatUIText("spent")}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$color" marginTop="$1">
                {w.totalSpent.toLocaleString()}
              </Text>
            </YStack>
            <YStack width={1} backgroundColor="$borderColor" />
            <YStack flex={1} alignItems="center">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">{formatUIText("won")}</Text>
              <Text fontFamily="$mono" fontWeight="700" fontSize={16} color="$accentBackground" marginTop="$1">
                {w.totalWon.toLocaleString()}
              </Text>
            </YStack>
          </XStack>
        </Card>
      )}

      {/* Daily Claim Card */}
      {w && (
        <Card margin="$4" marginTop={0} padding="$4" borderColor={w.canClaimDaily ? "$accentBackground" : "$borderColor"}>
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
            <YStack>
              <Text fontFamily="$mono" fontWeight="600" fontSize={15} color="$color">
                {formatUIText("daily reward")}
              </Text>
              <Text fontFamily="$body" fontSize={12} color="$colorMuted" marginTop={2}>
                {w.currentStreak > 0
                  ? `${w.currentStreak}-day streak (+${(w.currentStreak - 1) * 10}% bonus)`
                  : formatUIText("start a streak for bonus coins!")}
              </Text>
            </YStack>
            <Button
              testID="claim-daily-btn"
              variant={w.canClaimDaily ? "primary" : "secondary"}
              size="sm"
              disabled={!w.canClaimDaily || claimDaily.isPending}
              opacity={!w.canClaimDaily ? 0.5 : 1}
              onPress={() => claimDaily.mutate()}
            >
              {claimDaily.isPending
                ? formatUIText("claiming...")
                : w.canClaimDaily
                  ? formatUIText("claim now")
                  : formatUIText("claimed today")}
            </Button>
          </XStack>
          {/* Streak dots with multiplier labels */}
          <XStack gap="$2" justifyContent="center">
            {Array.from({ length: 7 }).map((_, i) => {
              const isCompleted = i < w.currentStreak;
              const isNext = i === w.currentStreak;
              const isMilestone = i === 2 || i === 6; // day 3 and 7
              const multiplier = `${(1 + i * 0.1).toFixed(1)}x`;
              return (
                <YStack key={i} alignItems="center" gap={2}>
                  {isNext ? (
                    <StreakPulseDot day={i + 1} isMilestone={isMilestone} />
                  ) : (
                    <YStack
                      width={28}
                      height={28}
                      borderRadius={14}
                      backgroundColor={isCompleted ? "$accentBackground" : "$backgroundSurface"}
                      borderWidth={isMilestone ? 2 : 1}
                      borderColor={isCompleted ? "$accentBackground" : isMilestone ? "$colorCricket" : "$borderColor"}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontFamily="$mono" fontSize={10} fontWeight="700" color={isCompleted ? "$accentColor" : "$colorMuted"}>
                        {i + 1}
                      </Text>
                    </YStack>
                  )}
                  <Text fontFamily="$mono" fontSize={8} fontWeight="600" color={isCompleted ? "$accentBackground" : "$colorMuted"}>
                    {multiplier}
                  </Text>
                </YStack>
              );
            })}
          </XStack>

          {/* Next reward preview */}
          {w.currentStreak < 7 && (
            <XStack justifyContent="center" marginTop="$2">
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                {formatUIText("tomorrow")}: {" "}
              </Text>
              <Text fontFamily="$mono" fontSize={11} fontWeight="700" color="$accentBackground">
                +{Math.round((w.dailyCoinDrip ?? 10) * (1 + w.currentStreak * 0.1))} PC
              </Text>
            </XStack>
          )}
        </Card>
      )}

      {/* How to Earn */}
      <Card margin="$4" marginTop={0} padding="$4">
        <Text fontFamily="$mono" fontWeight="600" fontSize={14} color="$color" marginBottom="$3">
          {formatUIText("ways to earn")}
        </Text>
        {[
          { label: "daily claim", amount: "10-100 PC/day" },
          { label: "win contests", amount: "prize pool share" },
          { label: "correct predictions", amount: "10-50 PC each" },
          { label: "refer friends", amount: "200 PC per referral" },
          { label: "login streaks", amount: "up to +70% bonus" },
        ].map((item) => (
          <XStack key={item.label} justifyContent="space-between" paddingVertical="$1">
            <Text fontFamily="$body" fontSize={13} color="$colorMuted">
              {formatUIText(item.label)}
            </Text>
            <Text fontFamily="$mono" fontSize={12} fontWeight="600" color="$accentBackground">
              {item.amount}
            </Text>
          </XStack>
        ))}
      </Card>

      {/* Transaction History */}
      <YStack paddingHorizontal="$4" marginBottom="$8">
        <Text {...textStyles.sectionHeader} marginBottom="$3">
          {formatUIText("recent activity")}
        </Text>
        {txns.isLoading ? (
          <EggLoadingSpinner size={32} message={formatUIText("loading transactions")} />
        ) : txns.data && txns.data.length > 0 ? (
          txns.data.map((txn, i) => {
            const isCredit = CREDIT_TYPES.has(txn.type);
            return (
              <Animated.View key={txn.id} entering={FadeInDown.delay(i * 25).springify()}>
                <Card marginBottom="$1" padding="$4">
                  <XStack justifyContent="space-between" alignItems="center">
                    <YStack flex={1}>
                      <Text fontFamily="$mono" fontWeight="600" fontSize={13} color="$color">
                        {formatBadgeText(TXN_LABELS[txn.type] ?? txn.type)}
                      </Text>
                      <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginTop={2}>
                        {new Date(txn.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </Text>
                    </YStack>
                    <Text
                      fontFamily="$mono"
                      fontWeight="700"
                      fontSize={16}
                      marginLeft="$3"
                      color={isCredit ? "$accentBackground" : "$error"}
                    >
                      {isCredit ? "+" : "-"}{txn.amount.toLocaleString()} PC
                    </Text>
                  </XStack>
                </Card>
              </Animated.View>
            );
          })
        ) : (
          <Card padding="$6" alignItems="center">
            <DraftPlayLogo size={DesignSystem.emptyState.iconSize} />
            <Text {...textStyles.hint}>{formatUIText("no activity yet")}</Text>
          </Card>
        )}
      </YStack>
    </ScrollView>
  );
}
