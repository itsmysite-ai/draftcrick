import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { createTeamSchema } from "@draftplay/shared";
import { eq, and, inArray, sql } from "drizzle-orm";
import { fantasyTeams, contests, players, matches, playerMatchScores, leagueMembers, users, leagues, draftRooms, draftPicks } from "@draftplay/db";
import { TRPCError } from "@trpc/server";
import { getPlayerCredits } from "../services/cricket-data";
import { getEffectiveTeamRules } from "../services/admin-config";
import { getTierConfigs } from "../services/subscription";
import { deductCoins } from "../services/pop-coins";

// Fun team name generator — multiple patterns for variety
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

const ADJECTIVES = [
  "Royal", "Super", "Mighty", "Thunder", "Golden", "Blazing", "Savage",
  "Electric", "Cosmic", "Fearless", "Turbo", "Phantom", "Storm", "Iron",
  "Shadow", "Mega", "Wild", "Raging", "Supreme", "Ultra", "Mad", "Flying",
  "Atomic", "Dynamic", "Epic", "Rebel", "Wicked", "Bold", "Stealth", "Hyper",
  "Furious", "Mystic", "Lethal", "Daring", "Ruthless", "Fiery", "Neon",
  "Chaos", "Venom", "Frost", "Crimson", "Dark", "Lucky", "Brutal",
];
const ANIMALS = [
  "Wolves", "Panthers", "Lions", "Hawks", "Vipers", "Stallions", "Raptors",
  "Dragons", "Scorpions", "Falcons", "Eagles", "Rhinos", "Jaguars", "Cobras",
  "Sharks", "Tigers", "Pythons", "Gorillas", "Phoenixes", "Yaks", "Owls",
  "Bulls", "Mustangs", "Crows", "Leopards", "Hornets", "Barracudas",
];
const CRICKET = [
  "Strikers", "Warriors", "Titans", "Knights", "Gladiators", "Legends",
  "Chargers", "Spartans", "Mavericks", "Rovers", "Crushers", "Blasters",
  "Challengers", "Hurricanes", "Vikings", "Ninjas", "Avengers", "Raiders",
  "Wreckers", "Sloggers", "Yorkers", "Bouncers", "Sixers", "Spinners",
];
const CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad",
  "Jaipur", "Lucknow", "Pune", "Ahmedabad", "Mohali", "Guwahati",
  "Ranchi", "Vizag", "Dharamsala", "Indore", "Nagpur", "Cuttack",
];
const PREFIXES = [
  "Captain", "Agent", "General", "Lord", "King", "Chief", "Don",
  "Professor", "Dr.", "Sir", "Commander", "Emperor", "Baron",
];
const SUFFIXES = [
  "United", "XI", "FC", "Army", "Squad", "Clan", "Empire", "Force",
  "Legion", "Brigade", "Alliance", "Crew", "Posse", "Gang",
];
const FUNNY = [
  "No Ball Nightmares", "Duck Dynasty XI",
  "Boundary Bandits", "Wicket Wizards", "Spin to Win", "Pace & Grace",
  "Six Machine", "Stump Mic Legends", "Third Umpire FC",
  "DRS Delinquents", "Mankad Mafia", "Sledge Hammers",
  "Night Watchmen", "Rain Perera XI", "Free Hit Frenzy",
  "Dot Ball Dealers", "Powerplay Pirates", "Death Over Demons",
  "Sweep Shot Society", "Inside Edge United", "No Run Needed",
  "Review Lost FC", "Dolly Drop XI", "Wide Ball Wonders",
  "Yorker Yodelers", "Googly Gang",
  "Last Over Legends", "Hat Trick Heroes",
  "Stumped & Confused", "Bowled Over Bunch", "Run Out Rascals",
  "LBW Lovers", "Tail Ender Terrors",
];

const PATTERNS = [
  // "Blazing Tigers"
  () => `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
  // "Royal Sixers"
  () => `${pick(ADJECTIVES)} ${pick(CRICKET)}`,
  // "Mumbai Strikers"
  () => `${pick(CITIES)} ${pick(CRICKET)}`,
  // "Mumbai Lions"
  () => `${pick(CITIES)} ${pick(ANIMALS)}`,
  // "Captain Chaos XI"
  () => `${pick(PREFIXES)} ${pick(ADJECTIVES)} ${pick(SUFFIXES)}`,
  // "Thunder Wolves United"
  () => `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${pick(SUFFIXES)}`,
  // Full funny names
  () => pick(FUNNY),
];

// Short name mapping for IPL/franchise teams
const TEAM_SHORT: Record<string, string> = {
  "chennai super kings": "Chennai", "csk": "Chennai",
  "mumbai indians": "Mumbai", "mi": "Mumbai",
  "royal challengers bengaluru": "Bengaluru", "rcb": "Bengaluru",
  "kolkata knight riders": "Kolkata", "kkr": "Kolkata",
  "sunrisers hyderabad": "Hyderabad", "srh": "Hyderabad",
  "rajasthan royals": "Rajasthan", "rr": "Rajasthan",
  "delhi capitals": "Delhi", "dc": "Delhi",
  "punjab kings": "Punjab", "pbks": "Punjab",
  "lucknow super giants": "Lucknow", "lsg": "Lucknow",
  "gujarat titans": "Gujarat", "gt": "Gujarat",
};

function getTeamCity(teamName: string): string {
  return TEAM_SHORT[teamName.toLowerCase()] ?? teamName.split(" ")[0] ?? teamName;
}

const MAX_TEAM_NAME_LENGTH = 20;

function generateTeamName(teamA?: string, teamB?: string): string {
  const cityA = teamA ? getTeamCity(teamA) : null;
  const cityB = teamB ? getTeamCity(teamB) : null;
  const matchCities = [cityA, cityB].filter(Boolean) as string[];

  let name: string;

  // Match-aware patterns (50% chance when match context available)
  if (matchCities.length > 0 && Math.random() < 0.5) {
    const city = pick(matchCities);
    const matchPatterns = [
      // "Chennai Sixers"
      () => `${city} ${pick(CRICKET)}`,
      // "Mumbai Tigers"
      () => `${city} ${pick(ANIMALS)}`,
      // "Super Chennai XI"
      () => `${pick(ADJECTIVES)} ${city} ${pick(SUFFIXES)}`,
      // "Chennai Blazing Force"
      () => `${city} ${pick(ADJECTIVES)} ${pick(SUFFIXES)}`,
    ];
    name = pick(matchPatterns)();
  } else {
    name = pick(PATTERNS)();
  }

  // Cap at max length — if too long, retry with a simple 2-word pattern
  if (name.length > MAX_TEAM_NAME_LENGTH) {
    name = `${pick(ADJECTIVES)} ${pick(CRICKET)}`;
  }
  return name.slice(0, MAX_TEAM_NAME_LENGTH);
}

export const teamRouter = router({
  /**
   * Create a fantasy team with salary cap validation
   */
  create: protectedProcedure
    .input(createTeamSchema)
    .mutation(async ({ ctx, input }) => {
      // Resolve tournament ID and match teams for per-tournament rules & name generation
      let tournamentId: string | undefined;
      let matchTeamA: string | undefined;
      let matchTeamB: string | undefined;
      let relevantContestId: string | undefined; // contest the user should navigate to, even if not linked
      let contestEntryFee = 0; // entry fee to deduct when linking to a contest

      // If contestId provided, verify contest exists and is open
      if (input.contestId) {
        const contest = await ctx.db.query.contests.findFirst({
          where: eq(contests.id, input.contestId),
          with: { match: true },
        });

        if (!contest) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contest not found" });
        }

        if (contest.status !== "open") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Contest is no longer accepting entries",
          });
        }

        contestEntryFee = contest.entryFee;

        // Resolve tournament and team names from the match
        const matchRecord = contest.match;
        if (matchRecord) {
          if ("tournamentId" in matchRecord) {
            tournamentId = (matchRecord as any).tournamentId ?? undefined;
          }
          matchTeamA = (matchRecord as any).teamHome ?? undefined;
          matchTeamB = (matchRecord as any).teamAway ?? undefined;
        }

        // Check if user already has a team for this contest — skip linking, team will be unlinked
        const existingTeam = await ctx.db.query.fantasyTeams.findFirst({
          where: and(
            eq(fantasyTeams.userId, ctx.user.id),
            eq(fantasyTeams.contestId, input.contestId)
          ),
          columns: { id: true },
        });

        if (existingTeam) {
          // User already has a team in this contest — auto-swap: unlink old, link new
          relevantContestId = input.contestId;
          // Unlink old team from contest
          await ctx.db.update(fantasyTeams).set({ contestId: null }).where(eq(fantasyTeams.id, existingTeam.id));
          // Decrement entry count (the new team will increment it back)
          await ctx.db
            .update(contests)
            .set({ currentEntries: sql`GREATEST(${contests.currentEntries} - 1, 0)` })
            .where(eq(contests.id, input.contestId));
          // Keep contestId so the new team gets linked
        }
      } else if (input.matchId) {
        // Resolve tournament from matchId (when creating team without contest)
        // matchId could be a UUID or an external/AI ID
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.matchId);
        const matchRecord = await ctx.db.query.matches.findFirst({
          where: isUuid
            ? eq(matches.id, input.matchId)
            : eq(matches.externalId, input.matchId),
          columns: { id: true, tournamentId: true, teamHome: true, teamAway: true },
        });
        if (matchRecord) {
          tournamentId = matchRecord.tournamentId ?? undefined;
          matchTeamA = matchRecord.teamHome ?? undefined;
          matchTeamB = matchRecord.teamAway ?? undefined;
          // Normalize matchId to the DB UUID for the insert below
          input = { ...input, matchId: matchRecord.id };

          // Auto-link: find an open contest for this match in a league the user belongs to
          const userLeagues = await ctx.db.query.leagueMembers.findMany({
            where: eq(leagueMembers.userId, ctx.user.id),
            columns: { leagueId: true },
          });
          if (userLeagues.length > 0) {
            const leagueIds = userLeagues.map((l) => l.leagueId);
            const openContest = await ctx.db.query.contests.findFirst({
              where: and(
                eq(contests.matchId, matchRecord.id),
                eq(contests.status, "open"),
                inArray(contests.leagueId, leagueIds),
              ),
            });
            if (openContest) {
              relevantContestId = openContest.id;
              // Check user doesn't already have a team in this contest
              const existing = await ctx.db.query.fantasyTeams.findFirst({
                where: and(
                  eq(fantasyTeams.userId, ctx.user.id),
                  eq(fantasyTeams.contestId, openContest.id),
                ),
              });
              if (!existing) {
                input = { ...input, contestId: openContest.id };
                contestEntryFee = openContest.entryFee;
              }
            }
          }
        }
      }

      // --- Subscription tier: teams-per-match gate ---
      const configs = await getTierConfigs();
      const tier = ctx.tier ?? "basic";
      const teamsPerMatch = configs[tier].features.teamsPerMatch;

      if (teamsPerMatch && input.matchId) {
        // Count all teams this user has for the same match
        const existingTeamsForMatch = await ctx.db.query.fantasyTeams.findMany({
          where: and(
            eq(fantasyTeams.userId, ctx.user.id),
            eq(fantasyTeams.matchId, input.matchId)
          ),
          columns: { id: true },
        });

        if (existingTeamsForMatch.length >= teamsPerMatch) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: JSON.stringify({
              type: "PAYWALL",
              feature: "teamsPerMatch",
              currentTier: tier,
              requiredTier: "pro",
              title: "Team limit reached",
              description: `Your plan allows ${teamsPerMatch} team${teamsPerMatch > 1 ? "s" : ""} per match. Upgrade to create more.`,
            }),
          });
        }
      }

      // Get effective team rules (global + per-tournament overrides)
      const rules = await getEffectiveTeamRules(tournamentId);

      // Vice-captain defaults to captain if not provided (1-player team)
      const effectiveVC = input.viceCaptainId ?? input.captainId;

      // Captain and vice-captain validation (allow same player if only 1 in team)
      if (input.captainId === effectiveVC && input.players.length > 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Captain and vice-captain must be different players",
        });
      }

      const playerIds = input.players.map((p) => p.playerId);
      if (!playerIds.includes(input.captainId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Captain must be in selected players",
        });
      }
      if (!playerIds.includes(input.viceCaptainId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vice-captain must be in selected players",
        });
      }

      // Fetch actual player records for validation
      const playerRecords = await ctx.db.query.players.findMany({
        where: inArray(players.id, playerIds),
      });

      if (playerRecords.length !== 11) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Found ${playerRecords.length} valid players, need exactly 11`,
        });
      }

      // --- Auction/Draft roster enforcement ---
      // In auction or draft leagues, players must come from the user's drafted roster
      const contestForRoster = input.contestId
        ? await ctx.db.query.contests.findFirst({
            where: eq(contests.id, input.contestId),
            columns: { leagueId: true },
          })
        : null;

      if (contestForRoster?.leagueId) {
        const league = await ctx.db.query.leagues.findFirst({
          where: eq(leagues.id, contestForRoster.leagueId),
          columns: { id: true, format: true },
        });

        if (league && (league.format === "auction" || league.format === "draft")) {
          const draftRoom = await ctx.db.query.draftRooms.findFirst({
            where: and(
              eq(draftRooms.leagueId, league.id),
              eq(draftRooms.status, "completed"),
            ),
            columns: { id: true },
          });

          if (!draftRoom) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Draft has not been completed for this league yet",
            });
          }

          const userPicks = await ctx.db.query.draftPicks.findMany({
            where: and(
              eq(draftPicks.roomId, draftRoom.id),
              eq(draftPicks.userId, ctx.user.id),
            ),
            columns: { playerId: true },
          });
          const rosterPlayerIds = new Set(userPicks.map((p) => p.playerId));

          const invalidPlayers = playerIds.filter((id) => !rosterPlayerIds.has(id));
          if (invalidPlayers.length > 0) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `${invalidPlayers.length} player(s) are not in your drafted roster`,
            });
          }
        }
      }

      // Role count validation
      const roleCounts: Record<string, number> = {};
      for (const p of input.players) {
        roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1;
      }

      for (const [role, limits] of Object.entries(rules.roleLimits)) {
        const count = roleCounts[role] ?? 0;
        if (count < limits.min) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Need at least ${limits.min} ${role.replace("_", " ")}(s), have ${count}`,
          });
        }
        if (count > limits.max) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Max ${limits.max} ${role.replace("_", " ")}(s) allowed, have ${count}`,
          });
        }
      }

      // Team count validation
      const teamCounts: Record<string, number> = {};
      for (const p of playerRecords) {
        teamCounts[p.team] = (teamCounts[p.team] ?? 0) + 1;
      }
      for (const [team, count] of Object.entries(teamCounts)) {
        if (count > rules.maxFromOneTeam) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Max ${rules.maxFromOneTeam} players from ${team}, have ${count}`,
          });
        }
      }

      // Overseas player limit — check tournament-level overseasRule first
      const overseasRule = (rules as any).overseasRule as { enabled: boolean; hostCountry: string } | undefined;
      const overseasEnabled = overseasRule ? overseasRule.enabled : (rules.maxOverseas > 0);
      if (overseasEnabled && rules.maxOverseas > 0) {
        const hostCountry = overseasRule?.hostCountry || "India";
        const overseasCount = playerRecords.filter(
          (p) => p.nationality && p.nationality.toLowerCase() !== hostCountry.toLowerCase()
        ).length;
        if (overseasCount > rules.maxOverseas) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Max ${rules.maxOverseas} overseas players, have ${overseasCount}`,
          });
        }
      }

      // Budget validation
      let totalCredits = 0;
      for (const p of playerRecords) {
        totalCredits += getPlayerCredits(p.stats as Record<string, unknown>);
      }

      if (totalCredits > rules.maxBudget) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Budget exceeded. Used ${totalCredits.toFixed(1)} / ${rules.maxBudget} credits`,
        });
      }

      // Auto-generate fun team name if not provided
      let teamName = input.name?.trim() || "";
      if (!teamName) {
        // Count existing teams for this user + match to create numbered names
        const existingTeams = await ctx.db.query.fantasyTeams.findMany({
          where: and(
            eq(fantasyTeams.userId, ctx.user.id),
            input.matchId ? eq(fantasyTeams.matchId, input.matchId) : undefined,
          ),
          columns: { id: true },
        });
        const teamNum = existingTeams.length + 1;
        teamName = teamNum === 1
          ? generateTeamName(matchTeamA, matchTeamB)
          : `${generateTeamName(matchTeamA, matchTeamB)} #${teamNum}`;
      }

      // Deduct entry fee before creating the team
      if (input.contestId && contestEntryFee > 0) {
        try {
          await deductCoins(ctx.db, ctx.user.id, contestEntryFee, "contest_entry", {
            contestId: input.contestId,
          });
        } catch (e: any) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: e.message || "Insufficient Pop Coins for entry fee",
          });
        }
      }

      const [team] = await ctx.db
        .insert(fantasyTeams)
        .values({
          userId: ctx.user.id,
          name: teamName,
          contestId: input.contestId ?? null,
          matchId: input.matchId ?? null,
          players: input.players.map((p) => ({
            playerId: p.playerId,
            role: p.role,
            isPlaying: false,
          })),
          captainId: input.captainId,
          viceCaptainId: effectiveVC,
          creditsUsed: String(totalCredits),
        })
        .returning();

      // Increment contest entry count
      if (input.contestId) {
        await ctx.db
          .update(contests)
          .set({ currentEntries: sql`${contests.currentEntries} + 1` })
          .where(eq(contests.id, input.contestId));

        // Notify other league members that a team was created
        const contestRecord = await ctx.db.query.contests.findFirst({
          where: eq(contests.id, input.contestId),
          columns: { leagueId: true, name: true },
        });
        if (contestRecord?.leagueId) {
          const members = await ctx.db.query.leagueMembers.findMany({
            where: eq(leagueMembers.leagueId, contestRecord.leagueId),
            columns: { userId: true },
          });
          const otherMemberIds = members.map((m) => m.userId).filter((uid) => uid !== ctx.user.id);
          if (otherMemberIds.length > 0) {
            const userName = (ctx.user as any).displayName || (ctx.user as any).username || "A league member";
            import("../services/notifications").then(({ sendBatchNotifications, NOTIFICATION_TYPES }) => {
              sendBatchNotifications(
                ctx.db,
                otherMemberIds,
                NOTIFICATION_TYPES.TEAM_CREATED,
                "Team Created!",
                `${userName} created their team for "${contestRecord.name ?? "a contest"}". Create yours before the match starts!`,
                { contestId: input.contestId, leagueId: contestRecord.leagueId },
              ).catch(() => {});
            }).catch(() => {});
          }
        }
      }

      return { ...team!, creditsUsed: totalCredits, relevantContestId: relevantContestId ?? team!.contestId ?? undefined };
    }),

  /**
   * Update an existing team's players, captain, VC (before match goes live).
   */
  update: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      name: z.string().max(30).optional(),
      players: z.array(z.object({
        playerId: z.string().uuid(),
        role: z.enum(["batsman", "bowler", "all_rounder", "wicket_keeper"]),
      })).min(1).max(11),
      captainId: z.string().uuid(),
      viceCaptainId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify team belongs to user
      const team = await ctx.db.query.fantasyTeams.findFirst({
        where: and(eq(fantasyTeams.id, input.teamId), eq(fantasyTeams.userId, ctx.user.id)),
        with: { contest: { columns: { id: true, status: true, matchId: true } } },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });

      // Only allow edits when contest is still open (or team has no contest)
      const contestStatus = (team as any).contest?.status;
      if (contestStatus && contestStatus !== "open") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit team — contest is no longer open" });
      }

      const effectiveVC = input.viceCaptainId ?? input.captainId;
      if (input.captainId === effectiveVC && input.players!.length > 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Captain and vice-captain must be different" });
      }

      const playerIds = input.players!.map((p) => p.playerId);
      if (!playerIds.includes(input.captainId) || !playerIds.includes(effectiveVC)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Captain and VC must be in selected players" });
      }

      // Validate players exist
      const playerRecords = await ctx.db.query.players.findMany({
        where: inArray(players.id, playerIds),
      });
      if (playerRecords.length !== 11) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Found ${playerRecords.length} valid players, need 11` });
      }

      // Budget validation
      let totalCredits = 0;
      for (const p of playerRecords) {
        totalCredits += getPlayerCredits(p.stats as Record<string, unknown>);
      }
      const rules = await getEffectiveTeamRules(undefined);
      if (totalCredits > rules.maxBudget) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Budget exceeded: ${totalCredits.toFixed(1)} / ${rules.maxBudget}` });
      }

      // Update team
      const [updated] = await ctx.db
        .update(fantasyTeams)
        .set({
          name: input.name?.trim() || team.name,
          players: input.players.map((p) => ({ playerId: p.playerId, role: p.role, isPlaying: false })),
          captainId: input.captainId,
          viceCaptainId: effectiveVC,
          creditsUsed: String(totalCredits),
          updatedAt: new Date(),
        })
        .where(eq(fantasyTeams.id, input.teamId))
        .returning();

      return { ...updated!, creditsUsed: totalCredits };
    }),

  /**
   * Get user's team for a specific contest
   */
  getByContest: protectedProcedure
    .input(z.object({ contestId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.query.fantasyTeams.findFirst({
        where: and(
          eq(fantasyTeams.userId, ctx.user.id),
          eq(fantasyTeams.contestId, input.contestId)
        ),
        with: { contest: { columns: { matchId: true } } },
      });

      if (!team) return null;

      // Fetch player details
      const teamPlayers = team.players as Array<{
        playerId: string;
        role: string;
      }>;
      const playerIds = teamPlayers.map((p) => p.playerId);
      const playerRecords = await ctx.db.query.players.findMany({
        where: inArray(players.id, playerIds),
      });

      // Fetch per-player fantasy points from match scores
      const matchId = (team as any).contest?.matchId ?? team.matchId;
      const scores = matchId
        ? await ctx.db.query.playerMatchScores.findMany({
            where: and(
              eq(playerMatchScores.matchId, matchId),
              inArray(playerMatchScores.playerId, playerIds)
            ),
          })
        : [];
      const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

      // Compute live total from player scores (instead of stale DB value)
      const playerDetails = playerRecords.map((p) => {
        const score = scoreMap.get(p.id);
        const pts = Number(score?.fantasyPoints ?? 0);
        const isCaptain = p.id === team.captainId;
        const isViceCaptain = p.id === team.viceCaptainId;
        const multiplier = isCaptain ? 2 : isViceCaptain ? 1.5 : 1;
        return {
          ...p,
          credits: getPlayerCredits(p.stats as Record<string, unknown>),
          isCaptain,
          isViceCaptain,
          fantasyPoints: pts,
          contribution: pts * multiplier,
            runs: score?.runs ?? 0,
            ballsFaced: score?.ballsFaced ?? 0,
            fours: score?.fours ?? 0,
            sixes: score?.sixes ?? 0,
            wickets: score?.wickets ?? 0,
            oversBowled: Number(score?.oversBowled ?? 0),
            runsConceded: score?.runsConceded ?? 0,
            maidens: score?.maidens ?? 0,
            catches: score?.catches ?? 0,
            stumpings: score?.stumpings ?? 0,
            runOuts: score?.runOuts ?? 0,
          };
        });

      // Sum live points from player contributions + prediction points
      const predPts = Number(team.predictionPoints ?? 0);
      const liveTotal = scores.length > 0
        ? Math.round((playerDetails.reduce((sum, p) => sum + p.contribution, 0) + predPts) * 100) / 100
        : Number(team.totalPoints);

      return {
        ...team,
        totalPoints: liveTotal,
        creditsUsed: Number(team.creditsUsed),
        playerDetails,
      };
    }),

  /**
   * Get a team by ID (must belong to the current user)
   */
  getById: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.query.fantasyTeams.findFirst({
        where: and(
          eq(fantasyTeams.id, input.teamId),
          eq(fantasyTeams.userId, ctx.user.id)
        ),
        with: {
          contest: { columns: { matchId: true, name: true, status: true, prizePool: true, entryFee: true } },
        },
      });

      if (!team) return null;

      // Fetch player details
      const teamPlayers = team.players as Array<{ playerId: string; role: string }>;
      const playerIds = teamPlayers.map((p) => p.playerId);
      const playerRecords = await ctx.db.query.players.findMany({
        where: inArray(players.id, playerIds),
      });

      // Fetch match info
      const matchId = (team as any).contest?.matchId ?? team.matchId;
      let matchRecord = null;
      if (matchId) {
        matchRecord = await ctx.db.query.matches.findFirst({
          where: eq(matches.id, matchId),
          columns: { id: true, teamHome: true, teamAway: true, status: true, result: true, scoreSummary: true, startTime: true, tournamentId: true },
        });
      }

      // Fetch per-player fantasy points from match scores
      const scores = matchId
        ? await ctx.db.query.playerMatchScores.findMany({
            where: and(
              eq(playerMatchScores.matchId, matchId),
              inArray(playerMatchScores.playerId, playerIds)
            ),
          })
        : [];
      const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

      return {
        ...team,
        totalPoints: Number(team.totalPoints),
        creditsUsed: Number(team.creditsUsed),
        match: matchRecord,
        playerDetails: playerRecords.map((p) => {
          const score = scoreMap.get(p.id);
          const pts = Number(score?.fantasyPoints ?? 0);
          const isCaptain = p.id === team.captainId;
          const isViceCaptain = p.id === team.viceCaptainId;
          const multiplier = isCaptain ? 2 : isViceCaptain ? 1.5 : 1;
          return {
            ...p,
            credits: getPlayerCredits(p.stats as Record<string, unknown>),
            isCaptain,
            isViceCaptain,
            fantasyPoints: pts,
            contribution: pts * multiplier,
            runs: score?.runs ?? 0,
            ballsFaced: score?.ballsFaced ?? 0,
            fours: score?.fours ?? 0,
            sixes: score?.sixes ?? 0,
            wickets: score?.wickets ?? 0,
            oversBowled: Number(score?.oversBowled ?? 0),
            runsConceded: score?.runsConceded ?? 0,
            maidens: score?.maidens ?? 0,
            catches: score?.catches ?? 0,
            stumpings: score?.stumpings ?? 0,
            runOuts: score?.runOuts ?? 0,
          };
        }),
      };
    }),

  /**
   * Swap a different team into a contest (must be same match, owned by user)
   */
  swapTeam: protectedProcedure
    .input(z.object({ contestId: z.string().uuid(), newTeamId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify contest exists and is open
      const contest = await ctx.db.query.contests.findFirst({
        where: eq(contests.id, input.contestId),
        columns: { id: true, matchId: true, status: true },
      });
      if (!contest) throw new TRPCError({ code: "NOT_FOUND", message: "Contest not found" });
      if (contest.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "Contest is no longer accepting changes" });

      // Verify the new team belongs to user and is for the same match
      const newTeam = await ctx.db.query.fantasyTeams.findFirst({
        where: and(eq(fantasyTeams.id, input.newTeamId), eq(fantasyTeams.userId, ctx.user.id)),
        columns: { id: true, matchId: true, contestId: true },
      });
      if (!newTeam) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      if (newTeam.matchId !== contest.matchId) throw new TRPCError({ code: "BAD_REQUEST", message: "Team is for a different match" });

      // Unlink current team from contest (if any)
      const currentTeam = await ctx.db.query.fantasyTeams.findFirst({
        where: and(eq(fantasyTeams.userId, ctx.user.id), eq(fantasyTeams.contestId, input.contestId)),
        columns: { id: true },
      });
      if (currentTeam) {
        await ctx.db.update(fantasyTeams).set({ contestId: null }).where(eq(fantasyTeams.id, currentTeam.id));
      }

      // Link new team to contest
      await ctx.db.update(fantasyTeams).set({ contestId: input.contestId }).where(eq(fantasyTeams.id, input.newTeamId));

      return { swapped: true, previousTeamId: currentTeam?.id ?? null };
    }),

  /**
   * Get all of user's teams
   */
  myTeams: protectedProcedure.query(async ({ ctx }) => {
    const teams = await ctx.db.query.fantasyTeams.findMany({
      where: eq(fantasyTeams.userId, ctx.user.id),
      with: {
        contest: { with: { match: true } },
      },
    });

    return teams.map((t) => ({
      ...t,
      totalPoints: Number(t.totalPoints),
      creditsUsed: Number(t.creditsUsed),
    }));
  }),

  /**
   * Get resolved player details for a specific team (names, roles, credits)
   */
  getTeamPlayers: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.query.fantasyTeams.findFirst({
        where: and(eq(fantasyTeams.id, input.teamId), eq(fantasyTeams.userId, ctx.user.id)),
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });

      const playerEntries = (team.players as Array<{ playerId: string; role?: string }>) ?? [];
      if (playerEntries.length === 0) return [];

      const playerIds = playerEntries.map((p) => p.playerId);
      const playerRows = await ctx.db.query.players.findMany({
        where: inArray(players.id, playerIds),
      });

      const playerMap = new Map(playerRows.map((p) => [p.id, p]));
      return playerEntries.map((entry) => {
        const player = playerMap.get(entry.playerId);
        return {
          playerId: entry.playerId,
          name: player?.name ?? "Unknown",
          role: player?.role ?? entry.role ?? "all_rounder",
          credits: player?.stats && typeof player.stats === "object" && "credits" in (player.stats as any) ? Number((player.stats as any).credits) : 8,
          isCaptain: entry.playerId === team.captainId,
          isViceCaptain: entry.playerId === team.viceCaptainId,
        };
      });
    }),

  /**
   * Generate AI-powered team names — single call, no questions needed.
   * Uses match context + user profile + region for personalized names.
   */
  generateTeamNames: protectedProcedure
    .input(z.object({
      teamA: z.string(),
      teamB: z.string(),
      tournament: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.query.users.findFirst({ where: eq(users.id, ctx.user.id) });
      const prefs = user?.preferences as { state?: string } | null;
      const displayName = user?.displayName || "player";
      const userRegion = prefs?.state || null;

      const STATE_CODE_MAP: Record<string, string> = {
        "AP": "andhra pradesh", "TN": "tamil nadu", "KA": "karnataka", "KL": "kerala",
        "MH": "maharashtra", "TG": "telangana", "TS": "telangana", "WB": "west bengal",
        "GJ": "gujarat", "RJ": "rajasthan", "PB": "punjab", "DL": "delhi",
        "UP": "uttar pradesh", "BR": "bihar", "JH": "jharkhand", "HR": "haryana",
        "OD": "odisha", "AS": "assam", "GA": "goa", "HP": "himachal pradesh",
      };
      const resolvedRegion = userRegion
        ? (STATE_CODE_MAP[userRegion.toUpperCase()] || userRegion.toLowerCase())
        : null;

      const regionHint = resolvedRegion
        ? `User is from ${resolvedRegion}. Use YOUR OWN KNOWLEDGE to give 1-2 names a ${resolvedRegion} flavor — a local word, cricket slang from the region, or a cultural nod. Be creative, don't just use the obvious references.`
        : "";

      const { createGeminiClient } = await import("../services/gemini-client");
      const ai = await createGeminiClient(process.env.GEMINI_DEFAULT_REGION || "IN");

      const prompt = `Generate 5 fantasy cricket team names for ${input.teamA} vs ${input.teamB} (${input.tournament}).

ABOUT THE USER:
- Name: ${displayName}
${regionHint}

NAME RULES:
- MAX 3 WORDS (20 chars max). Short & punchy.
- This is a PERSONAL team name — the user's alter ego or team identity
- All 5 must feel STRUCTURALLY DIFFERENT:
  1. A cricket term/pun (e.g. "Yorker Yodas", "Six Machine")
  2. A match/team reference using "${input.teamA.split(" ")[0]}" or "${input.teamB.split(" ")[0]}"
  3. A name mashup using "${displayName}" creatively (e.g. "${displayName}'s Army")
  4. One with regional flavor (if region known) or local cricket culture
  5. One wildcard — funny, unexpected, meme-worthy
- Think: WhatsApp cricket group name energy, fantasy team banter, IPL nickname vibes
- NO "XI" suffix on every name. Vary the format.
- DO NOT repeat the same structure twice.

Return ONLY a JSON array of 5 strings:`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text?.trim() ?? "";
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
        return { names: [generateTeamName(input.teamA, input.teamB)] };
      }

      try {
        const parsed = JSON.parse(match[0]) as string[];
        const valid = parsed.filter((n) => typeof n === "string" && n.length > 0 && n.length <= 30);
        if (valid.length >= 3) return { names: valid.slice(0, 5) };
      } catch {}

      return { names: [generateTeamName(input.teamA, input.teamB)] };
    }),

  /**
   * Get any team's player details by team ID (public — for leaderboard expansion).
   * Returns team name, players with scores, captain/VC info.
   */
  getTeamDetails: publicProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.query.fantasyTeams.findFirst({
        where: eq(fantasyTeams.id, input.teamId),
        with: { contest: { columns: { matchId: true, status: true } } },
      });
      if (!team) return null;

      // Don't expose other users' players while contest is still open
      const contestStatus = (team as any).contest?.status;
      const isOwnTeam = (ctx as any).user?.id === team.userId;
      if (contestStatus === "open" && !isOwnTeam) {
        return { id: team.id, name: team.name, captainId: null, viceCaptainId: null, totalPoints: 0, playerDetails: [] };
      }

      const teamPlayers = team.players as Array<{ playerId: string; role: string }>;
      const playerIds = teamPlayers.map((p) => p.playerId);
      if (playerIds.length === 0) return { ...team, playerDetails: [] };

      const playerRecords = await ctx.db.query.players.findMany({
        where: inArray(players.id, playerIds),
      });

      const matchId = (team as any).contest?.matchId ?? team.matchId;
      const scores = matchId
        ? await ctx.db.query.playerMatchScores.findMany({
            where: and(
              eq(playerMatchScores.matchId, matchId),
              inArray(playerMatchScores.playerId, playerIds)
            ),
          })
        : [];
      const scoreMap = new Map(scores.map((s) => [s.playerId, s]));

      const playerDetails = playerRecords.map((p) => {
        const score = scoreMap.get(p.id);
        const pts = Number(score?.fantasyPoints ?? 0);
        const isCaptain = p.id === team.captainId;
        const isViceCaptain = p.id === team.viceCaptainId;
        const multiplier = isCaptain ? 2 : isViceCaptain ? 1.5 : 1;
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          team: p.team,
          photoUrl: (p as any).photoUrl ?? null,
          isCaptain,
          isViceCaptain,
          fantasyPoints: pts,
          contribution: pts * multiplier,
          runs: score?.runs ?? 0,
          ballsFaced: score?.ballsFaced ?? 0,
          fours: score?.fours ?? 0,
          sixes: score?.sixes ?? 0,
          wickets: score?.wickets ?? 0,
          oversBowled: Number(score?.oversBowled ?? 0),
          runsConceded: score?.runsConceded ?? 0,
          maidens: score?.maidens ?? 0,
          catches: score?.catches ?? 0,
          stumpings: score?.stumpings ?? 0,
          runOuts: score?.runOuts ?? 0,
        };
      });

      return {
        id: team.id,
        name: team.name,
        captainId: team.captainId,
        viceCaptainId: team.viceCaptainId,
        totalPoints: Number(team.totalPoints),
        playerDetails,
      };
    }),
});
