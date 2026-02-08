import type { LeagueRules } from "../types";
import { DEFAULT_T20_SCORING } from "./scoring-rules";

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
