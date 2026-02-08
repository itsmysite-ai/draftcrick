import { z } from "zod";

export const createContestSchema = z.object({
  matchId: z.string().uuid(),
  leagueId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  entryFee: z.number().min(0),
  maxEntries: z.number().int().min(2).max(100000),
  contestType: z.enum(["public", "private", "h2h"]),
  isGuaranteed: z.boolean().default(false),
  prizeDistribution: z.array(
    z.object({
      rank: z.number().int().positive(),
      amount: z.number().min(0),
    })
  ),
});

export const joinContestSchema = z.object({
  contestId: z.string().uuid(),
  teamId: z.string().uuid(),
});

export type CreateContestInput = z.infer<typeof createContestSchema>;
export type JoinContestInput = z.infer<typeof joinContestSchema>;
