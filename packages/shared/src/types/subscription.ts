/**
 * Subscription types — 3-tier freemium model (Free / Pro / Elite).
 * SaaS revenue stream, completely independent from contest wallet.
 *
 * Tier configs below are hardcoded defaults. Admin can override
 * features and pricing per tier via admin_config ("subscription_tiers" key).
 * The service merges admin overrides on top of these defaults.
 */

export type SubscriptionTier = "free" | "pro" | "elite";
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due";

/** Feature flags per tier — every flag is admin-togglable via admin portal */
export interface TierFeatures {
  teamsPerMatch: number | null;       // null = unlimited
  guruQuestionsPerDay: number | null; // null = unlimited
  fdrLevel: "basic" | "full" | "full_historical";
  hasProjectedPoints: boolean;
  hasConfidence: boolean;
  hasRateMyTeam: boolean;
  hasCaptainPicks: boolean;
  hasDifferentials: boolean;          // Low-ownership high-upside picks
  hasPlayingXI: boolean;              // AI-predicted playing XI
  hasPitchWeather: boolean;           // Weather & pitch report
  hasHeadToHead: boolean;             // Historical head-to-head
  isAdFree: boolean;
  guruPriority: boolean;
  dailyCoinDrip: number;              // Pop Coins per daily claim: free=50, pro=100, elite=200
  // New analytics features
  hasPlayerStats: boolean;            // Player stats tables (basic=free, advanced=pro)
  hasPlayerCompare: boolean;          // Side-by-side player comparison
  hasTeamSolver: boolean;             // Auto-pick optimal team
  hasPointsBreakdown: boolean;        // Detailed fantasy points breakdown
  hasValueTracker: boolean;           // Price/credit change tracking
  hasStatTopFives: boolean;           // Tournament stat leaderboards
}

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  priceMonthly: number;    // INR: 0, 99, 299 (admin-editable)
  priceInPaise: number;     // 0, 9900, 29900 (admin-editable)
  features: TierFeatures;
  displayFeatures: string[]; // human-readable list for subscription screen
}

/** Default tier configs — admin overrides merge on top of these */
export const DEFAULT_TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceInPaise: 0,
    features: {
      teamsPerMatch: 1,
      guruQuestionsPerDay: 3,
      fdrLevel: "basic",
      hasProjectedPoints: false,
      hasConfidence: false,
      hasRateMyTeam: false,
      hasCaptainPicks: false,
      hasDifferentials: false,
      hasPlayingXI: false,
      hasPitchWeather: true,       // free for all
      hasHeadToHead: true,         // free for all
      isAdFree: false,
      guruPriority: false,
      dailyCoinDrip: 50,
      hasPlayerStats: true,        // basic stats only (SR/economy hidden)
      hasPlayerCompare: false,
      hasTeamSolver: false,
      hasPointsBreakdown: true,    // transparency for all
      hasValueTracker: false,
      hasStatTopFives: true,       // engagement for all
    },
    displayFeatures: [
      "1 team per match",
      "3 AI Guru questions per day",
      "Basic FDR overview",
      "Free contests & leaderboards",
      "Head-to-head stats",
      "Weather & pitch reports",
      "Player stats (basic)",
      "Fantasy points breakdown",
      "Tournament stat leaderboards",
      "50 Pop Coins daily",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 99,
    priceInPaise: 9900,
    features: {
      teamsPerMatch: null,
      guruQuestionsPerDay: null,
      fdrLevel: "full",
      hasProjectedPoints: true,
      hasConfidence: false,
      hasRateMyTeam: true,
      hasCaptainPicks: true,
      hasDifferentials: true,
      hasPlayingXI: true,
      hasPitchWeather: true,
      hasHeadToHead: true,
      isAdFree: true,
      guruPriority: false,
      dailyCoinDrip: 100,
      hasPlayerStats: true,        // full stats with SR, economy, form
      hasPlayerCompare: true,
      hasTeamSolver: false,
      hasPointsBreakdown: true,
      hasValueTracker: true,
      hasStatTopFives: true,
    },
    displayFeatures: [
      "Everything in Free",
      "Unlimited teams per match",
      "Unlimited AI Guru questions",
      "Full FDR breakdowns (bat/bowl)",
      "AI Projected points",
      "Rate My Team grading",
      "AI Captain & VC picks",
      "Differential picks (low-owned gems)",
      "AI Playing XI prediction",
      "Player stats (advanced: SR, economy, form)",
      "Player comparison tool",
      "Value & ownership tracker",
      "Ad-free experience",
      "100 Pop Coins daily",
    ],
  },
  elite: {
    id: "elite",
    name: "Elite",
    priceMonthly: 299,
    priceInPaise: 29900,
    features: {
      teamsPerMatch: null,
      guruQuestionsPerDay: null,
      fdrLevel: "full_historical",
      hasProjectedPoints: true,
      hasConfidence: true,
      hasRateMyTeam: true,
      hasCaptainPicks: true,
      hasDifferentials: true,
      hasPlayingXI: true,
      hasPitchWeather: true,
      hasHeadToHead: true,
      isAdFree: true,
      guruPriority: true,
      dailyCoinDrip: 200,
      hasPlayerStats: true,
      hasPlayerCompare: true,
      hasTeamSolver: true,        // Elite exclusive
      hasPointsBreakdown: true,
      hasValueTracker: true,
      hasStatTopFives: true,
    },
    displayFeatures: [
      "Everything in Pro",
      "FDR with historical trends",
      "Projected points + confidence intervals",
      "Priority Guru responses",
      "AI Team Solver (auto-pick optimal 11)",
      "200 Pop Coins daily",
      "Early access to new features",
    ],
  },
};

/** Check if tier A >= tier B in hierarchy (free < pro < elite) */
export function tierAtLeast(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): boolean {
  const order: Record<SubscriptionTier, number> = { free: 0, pro: 1, elite: 2 };
  return order[userTier] >= order[requiredTier];
}

/** Promo code discount types */
export type PromoDiscountType = "percentage" | "fixed_amount" | "free_trial";
