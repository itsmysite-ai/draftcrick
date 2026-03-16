/**
 * usePaywall — manages paywall state + 1-click upgrade flow + Day Pass purchase.
 *
 * Usage:
 *   const { gate, paywallProps } = usePaywall();
 *
 *   // In an onPress handler:
 *   if (gate("pro", "Projected Points")) return;
 *   // ...proceed with feature
 *
 *   // In JSX (render once at root of screen):
 *   <Paywall {...paywallProps} />
 */

import { useState, useCallback } from "react";
import { useSubscription } from "./useSubscription";
import { trpc } from "../lib/trpc";
import type { TierFeatures } from "@draftplay/shared";

interface PaywallState {
  visible: boolean;
  requiredTier: "pro" | "elite";
  featureName: string;
  description?: string;
  showDayPassOption: boolean;
}

export function usePaywall() {
  const { tier, hasTier, canAccess, refetch, dayPassActive } = useSubscription();

  const [state, setState] = useState<PaywallState>({
    visible: false,
    requiredTier: "pro",
    featureName: "",
    showDayPassOption: false,
  });

  const subscribeMutation = trpc.subscription.subscribe.useMutation({
    onSuccess: () => {
      refetch();
      setState((s) => ({ ...s, visible: false }));
    },
  });

  const dayPassMutation = trpc.subscription.purchaseDayPass.useMutation({
    onSuccess: () => {
      refetch();
      setState((s) => ({ ...s, visible: false }));
    },
  });

  /**
   * Gate a feature by tier.
   * Returns `true` if blocked (shows paywall), `false` if access granted.
   */
  const gate = useCallback(
    (requiredTier: "pro" | "elite", featureName: string, description?: string): boolean => {
      if (hasTier(requiredTier)) return false;
      setState({
        visible: true,
        requiredTier,
        featureName,
        description,
        showDayPassOption: !dayPassActive, // only show Day Pass if not already active
      });
      return true;
    },
    [hasTier, dayPassActive],
  );

  /**
   * Gate by specific feature flag from admin-togglable tier config.
   */
  const gateFeature = useCallback(
    (feature: keyof TierFeatures, fallbackTier: "pro" | "elite", featureName: string, description?: string): boolean => {
      if (canAccess(feature)) return false;
      setState({
        visible: true,
        requiredTier: fallbackTier,
        featureName,
        description,
        showDayPassOption: !dayPassActive,
      });
      return true;
    },
    [canAccess, dayPassActive],
  );

  /** Check access without showing paywall */
  const hasAccess = useCallback(
    (requiredTier: "pro" | "elite"): boolean => hasTier(requiredTier),
    [hasTier],
  );

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, visible: false }));
  }, []);

  const upgrade = useCallback(() => {
    subscribeMutation.mutate({ tier: state.requiredTier });
  }, [state.requiredTier, subscribeMutation]);

  const purchaseDayPass = useCallback(() => {
    dayPassMutation.mutate();
  }, [dayPassMutation]);

  const paywallProps = {
    visible: state.visible,
    requiredTier: state.requiredTier,
    featureName: state.featureName,
    description: state.description,
    showDayPassOption: state.showDayPassOption,
    onUpgrade: upgrade,
    onDayPass: purchaseDayPass,
    onDismiss: dismiss,
  };

  return {
    tier,
    gate,
    gateFeature,
    hasAccess,
    canAccess,
    paywallProps,
    isUpgrading: subscribeMutation.isPending,
    isDayPassPurchasing: dayPassMutation.isPending,
  };
}
