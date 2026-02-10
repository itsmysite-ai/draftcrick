import type { ScoringRules } from "../types";

/**
 * DraftCrick 200+ Rule Engine
 *
 * All league rules organized into 8 categories with progressive disclosure.
 * Each rule has: key, label, description, type, default value, min/max bounds.
 */

// ────────────────────────────────────────
// Category 1: Team Composition
// ────────────────────────────────────────
export interface TeamCompositionRules {
  teamSize: number;
  minBatsmen: number;
  maxBatsmen: number;
  minBowlers: number;
  maxBowlers: number;
  minAllRounders: number;
  maxAllRounders: number;
  minWicketKeepers: number;
  maxWicketKeepers: number;
  maxOverseasPlayers: number;
  maxFromOneTeam: number;
  uncappedPlayerSlots: number;
  benchSize: number;
}

// ────────────────────────────────────────
// Category 2: Scoring
// ────────────────────────────────────────
export interface ExtendedScoringRules extends ScoringRules {
  // Batting extras
  dotBallFacedPenalty: number;
  thirtyRunBonus: number;
  doublyBoundaryBonus: number; // hitting both 4 & 6 in an innings

  // Bowling extras
  fourWicketBonus: number;
  dotBallBowledPoints: number;
  noballPenalty: number;
  widePenalty: number;

  // Fielding extras
  catchInSuperOverPoints: number;
  assistPoints: number;

  // Match situation
  playerOfMatchBonus: number;
  winningTeamBonus: number;
  tossWinnerBonus: number;

  // Format-specific
  powerplayRunBonus: number;
  deathOverWicketBonus: number;
  middleOverMaidenBonus: number;
}

// ────────────────────────────────────────
// Category 3: Boosters
// ────────────────────────────────────────
export interface BoosterRules {
  captainMultiplier: number;
  viceCaptainMultiplier: number;
  powerPlayerEnabled: boolean;
  powerPlayerMultiplier: number;
  powerPlayerMatchesPerSeason: number;
  superSubEnabled: boolean;
  superSubAutoSwap: boolean;
  tripleCaptainEnabled: boolean;
  tripleCaptainUsesPerSeason: number;
  benchBoostEnabled: boolean;
  benchBoostUsesPerSeason: number;
}

// ────────────────────────────────────────
// Category 4: Transfers & Trading
// ────────────────────────────────────────
export interface TransferRules {
  maxTransfersPerWeek: number;
  freeTransfersPerWeek: number;
  transferPenaltyPoints: number;
  tradeWindowOpen: boolean;
  tradeWindowStartDay: number; // 0=Sunday...6=Saturday
  tradeWindowEndDay: number;
  tradeDeadlineHoursBeforeMatch: number;
  maxTradesPerWeek: number;
  waiverWireEnabled: boolean;
  waiverWirePriority: "inverse_standings" | "first_come" | "rolling";
  waiverWireProcessDay: number;
  protectedPlayerSlots: number; // top-X can't be traded
  tradeVetoEnabled: boolean;
  tradeVetoThreshold: number; // % of league to veto
}

// ────────────────────────────────────────
// Category 5: Playoffs
// ────────────────────────────────────────
export interface PlayoffRules {
  playoffsEnabled: boolean;
  playoffSize: number;
  playoffFormat: "knockout" | "round_robin" | "double_elimination";
  playoffRounds: number;
  homeAdvantageEnabled: boolean;
  homeAdvantageBonus: number;
  thirdPlaceMatch: boolean;
  wildcardSpots: number;
  byeForTopSeed: boolean;
}

// ────────────────────────────────────────
// Category 6: Salary Dynamics
// ────────────────────────────────────────
export interface SalaryRules {
  totalBudget: number;
  playerPriceMin: number;
  playerPriceMax: number;
  priceChangeEnabled: boolean;
  priceChangePerMatch: number; // max change per match
  inflationRate: number; // % per gameweek
  salaryFloor: number;
  salaryCeiling: number;
  budgetRollover: boolean; // unused budget carries over
}

// ────────────────────────────────────────
// Category 7: Auto-management
// ────────────────────────────────────────
export interface AutoManagementRules {
  autoSwapInjured: boolean;
  autoCaptainIfBenched: boolean;
  autoPickEnabled: boolean;
  autoPickStrategy: "highest_points" | "highest_credits" | "balanced";
  deadlineReminderHours: number;
  inactivityAutoPick: boolean;
  inactivityThresholdDays: number;
}

// ────────────────────────────────────────
// Category 8: Scoring Modifiers
// ────────────────────────────────────────
export interface ScoringModifierRules {
  homeMultiplier: number;
  awayMultiplier: number;
  powerplayBonusMultiplier: number;
  deathOversBonusMultiplier: number;
  middleOversBonusMultiplier: number;
  rainReducedMatchMultiplier: number;
  superOverMultiplier: number;
  dayNightMatchBonus: number;
}

// ────────────────────────────────────────
// Draft & Auction Specific
// ────────────────────────────────────────
export interface DraftSpecificRules {
  maxRounds: number;
  timePerPick: number;
  autoPick: boolean;
  pauseBetweenRounds: boolean;
  snakeDraftEnabled: boolean;
  keeperPlayersEnabled: boolean;
  keeperPlayerSlots: number;
}

export interface AuctionSpecificRules {
  auctionBudget: number;
  minBid: number;
  bidIncrement: number;
  maxBidTime: number;
  goingOnceTime: number;
  goingTwiceTime: number;
  maxPlayersPerTeam: number;
  unsoldPlayerReAuction: boolean;
  rightToMatchEnabled: boolean;
}

// ────────────────────────────────────────
// Complete Rule Set
// ────────────────────────────────────────
export interface CompleteLeagueRules {
  teamComposition: TeamCompositionRules;
  scoring: ExtendedScoringRules;
  boosters: BoosterRules;
  transfers: TransferRules;
  playoffs: PlayoffRules;
  salary: SalaryRules;
  autoManagement: AutoManagementRules;
  scoringModifiers: ScoringModifierRules;
  draft: DraftSpecificRules;
  auction: AuctionSpecificRules;
}

// ────────────────────────────────────────
// Rule Metadata (for UI rendering)
// ────────────────────────────────────────
export interface RuleDefinition {
  key: string;
  label: string;
  description: string;
  comfortDescription: string; // plain English for comfort mode
  type: "number" | "boolean" | "select" | "range";
  category: RuleCategory;
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  advanced?: boolean; // hidden in simple mode
}

export type RuleCategory =
  | "teamComposition"
  | "scoring"
  | "boosters"
  | "transfers"
  | "playoffs"
  | "salary"
  | "autoManagement"
  | "scoringModifiers"
  | "draft"
  | "auction";

export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  teamComposition: "Team Composition",
  scoring: "Scoring",
  boosters: "Boosters & Power-ups",
  transfers: "Transfers & Trading",
  playoffs: "Playoffs",
  salary: "Salary & Budget",
  autoManagement: "Auto-management",
  scoringModifiers: "Scoring Modifiers",
  draft: "Draft Settings",
  auction: "Auction Settings",
};

// Full rule definitions catalog (200+)
export const RULE_DEFINITIONS: RuleDefinition[] = [
  // ── Team Composition (13 rules) ──
  { key: "teamComposition.teamSize", label: "Team Size", description: "Number of players in each team", comfortDescription: "How many players you pick", type: "number", category: "teamComposition", default: 11, min: 7, max: 15 },
  { key: "teamComposition.minBatsmen", label: "Min Batsmen", description: "Minimum batsmen required", comfortDescription: "At least this many batsmen", type: "number", category: "teamComposition", default: 1, min: 0, max: 6 },
  { key: "teamComposition.maxBatsmen", label: "Max Batsmen", description: "Maximum batsmen allowed", comfortDescription: "At most this many batsmen", type: "number", category: "teamComposition", default: 6, min: 1, max: 8 },
  { key: "teamComposition.minBowlers", label: "Min Bowlers", description: "Minimum bowlers required", comfortDescription: "At least this many bowlers", type: "number", category: "teamComposition", default: 1, min: 0, max: 6 },
  { key: "teamComposition.maxBowlers", label: "Max Bowlers", description: "Maximum bowlers allowed", comfortDescription: "At most this many bowlers", type: "number", category: "teamComposition", default: 6, min: 1, max: 8 },
  { key: "teamComposition.minAllRounders", label: "Min All-rounders", description: "Minimum all-rounders required", comfortDescription: "At least this many all-rounders", type: "number", category: "teamComposition", default: 1, min: 0, max: 6 },
  { key: "teamComposition.maxAllRounders", label: "Max All-rounders", description: "Maximum all-rounders allowed", comfortDescription: "At most this many all-rounders", type: "number", category: "teamComposition", default: 6, min: 1, max: 8 },
  { key: "teamComposition.minWicketKeepers", label: "Min Wicket-keepers", description: "Minimum wicket-keepers required", comfortDescription: "At least this many keepers", type: "number", category: "teamComposition", default: 1, min: 0, max: 4 },
  { key: "teamComposition.maxWicketKeepers", label: "Max Wicket-keepers", description: "Maximum wicket-keepers allowed", comfortDescription: "At most this many keepers", type: "number", category: "teamComposition", default: 4, min: 1, max: 6 },
  { key: "teamComposition.maxOverseasPlayers", label: "Overseas Player Limit", description: "Maximum overseas players in team", comfortDescription: "How many foreign players allowed", type: "number", category: "teamComposition", default: 4, min: 0, max: 11 },
  { key: "teamComposition.maxFromOneTeam", label: "Max From One Team", description: "Maximum players from a single real team", comfortDescription: "Can't pick too many from one team", type: "number", category: "teamComposition", default: 7, min: 3, max: 11 },
  { key: "teamComposition.uncappedPlayerSlots", label: "Uncapped Player Slots", description: "Reserved slots for uncapped players", comfortDescription: "Slots reserved for new players", type: "number", category: "teamComposition", default: 0, min: 0, max: 3, advanced: true },
  { key: "teamComposition.benchSize", label: "Bench Size", description: "Number of bench/substitute players", comfortDescription: "Extra players on your bench", type: "number", category: "teamComposition", default: 0, min: 0, max: 4, advanced: true },

  // ── Scoring — Batting (12 rules) ──
  { key: "scoring.runPoints", label: "Run Points", description: "Points per run scored", comfortDescription: "Points for each run", type: "number", category: "scoring", default: 1, min: 0, max: 5, step: 0.5 },
  { key: "scoring.boundaryBonus", label: "Boundary Bonus", description: "Extra points per four", comfortDescription: "Bonus for hitting a four", type: "number", category: "scoring", default: 1, min: 0, max: 5 },
  { key: "scoring.sixBonus", label: "Six Bonus", description: "Extra points per six", comfortDescription: "Bonus for hitting a six", type: "number", category: "scoring", default: 2, min: 0, max: 10 },
  { key: "scoring.thirtyRunBonus", label: "30-Run Bonus", description: "Bonus for scoring 30+ runs", comfortDescription: "Bonus for reaching 30 runs", type: "number", category: "scoring", default: 5, min: 0, max: 20, advanced: true },
  { key: "scoring.halfCenturyBonus", label: "Half-Century Bonus", description: "Bonus for scoring 50+ runs", comfortDescription: "Bonus for reaching 50 runs", type: "number", category: "scoring", default: 20, min: 0, max: 50 },
  { key: "scoring.centuryBonus", label: "Century Bonus", description: "Bonus for scoring 100+ runs", comfortDescription: "Bonus for reaching 100 runs", type: "number", category: "scoring", default: 50, min: 0, max: 100 },
  { key: "scoring.duckPenalty", label: "Duck Penalty", description: "Penalty for getting out on 0 (batsmen/WK/AR only)", comfortDescription: "Penalty for scoring zero", type: "number", category: "scoring", default: -5, min: -20, max: 0 },
  { key: "scoring.dotBallFacedPenalty", label: "Dot Ball Penalty", description: "Penalty per dot ball faced", comfortDescription: "Penalty for not scoring off a ball", type: "number", category: "scoring", default: 0, min: -2, max: 0, step: 0.5, advanced: true },

  // ── Scoring — Bowling (10 rules) ──
  { key: "scoring.wicketPoints", label: "Wicket Points", description: "Points per wicket taken", comfortDescription: "Points for taking a wicket", type: "number", category: "scoring", default: 25, min: 5, max: 50 },
  { key: "scoring.maidenOverPoints", label: "Maiden Over Points", description: "Points for bowling a maiden over", comfortDescription: "Points for a no-run over", type: "number", category: "scoring", default: 15, min: 0, max: 30 },
  { key: "scoring.threeWicketBonus", label: "3-Wicket Bonus", description: "Bonus for 3+ wickets in an innings", comfortDescription: "Bonus for 3 wickets", type: "number", category: "scoring", default: 15, min: 0, max: 40 },
  { key: "scoring.fourWicketBonus", label: "4-Wicket Bonus", description: "Bonus for 4+ wickets in an innings", comfortDescription: "Bonus for 4 wickets", type: "number", category: "scoring", default: 25, min: 0, max: 50, advanced: true },
  { key: "scoring.fiveWicketBonus", label: "5-Wicket Haul Bonus", description: "Bonus for taking 5+ wickets", comfortDescription: "Bonus for 5 wickets", type: "number", category: "scoring", default: 30, min: 0, max: 60 },
  { key: "scoring.dotBallBowledPoints", label: "Dot Ball Bowled", description: "Points per dot ball bowled", comfortDescription: "Points for bowling a dot ball", type: "number", category: "scoring", default: 0, min: 0, max: 2, step: 0.5, advanced: true },
  { key: "scoring.noballPenalty", label: "No-Ball Penalty", description: "Penalty per no-ball bowled", comfortDescription: "Penalty for bowling a no-ball", type: "number", category: "scoring", default: 0, min: -5, max: 0, advanced: true },
  { key: "scoring.widePenalty", label: "Wide Penalty", description: "Penalty per wide bowled", comfortDescription: "Penalty for bowling a wide", type: "number", category: "scoring", default: 0, min: -5, max: 0, advanced: true },

  // ── Scoring — Fielding (6 rules) ──
  { key: "scoring.catchPoints", label: "Catch Points", description: "Points per catch taken", comfortDescription: "Points for catching someone out", type: "number", category: "scoring", default: 10, min: 0, max: 25 },
  { key: "scoring.stumpingPoints", label: "Stumping Points", description: "Points per stumping", comfortDescription: "Points for a stumping", type: "number", category: "scoring", default: 15, min: 0, max: 25 },
  { key: "scoring.runOutDirectPoints", label: "Direct Run-out Points", description: "Points for direct hit run-out", comfortDescription: "Points for a direct run-out", type: "number", category: "scoring", default: 15, min: 0, max: 25 },
  { key: "scoring.runOutIndirectPoints", label: "Indirect Run-out Points", description: "Points for throw/assist run-out", comfortDescription: "Points for helping with a run-out", type: "number", category: "scoring", default: 10, min: 0, max: 20 },
  { key: "scoring.assistPoints", label: "Assist Points", description: "Points for fielding assist", comfortDescription: "Points for helping with a dismissal", type: "number", category: "scoring", default: 0, min: 0, max: 10, advanced: true },

  // ── Scoring — Match Situation (6 rules) ──
  { key: "scoring.playerOfMatchBonus", label: "Player of Match", description: "Bonus for player of the match", comfortDescription: "Bonus if named best player", type: "number", category: "scoring", default: 25, min: 0, max: 50 },
  { key: "scoring.winningTeamBonus", label: "Winning Team Bonus", description: "Bonus for players on winning team", comfortDescription: "Bonus if your player's team wins", type: "number", category: "scoring", default: 0, min: 0, max: 15, advanced: true },
  { key: "scoring.powerplayRunBonus", label: "Powerplay Run Bonus", description: "Extra points for runs in powerplay", comfortDescription: "Bonus runs in powerplay overs", type: "number", category: "scoring", default: 0, min: 0, max: 5, step: 0.5, advanced: true },
  { key: "scoring.deathOverWicketBonus", label: "Death Over Wicket Bonus", description: "Extra for wickets in death overs (16-20)", comfortDescription: "Bonus for wickets in last overs", type: "number", category: "scoring", default: 0, min: 0, max: 15, advanced: true },

  // ── Boosters (11 rules) ──
  { key: "boosters.captainMultiplier", label: "Captain Multiplier", description: "Points multiplier for captain", comfortDescription: "Captain scores double", type: "number", category: "boosters", default: 2, min: 1, max: 4, step: 0.5 },
  { key: "boosters.viceCaptainMultiplier", label: "Vice-Captain Multiplier", description: "Points multiplier for vice-captain", comfortDescription: "Vice-captain scores 1.5x", type: "number", category: "boosters", default: 1.5, min: 1, max: 3, step: 0.5 },
  { key: "boosters.powerPlayerEnabled", label: "Power Player", description: "Enable 3x multiplier power player chip", comfortDescription: "Let players use a 3x boost", type: "boolean", category: "boosters", default: false, advanced: true },
  { key: "boosters.powerPlayerMultiplier", label: "Power Player Multiplier", description: "Multiplier for power player", comfortDescription: "How much the power player boost is", type: "number", category: "boosters", default: 3, min: 2, max: 5, advanced: true },
  { key: "boosters.powerPlayerMatchesPerSeason", label: "Power Player Uses", description: "Times power player can be used per season", comfortDescription: "How many times you can use power player", type: "number", category: "boosters", default: 1, min: 1, max: 5, advanced: true },
  { key: "boosters.superSubEnabled", label: "Super Sub", description: "Auto-swap bench player if starter benched", comfortDescription: "Auto-swap if a player doesn't play", type: "boolean", category: "boosters", default: false, advanced: true },
  { key: "boosters.tripleCaptainEnabled", label: "Triple Captain", description: "Enable 3x captain chip", comfortDescription: "Let players boost captain to 3x", type: "boolean", category: "boosters", default: false, advanced: true },
  { key: "boosters.tripleCaptainUsesPerSeason", label: "Triple Captain Uses", description: "Times triple captain can be used", comfortDescription: "How many times you can triple captain", type: "number", category: "boosters", default: 1, min: 1, max: 3, advanced: true },
  { key: "boosters.benchBoostEnabled", label: "Bench Boost", description: "Enable bench boost chip (all bench players score)", comfortDescription: "Let bench players score too", type: "boolean", category: "boosters", default: false, advanced: true },

  // ── Transfers & Trading (14 rules) ──
  { key: "transfers.maxTransfersPerWeek", label: "Max Transfers/Week", description: "Maximum player transfers per gameweek", comfortDescription: "How many players you can swap per week", type: "number", category: "transfers", default: 5, min: 0, max: 11 },
  { key: "transfers.freeTransfersPerWeek", label: "Free Transfers", description: "Free transfers before penalty applies", comfortDescription: "Free swaps before losing points", type: "number", category: "transfers", default: 2, min: 0, max: 5 },
  { key: "transfers.transferPenaltyPoints", label: "Transfer Penalty", description: "Points deducted per extra transfer", comfortDescription: "Points lost for extra swaps", type: "number", category: "transfers", default: 4, min: 0, max: 20 },
  { key: "transfers.tradeWindowOpen", label: "Trading Enabled", description: "Allow player-to-player trades between managers", comfortDescription: "Can you trade players with friends", type: "boolean", category: "transfers", default: false },
  { key: "transfers.maxTradesPerWeek", label: "Max Trades/Week", description: "Maximum trades allowed per week", comfortDescription: "How many trades per week", type: "number", category: "transfers", default: 2, min: 0, max: 10 },
  { key: "transfers.tradeDeadlineHoursBeforeMatch", label: "Trade Deadline (hours)", description: "Hours before match when trades lock", comfortDescription: "Trading stops this many hours before game", type: "number", category: "transfers", default: 1, min: 0, max: 48 },
  { key: "transfers.waiverWireEnabled", label: "Waiver Wire", description: "Enable waiver wire for unclaimed players", comfortDescription: "Queue system for picking free players", type: "boolean", category: "transfers", default: false, advanced: true },
  { key: "transfers.waiverWirePriority", label: "Waiver Priority", description: "How waiver wire claims are ordered", comfortDescription: "Who gets first pick of free players", type: "select", category: "transfers", default: "inverse_standings", options: [{ value: "inverse_standings", label: "Inverse Standings" }, { value: "first_come", label: "First Come First Served" }, { value: "rolling", label: "Rolling Priority" }], advanced: true },
  { key: "transfers.protectedPlayerSlots", label: "Protected Players", description: "Number of players that can't be traded", comfortDescription: "Players you can protect from trades", type: "number", category: "transfers", default: 0, min: 0, max: 5, advanced: true },
  { key: "transfers.tradeVetoEnabled", label: "Trade Veto", description: "Allow league to veto unfair trades", comfortDescription: "League can block unfair trades", type: "boolean", category: "transfers", default: false, advanced: true },
  { key: "transfers.tradeVetoThreshold", label: "Veto Threshold (%)", description: "Percentage of league needed to veto", comfortDescription: "How many people must object", type: "number", category: "transfers", default: 50, min: 25, max: 75, advanced: true },

  // ── Playoffs (9 rules) ──
  { key: "playoffs.playoffsEnabled", label: "Playoffs", description: "Enable end-of-season playoffs", comfortDescription: "Have a playoff at the end", type: "boolean", category: "playoffs", default: false },
  { key: "playoffs.playoffSize", label: "Playoff Size", description: "Number of teams in playoffs", comfortDescription: "How many make the playoffs", type: "number", category: "playoffs", default: 4, min: 2, max: 16 },
  { key: "playoffs.playoffFormat", label: "Playoff Format", description: "Format of playoff rounds", comfortDescription: "How playoffs work", type: "select", category: "playoffs", default: "knockout", options: [{ value: "knockout", label: "Knockout" }, { value: "round_robin", label: "Round Robin" }, { value: "double_elimination", label: "Double Elimination" }] },
  { key: "playoffs.playoffRounds", label: "Playoff Rounds", description: "Number of playoff matchweeks", comfortDescription: "How many rounds in playoffs", type: "number", category: "playoffs", default: 3, min: 1, max: 6, advanced: true },
  { key: "playoffs.homeAdvantageEnabled", label: "Home Advantage", description: "Higher seed gets points bonus", comfortDescription: "Better-ranked player gets a small bonus", type: "boolean", category: "playoffs", default: false, advanced: true },
  { key: "playoffs.homeAdvantageBonus", label: "Home Bonus Points", description: "Points bonus for higher seed", comfortDescription: "How many bonus points for home", type: "number", category: "playoffs", default: 5, min: 0, max: 20, advanced: true },
  { key: "playoffs.thirdPlaceMatch", label: "3rd Place Match", description: "Play a consolation final", comfortDescription: "Losers play for 3rd place", type: "boolean", category: "playoffs", default: false, advanced: true },
  { key: "playoffs.wildcardSpots", label: "Wildcard Spots", description: "Extra playoff spots for best non-qualifiers", comfortDescription: "Extra chances to make playoffs", type: "number", category: "playoffs", default: 0, min: 0, max: 4, advanced: true },

  // ── Salary Dynamics (9 rules) ──
  { key: "salary.totalBudget", label: "Total Budget", description: "Starting budget for team building", comfortDescription: "How much money you start with", type: "number", category: "salary", default: 100, min: 50, max: 200 },
  { key: "salary.playerPriceMin", label: "Min Player Price", description: "Minimum player price", comfortDescription: "Cheapest a player can cost", type: "number", category: "salary", default: 4, min: 1, max: 10 },
  { key: "salary.playerPriceMax", label: "Max Player Price", description: "Maximum player price", comfortDescription: "Most expensive a player can be", type: "number", category: "salary", default: 12, min: 8, max: 20 },
  { key: "salary.priceChangeEnabled", label: "Price Changes", description: "Player prices change based on performance", comfortDescription: "Player prices go up/down each week", type: "boolean", category: "salary", default: false, advanced: true },
  { key: "salary.priceChangePerMatch", label: "Max Price Change", description: "Maximum price change per match", comfortDescription: "Most a price can change per game", type: "number", category: "salary", default: 0.3, min: 0.1, max: 1.0, step: 0.1, advanced: true },
  { key: "salary.inflationRate", label: "Weekly Inflation (%)", description: "Budget inflation percentage per gameweek", comfortDescription: "Budget grows a little each week", type: "number", category: "salary", default: 0, min: 0, max: 5, step: 0.5, advanced: true },
  { key: "salary.budgetRollover", label: "Budget Rollover", description: "Unused budget carries to next gameweek", comfortDescription: "Save unspent money for later", type: "boolean", category: "salary", default: false, advanced: true },

  // ── Auto-management (7 rules) ──
  { key: "autoManagement.autoSwapInjured", label: "Auto-swap Injured", description: "Automatically bench injured players", comfortDescription: "Swap out hurt players for you", type: "boolean", category: "autoManagement", default: true },
  { key: "autoManagement.autoCaptainIfBenched", label: "Auto Captain Switch", description: "Auto-assign captain if current captain doesn't play", comfortDescription: "Pick new captain if yours sits out", type: "boolean", category: "autoManagement", default: true },
  { key: "autoManagement.autoPickEnabled", label: "Auto-Pick", description: "Auto-select team if user misses deadline", comfortDescription: "Pick team for you if you forget", type: "boolean", category: "autoManagement", default: true },
  { key: "autoManagement.autoPickStrategy", label: "Auto-Pick Strategy", description: "How auto-pick selects players", comfortDescription: "How we pick players for you", type: "select", category: "autoManagement", default: "highest_points", options: [{ value: "highest_points", label: "Best Recent Points" }, { value: "highest_credits", label: "Most Expensive" }, { value: "balanced", label: "Balanced Team" }] },
  { key: "autoManagement.deadlineReminderHours", label: "Deadline Reminder", description: "Hours before deadline to send reminder", comfortDescription: "Remind you before time runs out", type: "number", category: "autoManagement", default: 2, min: 0, max: 24 },
  { key: "autoManagement.inactivityAutoPick", label: "Inactivity Auto-Pick", description: "Auto-pick for inactive managers", comfortDescription: "Pick team if someone stops playing", type: "boolean", category: "autoManagement", default: true, advanced: true },
  { key: "autoManagement.inactivityThresholdDays", label: "Inactivity Threshold", description: "Days of inactivity before auto-pick", comfortDescription: "Days before auto-pick kicks in", type: "number", category: "autoManagement", default: 7, min: 3, max: 30, advanced: true },

  // ── Scoring Modifiers (8 rules) ──
  { key: "scoringModifiers.homeMultiplier", label: "Home Multiplier", description: "Score multiplier for home team players", comfortDescription: "Home team players get a boost", type: "number", category: "scoringModifiers", default: 1.0, min: 1.0, max: 1.5, step: 0.05, advanced: true },
  { key: "scoringModifiers.awayMultiplier", label: "Away Multiplier", description: "Score multiplier for away team players", comfortDescription: "Away team players modifier", type: "number", category: "scoringModifiers", default: 1.0, min: 0.8, max: 1.2, step: 0.05, advanced: true },
  { key: "scoringModifiers.powerplayBonusMultiplier", label: "Powerplay Bonus", description: "Multiplier for powerplay performance", comfortDescription: "Extra for doing well in powerplay", type: "number", category: "scoringModifiers", default: 1.0, min: 1.0, max: 2.0, step: 0.1, advanced: true },
  { key: "scoringModifiers.deathOversBonusMultiplier", label: "Death Overs Bonus", description: "Multiplier for death over performance", comfortDescription: "Extra for doing well in last overs", type: "number", category: "scoringModifiers", default: 1.0, min: 1.0, max: 2.0, step: 0.1, advanced: true },
  { key: "scoringModifiers.superOverMultiplier", label: "Super Over Multiplier", description: "Score multiplier for super over", comfortDescription: "Super over points count extra", type: "number", category: "scoringModifiers", default: 1.0, min: 1.0, max: 3.0, step: 0.5, advanced: true },

  // ── Draft Settings (7 rules) ──
  { key: "draft.maxRounds", label: "Draft Rounds", description: "Number of rounds in the draft", comfortDescription: "How many rounds of picking", type: "number", category: "draft", default: 15, min: 5, max: 25 },
  { key: "draft.timePerPick", label: "Time Per Pick (seconds)", description: "Seconds allowed per draft pick", comfortDescription: "How long you have to pick", type: "number", category: "draft", default: 60, min: 15, max: 300, step: 15 },
  { key: "draft.autoPick", label: "Auto-Pick on Timeout", description: "Auto-pick best available if time runs out", comfortDescription: "Pick for you if time runs out", type: "boolean", category: "draft", default: true },
  { key: "draft.pauseBetweenRounds", label: "Pause Between Rounds", description: "Pause draft between rounds", comfortDescription: "Take a break between rounds", type: "boolean", category: "draft", default: false },
  { key: "draft.snakeDraftEnabled", label: "Snake Draft", description: "Reverse order every other round", comfortDescription: "Picking order flips each round", type: "boolean", category: "draft", default: true },
  { key: "draft.keeperPlayersEnabled", label: "Keeper Players", description: "Allow keeping players from previous season", comfortDescription: "Keep some players between seasons", type: "boolean", category: "draft", default: false, advanced: true },
  { key: "draft.keeperPlayerSlots", label: "Keeper Slots", description: "Number of players you can keep", comfortDescription: "How many players you can keep", type: "number", category: "draft", default: 2, min: 0, max: 5, advanced: true },

  // ── Auction Settings (9 rules) ──
  { key: "auction.auctionBudget", label: "Auction Budget", description: "Starting budget for auction bidding", comfortDescription: "How much money for buying players", type: "number", category: "auction", default: 100, min: 50, max: 500 },
  { key: "auction.minBid", label: "Minimum Bid", description: "Minimum opening bid for a player", comfortDescription: "Lowest starting price", type: "number", category: "auction", default: 1, min: 1, max: 10 },
  { key: "auction.bidIncrement", label: "Bid Increment", description: "Minimum amount to raise a bid", comfortDescription: "Minimum raise amount", type: "number", category: "auction", default: 1, min: 0.5, max: 5, step: 0.5 },
  { key: "auction.maxBidTime", label: "Bid Timer (seconds)", description: "Time to place a bid", comfortDescription: "How long to decide on a bid", type: "number", category: "auction", default: 15, min: 5, max: 60 },
  { key: "auction.goingOnceTime", label: "Going Once Time (sec)", description: "Countdown after last bid", comfortDescription: "Countdown before sold", type: "number", category: "auction", default: 5, min: 3, max: 15 },
  { key: "auction.goingTwiceTime", label: "Going Twice Time (sec)", description: "Final countdown", comfortDescription: "Final countdown before sold", type: "number", category: "auction", default: 3, min: 2, max: 10 },
  { key: "auction.maxPlayersPerTeam", label: "Max Players Per Team", description: "Maximum players each team can buy", comfortDescription: "Most players you can buy", type: "number", category: "auction", default: 11, min: 7, max: 20 },
  { key: "auction.unsoldPlayerReAuction", label: "Re-auction Unsold", description: "Re-auction players nobody bought", comfortDescription: "Try to sell unsold players again", type: "boolean", category: "auction", default: true },
  { key: "auction.rightToMatchEnabled", label: "Right to Match", description: "Previous owner can match highest bid", comfortDescription: "Old owner can match the price", type: "boolean", category: "auction", default: false, advanced: true },
];

/**
 * Get default values for a complete rule set.
 */
export function getDefaultRules(): CompleteLeagueRules {
  const defaults: Record<string, unknown> = {};
  for (const rule of RULE_DEFINITIONS) {
    setNestedValue(defaults, rule.key, rule.default);
  }
  return defaults as unknown as CompleteLeagueRules;
}

/**
 * Get rules for a specific category.
 */
export function getRulesByCategory(category: RuleCategory): RuleDefinition[] {
  return RULE_DEFINITIONS.filter((r) => r.category === category);
}

/**
 * Get only non-advanced rules (for simple mode).
 */
export function getSimpleRules(): RuleDefinition[] {
  return RULE_DEFINITIONS.filter((r) => !r.advanced);
}

/**
 * Validate a rule value against its definition bounds.
 */
export function validateRuleValue(
  key: string,
  value: unknown
): { valid: boolean; error?: string } {
  const def = RULE_DEFINITIONS.find((r) => r.key === key);
  if (!def) return { valid: false, error: `Unknown rule: ${key}` };

  if (def.type === "boolean") {
    if (typeof value !== "boolean")
      return { valid: false, error: `${def.label} must be true or false` };
    return { valid: true };
  }

  if (def.type === "number" || def.type === "range") {
    if (typeof value !== "number")
      return { valid: false, error: `${def.label} must be a number` };
    if (def.min !== undefined && value < def.min)
      return {
        valid: false,
        error: `${def.label} must be at least ${def.min}`,
      };
    if (def.max !== undefined && value > def.max)
      return { valid: false, error: `${def.label} must be at most ${def.max}` };
    return { valid: true };
  }

  if (def.type === "select") {
    const validValues = def.options?.map((o) => o.value) ?? [];
    if (!validValues.includes(value as string))
      return {
        valid: false,
        error: `${def.label} must be one of: ${validValues.join(", ")}`,
      };
    return { valid: true };
  }

  return { valid: true };
}

/**
 * Merge partial rules on top of defaults, returning a complete set.
 */
export function mergeWithDefaults(
  partial: Record<string, unknown>
): CompleteLeagueRules {
  const defaults = getDefaultRules();
  return deepMerge(defaults, partial) as CompleteLeagueRules;
}

// ── Helpers ──

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
) {
  const parts = path.split(".");
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object"
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
