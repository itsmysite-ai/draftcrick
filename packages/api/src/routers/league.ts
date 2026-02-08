import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { createLeagueSchema } from "@draftcrick/shared";
import { LEAGUE_TEMPLATES } from "@draftcrick/shared";
import { eq, and } from "drizzle-orm";
import { leagues, leagueMembers } from "@draftcrick/db";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";

export const leagueRouter = router({
  /**
   * Create a new league
   */
  create: protectedProcedure
    .input(createLeagueSchema)
    .mutation(async ({ ctx, input }) => {
      const inviteCode = randomBytes(6).toString("hex");

      // Apply template rules if not custom
      const templateRules =
        input.template !== "custom" && input.template
          ? LEAGUE_TEMPLATES[input.template]
          : {};

      const [league] = await ctx.db
        .insert(leagues)
        .values({
          name: input.name,
          ownerId: ctx.user.id,
          format: input.format,
          sport: input.sport,
          tournament: input.tournament,
          season: input.season,
          isPrivate: input.isPrivate,
          inviteCode,
          maxMembers: input.maxMembers,
          template: input.template,
          rules: { ...templateRules, ...input.rules },
        })
        .returning();

      // Add owner as a league member
      await ctx.db.insert(leagueMembers).values({
        leagueId: league!.id,
        userId: ctx.user.id,
        role: "owner",
      });

      return league;
    }),

  /**
   * Join a league by invite code
   */
  join: protectedProcedure
    .input(z.object({ inviteCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.inviteCode, input.inviteCode),
      });

      if (!league) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid invite code",
        });
      }

      // Check if already a member
      const existingMember = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, league.id),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (existingMember) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already a member of this league",
        });
      }

      await ctx.db.insert(leagueMembers).values({
        leagueId: league.id,
        userId: ctx.user.id,
        role: "member",
      });

      return league;
    }),

  /**
   * Get user's leagues
   */
  myLeagues: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.leagueMembers.findMany({
      where: eq(leagueMembers.userId, ctx.user.id),
      with: {
        league: true,
      },
    });
    return memberships;
  }),

  /**
   * Get league details
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.id, input.id),
        with: {
          members: true,
          owner: true,
        },
      });
      return league ?? null;
    }),
});
