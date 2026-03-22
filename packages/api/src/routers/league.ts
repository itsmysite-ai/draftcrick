import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { createLeagueSchema, DEFAULT_TIER_CONFIGS } from "@draftplay/shared";
import { LEAGUE_TEMPLATES, FULL_LEAGUE_TEMPLATES } from "@draftplay/shared";
import { eq, and, count, desc, sql, inArray, ilike, ne } from "drizzle-orm";
import { leagues, leagueMembers, draftRooms, contests, fantasyTeams, users, matches } from "@draftplay/db";
import type { Database } from "@draftplay/db";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { getUserTier } from "../services/subscription";
import { getLogger } from "../lib/logger";

const log = getLogger("league");

// ─── Auto-Contest Creation ─────────────────────────────────────────────────

/**
 * Auto-create contests for a league based on its tournament's matches.
 * - For salary_cap: creates a private contest per upcoming match
 * - For draft/auction: same, but members' drafted squads auto-score
 * - Skips matches that already have a contest in this league
 * - Returns count of contests created
 */
export async function autoCreateContestsForLeague(
  db: Database,
  leagueId: string,
  tournament: string,
  maxMembers: number,
): Promise<number> {
  // Find all upcoming/live matches for this tournament
  const tournamentMatches = await db
    .select({ id: matches.id, teamHome: matches.teamHome, teamAway: matches.teamAway, format: matches.format, draftEnabled: matches.draftEnabled, startTime: matches.startTime })
    .from(matches)
    .where(
      and(
        ilike(matches.tournament, tournament),
        inArray(matches.status, ["upcoming", "live"]),
      )
    );

  if (tournamentMatches.length === 0) {
    log.info({ leagueId, tournament }, "No upcoming matches found for auto-contest creation");
    return 0;
  }

  // Find matches that already have contests in this league
  const existingContests = await db
    .select({ matchId: contests.matchId })
    .from(contests)
    .where(eq(contests.leagueId, leagueId));
  const existingMatchIds = new Set(existingContests.map((c) => c.matchId));

  // Create contests for matches that don't have one yet
  const newMatches = tournamentMatches.filter((m) => !existingMatchIds.has(m.id));
  if (newMatches.length === 0) {
    log.info({ leagueId, tournament }, "All matches already have contests");
    return 0;
  }

  // Get league name for contest naming
  const league = await db.query.leagues.findFirst({ where: eq(leagues.id, leagueId) });
  const leagueName = league?.name || "League";

  const contestValues = newMatches.map((m) => ({
    matchId: m.id,
    leagueId,
    name: leagueName,
    entryFee: 0,
    prizePool: 0,
    maxEntries: maxMembers,
    contestType: "private" as const,
    isGuaranteed: false,
    prizeDistribution: [] as { rank: number; amount: number }[],
    status: m.draftEnabled ? "open" as const : "upcoming" as const,
  }));

  await db.insert(contests).values(contestValues);

  log.info({ leagueId, tournament, created: contestValues.length }, "Auto-created league contests");
  return contestValues.length;
}

/**
 * Auto-create contests for ALL active leagues tied to a tournament.
 * Called after new matches are discovered during sports-data refresh.
 */
export async function autoCreateContestsForTournament(
  db: Database,
  tournament: string,
): Promise<number> {
  // Find all active leagues for this tournament
  const activeLeagues = await db
    .select({ id: leagues.id, tournament: leagues.tournament, maxMembers: leagues.maxMembers })
    .from(leagues)
    .where(
      and(
        ilike(leagues.tournament, tournament),
        eq(leagues.status, "active"),
      )
    );

  let totalCreated = 0;
  for (const league of activeLeagues) {
    const created = await autoCreateContestsForLeague(db, league.id, league.tournament, league.maxMembers);
    totalCreated += created;
  }

  if (totalCreated > 0) {
    log.info({ tournament, leagues: activeLeagues.length, contestsCreated: totalCreated }, "Auto-created contests for tournament leagues");
  }
  return totalCreated;
}

// ─── AI League Name Generator ──────────────────────────────────────────────

// Indian state code → full name mapping (ISO 3166-2:IN codes)
const STATE_CODE_MAP: Record<string, string> = {
  "AP": "andhra pradesh", "AR": "arunachal pradesh", "AS": "assam", "BR": "bihar",
  "CG": "chhattisgarh", "CT": "chhattisgarh", "GA": "goa", "GJ": "gujarat",
  "HR": "haryana", "HP": "himachal pradesh", "JH": "jharkhand", "JK": "jammu and kashmir",
  "KA": "karnataka", "KL": "kerala", "MP": "madhya pradesh", "MH": "maharashtra",
  "MN": "manipur", "ML": "meghalaya", "MZ": "mizoram", "NL": "nagaland",
  "OD": "odisha", "OR": "odisha", "PB": "punjab", "RJ": "rajasthan",
  "SK": "sikkim", "TN": "tamil nadu", "TG": "telangana", "TS": "telangana",
  "TR": "tripura", "UP": "uttar pradesh", "UK": "uttarakhand", "UT": "uttarakhand",
  "WB": "west bengal", "DL": "delhi", "AN": "andaman and nicobar",
  "CH": "chandigarh", "DD": "dadra and nagar haveli", "DN": "dadra and nagar haveli",
  "LD": "lakshadweep", "PY": "puducherry",
};

/** Resolve state code or full name to lowercase key */
function resolveStateName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (STATE_CODE_MAP[upper]) return STATE_CODE_MAP[upper];
  return raw.toLowerCase().trim();
}

// Minimal region→language map — just enough for Gemini to know the local language.
// All cultural knowledge (films, slang, food, memes) comes from Gemini's own training.
const REGION_LANG: Record<string, string> = {
  "kerala": "Malayalam", "tamil nadu": "Tamil", "karnataka": "Kannada",
  "andhra pradesh": "Telugu", "telangana": "Telugu/Deccani Hindi",
  "maharashtra": "Marathi", "west bengal": "Bengali", "gujarat": "Gujarati",
  "rajasthan": "Rajasthani/Hindi", "punjab": "Punjabi", "delhi": "Hindi",
  "uttar pradesh": "Hindi/Bhojpuri", "bihar": "Bhojpuri/Hindi",
  "goa": "Konkani", "madhya pradesh": "Hindi", "jharkhand": "Hindi",
  "odisha": "Odia", "assam": "Assamese", "himachal pradesh": "Pahari/Hindi",
  "uttarakhand": "Garhwali/Hindi", "chhattisgarh": "Chhattisgarhi",
  "meghalaya": "Khasi", "manipur": "Meitei", "nagaland": "Nagamese",
  "tripura": "Bengali/Kokborok", "mizoram": "Mizo", "sikkim": "Nepali",
  "arunachal pradesh": "Hindi", "jammu and kashmir": "Kashmiri/Urdu",
};

function getRegionalHint(state: string | null | undefined): string {
  if (!state) return "";
  const region = resolveStateName(state);
  if (!region) return "";
  const lang = REGION_LANG[region] || null;
  return `
REGIONAL FLAVOR (user is from ${region}, India${lang ? `, speaks ${lang}` : ""}):
You know ${region}'s culture — films, food, festivals, slang, memes, college life, famous people, local rivalries, stereotypes.
USE YOUR OWN KNOWLEDGE. Be creative. Mix references from different parts of their culture — don't just pick the most obvious movie.
At least 2 of 5 names should have a ${region} flavor — a local word, cultural reference, or something that makes someone from ${region} smile.
The other 3 can mix cricket + the group's identity.`;
}

/**
 * Generate a dynamic follow-up question with selectable options,
 * personalized to the user's group name and tournament context.
 */
async function generateDynamicQuestion(
  groupName: string,
  tournament: string,
  leagueSize: number,
  userRegion?: string | null,
): Promise<{ question: string; options: string[] }> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || "",
  });

  const resolvedRegion = resolveStateName(userRegion);
  const lang = resolvedRegion ? REGION_LANG[resolvedRegion] : null;

  // Fixed question templates — each is structurally different.
  // We pick one at random; only the OPTIONS are AI-generated.
  const questionTemplates = [
    `if your ${groupName} was a street food stall, what would you serve?`,
    `pick a song that plays when ${groupName} enters the stadium`,
    `your ${groupName} is a movie — what genre?`,
    `what does ${groupName} fight about the most?`,
    `it's 3 am and ${groupName} is still awake because...`,
    `${groupName}'s captain gets out on duck — what happens next?`,
    `one word your rivals would use to describe ${groupName}?`,
    `${groupName} walks into a cricket ground — what's the entry scene?`,
    `what's ${groupName}'s biggest flex?`,
    `how would ${groupName} celebrate winning the league?`,
    `pick a vehicle that represents ${groupName}`,
    `${groupName}'s signature move on the cricket field?`,
  ];
  const question = questionTemplates[Math.floor(Math.random() * questionTemplates.length)];

  const regionHint = resolvedRegion
    ? `The user is from ${resolvedRegion}, India${lang ? ` (speaks ${lang})` : ""}.
Use your knowledge of ${resolvedRegion} culture to make 2-3 options hyper-local (food, places, slang, habits unique to ${resolvedRegion}).
The rest should be universal but specific. DO NOT just list famous movies or actors.`
    : `The user is from India. Make options fun and diverse.`;

  const prompt = `Generate 5 answer options for this question: "${question}"
Context: fantasy cricket league for "${tournament}", ${leagueSize} members.

${regionHint}

RULES:
- Each option: 2-5 words, funny, something a group would proudly claim
- All 5 must be DIFFERENT vibes — don't make variations of the same answer
- Think: local food, city quirks, daily life, college humor, not just movies/cricket
- Make someone from ${resolvedRegion || "India"} laugh or say "that's literally us"

Return ONLY a JSON array of 5 strings: ["...", "...", "...", "...", "..."]`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: prompt,
  });

  const text = response.text?.trim() ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    return {
      question,
      options: ["absolute chaos", "silent assassins", "meme factory", "last over specialists", "chai break champions"],
    };
  }

  try {
    const parsed = JSON.parse(match[0]) as string[];
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return { question, options: parsed.filter((o) => typeof o === "string" && o.length > 0).slice(0, 6) };
    }
  } catch {}

  return {
    question,
    options: ["absolute chaos", "silent assassins", "meme factory", "last over specialists", "chai break champions"],
  };
}

async function generateLeagueNameWithAI(
  format: string,
  template: string,
  tournament: string,
  userContext?: { crewVibe?: string; groupName?: string; leagueSize?: number; userRegion?: string | null },
): Promise<string[]> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY || "",
  });

  const formatDesc = format === "salary_cap" ? "salary cap fantasy (pick players within a budget)"
    : format === "draft" ? "snake draft (take turns picking)"
    : format === "auction" ? "auction (bid on players in real-time)"
    : "prediction (predict match outcomes)";
  const templateDesc = template === "casual" ? "casual/fun" : template === "competitive" ? "competitive" : "hardcore pro";

  const userHints = userContext
    ? `\nABOUT THE GROUP:
- They picked this vibe: "${userContext.crewVibe || "just vibes"}"
- They call their group: "${userContext.groupName || "the gang"}"
- League size: ${userContext.leagueSize || "unknown"} members`
    : "";

  const regionalHint = getRegionalHint(userContext?.userRegion);

  const prompt = `Generate 5 fantasy cricket league names for "${tournament}" (${formatDesc}, ${templateDesc}).
${userHints}
${regionalHint}

NAME GENERATION RULES:
- MAX 5 WORDS. 2-3 word names are best. Punchy > clever > long.
- Each name should feel DIFFERENT — don't just rephrase the same joke 5 ways
- Weave the group's identity ("${userContext?.groupName || "the gang"}") + their vibe ("${userContext?.crewVibe || ""}") into the names
- The 5 names should be a MIX of:
  1. One that uses a local/regional word or phrase naturally (not forced)
  2. One cricket-specific pun or wordplay
  3. One that references their group name creatively
  4. One that mashes up their vibe + tournament context
  5. One wildcard — surprise me
- DO NOT just append "XI" or "league" to a movie name — that's lazy
- DO NOT use the same cultural reference twice across the 5 names
- Names should sound like something a group would actually name their WhatsApp group — natural, funny, a bit irreverent
- Think: inside jokes > movie references > generic cricket terms

Return ONLY a JSON array of 5 strings:`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: prompt,
  });

  const text = response.text?.trim() ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error(`Gemini returned unparseable response: ${text.slice(0, 200)}`);
  }

  const names = JSON.parse(match[0]) as string[];
  const valid = names.filter((n) => typeof n === "string" && n.length > 0 && n.length <= 60);
  if (valid.length < 3) {
    throw new Error(`Gemini returned too few valid names (${valid.length})`);
  }
  return valid;
}

async function ensureUniqueName(db: any, name: string): Promise<string> {
  const existing = await db
    .select({ id: leagues.id })
    .from(leagues)
    .where(ilike(leagues.name, name))
    .limit(1);

  if (existing.length === 0) return name;

  // Append a random 3-digit suffix to make it unique
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.floor(Math.random() * 900) + 100;
    const candidate = `${name} #${suffix}`;
    const check = await db
      .select({ id: leagues.id })
      .from(leagues)
      .where(ilike(leagues.name, candidate))
      .limit(1);
    if (check.length === 0) return candidate;
  }

  // Ultimate fallback
  return `${name} #${Date.now() % 10000}`;
}

export const leagueRouter = router({
  create: protectedProcedure
    .input(createLeagueSchema)
    .mutation(async ({ ctx, input }) => {
      // Check league count limit based on user's tier
      const tier = await getUserTier(ctx.db, ctx.user.id);
      const tierConfig = DEFAULT_TIER_CONFIGS[tier];
      const [ownedCount] = await ctx.db
        .select({ count: count() })
        .from(leagues)
        .where(eq(leagues.ownerId, ctx.user.id));
      if (ownedCount && ownedCount.count >= tierConfig.features.maxLeagues) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've reached the ${tierConfig.features.maxLeagues} league limit for ${tierConfig.name} tier. Upgrade to create more leagues.`,
        });
      }

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

      // Auto-create contests for salary_cap leagues immediately
      if (input.format === "salary_cap") {
        try {
          const created = await autoCreateContestsForLeague(
            ctx.db,
            league!.id,
            input.tournament,
            input.maxMembers,
          );
          log.info({ leagueId: league!.id, contestsCreated: created }, "Auto-created contests on league creation");
        } catch (err) {
          // Non-fatal — league is created, contests can be created later
          log.error({ leagueId: league!.id, err }, "Failed to auto-create contests");
        }
      }

      return league;
    }),

  generateQuestion: protectedProcedure
    .input(z.object({
      groupName: z.string(),
      tournament: z.string(),
      leagueSize: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch user's region for personalized question
      const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.user.id) });
      const prefs = user?.preferences as { state?: string } | null;
      const userRegion = prefs?.state || null;
      return generateDynamicQuestion(input.groupName, input.tournament, input.leagueSize || 10, userRegion);
    }),

  generateName: protectedProcedure
    .input(z.object({
      format: z.string(),
      template: z.string(),
      tournament: z.string(),
      crewVibe: z.string().optional(),
      groupName: z.string().optional(),
      leagueSize: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch user's region for regional flavor in names
      const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.user.id) });
      const prefs = user?.preferences as { state?: string } | null;
      const userRegion = prefs?.state || null;
      const names = await generateLeagueNameWithAI(
        input.format, input.template, input.tournament,
        { crewVibe: input.crewVibe, groupName: input.groupName, leagueSize: input.leagueSize, userRegion },
      );
      // Ensure all returned names are unique in DB
      const uniqueNames: string[] = [];
      for (const name of names) {
        const unique = await ensureUniqueName(ctx.db, name);
        uniqueNames.push(unique);
      }
      return { names: uniqueNames };
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

      // Auto-create contests for draft/auction leagues when draft starts
      if (league) {
        try {
          const created = await autoCreateContestsForLeague(
            ctx.db,
            input.leagueId,
            league.tournament,
            league.maxMembers,
          );
          log.info({ leagueId: input.leagueId, contestsCreated: created }, "Auto-created contests on draft start");
        } catch (err) {
          log.error({ leagueId: input.leagueId, err }, "Failed to auto-create contests on draft start");
        }
      }

      return room;
    }),

  memberStandings: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get all league contests
      const leagueContests = await ctx.db.query.contests.findMany({
        where: eq(contests.leagueId, input.leagueId),
      });

      if (leagueContests.length === 0) {
        // Fall back: get members and return with 0 points
        const members = await ctx.db.query.leagueMembers.findMany({
          where: eq(leagueMembers.leagueId, input.leagueId),
          with: { user: true },
        });
        return members.map((m, i) => ({
          rank: i + 1,
          userId: m.userId,
          displayName: m.user?.displayName ?? m.user?.username ?? "Unknown",
          totalPoints: 0,
          contestsPlayed: 0,
        }));
      }

      const contestIds = leagueContests.map((c) => c.id);

      // Aggregate points per user across all league contests
      const teamStats = await ctx.db
        .select({
          userId: fantasyTeams.userId,
          displayName: users.displayName,
          username: users.username,
          totalPoints: sql<number>`SUM(${fantasyTeams.totalPoints})`.as("totalPoints"),
          contestsPlayed: sql<number>`COUNT(DISTINCT ${fantasyTeams.contestId})`.as("contestsPlayed"),
        })
        .from(fantasyTeams)
        .innerJoin(users, eq(fantasyTeams.userId, users.id))
        .where(inArray(fantasyTeams.contestId, contestIds))
        .groupBy(fantasyTeams.userId, users.displayName, users.username)
        .orderBy(desc(sql`SUM(${fantasyTeams.totalPoints})`));

      return teamStats.map((s, i) => ({
        rank: i + 1,
        userId: s.userId,
        displayName: s.displayName ?? s.username ?? "Unknown",
        totalPoints: Number(s.totalPoints),
        contestsPlayed: Number(s.contestsPlayed),
      }));
    }),

  leagueContests: protectedProcedure
    .input(z.object({ leagueId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const leagueContestRows = await ctx.db.query.contests.findMany({
        where: eq(contests.leagueId, input.leagueId),
        with: { match: true },
        orderBy: (c, { desc: d }) => [d(c.createdAt)],
      });

      return leagueContestRows.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        entryFee: c.entryFee,
        prizePool: c.prizePool,
        currentEntries: c.currentEntries,
        maxEntries: c.maxEntries,
        contestType: c.contestType,
        match: c.match
          ? {
              id: c.match.id,
              teamHome: c.match.teamHome,
              teamAway: c.match.teamAway,
              startTime: c.match.startTime,
              status: c.match.status,
              venue: c.match.venue,
              format: c.match.format,
              result: c.match.result,
              scoreSummary: c.match.scoreSummary,
              draftEnabled: c.match.draftEnabled,
            }
          : null,
      }));
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
