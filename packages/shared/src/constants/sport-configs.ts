import type { SportPromptConfig } from "../types/sports";

/**
 * Sport-specific configurations for Gemini AI prompts.
 * To add a new sport, just add an entry here — no other code changes needed.
 */
export const SPORT_CONFIGS: Record<string, SportPromptConfig> = {
  cricket: {
    sport: "cricket",
    displayName: "Cricket",
    formatExamples: ["T20", "ODI", "Test", "T10"],
    knownTournaments: [
      "IPL",
      "ICC Men's T20 World Cup",
      "ICC Men's ODI World Cup",
      "The Ashes",
      "Big Bash League",
      "Caribbean Premier League",
      "PSL",
      "SA20",
      "ILT20",
      "Bangladesh Premier League",
      "ICC Champions Trophy",
      "Asia Cup",
    ],
  },
  football: {
    sport: "football",
    displayName: "Football",
    formatExamples: ["League", "Cup", "Friendly", "Qualifier"],
    knownTournaments: [
      "English Premier League",
      "UEFA Champions League",
      "La Liga",
      "Serie A",
      "Bundesliga",
      "FIFA World Cup",
      "Copa America",
      "AFC Asian Cup",
    ],
  },
  kabaddi: {
    sport: "kabaddi",
    displayName: "Kabaddi",
    formatExamples: ["League", "International"],
    knownTournaments: [
      "Pro Kabaddi League",
      "Kabaddi World Cup",
      "Asian Kabaddi Championship",
    ],
  },
  basketball: {
    sport: "basketball",
    displayName: "Basketball",
    formatExamples: ["Regular Season", "Playoffs", "International"],
    knownTournaments: [
      "NBA",
      "EuroLeague",
      "FIBA World Cup",
      "FIBA Asia Cup",
      "NBL",
    ],
  },
};

/** Default sport to fetch if none specified */
export const DEFAULT_SPORT = "cricket" as const;
