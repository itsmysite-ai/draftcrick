import { z } from "zod";
import { CRICKET_ROLES, F1_ROLES } from "../types/roles";

// All valid roles across all sports
const ALL_ROLES = [...CRICKET_ROLES, ...F1_ROLES] as const;

export const createTeamSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  contestId: z.string().uuid().optional(),
  matchId: z.string().optional(),
  players: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        role: z.enum(ALL_ROLES as unknown as [string, ...string[]]),
      })
    )
    .min(1, "Team must have at least 1 player"),
  captainId: z.string().uuid(),
  viceCaptainId: z.string().uuid(),
});

export const updateTeamSchema = z.object({
  teamId: z.string().uuid(),
  players: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        role: z.enum(ALL_ROLES as unknown as [string, ...string[]]),
      })
    )
    .min(1)
    .optional(),
  captainId: z.string().uuid().optional(),
  viceCaptainId: z.string().uuid().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
