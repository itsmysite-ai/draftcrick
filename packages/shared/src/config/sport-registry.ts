import type { Sport, PlayerRole } from "../types/match";
import type { RoleToken } from "../types/roles";

export interface SportRoleConfig {
  token: RoleToken;
  role: PlayerRole;
  displayName: string;
  pluralName: string;
  emoji: string;
}

export interface SportTerminology {
  matchEvent: string;     // "match" | "grand prix"
  round: string;          // "over" | "lap"
  score: string;          // "runs" | "points"
  dismiss: string;        // "wicket" | "DNF"
  period: string;         // "innings" | "session"
  formation: string;      // "playing XI" | "grid"
  result: string;         // "won by" | "classification"
  venue: string;          // "ground" | "circuit"
  captain: string;        // "captain" | "turbo driver"
}

export interface SportScoringCategory {
  key: string;
  label: string;
  description: string;
}

export interface SportConfig {
  sport: Sport;
  displayName: string;

  // Roles
  roles: SportRoleConfig[];

  // Team composition
  teamSize: number;
  compositionRules: Partial<Record<RoleToken, { min: number; max: number }>>;

  // Formats (e.g., T20/ODI for cricket, Race/Sprint for F1)
  formats: string[];

  // Terminology
  terminology: SportTerminology;

  // Scoring categories
  scoringCategories: SportScoringCategory[];

  // Prompt config for Gemini (folded from old SPORT_CONFIGS)
  promptConfig: {
    formatExamples: string[];
    knownTournaments: string[];
  };
}

// ── Cricket Config ──

const CRICKET_CONFIG: SportConfig = {
  sport: "cricket",
  displayName: "Cricket",
  roles: [
    { token: "BAT", role: "batsman", displayName: "Batsman", pluralName: "Batsmen", emoji: "🏏" },
    { token: "BOWL", role: "bowler", displayName: "Bowler", pluralName: "Bowlers", emoji: "🔴" },
    { token: "AR", role: "all_rounder", displayName: "All-Rounder", pluralName: "All-Rounders", emoji: "⚡" },
    { token: "WK", role: "wicket_keeper", displayName: "Keeper", pluralName: "Keepers", emoji: "🧤" },
  ],
  teamSize: 11,
  compositionRules: {
    BAT: { min: 1, max: 6 },
    BOWL: { min: 1, max: 6 },
    AR: { min: 1, max: 6 },
    WK: { min: 1, max: 4 },
  },
  formats: ["T20", "ODI", "Test"],
  terminology: {
    matchEvent: "match",
    round: "over",
    score: "runs",
    dismiss: "wicket",
    period: "innings",
    formation: "playing XI",
    result: "won by",
    venue: "ground",
    captain: "captain",
  },
  scoringCategories: [
    { key: "batting", label: "Batting", description: "Runs, boundaries, strike rate" },
    { key: "bowling", label: "Bowling", description: "Wickets, economy, maidens" },
    { key: "fielding", label: "Fielding", description: "Catches, stumpings, run outs" },
  ],
  promptConfig: {
    formatExamples: ["T20", "ODI", "Test", "T10"],
    knownTournaments: [
      "IPL", "ICC Men's T20 World Cup", "ICC Men's ODI World Cup",
      "The Ashes", "Big Bash League", "Caribbean Premier League",
      "PSL", "SA20", "ILT20", "Bangladesh Premier League",
      "ICC Champions Trophy", "Asia Cup",
    ],
  },
};

// ── F1 Config ──

const F1_CONFIG: SportConfig = {
  sport: "f1",
  displayName: "Formula 1",
  roles: [
    { token: "DRV", role: "driver", displayName: "Driver", pluralName: "Drivers", emoji: "🏎️" },
    { token: "CON", role: "constructor", displayName: "Constructor", pluralName: "Constructors", emoji: "🏗️" },
    { token: "TP", role: "team_principal", displayName: "Team Principal", pluralName: "Team Principals", emoji: "👔" },
  ],
  teamSize: 6,
  compositionRules: {
    DRV: { min: 4, max: 5 },
    CON: { min: 1, max: 2 },
    TP: { min: 0, max: 1 },
  },
  formats: ["Race", "Sprint", "Qualifying"],
  terminology: {
    matchEvent: "grand prix",
    round: "lap",
    score: "points",
    dismiss: "DNF",
    period: "session",
    formation: "grid",
    result: "classification",
    venue: "circuit",
    captain: "turbo driver",
  },
  scoringCategories: [
    { key: "race", label: "Race", description: "Finish position, positions gained" },
    { key: "qualifying", label: "Qualifying", description: "Grid position, pole bonus" },
    { key: "bonus", label: "Bonus", description: "Fastest lap, driver of the day" },
  ],
  promptConfig: {
    formatExamples: ["Race", "Sprint Race", "Qualifying"],
    knownTournaments: [
      "Formula 1 World Championship",
      "F1 Academy",
      "Formula 2",
    ],
  },
};

// ── Stub configs for future sports ──

const FOOTBALL_CONFIG: SportConfig = {
  sport: "football",
  displayName: "Football",
  roles: [],
  teamSize: 11,
  compositionRules: {},
  formats: ["League", "Cup"],
  terminology: {
    matchEvent: "match", round: "half", score: "goals", dismiss: "red card",
    period: "half", formation: "starting XI", result: "won", venue: "stadium",
    captain: "captain",
  },
  scoringCategories: [],
  promptConfig: {
    formatExamples: ["League", "Cup", "Friendly", "Qualifier"],
    knownTournaments: ["English Premier League", "UEFA Champions League", "La Liga", "Serie A", "Bundesliga", "FIFA World Cup"],
  },
};

const KABADDI_CONFIG: SportConfig = {
  sport: "kabaddi",
  displayName: "Kabaddi",
  roles: [],
  teamSize: 7,
  compositionRules: {},
  formats: ["League", "International"],
  terminology: {
    matchEvent: "match", round: "half", score: "points", dismiss: "tackle",
    period: "half", formation: "starting VII", result: "won by", venue: "arena",
    captain: "captain",
  },
  scoringCategories: [],
  promptConfig: {
    formatExamples: ["League", "International"],
    knownTournaments: ["Pro Kabaddi League", "Kabaddi World Cup", "Asian Kabaddi Championship"],
  },
};

const BASKETBALL_CONFIG: SportConfig = {
  sport: "basketball",
  displayName: "Basketball",
  roles: [],
  teamSize: 5,
  compositionRules: {},
  formats: ["Regular Season", "Playoffs"],
  terminology: {
    matchEvent: "game", round: "quarter", score: "points", dismiss: "foul out",
    period: "quarter", formation: "starting five", result: "won", venue: "arena",
    captain: "captain",
  },
  scoringCategories: [],
  promptConfig: {
    formatExamples: ["Regular Season", "Playoffs", "International"],
    knownTournaments: ["NBA", "EuroLeague", "FIBA World Cup", "FIBA Asia Cup", "NBL"],
  },
};

// ── Registry ──

export const SPORT_REGISTRY: Record<Sport, SportConfig> = {
  cricket: CRICKET_CONFIG,
  f1: F1_CONFIG,
  football: FOOTBALL_CONFIG,
  kabaddi: KABADDI_CONFIG,
  basketball: BASKETBALL_CONFIG,
};

/** Get the full config for a sport */
export function getSportConfig(sport: Sport): SportConfig {
  return SPORT_REGISTRY[sport];
}

/** Get roles for a sport */
export function getRolesForSport(sport: Sport): SportRoleConfig[] {
  return SPORT_REGISTRY[sport].roles;
}

/** Get terminology for a sport */
export function getTerminology(sport: Sport): SportTerminology {
  return SPORT_REGISTRY[sport].terminology;
}

/** Get composition rules for a sport */
export function getCompositionRules(sport: Sport) {
  return {
    teamSize: SPORT_REGISTRY[sport].teamSize,
    roleConstraints: SPORT_REGISTRY[sport].compositionRules,
  };
}

/** Sports that are fully implemented and available to users */
export const AVAILABLE_SPORTS: Sport[] = ["cricket", "f1"];

/** Default sport */
export const DEFAULT_SPORT: Sport = "cricket";
