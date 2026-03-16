import { ScrollView, RefreshControl, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback, useEffect, useRef } from "react";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, useTheme as useTamaguiTheme } from "tamagui";
import { Text } from "../../components/SportText";
import {
  Card,
  BackButton,
  Button,
  TierBadge,
  AlertModal,
  formatUIText,
  formatBadgeText,
} from "@draftplay/ui";
import type { AlertAction } from "@draftplay/ui";
import { trpc } from "../../lib/trpc";
import { HeaderControls } from "../../components/HeaderControls";
import { useAuth } from "../../providers/AuthProvider";
import type { TierConfig } from "@draftplay/shared";
import { DAY_PASS_CONFIG } from "@draftplay/shared";
import { Platform } from "react-native";

/** Detect if user is likely in India (INR pricing only, no USD) */
function useIsIndianUser(): boolean {
  try {
    if (Platform.OS === "web") {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz?.startsWith("Asia/Kolkata") || tz?.startsWith("Asia/Calcutta")) return true;
      const lang = navigator?.language ?? "";
      if (lang.includes("-IN") || lang === "hi") return true;
    }
    // On native, check locale
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
    if (locale.includes("-IN") || locale.includes("_IN")) return true;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz?.startsWith("Asia/Kolkata") || tz?.startsWith("Asia/Calcutta") || false;
  } catch {
    return true; // Default to Indian for our primary market
  }
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  actions: AlertAction[];
}

const EMPTY_ALERT: AlertState = { visible: false, title: "", message: "", actions: [] };

function formatTimeRemaining(expiresAt: Date): string {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m remaining`;
}

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();

  const { user } = useAuth();
  const isIndian = useIsIndianUser();
  const [refreshing, setRefreshing] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{ valid: boolean; discountDisplay?: string } | null>(null);
  const [alert, setAlert] = useState<AlertState>(EMPTY_ALERT);
  const [dayPassCountdown, setDayPassCountdown] = useState("");

  const dismiss = () => setAlert(EMPTY_ALERT);

  const showInfo = (title: string, message: string) => {
    setAlert({
      visible: true,
      title,
      message,
      actions: [{ label: "OK", variant: "primary", onPress: dismiss }],
    });
  };

  const showConfirm = (title: string, message: string, confirmLabel: string, onConfirm: () => void, variant: "primary" | "danger" = "primary") => {
    setAlert({
      visible: true,
      title,
      message,
      actions: [
        { label: "Cancel", variant: "ghost", onPress: dismiss },
        { label: confirmLabel, variant, onPress: () => { dismiss(); onConfirm(); } },
      ],
    });
  };

  const myTier = trpc.subscription.getMyTier.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });
  const tierConfigs = trpc.subscription.getTierConfigs.useQuery(undefined, { retry: false });
  const history = trpc.subscription.getHistory.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const subscribeMutation = trpc.subscription.subscribe.useMutation({
    onSuccess: (data: { tier: string; discountApplied: number; isTrialing?: boolean }) => {
      myTier.refetch();
      history.refetch();
      const discount = data.discountApplied > 0 ? ` (saved ₹${(data.discountApplied / 100).toFixed(0)})` : "";
      const trialNote = data.isTrialing ? " Your 7-day free trial has started." : "";
      showInfo("Subscribed", `You're now on the ${data.tier.toUpperCase()} plan${discount}.${trialNote}`);
      setPromoCode("");
      setPromoResult(null);
    },
    onError: (error: { message: string }) => {
      showInfo("Subscription Failed", error.message);
    },
  });

  const dayPassMutation = trpc.subscription.purchaseDayPass.useMutation({
    onSuccess: (data) => {
      myTier.refetch();
      history.refetch();
      showInfo("Day Pass Activated", `You have Elite access for the next ${DAY_PASS_CONFIG.durationHours} hours.`);
    },
    onError: (error: { message: string }) => {
      showInfo("Purchase Failed", error.message);
    },
  });

  const cancelMutation = trpc.subscription.cancel.useMutation({
    onSuccess: () => {
      myTier.refetch();
      history.refetch();
      showInfo("Subscription Cancelled", "Your subscription will not renew. Access continues until the end of your billing period.");
    },
    onError: (error: { message: string }) => {
      showInfo("Cancellation Failed", error.message);
    },
  });

  // Day Pass countdown timer
  const dayPassExpiresAt = myTier.data?.dayPassExpiresAt ? new Date(myTier.data.dayPassExpiresAt) : null;
  useEffect(() => {
    if (!myTier.data?.dayPassActive || !dayPassExpiresAt) {
      setDayPassCountdown("");
      return;
    }
    const update = () => setDayPassCountdown(formatTimeRemaining(dayPassExpiresAt));
    update();
    const interval = setInterval(update, 60_000); // update every minute
    return () => clearInterval(interval);
  }, [myTier.data?.dayPassActive, dayPassExpiresAt?.getTime()]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([myTier.refetch(), tierConfigs.refetch(), history.refetch()]);
    setRefreshing(false);
  }, [myTier, tierConfigs, history]);

  const currentTier = myTier.data?.effectiveTier ?? myTier.data?.tier ?? "basic";
  const baseTier = myTier.data?.baseTier ?? myTier.data?.tier ?? "basic";
  const isTrialing = myTier.data?.isTrialing ?? false;
  const tiers = ((tierConfigs.data as any)?.tiers ?? []) as TierConfig[];
  const tierRank: Record<string, number> = { basic: 0, pro: 1, elite: 2 };

  const handleSubscribe = (tier: "basic" | "pro" | "elite") => {
    const promoNote = promoResult?.valid ? ` Promo: ${promoResult.discountDisplay}` : "";
    const trialNote = tier === "basic" ? " Includes a 7-day free trial." : "";
    showConfirm(
      `${tier === baseTier ? "Renew" : "Upgrade to"} ${tier.toUpperCase()}`,
      `This will start your yearly ${tier} subscription.${promoNote}${trialNote}`,
      "Subscribe",
      () => subscribeMutation.mutate({
        tier,
        promoCode: promoResult?.valid ? promoCode : undefined,
      }),
    );
  };

  const handleDayPass = () => {
    showConfirm(
      "Purchase Day Pass",
      `Get full Elite access for 24 hours at ${isIndian ? `₹${(DAY_PASS_CONFIG.priceINR / 100).toFixed(0)}` : `$${(DAY_PASS_CONFIG.priceUSD / 100).toFixed(2)}`}.`,
      "Buy Day Pass",
      () => dayPassMutation.mutate(),
    );
  };

  const handleCancel = () => {
    showConfirm(
      "Cancel Subscription",
      "Your subscription will not renew. You'll keep access until the end of your current billing period.",
      "Cancel Subscription",
      () => cancelMutation.mutate(),
      "danger",
    );
  };

  return (
    <>
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background?.val }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      testID="subscription-screen"
    >
      {/* Header */}
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
            {formatUIText("subscription")}
          </Text>
        </XStack>
        <HeaderControls />
      </XStack>

      {/* Current Plan */}
      <Animated.View entering={FadeInDown.delay(40).springify()}>
        <Card marginHorizontal="$4" marginBottom="$4" padding="$5" testID="current-plan-card">
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
              {formatBadgeText("current plan")}
            </Text>
            <XStack gap="$2" alignItems="center">
              {myTier.data?.dayPassActive && (
                <TierBadge tier="day_pass" testID="daypass-active-badge" />
              )}
              <TierBadge tier={baseTier} testID="current-tier-badge" />
            </XStack>
          </XStack>
          <Text fontFamily="$body" fontWeight="700" fontSize={22} color="$color">
            {baseTier === "basic" ? "Basic" : baseTier === "pro" ? "Pro" : "Elite"}
            {isTrialing && " (Trial)"}
          </Text>
          {myTier.data?.currentPeriodEnd && (
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop="$1">
              {myTier.data?.cancelAtPeriodEnd ? "expires" : "renews"}{" "}
              {new Date(myTier.data.currentPeriodEnd).toLocaleDateString()}
            </Text>
          )}
          {isTrialing && myTier.data?.trialEndsAt && (
            <Text fontFamily="$mono" fontSize={10} color="$accentBackground" marginTop="$1">
              Trial ends {new Date(myTier.data.trialEndsAt).toLocaleDateString()}
            </Text>
          )}
        </Card>
      </Animated.View>

      {/* Day Pass Card */}
      <Animated.View entering={FadeInDown.delay(60).springify()}>
        <Card
          marginHorizontal="$4"
          marginBottom="$4"
          padding="$5"
          borderWidth={myTier.data?.dayPassActive ? 2 : 1}
          borderColor={myTier.data?.dayPassActive ? "#8B5CF6" : "$borderColor"}
          testID="day-pass-card"
        >
          <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
            <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
              {formatBadgeText("day pass")}
            </Text>
            <TierBadge tier="day_pass" size="sm" />
          </XStack>
          <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" marginBottom="$1">
            24hr Elite Access
          </Text>
          <Text fontFamily="$body" fontSize={13} color="$colorSecondary" marginBottom="$3">
            Get all Elite features for 24 hours. Perfect for big match days.
          </Text>

          {myTier.data?.dayPassActive && dayPassCountdown ? (
            <YStack
              backgroundColor="#8B5CF620"
              padding="$3"
              borderRadius="$3"
              alignItems="center"
            >
              <Text fontFamily="$mono" fontWeight="700" fontSize={14} color="#8B5CF6">
                Elite features active
              </Text>
              <Text fontFamily="$mono" fontSize={12} color="$colorSecondary" marginTop="$1">
                {dayPassCountdown}
              </Text>
            </YStack>
          ) : (
            <Button
              variant="primary"
              size="md"
              disabled={dayPassMutation.isPending}
              onPress={handleDayPass}
              testID="buy-daypass-btn"
            >
              {dayPassMutation.isPending
                ? formatUIText("processing...")
                : formatUIText(`${isIndian ? `₹${(DAY_PASS_CONFIG.priceINR / 100).toFixed(0)}` : `$${(DAY_PASS_CONFIG.priceUSD / 100).toFixed(2)}`} — buy day pass`)}
            </Button>
          )}
        </Card>
      </Animated.View>

      {/* Promo Code Input */}
      <Animated.View entering={FadeInDown.delay(80).springify()}>
        <Card marginHorizontal="$4" marginBottom="$4" padding="$4">
          <Text fontFamily="$mono" fontSize={11} color="$colorMuted" marginBottom="$2">
            {formatBadgeText("promo code")}
          </Text>
          <XStack gap="$2" alignItems="center">
            <TextInput
              style={{
                flex: 1,
                fontFamily: "DMMono_400Regular",
                fontSize: 14,
                color: theme.color?.val,
                backgroundColor: theme.backgroundSurface?.val,
                borderWidth: 1,
                borderColor: theme.borderColor?.val,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                textTransform: "uppercase",
              }}
              placeholder="Enter code"
              placeholderTextColor={theme.colorMuted?.val}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
              testID="promo-code-input"
            />
          </XStack>
          {promoResult && (
            <Text
              fontFamily="$mono"
              fontSize={11}
              color={promoResult.valid ? "$accentBackground" : "$colorDanger"}
              marginTop="$2"
            >
              {promoResult.valid ? `Applied: ${promoResult.discountDisplay}` : "Invalid or expired code"}
            </Text>
          )}
        </Card>
      </Animated.View>

      {/* Tier Cards */}
      {tiers.map((tier, i) => {
        const isCurrent = baseTier === tier.id;
        const isUpgrade = !isCurrent && (tierRank[tier.id] ?? 0) > (tierRank[baseTier] ?? 0);

        return (
          <Animated.View key={tier.id} entering={FadeInDown.delay(120 + i * 60).springify()}>
            <Card
              marginHorizontal="$4"
              marginBottom="$3"
              padding="$5"
              borderWidth={isCurrent ? 2 : 1}
              borderColor={isCurrent ? "$accentBackground" : "$borderColor"}
              testID={`tier-card-${tier.id}`}
            >
              {/* Tier header */}
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <XStack alignItems="baseline" gap="$2">
                  <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color">
                    {tier.name}
                  </Text>
                  {isCurrent && (
                    <Text fontFamily="$mono" fontSize={9} color="$accentBackground" fontWeight="600">
                      {formatBadgeText("current")}
                    </Text>
                  )}
                </XStack>
                <TierBadge tier={tier.id} size="sm" />
              </XStack>

              {/* Price — yearly */}
              <XStack alignItems="baseline" gap="$1" marginBottom="$1">
                <Text fontFamily="$mono" fontWeight="800" fontSize={28} color="$accentBackground">
                  {isIndian ? `₹${((tier as any).priceYearlyINR / 100).toFixed(0)}` : `$${((tier as any).priceYearlyUSD / 100).toFixed(2)}`}
                </Text>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  /year
                </Text>
              </XStack>
              {!isIndian && (
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginBottom="$1">
                  ₹{((tier as any).priceYearlyINR / 100).toFixed(0)}/yr
                </Text>
              )}
              {(tier as any).hasFreeTrial && (
                <XStack
                  backgroundColor="$accentBackground"
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$2"
                  alignSelf="flex-start"
                  marginBottom="$3"
                  marginTop="$1"
                >
                  <Text fontFamily="$mono" fontWeight="700" fontSize={10} color="white">
                    {formatBadgeText("7-day free trial")}
                  </Text>
                </XStack>
              )}
              {!(tier as any).hasFreeTrial && <YStack marginBottom="$4" />}

              {/* Features */}
              <YStack gap="$2" marginBottom="$4">
                {tier.displayFeatures.map((feat, j) => (
                  <XStack key={j} alignItems="flex-start" gap="$2">
                    <Text fontSize={12} color="$accentBackground" marginTop={1}>
                      ✓
                    </Text>
                    <Text fontFamily="$body" fontSize={13} color="$color" flex={1}>
                      {feat}
                    </Text>
                  </XStack>
                ))}
              </YStack>

              {/* CTA */}
              {isUpgrade && (
                <Button
                  variant="primary"
                  size="md"
                  disabled={subscribeMutation.isPending}
                  onPress={() => handleSubscribe(tier.id as "basic" | "pro" | "elite")}
                  testID={`subscribe-btn-${tier.id}`}
                >
                  {subscribeMutation.isPending
                    ? formatUIText("processing...")
                    : formatUIText(`upgrade to ${tier.name.toLowerCase()}`)}
                </Button>
              )}
              {isCurrent && !myTier.data?.cancelAtPeriodEnd && (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={cancelMutation.isPending}
                  onPress={handleCancel}
                  testID="cancel-btn"
                >
                  {cancelMutation.isPending
                    ? formatUIText("processing...")
                    : formatUIText("cancel subscription")}
                </Button>
              )}
              {isCurrent && myTier.data?.cancelAtPeriodEnd && (
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted" textAlign="center">
                  {formatUIText("cancellation pending — access until period end")}
                </Text>
              )}
            </Card>
          </Animated.View>
        );
      })}

      {/* Subscription History */}
      {history.data && history.data.length > 0 && (
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text
            fontFamily="$mono"
            fontSize={12}
            fontWeight="600"
            color="$color"
            marginHorizontal="$4"
            marginTop="$4"
            marginBottom="$2"
          >
            {formatUIText("history")}
          </Text>
          {history.data.map((event: any, i: number) => (
            <Card key={event.id} marginHorizontal="$4" marginBottom="$2" padding="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <YStack flex={1}>
                  <Text fontFamily="$mono" fontWeight="600" fontSize={12} color="$color">
                    {event.event.replace(/_/g, " ")}
                  </Text>
                  {event.fromTier && event.toTier && (
                    <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                      {event.fromTier} → {event.toTier}
                    </Text>
                  )}
                </YStack>
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
                  {new Date(event.createdAt).toLocaleDateString()}
                </Text>
              </XStack>
            </Card>
          ))}
        </Animated.View>
      )}
    </ScrollView>

    {/* Custom Alert Modal */}
    <AlertModal
      visible={alert.visible}
      title={alert.title}
      message={alert.message}
      actions={alert.actions}
      onDismiss={dismiss}
    />
    </>
  );
}
