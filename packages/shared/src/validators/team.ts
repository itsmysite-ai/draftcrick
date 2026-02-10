import { z } from "zod";

export const createTeamSchema = z.object({
  contestId: z.string().uuid(),
  players: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        role: z.enum(["batsman", "bowler", "all_rounder", "wicket_keeper"]),
      })
    )
    .length(11, "Team must have exactly 11 players"),
  captainId: z.string().uuid(),
  viceCaptainId: z.string().uuid(),
});

export const updateTeamSchema = z.object({
  teamId: z.string().uuid(),
  players: z
    .array(
      z.object({
        playerId: z.string().uuid(),
        role: z.enum(["batsman", "bowler", "all_rounder", "wicket_keeper"]),
      })
    )
    .length(11)
    .optional(),
  captainId: z.string().uuid().optional(),
  viceCaptainId: z.string().uuid().optional(),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
