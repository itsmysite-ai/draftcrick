import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { createLeagueSchema } from "@draftcrick/shared";
import { LEAGUE_TEMPLATES, FULL_LEAGUE_TEMPLATES } from "@draftcrick/shared";
import { eq, and, count } from "drizzle-orm";
import { leagues, leagueMembers, draftRooms } from "@draftcrick/db";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";

export const leagueRouter = router({
  create: protectedProcedure
    .input(createLeagueSchema)
    .mutation(async ({ ctx, input }) => {
      const inviteCode = randomBytes(6).toString("hex");

      let templateRules: Record<string, unknown> = {};
      if (input.template !== "custom" && input.template) {
        if (input.format === "draft" || input.format === "auction") {
          templateRules = FULL_LEAGUE_TEMPLATES[input.template] as unknown as Record<string, unknown>;
        } else {
          templateRules = LEAGUE_TEMPLATES[input.template] as unknown as Record<string, unknown>;
        }
      }

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

      await ctx.db.insert(leagueMembers).values({
        leagueId: league!.id,
        userId: ctx.user.id,
        role: "owner",
      });

      return league;
    }),

  join: protectedProcedure
    .input(z.object({ inviteCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.inviteCode, input.inviteCode),
      });

      if (!league) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });
      }

      const memberCount = await ctx.db
        .select({ count: count() })
        .from(leagueMembers)
        .where(eq(leagueMembers.leagueId, league.id));

      if (memberCount[0] && memberCount[0].count >= league.maxMembers) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "League is full" });
      }

      const existingMember = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, league.id),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (existingMember) {
        throw new TRPCError({ code: "CONFLICT", message: "Already a member of this league" });
      }

      await ctx.db.insert(leagueMembers).values({
        leagueId: league.id,
        userId: ctx.user.id,
        role: "member",
      });

      return league;
    }),

  myLeagues: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.query.leagueMembers.findMany({
      where: eq(leagueMembers.userId, ctx.user.id),
      with: { league: true },
    });
    return memberships;
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.id, input.id),
        with: {
          members: { with: { user: true } },
          owner: true,
        },
      });
      return league ?? null;
    }),

  getMembers: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.leagueMembers.findMany({
        where: eq(leagueMembers.leagueId, input.leagueId),
        with: { user: true },
      });
    }),

  updateSettings: protectedProcedure
    .input(
      z.object({
        leagueId: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        maxMembers: z.number().int().min(2).max(200).optional(),
        isPrivate: z.boolean().optional(),
        rules: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owner/admin can update settings" });
      }

      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.id, input.leagueId),
      });
      if (!league) throw new TRPCError({ code: "NOT_FOUND", message: "League not found" });

      const updates: Record<string, unknown> = {};
      if (input.name) updates.name = input.name;
      if (input.maxMembers) updates.maxMembers = input.maxMembers;
      if (input.isPrivate !== undefined) updates.isPrivate = input.isPrivate;
      if (input.rules) {
        updates.rules = { ...(league.rules as Record<string, unknown>), ...input.rules };
      }

      const [updated] = await ctx.db
        .update(leagues)
        .set(updates)
        .where(eq(leagues.id, input.leagueId))
        .returning();

      return updated;
    }),

  promoteMember: protectedProcedure
    .input(z.object({
      leagueId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.enum(["admin", "member"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (!callerMembership || callerMembership.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owner can change member roles" });
      }

      await ctx.db
        .update(leagueMembers)
        .set({ role: input.role })
        .where(and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, input.userId)
        ));

      return { success: true };
    }),

  kickMember: protectedProcedure
    .input(z.object({
      leagueId: z.string().uuid(),
      userId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (!callerMembership || (callerMembership.role !== "owner" && callerMembership.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owner/admin can kick members" });
      }

      const targetMembership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, input.userId)
        ),
      });

      if (targetMembership?.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot kick the league owner" });
      }

      await ctx.db
        .delete(leagueMembers)
        .where(and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, input.userId)
        ));

      return { success: true };
    }),

  leave: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not a member" });
      }
      if (membership.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Owner cannot leave. Transfer ownership first." });
      }

      await ctx.db
        .delete(leagueMembers)
        .where(and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ));

      return { success: true };
    }),

  regenerateInviteCode: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (!membership || membership.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owner can regenerate invite code" });
      }

      const newCode = randomBytes(6).toString("hex");
      const [updated] = await ctx.db
        .update(leagues)
        .set({ inviteCode: newCode })
        .where(eq(leagues.id, input.leagueId))
        .returning();

      return updated;
    }),

  startDraft: protectedProcedure
    .input(z.object({
      leagueId: z.string().uuid(),
      type: z.enum(["snake_draft", "auction"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owner/admin can start a draft" });
      }

      const members = await ctx.db.query.leagueMembers.findMany({
        where: eq(leagueMembers.leagueId, input.leagueId),
      });

      if (members.length < 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Need at least 2 members to start a draft" });
      }

      const existingDraft = await ctx.db.query.draftRooms.findFirst({
        where: and(
          eq(draftRooms.leagueId, input.leagueId),
          eq(draftRooms.status, "in_progress")
        ),
      });

      if (existingDraft) {
        throw new TRPCError({ code: "CONFLICT", message: "A draft is already in progress" });
      }

      // Randomize pick order
      const pickOrder = members.map((m) => m.userId).sort(() => Math.random() - 0.5);

      const league = await ctx.db.query.leagues.findFirst({
        where: eq(leagues.id, input.leagueId),
      });
      const rules = (league?.rules ?? {}) as Record<string, unknown>;
      const draftSettings = (rules.draft ?? {}) as Record<string, unknown>;
      const auctionSettings = (rules.auction ?? {}) as Record<string, unknown>;

      const timePerPick = input.type === "snake_draft"
        ? (draftSettings.timePerPick as number) ?? 60
        : (auctionSettings.maxBidTime as number) ?? 15;

      const [room] = await ctx.db
        .insert(draftRooms)
        .values({
          leagueId: input.leagueId,
          type: input.type,
          status: "waiting",
          pickOrder,
          timePerPick,
          settings: input.type === "snake_draft" ? draftSettings : auctionSettings,
        })
        .returning();

      return room;
    }),

  transferOwnership: protectedProcedure
    .input(z.object({
      leagueId: z.string().uuid(),
      newOwnerId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerMembership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, ctx.user.id)
        ),
      });

      if (!callerMembership || callerMembership.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owner can transfer ownership" });
      }

      const targetMembership = await ctx.db.query.leagueMembers.findFirst({
        where: and(
          eq(leagueMembers.leagueId, input.leagueId),
          eq(leagueMembers.userId, input.newOwnerId)
        ),
      });

      if (!targetMembership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Target user is not a league member" });
      }

      await ctx.db.update(leagueMembers).set({ role: "admin" }).where(and(
        eq(leagueMembers.leagueId, input.leagueId),
        eq(leagueMembers.userId, ctx.user.id)
      ));

      await ctx.db.update(leagueMembers).set({ role: "owner" }).where(and(
        eq(leagueMembers.leagueId, input.leagueId),
        eq(leagueMembers.userId, input.newOwnerId)
      ));

      await ctx.db.update(leagues).set({ ownerId: input.newOwnerId }).where(eq(leagues.id, input.leagueId));

      return { success: true };
    }),
});
