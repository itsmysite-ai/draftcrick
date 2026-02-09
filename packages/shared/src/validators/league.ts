import { z } from "zod";

export const createLeagueSchema = z.object({
  name: z.string().min(1).max(100),
  format: z.enum(["salary_cap", "draft", "auction", "prediction"]),
  sport: z.enum(["cricket", "football", "kabaddi", "basketball"]).default("cricket"),
  tournament: z.string().min(1),
  season: z.string().optional(),
  isPrivate: z.boolean().default(true),
  maxMembers: z.number().int().min(2).max(200).default(10),
  template: z.enum(["casual", "competitive", "pro", "custom"]).default("casual"),
  rules: z.record(z.unknown()).optional(),
});

export const joinLeagueSchema = z.object({
  inviteCode: z.string().min(1),
});

export type CreateLeagueInput = z.infer<typeof createLeagueSchema>;
export type JoinLeagueInput = z.infer<typeof joinLeagueSchema>;
