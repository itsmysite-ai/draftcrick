import type { SportPromptConfig } from "../types/sports";
import { SPORT_REGISTRY } from "../config/sport-registry";

/**
 * Sport-specific configurations for Gemini AI prompts.
 * Now derived from the central sport registry.
 */
export const SPORT_CONFIGS: Record<string, SportPromptConfig> = Object.fromEntries(
  Object.entries(SPORT_REGISTRY).map(([key, config]) => [
    key,
    {
      sport: config.sport,
      displayName: config.displayName,
      formatExamples: config.promptConfig.formatExamples,
      knownTournaments: config.promptConfig.knownTournaments,
    },
  ])
);
