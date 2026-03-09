import { ScrollView, RefreshControl, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { useState, useCallback } from "react";
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

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  actions: AlertAction[];
}

const EMPTY_ALERT: AlertState = { visible: false, title: "", message: "", actions: [] };

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTamaguiTheme();

  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{ valid: boolean; discountDisplay?: string } | null>(null);
  const [alert, setAlert] = useState<AlertState>(EMPTY_ALERT);

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
    onSuccess: (data: { tier: string; discountApplied: number }) => {
      myTier.refetch();
      history.refetch();
      const discount = data.discountApplied > 0 ? ` (saved ₹${(data.discountApplied / 100).toFixed(0)})` : "";
      showInfo("Subscribed", `You're now on the ${data.tier.toUpperCase()} plan${discount}`);
      setPromoCode("");
      setPromoResult(null);
    },
    onError: (error: { message: string }) => {
      showInfo("Subscription Failed", error.message);
    },
  });

  const cancelMutation = trpc.subscription.cancel.useMutation({
    onSuccess: () => {
      myTier.refetch();
      history.refetch();
      showInfo("Subscription Cancelled", "You've been moved back to the Free plan.");
    },
    onError: (error: { message: string }) => {
      showInfo("Cancellation Failed", error.message);
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([myTier.refetch(), tierConfigs.refetch(), history.refetch()]);
    setRefreshing(false);
  }, [myTier, tierConfigs, history]);

  const currentTier = myTier.data?.tier ?? "free";
  const tiers = (tierConfigs.data ?? []) as TierConfig[];
  const tierRank: Record<string, number> = { free: 0, pro: 1, elite: 2 };

  const handleSubscribe = (tier: "pro" | "elite") => {
    const promoNote = promoResult?.valid ? ` Promo: ${promoResult.discountDisplay}` : "";
    showConfirm(
      `Upgrade to ${tier.toUpperCase()}`,
      `This will start your ${tier} subscription.${promoNote}`,
      "Subscribe",
      () => subscribeMutation.mutate({
        tier,
        promoCode: promoResult?.valid ? promoCode : undefined,
      }),
    );
  };

  const handleCancel = () => {
    showConfirm(
      "Cancel Subscription",
      "You'll be moved to the Free plan immediately. Are you sure?",
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
            <TierBadge tier={currentTier} testID="current-tier-badge" />
          </XStack>
          <Text fontFamily="$body" fontWeight="700" fontSize={22} color="$color">
            {currentTier === "free" ? "Free" : currentTier === "pro" ? "Pro" : "Elite"}
          </Text>
          {myTier.data?.currentPeriodEnd && currentTier !== "free" && (
            <Text fontFamily="$mono" fontSize={10} color="$colorMuted" marginTop="$1">
              {myTier.data?.cancelAtPeriodEnd ? "expires" : "renews"}{" "}
              {new Date(myTier.data.currentPeriodEnd).toLocaleDateString()}
            </Text>
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
        const isCurrent = currentTier === tier.id;
        const isUpgrade = !isCurrent && (tierRank[tier.id] ?? 0) > (tierRank[currentTier] ?? 0);
        const isDowngrade = !isCurrent && tier.priceMonthly > 0 && (tierRank[tier.id] ?? 0) < (tierRank[currentTier] ?? 0);

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

              {/* Price */}
              <XStack alignItems="baseline" gap="$1" marginBottom="$4">
                <Text fontFamily="$mono" fontWeight="800" fontSize={28} color="$accentBackground">
                  {tier.priceMonthly === 0 ? "₹0" : `₹${tier.priceMonthly}`}
                </Text>
                <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
                  /month
                </Text>
              </XStack>

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
                  onPress={() => handleSubscribe(tier.id as "pro" | "elite")}
                  testID={`subscribe-btn-${tier.id}`}
                >
                  {subscribeMutation.isPending
                    ? formatUIText("processing...")
                    : formatUIText(`upgrade to ${tier.name.toLowerCase()}`)}
                </Button>
              )}
              {isCurrent && currentTier !== "free" && !myTier.data?.cancelAtPeriodEnd && (
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
                  {formatUIText("cancellation pending")}
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
