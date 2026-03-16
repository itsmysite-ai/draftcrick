/**
 * Zod schemas for Jolpica/Ergast F1 API responses.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Common wrapper
// ---------------------------------------------------------------------------

const MRDataWrapper = <T extends z.AnyZodObject>(inner: T) =>
  z.object({
    MRData: z.object({
      xmlns: z.string().optional(),
      series: z.string().optional(),
      url: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
      total: z.string().optional(),
    }).merge(inner).passthrough(),
  });

// ---------------------------------------------------------------------------
// Races
// ---------------------------------------------------------------------------

const JolpicaCircuit = z.object({
  circuitId: z.string(),
  url: z.string().optional(),
  circuitName: z.string(),
  Location: z.object({
    lat: z.string().optional(),
    long: z.string().optional(),
    locality: z.string().optional(),
    country: z.string().optional(),
  }).passthrough(),
}).passthrough();

const JolpicaSession = z.object({
  date: z.string(),
  time: z.string().optional(),
}).passthrough();

const JolpicaRace = z.object({
  season: z.string(),
  round: z.string(),
  url: z.string().optional(),
  raceName: z.string(),
  Circuit: JolpicaCircuit,
  date: z.string(),
  time: z.string().optional(),
  FirstPractice: JolpicaSession.optional(),
  SecondPractice: JolpicaSession.optional(),
  ThirdPractice: JolpicaSession.optional(),
  Qualifying: JolpicaSession.optional(),
  Sprint: JolpicaSession.optional(),
}).passthrough();

export const JolpicaRacesSchema = MRDataWrapper(
  z.object({
    RaceTable: z.object({
      season: z.string().optional(),
      Races: z.array(JolpicaRace),
    }).passthrough(),
  })
);

export type JolpicaRacesResponse = z.infer<typeof JolpicaRacesSchema>;

// ---------------------------------------------------------------------------
// Driver standings
// ---------------------------------------------------------------------------

const JolpicaDriver = z.object({
  driverId: z.string(),
  permanentNumber: z.string().optional(),
  code: z.string().optional(),
  url: z.string().optional(),
  givenName: z.string(),
  familyName: z.string(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
}).passthrough();

const JolpicaConstructor = z.object({
  constructorId: z.string(),
  url: z.string().optional(),
  name: z.string(),
  nationality: z.string().optional(),
}).passthrough();

const JolpicaDriverStanding = z.object({
  position: z.string().optional(),
  positionText: z.string().optional(),
  points: z.string().optional(),
  wins: z.string().optional(),
  Driver: JolpicaDriver,
  Constructors: z.array(JolpicaConstructor),
}).passthrough();

const JolpicaStandingsList = z.object({
  season: z.string().optional(),
  round: z.string().optional(),
  DriverStandings: z.array(JolpicaDriverStanding).optional(),
}).passthrough();

export const JolpicaDriverStandingsSchema = MRDataWrapper(
  z.object({
    StandingsTable: z.object({
      season: z.string().optional(),
      StandingsLists: z.array(JolpicaStandingsList),
    }).passthrough(),
  })
);

export type JolpicaDriverStandingsResponse = z.infer<typeof JolpicaDriverStandingsSchema>;

// ---------------------------------------------------------------------------
// Constructor standings
// ---------------------------------------------------------------------------

const JolpicaConstructorStanding = z.object({
  position: z.string().optional(),
  positionText: z.string().optional(),
  points: z.string().optional(),
  wins: z.string().optional(),
  Constructor: JolpicaConstructor,
}).passthrough();

const JolpicaConstructorStandingsList = z.object({
  season: z.string().optional(),
  round: z.string().optional(),
  ConstructorStandings: z.array(JolpicaConstructorStanding).optional(),
}).passthrough();

export const JolpicaConstructorStandingsSchema = MRDataWrapper(
  z.object({
    StandingsTable: z.object({
      season: z.string().optional(),
      StandingsLists: z.array(JolpicaConstructorStandingsList),
    }).passthrough(),
  })
);

export type JolpicaConstructorStandingsResponse = z.infer<typeof JolpicaConstructorStandingsSchema>;

// ---------------------------------------------------------------------------
// Race results (for completed races)
// ---------------------------------------------------------------------------

const JolpicaResult = z.object({
  number: z.string().optional(),
  position: z.string(),
  positionText: z.string().optional(),
  points: z.string(),
  Driver: JolpicaDriver,
  Constructor: JolpicaConstructor,
  grid: z.string().optional(),
  laps: z.string().optional(),
  status: z.string().optional(),
  Time: z.object({
    millis: z.string().optional(),
    time: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();

const JolpicaRaceResult = z.object({
  season: z.string(),
  round: z.string(),
  raceName: z.string(),
  Circuit: JolpicaCircuit,
  date: z.string(),
  Results: z.array(JolpicaResult).optional(),
}).passthrough();

export const JolpicaResultsSchema = MRDataWrapper(
  z.object({
    RaceTable: z.object({
      season: z.string().optional(),
      Races: z.array(JolpicaRaceResult),
    }).passthrough(),
  })
);

export type JolpicaResultsResponse = z.infer<typeof JolpicaResultsSchema>;
