import { z } from "zod";

export const createPredictionSchema = z.object({
  matchId: z.string().uuid(),
  predictionType: z.enum([
    "winner",
    "margin",
    "top_scorer",
    "top_bowler",
    "toss",
  ]),
  predictionValue: z.string().min(1),
});

export type CreatePredictionInput = z.infer<typeof createPredictionSchema>;
