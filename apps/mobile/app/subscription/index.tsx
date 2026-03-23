import { ScrollView, RefreshControl, TextInput, Linking } from "react-native";
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
import { getPlatform, purchaseProduct, restorePurchases, supportsNativeIAP } from "../../services/iap";

// India-only launch — always show INR pricing
const isIOS = Platform.OS === "ios";

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  actions: AlertAction[];
}

const EMPTY_ALERT: AlertState = { visible: false, title: "", message: "", actions: [] };

// ── Cancel flow ────────────────────────────────────────────────────
type CancelStep = "idle" | "confirm" | "downgrade_pro" | "downgrade_basic" | "daypass" | "reason" | "freeform";

const CANCEL_REASONS = [
  "Too expensive",
  "Not using the app enough",
  "Missing features I need",
  "Found a better alternative",
  "Too many bugs / technical issues",
  "Just trying it out",
  "Taking a break from fantasy cricket",
  "Other",
] as const;

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
  const [refreshing, setRefreshing] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{ valid: boolean; discountDisplay?: string } | null>(null);
  const [alert, setAlert] = useState<AlertState>(EMPTY_ALERT);
  const [dayPassCountdown, setDayPassCountdown] = useState("");
  const [cancelStep, setCancelStep] = useState<CancelStep>("idle");
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [cancelFreeform, setCancelFreeform] = useState("");

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

  // India-only launch — always INR
  const isIndian = true;

  const tierConfigs = trpc.subscription.getTierConfigs.useQuery(undefined, { retry: false });
  const history = trpc.subscription.getHistory.useQuery(undefined, {
    enabled: !!user,
    retry: false,
  });

  const subscribeMutation = trpc.subscription.subscribe.useMutation({
    onSuccess: async (data: { tier: string; discountApplied: number; isTrialing?: boolean; provider?: string; productId?: string; checkoutUrl?: string }) => {
      // iOS: Apple IAP flow — present native payment sheet
      if (data.provider === "apple" && data.productId) {
        const result = await purchaseProduct(data.productId);
        if (!result.success) {
          if (result.error !== "Purchase cancelled") {
            showInfo("Purchase Failed", result.error ?? "Apple payment failed");
          }
          return;
        }
        // Purchase succeeded — webhook will activate. Poll for status.
        showInfo("Processing", "Your subscription is being activated. This may take a moment.");
        setTimeout(() => { myTier.refetch(); history.refetch(); }, 3000);
        return;
      }

      // Razorpay: open checkout URL (Android/Web)
      if (data.checkoutUrl) {
        const { Linking } = require("react-native");
        await Linking.openURL(data.checkoutUrl);
        // Poll for activation after user returns
        setTimeout(() => { myTier.refetch(); history.refetch(); }, 5000);
        return;
      }

      // Stub mode or trial: immediate activation
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
    onSuccess: async (data: any) => {
      // iOS: Apple IAP flow
      if (data.provider === "apple" && data.productId) {
        const result = await purchaseProduct(data.productId);
        if (!result.success) {
          if (result.error !== "Purchase cancelled") {
            showInfo("Purchase Failed", result.error ?? "Apple payment failed");
          }
          return;
        }
        showInfo("Processing", "Your Day Pass is being activated.");
        setTimeout(() => { myTier.refetch(); history.refetch(); }, 3000);
        return;
      }

      // Razorpay checkout URL
      if (data.checkoutUrl) {
        const { Linking } = require("react-native");
        await Linking.openURL(data.checkoutUrl);
        setTimeout(() => { myTier.refetch(); history.refetch(); }, 5000);
        return;
      }

      // Stub mode: immediate activation
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
      setCancelStep("idle");
      setCancelReason(null);
      setCancelFreeform("");
      showInfo("Subscription Cancelled", "Your subscription will not renew. Access continues until the end of your billing period.");
    },
    onError: (error: { message: string }) => {
      setCancelStep("idle");
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
  // baseTier = computed tier for feature access (always "basic" when cancelled)
  const baseTier = myTier.data?.baseTier ?? myTier.data?.tier ?? "basic";
  // subTier = actual subscription tier from DB (preserves "elite" even when cancelled)
  const subTier = (myTier.data?.tier as string) ?? "basic";
  const subStatus = (myTier.data?.status as string) ?? "expired";
  const isActive = subStatus === "active" || subStatus === "trialing";
  const isCancelled = subStatus === "cancelled" || subStatus === "expired";
  // For display & cancel flow: show actual tier when active, show actual when cancelled too
  const displayTier = isActive ? baseTier : subTier;
  const isTrialing = myTier.data?.isTrialing ?? false;
  const tiers = ((tierConfigs.data as any)?.tiers ?? []) as TierConfig[];
  const tierRank: Record<string, number> = { basic: 0, pro: 1, elite: 2 };

  const handleSubscribe = (tier: "basic" | "pro" | "elite") => {
    const promoNote = promoResult?.valid ? ` Promo: ${promoResult.discountDisplay}` : "";
    const trialNote = tier === "basic" ? " Includes a 7-day free trial." : "";
    showConfirm(
      `${tier === displayTier ? (isCancelled ? "Resubscribe to" : "Renew") : (tierRank[tier] ?? 0) > (tierRank[displayTier] ?? 0) ? "Upgrade to" : "Downgrade to"} ${tier.toUpperCase()}`,
      `This will start your yearly ${tier} subscription.${promoNote}${trialNote}`,
      "Subscribe",
      () => subscribeMutation.mutate({
        tier,
        promoCode: isIOS ? undefined : (promoResult?.valid ? promoCode : undefined),
        platform: getPlatform(),
      }),
    );
  };

  const handleDayPass = () => {
    showConfirm(
      "Purchase Day Pass",
      `Get full Elite access for 24 hours at ₹${((isIOS ? DAY_PASS_CONFIG.priceINR_iOS : DAY_PASS_CONFIG.priceINR) / 100).toFixed(0)}.`,
      "Buy Day Pass",
      () => dayPassMutation.mutate({ platform: getPlatform() }),
    );
  };

  const handleCancel = () => {
    // Step 1: "Are you sure?" confirmation
    setCancelStep("confirm");
  };

  const onCancelConfirmed = () => {
    // Offer downgrade path based on current tier:
    // Elite → Pro → Basic → Day Pass → Reason
    // Pro → Basic → Day Pass → Reason
    // Basic → Day Pass → Reason
    if (displayTier === "elite") {
      setCancelStep("downgrade_pro");
    } else if (displayTier === "pro") {
      setCancelStep("downgrade_basic");
    } else if (!myTier.data?.dayPassActive) {
      setCancelStep("daypass");
    } else {
      setCancelStep("reason");
    }
  };

  const onSkipDowngradePro = () => {
    setCancelStep("downgrade_basic");
  };

  const onSkipDowngradeBasic = () => {
    if (!myTier.data?.dayPassActive) {
      setCancelStep("daypass");
    } else {
      setCancelStep("reason");
    }
  };

  const onSkipDayPass = () => {
    setCancelStep("reason");
  };

  const handleDowngrade = (toTier: "basic" | "pro") => {
    dismissCancelFlow();
    subscribeMutation.mutate({ tier: toTier });
  };

  const onReasonSelected = (reason: string) => {
    setCancelReason(reason);
    if (reason === "Other") {
      setCancelStep("freeform");
    } else {
      // Final cancel
      cancelMutation.mutate({
        reason,
        reasonCategory: reason,
      });
    }
  };

  const onFreeformSubmit = () => {
    cancelMutation.mutate({
      reason: cancelFreeform.trim() || "Other",
      reasonCategory: cancelReason ?? "Other",
    });
  };

  const dismissCancelFlow = () => {
    setCancelStep("idle");
    setCancelReason(null);
    setCancelFreeform("");
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

      {/* TODO(geo-pricing): Restore geo-pricing banner when multi-currency launches
      {pricingMode === "live" && pricingSource === "ip" && (
        <Animated.View entering={FadeInDown.delay(20).springify()}>
          <XStack
            marginHorizontal="$4"
            marginBottom="$3"
            padding="$3"
            backgroundColor="$backgroundSurface"
            borderRadius="$3"
            borderWidth={1}
            borderColor="$borderColor"
            alignItems="center"
            gap="$2"
            testID="geo-pricing-banner"
          >
            <Text fontSize={14}>🌍</Text>
            <Text fontFamily="$body" fontSize={11} color="$colorSecondary" flex={1}>
              {formatUIText(`pricing shown in ${isIndian ? "INR (₹)" : "USD ($)"} based on your location`)}
            </Text>
          </XStack>
        </Animated.View>
      )}
      */}

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
              <TierBadge tier={displayTier} testID="current-tier-badge" />
            </XStack>
          </XStack>
          <Text fontFamily="$body" fontWeight="700" fontSize={22} color="$color">
            {displayTier === "basic" ? "Basic" : displayTier === "pro" ? "Pro" : "Elite"}
            {isTrialing && " (Trial)"}
            {isCancelled && " (Cancelled)"}
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
        const isCurrent = displayTier === tier.id;
        const isUpgrade = !isCurrent && (tierRank[tier.id] ?? 0) > (tierRank[displayTier] ?? 0);
        const isDowngrade = !isCurrent && (tierRank[tier.id] ?? 0) < (tierRank[displayTier] ?? 0);

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
                  {isIndian ? `₹${((isIOS ? (tier as any).priceYearlyINR_iOS : (tier as any).priceYearlyINR) / 100).toFixed(0)}` : `$${((tier as any).priceYearlyUSD / 100).toFixed(2)}`}
                </Text>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  /year
                </Text>
              </XStack>
              {!isIndian && (
                <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginBottom="$1">
                  ₹{((isIOS ? (tier as any).priceYearlyINR_iOS : (tier as any).priceYearlyINR) / 100).toFixed(0)}/yr
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
              {isUpgrade && isActive && (
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
              {isCurrent && isActive && !myTier.data?.cancelAtPeriodEnd && (
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
              {isCancelled && !isCurrent && (
                <Button
                  variant="primary"
                  size="md"
                  disabled={subscribeMutation.isPending}
                  onPress={() => handleSubscribe(tier.id as "basic" | "pro" | "elite")}
                  testID={`subscribe-btn-${tier.id}`}
                >
                  {subscribeMutation.isPending
                    ? formatUIText("processing...")
                    : formatUIText(`subscribe to ${tier.name.toLowerCase()}`)}
                </Button>
              )}
              {isCurrent && isCancelled && (
                <Button
                  variant="primary"
                  size="md"
                  disabled={subscribeMutation.isPending}
                  onPress={() => handleSubscribe(tier.id as "basic" | "pro" | "elite")}
                  testID="resubscribe-btn"
                >
                  {subscribeMutation.isPending
                    ? formatUIText("processing...")
                    : formatUIText("resubscribe")}
                </Button>
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

      {/* Support Contact */}
      <Animated.View entering={FadeInDown.delay(340).springify()}>
        <Card
          marginHorizontal="$4"
          marginTop="$4"
          marginBottom="$6"
          padding="$4"
          pressable
          onPress={() => Linking.openURL("mailto:support@draftplay.ai?subject=DraftPlay%20Subscription%20Help")}
          testID="support-contact-card"
        >
          <XStack alignItems="center" gap="$3">
            <YStack
              width={36}
              height={36}
              borderRadius={18}
              backgroundColor="$backgroundSurface"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={16}>✉️</Text>
            </YStack>
            <YStack flex={1}>
              <Text fontFamily="$mono" fontWeight="600" fontSize={13} color="$color">
                {formatUIText("need help?")}
              </Text>
              <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                support@draftplay.ai
              </Text>
            </YStack>
            <Text fontSize={14} color="$colorMuted">→</Text>
          </XStack>
        </Card>
      </Animated.View>
    </ScrollView>

    {/* Custom Alert Modal */}
    <AlertModal
      visible={alert.visible}
      title={alert.title}
      message={alert.message}
      actions={alert.actions}
      onDismiss={dismiss}
    />

    {/* ── Cancel Flow Modal ── */}
    {cancelStep !== "idle" && (
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        backgroundColor="rgba(0,0,0,0.6)"
        justifyContent="center"
        alignItems="center"
        zIndex={1000}
        onPress={dismissCancelFlow}
        testID="cancel-flow-overlay"
      >
        <YStack
          backgroundColor="$backgroundSurface"
          borderRadius="$4"
          padding="$6"
          marginHorizontal="$6"
          maxWidth={360}
          width="100%"
          gap="$4"
          onPress={(e: any) => e.stopPropagation()}
        >
          {/* Step 1: Are you sure? */}
          {cancelStep === "confirm" && (
            <>
              <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" textAlign="center">
                {formatUIText("are you sure?")}
              </Text>
              <Text fontFamily="$body" fontSize={14} color="$colorSecondary" textAlign="center" lineHeight={20}>
                {formatUIText("you'll lose access to all your current plan features. your subscription stays active until the end of your billing period.")}
              </Text>
              <Button variant="primary" size="md" onPress={dismissCancelFlow}>
                {formatUIText("keep my plan")}
              </Button>
              <Text
                fontFamily="$mono"
                fontSize={13}
                color="$colorDanger"
                textAlign="center"
                onPress={onCancelConfirmed}
                cursor="pointer"
                testID="cancel-proceed-btn"
              >
                {formatUIText("i still want to cancel")}
              </Text>
            </>
          )}

          {/* Step: Downgrade to Pro (shown when cancelling Elite) */}
          {cancelStep === "downgrade_pro" && (
            <>
              <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" textAlign="center">
                {formatUIText("downgrade to pro instead?")}
              </Text>
              <Text fontFamily="$body" fontSize={14} color="$colorSecondary" textAlign="center" lineHeight={20}>
                {formatUIText("keep most premium features at a lower price. you won't lose your history or teams.")}
              </Text>
              <YStack
                backgroundColor="rgba(0,200,100,0.08)"
                padding="$4"
                borderRadius="$3"
                alignItems="center"
                gap="$1"
              >
                <Text fontFamily="$mono" fontWeight="800" fontSize={22} color="$accentBackground">
                  {isIndian
                    ? `₹${(((isIOS ? (tiers.find(t => t.id === "pro") as any)?.priceYearlyINR_iOS : (tiers.find(t => t.id === "pro") as any)?.priceYearlyINR) ?? 88900) / 100).toFixed(0)}`
                    : `$${(((tiers.find(t => t.id === "pro") as any)?.priceYearlyUSD ?? 1999) / 100).toFixed(2)}`}
                </Text>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  /year — Pro plan
                </Text>
              </YStack>
              <Button variant="primary" size="md" onPress={() => handleDowngrade("pro")}>
                {formatUIText("downgrade to pro")}
              </Button>
              <Text
                fontFamily="$mono"
                fontSize={13}
                color="$colorDanger"
                textAlign="center"
                onPress={onSkipDowngradePro}
                cursor="pointer"
              >
                {formatUIText("no thanks, continue cancelling")}
              </Text>
            </>
          )}

          {/* Step: Downgrade to Basic (shown when cancelling Elite/Pro) */}
          {cancelStep === "downgrade_basic" && (
            <>
              <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" textAlign="center">
                {formatUIText("downgrade to basic instead?")}
              </Text>
              <Text fontFamily="$body" fontSize={14} color="$colorSecondary" textAlign="center" lineHeight={20}>
                {formatUIText("keep your account active with essential features. you won't lose your history or teams.")}
              </Text>
              <YStack
                backgroundColor="rgba(0,200,100,0.08)"
                padding="$4"
                borderRadius="$3"
                alignItems="center"
                gap="$1"
              >
                <Text fontFamily="$mono" fontWeight="800" fontSize={22} color="$accentBackground">
                  {isIndian
                    ? `₹${(((isIOS ? (tiers.find(t => t.id === "basic") as any)?.priceYearlyINR_iOS : (tiers.find(t => t.id === "basic") as any)?.priceYearlyINR) ?? 28900) / 100).toFixed(0)}`
                    : `$${(((tiers.find(t => t.id === "basic") as any)?.priceYearlyUSD ?? 599) / 100).toFixed(2)}`}
                </Text>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  /year — Basic plan
                </Text>
              </YStack>
              <Button variant="primary" size="md" onPress={() => handleDowngrade("basic")}>
                {formatUIText("downgrade to basic")}
              </Button>
              <Text
                fontFamily="$mono"
                fontSize={13}
                color="$colorDanger"
                textAlign="center"
                onPress={onSkipDowngradeBasic}
                cursor="pointer"
              >
                {formatUIText("no thanks, continue cancelling")}
              </Text>
            </>
          )}

          {/* Step: Day Pass offer */}
          {cancelStep === "daypass" && (
            <>
              <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" textAlign="center">
                {formatUIText("try a day pass instead?")}
              </Text>
              <Text fontFamily="$body" fontSize={14} color="$colorSecondary" textAlign="center" lineHeight={20}>
                {formatUIText("get full elite access for 24 hours — perfect for match days without a yearly commitment.")}
              </Text>
              <YStack
                backgroundColor="#8B5CF620"
                padding="$4"
                borderRadius="$3"
                alignItems="center"
                gap="$1"
              >
                <Text fontFamily="$mono" fontWeight="800" fontSize={22} color="#8B5CF6">
                  {isIndian ? `₹${(DAY_PASS_CONFIG.priceINR / 100).toFixed(0)}` : `$${(DAY_PASS_CONFIG.priceUSD / 100).toFixed(2)}`}
                </Text>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  24 hours of Elite
                </Text>
              </YStack>
              <Button
                variant="primary"
                size="md"
                onPress={() => {
                  dismissCancelFlow();
                  handleDayPass();
                }}
              >
                {formatUIText("buy day pass")}
              </Button>
              <Text
                fontFamily="$mono"
                fontSize={13}
                color="$colorDanger"
                textAlign="center"
                onPress={onSkipDayPass}
                cursor="pointer"
              >
                {formatUIText("no thanks, continue cancelling")}
              </Text>
            </>
          )}

          {/* Step 3: Reason selection */}
          {cancelStep === "reason" && (
            <>
              <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" textAlign="center">
                {formatUIText("help us improve")}
              </Text>
              <Text fontFamily="$body" fontSize={14} color="$colorSecondary" textAlign="center" lineHeight={20}>
                {formatUIText("why are you cancelling? your feedback helps us build a better app.")}
              </Text>
              <YStack gap="$2">
                {CANCEL_REASONS.map((reason) => (
                  <XStack
                    key={reason}
                    backgroundColor="$background"
                    borderRadius="$3"
                    paddingVertical="$3"
                    paddingHorizontal="$4"
                    borderWidth={1}
                    borderColor="$borderColor"
                    onPress={() => onReasonSelected(reason)}
                    cursor="pointer"
                    pressStyle={{ backgroundColor: "$backgroundSurfaceHover", scale: 0.98 }}
                    testID={`cancel-reason-${reason.slice(0, 10)}`}
                  >
                    <Text fontFamily="$body" fontSize={14} color="$color">
                      {reason}
                    </Text>
                  </XStack>
                ))}
              </YStack>
              <Text
                fontFamily="$mono"
                fontSize={13}
                color="$colorMuted"
                textAlign="center"
                onPress={dismissCancelFlow}
                cursor="pointer"
              >
                {formatUIText("go back")}
              </Text>
            </>
          )}

          {/* Step 4: Freeform text (for "Other") */}
          {cancelStep === "freeform" && (
            <>
              <Text fontFamily="$body" fontWeight="700" fontSize={18} color="$color" textAlign="center">
                {formatUIText("tell us more")}
              </Text>
              <TextInput
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  color: theme.color?.val,
                  backgroundColor: theme.background?.val,
                  borderWidth: 1,
                  borderColor: theme.borderColor?.val,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  minHeight: 80,
                  textAlignVertical: "top",
                }}
                placeholder="What could we do better?"
                placeholderTextColor={theme.colorMuted?.val}
                value={cancelFreeform}
                onChangeText={setCancelFreeform}
                multiline
                maxLength={500}
                testID="cancel-freeform-input"
              />
              <Button
                variant="primary"
                size="md"
                disabled={cancelMutation.isPending}
                onPress={onFreeformSubmit}
                testID="cancel-submit-btn"
              >
                {cancelMutation.isPending
                  ? formatUIText("processing...")
                  : formatUIText("cancel subscription")}
              </Button>
              <Text
                fontFamily="$mono"
                fontSize={13}
                color="$colorMuted"
                textAlign="center"
                onPress={() => setCancelStep("reason")}
                cursor="pointer"
              >
                {formatUIText("go back")}
              </Text>
            </>
          )}
        </YStack>
      </YStack>
    )}
    </>
  );
}
