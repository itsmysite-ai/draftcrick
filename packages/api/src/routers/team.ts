import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { createTeamSchema } from "@draftplay/shared";
import { eq, and, inArray } from "drizzle-orm";
import { fantasyTeams, contests, players, matches, playerMatchScores, leagueMembers } from "@draftplay/db";
import { TRPCError } from "@trpc/server";
import { getPlayerCredits } from "../services/cricket-data";
import { getEffectiveTeamRules } from "../services/admin-config";
import { getTierConfigs } from "../services/subscription";

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
  "No Ball Nightmares", "Duck Dynasty XI", "Caught Behind the Sofa",
  "Boundary Bandits", "Wicket Wizards", "Spin to Win", "Pace & Grace",
  "Six Machine", "Stump Mic Legends", "Third Umpire FC",
  "DRS Delinquents", "Mankad Mafia", "Sledge Hammers",
  "Night Watchmen", "Rain Perera XI", "Free Hit Frenzy",
  "Dot Ball Dealers", "Powerplay Pirates", "Death Over Demons",
  "Sweep Shot Society", "Inside Edge United", "No Run Needed",
  "Review Lost FC", "Dolly Drop XI", "Wide Ball Wonders",
  "Helicopter Shot Heroes", "Yorker Yodelers", "Googly Gang",
  "Reverse Swing Rebels", "Last Over Legends", "Hat Trick Heroes",
  "Stumped & Confused", "Bowled Over Bunch", "Run Out Rascals",
  "LBW Lovers", "Maiden Over Mavericks", "Tail Ender Terrors",
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

function generateTeamName(teamA?: string, teamB?: string): string {
  const cityA = teamA ? getTeamCity(teamA) : null;
  const cityB = teamB ? getTeamCity(teamB) : null;
  const matchCities = [cityA, cityB].filter(Boolean) as string[];

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
    return pick(matchPatterns)();
  }

  return pick(PATTERNS)();
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
          // User already has a team in this contest — create unlinked, they can swap from contest page
          relevantContestId = input.contestId;
          input = { ...input, contestId: undefined };
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

      // Captain and vice-captain validation
      if (input.captainId === input.viceCaptainId) {
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

      // Overseas player limit (0 = disabled, e.g., for international tournaments)
      if (rules.maxOverseas > 0) {
        const overseasCount = playerRecords.filter(
          (p) => p.nationality !== "India"
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
          viceCaptainId: input.viceCaptainId,
          creditsUsed: String(totalCredits),
        })
        .returning();

      return { ...team!, creditsUsed: totalCredits, relevantContestId: relevantContestId ?? team!.contestId ?? undefined };
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

      return {
        ...team,
        totalPoints: Number(team.totalPoints),
        creditsUsed: Number(team.creditsUsed),
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
            wickets: score?.wickets ?? 0,
            catches: score?.catches ?? 0,
          };
        }),
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
            wickets: score?.wickets ?? 0,
            catches: score?.catches ?? 0,
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
});
