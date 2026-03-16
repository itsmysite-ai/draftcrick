/**
 * Zod schemas for ESPN public API responses.
 * These serve as a contract — if ESPN changes their format,
 * Zod throws a parse error and we fall back to Gemini cleanly.
 *
 * Schemas are intentionally permissive (.passthrough()) to survive
 * ESPN adding new fields, while still validating the fields we need.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Cricket scoreboard (personalized/v2/scoreboard/header)
// ---------------------------------------------------------------------------

const ESPNCricketCompetitor = z.object({
  id: z.string(),
  homeAway: z.string().optional(),
  displayName: z.string(),
  name: z.string().optional(),
  abbreviation: z.string().optional(),
  score: z.string().optional(),
  winner: z.boolean().optional(),
  logos: z.array(z.object({ href: z.string() }).passthrough()).optional(),
}).passthrough();

const ESPNCricketStatusType = z.object({
  id: z.string().optional(),
  state: z.string().optional(),
  description: z.string().optional(),
  detail: z.string().optional(),
  shortDetail: z.string().optional(),
}).passthrough();

const ESPNCricketNote = z.object({
  text: z.string().optional(),
  type: z.string().optional(),
}).passthrough();

const ESPNCricketEvent = z.object({
  id: z.string(),
  date: z.string(),
  endDate: z.string().optional(),
  name: z.string(),
  shortName: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  summary: z.string().optional(),
  fullStatus: z.object({
    type: ESPNCricketStatusType,
  }).passthrough().optional(),
  competitors: z.array(ESPNCricketCompetitor).optional(),
  notes: z.array(ESPNCricketNote).optional(),
  links: z.array(z.object({
    href: z.string(),
    rel: z.array(z.string()).optional(),
    text: z.string().optional(),
  }).passthrough()).optional(),
  season: z.number().optional(),
  seasonStartDate: z.string().optional(),
  seasonEndDate: z.string().optional(),
}).passthrough();

const ESPNCricketLeague = z.object({
  id: z.string(),
  name: z.string(),
  abbreviation: z.string().optional(),
  slug: z.string().optional(),
  isTournament: z.boolean().optional(),
  events: z.array(ESPNCricketEvent).optional(),
  smartdates: z.array(z.string()).optional(),
}).passthrough();

const ESPNCricketSport = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  leagues: z.array(ESPNCricketLeague).optional(),
}).passthrough();

export const ESPNCricketScoreboardSchema = z.object({
  sports: z.array(ESPNCricketSport),
}).passthrough();

export type ESPNCricketScoreboard = z.infer<typeof ESPNCricketScoreboardSchema>;

// ---------------------------------------------------------------------------
// F1 scoreboard (site/v2/sports/racing/f1/scoreboard)
// ---------------------------------------------------------------------------

const ESPNF1CalendarEntry = z.object({
  label: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  event: z.object({ "$ref": z.string() }).passthrough().optional(),
}).passthrough();

const ESPNF1Athlete = z.object({
  fullName: z.string().optional(),
  displayName: z.string().optional(),
  shortName: z.string().optional(),
  flag: z.object({
    alt: z.string().optional(),
    href: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

const ESPNF1Competitor = z.object({
  id: z.string(),
  type: z.string().optional(),
  order: z.number().optional(),
  winner: z.boolean().optional(),
  athlete: ESPNF1Athlete.optional(),
  statistics: z.array(z.any()).optional(),
}).passthrough();

const ESPNF1CompetitionType = z.object({
  id: z.string().optional(),
  abbreviation: z.string().optional(),
}).passthrough();

const ESPNF1Competition = z.object({
  id: z.string(),
  date: z.string(),
  type: ESPNF1CompetitionType.optional(),
  competitors: z.array(ESPNF1Competitor).optional(),
  status: z.object({
    type: z.object({
      state: z.string().optional(),
      description: z.string().optional(),
    }).passthrough(),
  }).passthrough().optional(),
}).passthrough();

const ESPNF1Event = z.object({
  id: z.string(),
  date: z.string(),
  endDate: z.string().optional(),
  name: z.string(),
  shortName: z.string().optional(),
  competitions: z.array(ESPNF1Competition).optional(),
  circuit: z.object({
    fullName: z.string().optional(),
    address: z.object({
      city: z.string().optional(),
      country: z.string().optional(),
    }).passthrough().optional(),
  }).passthrough().optional(),
  status: z.object({
    type: z.object({
      state: z.string().optional(),
      description: z.string().optional(),
    }).passthrough(),
  }).passthrough().optional(),
}).passthrough();

const ESPNF1League = z.object({
  id: z.string(),
  name: z.string(),
  abbreviation: z.string().optional(),
  slug: z.string().optional(),
  season: z.object({
    year: z.number(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).passthrough().optional(),
  calendar: z.array(ESPNF1CalendarEntry).optional(),
}).passthrough();

export const ESPNF1ScoreboardSchema = z.object({
  leagues: z.array(ESPNF1League),
  events: z.array(ESPNF1Event).optional(),
}).passthrough();

export type ESPNF1Scoreboard = z.infer<typeof ESPNF1ScoreboardSchema>;

// ---------------------------------------------------------------------------
// Football scoreboard (site/v2/sports/soccer/{league}/scoreboard)
// Uses a similar structure to F1 but with different competition fields
// ---------------------------------------------------------------------------

const ESPNFootballCompetitor = z.object({
  id: z.string(),
  homeAway: z.string().optional(),
  winner: z.boolean().optional(),
  team: z.object({
    id: z.string(),
    displayName: z.string(),
    abbreviation: z.string().optional(),
    logo: z.string().optional(),
  }).passthrough().optional(),
  score: z.string().optional(),
}).passthrough();

const ESPNFootballCompetition = z.object({
  id: z.string(),
  date: z.string(),
  competitors: z.array(ESPNFootballCompetitor).optional(),
  status: z.object({
    type: z.object({
      state: z.string().optional(),
      description: z.string().optional(),
      detail: z.string().optional(),
    }).passthrough(),
  }).passthrough().optional(),
  venue: z.object({
    fullName: z.string().optional(),
    address: z.object({
      city: z.string().optional(),
      country: z.string().optional(),
    }).passthrough().optional(),
  }).passthrough().optional(),
}).passthrough();

const ESPNFootballEvent = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  shortName: z.string().optional(),
  competitions: z.array(ESPNFootballCompetition).optional(),
  status: z.object({
    type: z.object({
      state: z.string().optional(),
      description: z.string().optional(),
    }).passthrough(),
  }).passthrough().optional(),
}).passthrough();

const ESPNFootballLeague = z.object({
  id: z.string(),
  name: z.string(),
  abbreviation: z.string().optional(),
  slug: z.string().optional(),
  season: z.object({
    year: z.number(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

export const ESPNFootballScoreboardSchema = z.object({
  leagues: z.array(ESPNFootballLeague),
  events: z.array(ESPNFootballEvent).optional(),
}).passthrough();

export type ESPNFootballScoreboard = z.infer<typeof ESPNFootballScoreboardSchema>;
