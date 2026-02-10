import type { LeagueRules } from "../types";
import { DEFAULT_T20_SCORING } from "./scoring-rules";
import { getDefaultRules, type CompleteLeagueRules } from "./rule-engine";

// ── Basic templates (backward compat for salary_cap mode) ──

export const CASUAL_TEMPLATE: LeagueRules = {
  teamSize: 11,
  minBatsmen: 3,
  maxBatsmen: 5,
  minBowlers: 3,
  maxBowlers: 5,
  minAllRounders: 1,
  maxAllRounders: 4,
  minWicketKeepers: 1,
  maxWicketKeepers: 2,
  maxOverseasPlayers: 4,
  totalBudget: 100,
  captainMultiplier: 2,
  viceCaptainMultiplier: 1.5,
  maxTransfersPerWeek: 5,
  tradeWindowOpen: false,
  scoringRules: DEFAULT_T20_SCORING,
};

export const COMPETITIVE_TEMPLATE: LeagueRules = {
  ...CASUAL_TEMPLATE,
  totalBudget: 100,
  captainMultiplier: 2,
  viceCaptainMultiplier: 1.5,
  powerPlayerMultiplier: 3,
  maxTransfersPerWeek: 3,
  tradeWindowOpen: true,
  waiverWirePriority: "inverse_standings",
  playoffSize: 4,
  playoffFormat: "knockout",
};

export const PRO_TEMPLATE: LeagueRules = {
  ...COMPETITIVE_TEMPLATE,
  totalBudget: 100,
  maxTransfersPerWeek: 2,
  waiverWirePriority: "inverse_standings",
  playoffSize: 6,
  playoffFormat: "round_robin",
};

export const LEAGUE_TEMPLATES = {
  casual: CASUAL_TEMPLATE,
  competitive: COMPETITIVE_TEMPLATE,
  pro: PRO_TEMPLATE,
} as const;

// ── Extended templates with CompleteLeagueRules (for league mode) ──

function makeTemplate(overrides: Partial<CompleteLeagueRules>): CompleteLeagueRules {
  const defaults = getDefaultRules();
  return {
    teamComposition: { ...defaults.teamComposition, ...overrides.teamComposition },
    scoring: { ...defaults.scoring, ...overrides.scoring },
    boosters: { ...defaults.boosters, ...overrides.boosters },
    transfers: { ...defaults.transfers, ...overrides.transfers },
    playoffs: { ...defaults.playoffs, ...overrides.playoffs },
    salary: { ...defaults.salary, ...overrides.salary },
    autoManagement: { ...defaults.autoManagement, ...overrides.autoManagement },
    scoringModifiers: { ...defaults.scoringModifiers, ...overrides.scoringModifiers },
    draft: { ...defaults.draft, ...overrides.draft },
    auction: { ...defaults.auction, ...overrides.auction },
  };
}

/**
 * Casual: Relaxed rules, generous transfers, no playoffs, no trading.
 */
export const CASUAL_FULL_TEMPLATE: CompleteLeagueRules = makeTemplate({
  teamComposition: {
    teamSize: 11, minBatsmen: 1, maxBatsmen: 6, minBowlers: 1, maxBowlers: 6,
    minAllRounders: 1, maxAllRounders: 6, minWicketKeepers: 1, maxWicketKeepers: 4,
    maxOverseasPlayers: 7, maxFromOneTeam: 7, uncappedPlayerSlots: 0, benchSize: 0,
  },
  boosters: {
    captainMultiplier: 2, viceCaptainMultiplier: 1.5, powerPlayerEnabled: false,
    powerPlayerMultiplier: 3, powerPlayerMatchesPerSeason: 1, superSubEnabled: false,
    superSubAutoSwap: false, tripleCaptainEnabled: false, tripleCaptainUsesPerSeason: 1,
    benchBoostEnabled: false, benchBoostUsesPerSeason: 1,
  },
  transfers: {
    maxTransfersPerWeek: 5, freeTransfersPerWeek: 5, transferPenaltyPoints: 0,
    tradeWindowOpen: false, tradeWindowStartDay: 1, tradeWindowEndDay: 5,
    tradeDeadlineHoursBeforeMatch: 1, maxTradesPerWeek: 0, waiverWireEnabled: false,
    waiverWirePriority: "first_come", waiverWireProcessDay: 3, protectedPlayerSlots: 0,
    tradeVetoEnabled: false, tradeVetoThreshold: 50,
  },
  playoffs: {
    playoffsEnabled: false, playoffSize: 4, playoffFormat: "knockout", playoffRounds: 3,
    homeAdvantageEnabled: false, homeAdvantageBonus: 0, thirdPlaceMatch: false,
    wildcardSpots: 0, byeForTopSeed: false,
  },
});

/**
 * Competitive: Trading enabled, limited transfers, playoffs, waiver wire.
 */
export const COMPETITIVE_FULL_TEMPLATE: CompleteLeagueRules = makeTemplate({
  teamComposition: {
    teamSize: 11, minBatsmen: 3, maxBatsmen: 5, minBowlers: 3, maxBowlers: 5,
    minAllRounders: 1, maxAllRounders: 4, minWicketKeepers: 1, maxWicketKeepers: 2,
    maxOverseasPlayers: 4, maxFromOneTeam: 6, uncappedPlayerSlots: 0, benchSize: 2,
  },
  boosters: {
    captainMultiplier: 2, viceCaptainMultiplier: 1.5, powerPlayerEnabled: true,
    powerPlayerMultiplier: 3, powerPlayerMatchesPerSeason: 2, superSubEnabled: true,
    superSubAutoSwap: true, tripleCaptainEnabled: true, tripleCaptainUsesPerSeason: 1,
    benchBoostEnabled: true, benchBoostUsesPerSeason: 1,
  },
  transfers: {
    maxTransfersPerWeek: 3, freeTransfersPerWeek: 2, transferPenaltyPoints: 4,
    tradeWindowOpen: true, tradeWindowStartDay: 1, tradeWindowEndDay: 5,
    tradeDeadlineHoursBeforeMatch: 2, maxTradesPerWeek: 2, waiverWireEnabled: true,
    waiverWirePriority: "inverse_standings", waiverWireProcessDay: 3, protectedPlayerSlots: 2,
    tradeVetoEnabled: false, tradeVetoThreshold: 50,
  },
  playoffs: {
    playoffsEnabled: true, playoffSize: 4, playoffFormat: "knockout", playoffRounds: 3,
    homeAdvantageEnabled: false, homeAdvantageBonus: 0, thirdPlaceMatch: false,
    wildcardSpots: 0, byeForTopSeed: false,
  },
  salary: {
    totalBudget: 100, playerPriceMin: 4, playerPriceMax: 12, priceChangeEnabled: true,
    priceChangePerMatch: 0.3, inflationRate: 0, salaryFloor: 3, salaryCeiling: 15,
    budgetRollover: false,
  },
  draft: {
    maxRounds: 15, timePerPick: 60, autoPick: true, pauseBetweenRounds: false,
    snakeDraftEnabled: true, keeperPlayersEnabled: false, keeperPlayerSlots: 0,
  },
  auction: {
    auctionBudget: 100, minBid: 1, bidIncrement: 1, maxBidTime: 15, goingOnceTime: 5,
    goingTwiceTime: 3, maxPlayersPerTeam: 11, unsoldPlayerReAuction: true,
    rightToMatchEnabled: false,
  },
});

/**
 * Pro: Strict rules, penalty transfers, full playoffs, trade vetoes, advanced modifiers.
 */
export const PRO_FULL_TEMPLATE: CompleteLeagueRules = makeTemplate({
  teamComposition: {
    teamSize: 11, minBatsmen: 3, maxBatsmen: 5, minBowlers: 3, maxBowlers: 5,
    minAllRounders: 1, maxAllRounders: 3, minWicketKeepers: 1, maxWicketKeepers: 2,
    maxOverseasPlayers: 4, maxFromOneTeam: 5, uncappedPlayerSlots: 1, benchSize: 4,
  },
  boosters: {
    captainMultiplier: 2, viceCaptainMultiplier: 1.5, powerPlayerEnabled: true,
    powerPlayerMultiplier: 3, powerPlayerMatchesPerSeason: 1, superSubEnabled: true,
    superSubAutoSwap: false, tripleCaptainEnabled: true, tripleCaptainUsesPerSeason: 1,
    benchBoostEnabled: true, benchBoostUsesPerSeason: 1,
  },
  transfers: {
    maxTransfersPerWeek: 2, freeTransfersPerWeek: 1, transferPenaltyPoints: 8,
    tradeWindowOpen: true, tradeWindowStartDay: 1, tradeWindowEndDay: 4,
    tradeDeadlineHoursBeforeMatch: 4, maxTradesPerWeek: 3, waiverWireEnabled: true,
    waiverWirePriority: "inverse_standings", waiverWireProcessDay: 3, protectedPlayerSlots: 3,
    tradeVetoEnabled: true, tradeVetoThreshold: 50,
  },
  playoffs: {
    playoffsEnabled: true, playoffSize: 6, playoffFormat: "round_robin", playoffRounds: 4,
    homeAdvantageEnabled: true, homeAdvantageBonus: 5, thirdPlaceMatch: true,
    wildcardSpots: 2, byeForTopSeed: true,
  },
  salary: {
    totalBudget: 100, playerPriceMin: 4, playerPriceMax: 12, priceChangeEnabled: true,
    priceChangePerMatch: 0.5, inflationRate: 1.0, salaryFloor: 3, salaryCeiling: 15,
    budgetRollover: true,
  },
  scoringModifiers: {
    homeMultiplier: 1.0, awayMultiplier: 1.0, powerplayBonusMultiplier: 1.1,
    deathOversBonusMultiplier: 1.15, middleOversBonusMultiplier: 1.0,
    rainReducedMatchMultiplier: 0.8, superOverMultiplier: 2.0, dayNightMatchBonus: 2,
  },
  draft: {
    maxRounds: 18, timePerPick: 90, autoPick: true, pauseBetweenRounds: true,
    snakeDraftEnabled: true, keeperPlayersEnabled: true, keeperPlayerSlots: 3,
  },
  auction: {
    auctionBudget: 150, minBid: 1, bidIncrement: 0.5, maxBidTime: 20, goingOnceTime: 5,
    goingTwiceTime: 3, maxPlayersPerTeam: 15, unsoldPlayerReAuction: true,
    rightToMatchEnabled: true,
  },
  autoManagement: {
    autoSwapInjured: false, autoCaptainIfBenched: false, autoPickEnabled: false,
    autoPickStrategy: "balanced", deadlineReminderHours: 4, inactivityAutoPick: true,
    inactivityThresholdDays: 14,
  },
});

export const FULL_LEAGUE_TEMPLATES = {
  casual: CASUAL_FULL_TEMPLATE,
  competitive: COMPETITIVE_FULL_TEMPLATE,
  pro: PRO_FULL_TEMPLATE,
} as const;
