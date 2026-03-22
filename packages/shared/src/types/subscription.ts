/**
 * Subscription types — 3-tier paid model (Basic / Pro / Elite) + Day Pass.
 * SaaS revenue stream, completely independent from contest wallet.
 *
 * All tiers are paid (yearly billing). No free tier.
 * Day Pass = 24hr Elite access via one-time payment.
 *
 * Tier configs below are hardcoded defaults. Admin can override
 * features and pricing per tier via admin_config ("subscription_tiers" key).
 * The service merges admin overrides on top of these defaults.
 */

export type SubscriptionTier = "basic" | "pro" | "elite";
export type SubscriptionStatus = "active" | "cancelled" | "expired" | "past_due" | "trialing";

/** Feature flags per tier — every flag is admin-togglable via admin portal */
export interface TierFeatures {
  teamsPerMatch: number;              // max teams per match (basic=1, pro=3, elite=5)
  guruQuestionsPerDay: number;        // AI Guru daily limit (basic=5, pro=25, elite=100)
  maxLeagues: number;                 // max leagues user can create/own (basic=3, pro=10, elite=50)
  fdrLevel: "basic" | "full" | "full_historical";
  hasProjectedPoints: boolean;
  hasConfidence: boolean;
  hasRateMyTeam: boolean;
  rateMyTeamPerDay: number;           // Rate My Team daily limit (basic=0, pro=10, elite=50)
  hasCaptainPicks: boolean;
  hasDifferentials: boolean;          // Low-ownership high-upside picks
  hasPlayingXI: boolean;              // AI-predicted playing XI
  hasPitchWeather: boolean;           // Weather & pitch report
  hasHeadToHead: boolean;             // Historical head-to-head
  isAdFree: boolean;
  guruPriority: boolean;
  dailyCoinDrip: number;              // Pop Coins per daily claim: basic=10, pro=50, elite=100
  // Analytics features
  hasPlayerStats: boolean;            // Player stats tables (basic=basic, advanced=pro)
  hasPlayerCompare: boolean;          // Side-by-side player comparison
  playerComparesPerDay: number;       // Player compare daily limit (basic=0, pro=3, elite=25)
  hasTeamSolver: boolean;             // Auto-pick optimal team
  teamSolverPerDay: number;           // Team solver daily limit (basic=0, pro=0, elite=20)
  hasPointsBreakdown: boolean;        // Detailed fantasy points breakdown
  hasValueTracker: boolean;           // Price/credit change tracking
  hasStatTopFives: boolean;           // Tournament stat leaderboards
  hasGuruVerdict: boolean;            // Guru's Verdict on review step (elite-only)
  predictionSuggestionsPerMatch: number; // AI prediction suggestions per match (basic=2, pro=5, elite=10)
}

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  priceYearlyINR: number;    // INR in paise: 28900, 88900, 189900 (admin-editable)
  priceYearlyUSD: number;    // USD in cents: 599, 1999, 4999 (admin-editable)
  hasFreeTrial: boolean;      // whether tier offers a free trial (Basic = yes)
  freeTrialDays: number;      // trial duration in days (Basic = 7)
  features: TierFeatures;
  displayFeatures: string[]; // human-readable list for subscription screen
}

/** Day Pass configuration — 24hr Elite access via one-time payment */
export interface DayPassConfig {
  priceINR: number;       // paise (6900 = ₹69)
  priceUSD: number;       // cents (299 = $2.99)
  durationHours: number;  // 24
  effectiveTier: SubscriptionTier; // "elite"
}

export const DAY_PASS_CONFIG: DayPassConfig = {
  priceINR: 6900,
  priceUSD: 299,
  durationHours: 24,
  effectiveTier: "elite",
};

/** Default tier configs — admin overrides merge on top of these */
export const DEFAULT_TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
  basic: {
    id: "basic",
    name: "Basic",
    priceYearlyINR: 28900,   // ₹289/yr
    priceYearlyUSD: 599,     // $5.99/yr
    hasFreeTrial: true,
    freeTrialDays: 7,
    features: {
      teamsPerMatch: 1,
      guruQuestionsPerDay: 5,
      maxLeagues: 3,
      fdrLevel: "basic",
      hasProjectedPoints: false,
      hasConfidence: false,
      hasRateMyTeam: false,
      rateMyTeamPerDay: 0,
      hasCaptainPicks: false,
      hasDifferentials: false,
      hasPlayingXI: false,
      hasPitchWeather: true,
      hasHeadToHead: true,
      isAdFree: true,            // all paid tiers are ad-free
      guruPriority: false,
      dailyCoinDrip: 10,
      hasPlayerStats: true,       // basic stats only (SR/economy hidden)
      hasPlayerCompare: false,
      playerComparesPerDay: 0,
      hasTeamSolver: false,
      teamSolverPerDay: 0,
      hasPointsBreakdown: true,
      hasValueTracker: false,
      hasStatTopFives: true,
      hasGuruVerdict: false,
      predictionSuggestionsPerMatch: 2,
    },
    displayFeatures: [
      "1 team per match",
      "5 AI Guru questions per day",
      "3 leagues max",
      "Basic FDR overview",
      "Head-to-head stats",
      "Weather & pitch reports",
      "Player stats (basic)",
      "Fantasy points breakdown",
      "2 AI prediction suggestions per match",
      "Ad-free experience",
      "20 Pop Coins daily",
      "7-day free trial",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceYearlyINR: 88900,   // ₹889/yr
    priceYearlyUSD: 1999,    // $19.99/yr
    hasFreeTrial: false,
    freeTrialDays: 0,
    features: {
      teamsPerMatch: 3,
      guruQuestionsPerDay: 25,
      maxLeagues: 10,
      fdrLevel: "full",
      hasProjectedPoints: true,
      hasConfidence: false,
      hasRateMyTeam: true,
      rateMyTeamPerDay: 10,
      hasCaptainPicks: true,
      hasDifferentials: true,
      hasPlayingXI: true,
      hasPitchWeather: true,
      hasHeadToHead: true,
      isAdFree: true,
      guruPriority: false,
      dailyCoinDrip: 50,
      hasPlayerStats: true,
      hasPlayerCompare: true,
      playerComparesPerDay: 3,
      hasTeamSolver: false,
      teamSolverPerDay: 0,
      hasPointsBreakdown: true,
      hasValueTracker: true,
      hasStatTopFives: true,
      hasGuruVerdict: false,
      predictionSuggestionsPerMatch: 5,
    },
    displayFeatures: [
      "Everything in Basic",
      "3 teams per match",
      "25 AI Guru questions per day",
      "10 leagues",
      "Full FDR breakdowns (bat/bowl)",
      "AI Projected points",
      "Rate My Team (10/day)",
      "AI Captain & VC picks",
      "Differential picks (low-owned gems)",
      "AI Playing XI prediction",
      "Player stats (advanced: SR, economy, form)",
      "Player comparison (3/day)",
      "Value & ownership tracker",
      "5 AI prediction suggestions per match",
      "100 Pop Coins daily",
    ],
  },
  elite: {
    id: "elite",
    name: "Elite",
    priceYearlyINR: 189900,  // ₹1,899/yr
    priceYearlyUSD: 4999,    // $49.99/yr
    hasFreeTrial: false,
    freeTrialDays: 0,
    features: {
      teamsPerMatch: 5,
      guruQuestionsPerDay: 100,
      maxLeagues: 50,
      fdrLevel: "full_historical",
      hasProjectedPoints: true,
      hasConfidence: true,
      hasRateMyTeam: true,
      rateMyTeamPerDay: 50,
      hasCaptainPicks: true,
      hasDifferentials: true,
      hasPlayingXI: true,
      hasPitchWeather: true,
      hasHeadToHead: true,
      isAdFree: true,
      guruPriority: true,
      dailyCoinDrip: 100,
      hasPlayerStats: true,
      hasPlayerCompare: true,
      playerComparesPerDay: 25,
      hasTeamSolver: true,
      teamSolverPerDay: 20,
      hasPointsBreakdown: true,
      hasValueTracker: true,
      hasStatTopFives: true,
      hasGuruVerdict: true,
      predictionSuggestionsPerMatch: 10,
    },
    displayFeatures: [
      "Everything in Pro",
      "5 teams per match",
      "100 AI Guru questions per day",
      "50 leagues",
      "FDR with historical trends",
      "Projected points + confidence intervals",
      "Rate My Team (50/day)",
      "Priority Guru responses",
      "AI Team Solver (20/day)",
      "Player comparison (25/day)",
      "Guru's Verdict on team review",
      "10 AI prediction suggestions per match",
      "200 Pop Coins daily",
      "Early access to new features",
    ],
  },
};

/** Check if tier A >= tier B in hierarchy (basic < pro < elite) */
export function tierAtLeast(
  userTier: SubscriptionTier,
  requiredTier: SubscriptionTier
): boolean {
  const order: Record<SubscriptionTier, number> = { basic: 0, pro: 1, elite: 2 };
  return order[userTier] >= order[requiredTier];
}

/** Get the effective tier considering Day Pass overlay */
export function getEffectiveTier(
  baseTier: SubscriptionTier,
  dayPassActive: boolean
): SubscriptionTier {
  if (dayPassActive) return DAY_PASS_CONFIG.effectiveTier;
  return baseTier;
}

/** Promo code discount types */
export type PromoDiscountType = "percentage" | "fixed_amount" | "free_trial";
