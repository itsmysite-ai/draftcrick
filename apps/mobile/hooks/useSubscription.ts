/**
 * useSubscription — wraps the subscription tRPC query and provides
 * tier info + feature access helpers for client-side gating.
 *
 * Uses server-returned tier configs (which include admin overrides)
 * when available, falling back to hardcoded defaults.
 */

import { useMemo } from "react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../providers/AuthProvider";
import { DEFAULT_TIER_CONFIGS, tierAtLeast } from "@draftplay/shared";
import type { SubscriptionTier, TierFeatures } from "@draftplay/shared";

export function useSubscription() {
  const { user } = useAuth();

  const myTier = trpc.subscription.getMyTier.useQuery(undefined, {
    enabled: !!user,
    retry: false,
    staleTime: 60_000, // 1 min
  });

  const tier: SubscriptionTier = myTier.data?.tier ?? "free";

  // Use server-returned features (includes admin overrides) when available,
  // otherwise fall back to hardcoded defaults
  const features: TierFeatures = useMemo(() => {
    const serverFeatures = (myTier.data as any)?.tierConfig?.features;
    if (serverFeatures) return serverFeatures as TierFeatures;
    return DEFAULT_TIER_CONFIGS[tier].features;
  }, [myTier.data, tier]);

  /** Check if the user's tier meets a minimum requirement */
  const hasTier = (required: SubscriptionTier): boolean => tierAtLeast(tier, required);

  /** Check a specific feature flag */
  const canAccess = (feature: keyof TierFeatures): boolean => {
    const value = features[feature];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (value === null) return true; // null = unlimited
    return !!value;
  };

  return {
    tier,
    features,
    isLoading: myTier.isLoading,
    hasTier,
    canAccess,
    refetch: myTier.refetch,
  };
}
