import type { Database } from "@draftplay/db";
import { matches, players, playerMatchScores, playerStatuses, contests, leagues, users } from "@draftplay/db";

/**
 * Cricket data service — ingests match/player data.
 * In production this will call CricAPI/SportRadar via MCP.
 * For development, provides seed data.
 */

// IPL 2026 teams with their squad
const IPL_TEAMS = {
  CSK: "Chennai Super Kings",
  MI: "Mumbai Indians",
  RCB: "Royal Challengers Bengaluru",
  KKR: "Kolkata Knight Riders",
  DC: "Delhi Capitals",
  SRH: "Sunrisers Hyderabad",
  PBKS: "Punjab Kings",
  GT: "Gujarat Titans",
  LSG: "Lucknow Super Giants",
  RR: "Rajasthan Royals",
} as const;

interface SeedPlayer {
  name: string;
  team: string;
  role: "batsman" | "bowler" | "all_rounder" | "wicket_keeper";
  credits: number;
  nationality: string;
  battingStyle?: string;
  bowlingStyle?: string;
}

// Representative player pool for development
const SEED_PLAYERS: SeedPlayer[] = [
  // CSK
  { name: "MS Dhoni", team: "CSK", role: "wicket_keeper", credits: 8.5, nationality: "India", battingStyle: "Right-hand" },
  { name: "Ruturaj Gaikwad", team: "CSK", role: "batsman", credits: 9.5, nationality: "India", battingStyle: "Right-hand" },
  { name: "Devon Conway", team: "CSK", role: "batsman", credits: 9.0, nationality: "New Zealand", battingStyle: "Left-hand" },
  { name: "Shivam Dube", team: "CSK", role: "all_rounder", credits: 8.5, nationality: "India", battingStyle: "Left-hand", bowlingStyle: "Right-arm medium" },
  { name: "Ravindra Jadeja", team: "CSK", role: "all_rounder", credits: 9.0, nationality: "India", battingStyle: "Left-hand", bowlingStyle: "Left-arm orthodox" },
  { name: "Deepak Chahar", team: "CSK", role: "bowler", credits: 8.0, nationality: "India", bowlingStyle: "Right-arm medium-fast" },
  { name: "Matheesha Pathirana", team: "CSK", role: "bowler", credits: 8.5, nationality: "Sri Lanka", bowlingStyle: "Right-arm fast" },
  // MI
  { name: "Rohit Sharma", team: "MI", role: "batsman", credits: 10.0, nationality: "India", battingStyle: "Right-hand" },
  { name: "Suryakumar Yadav", team: "MI", role: "batsman", credits: 10.0, nationality: "India", battingStyle: "Right-hand" },
  { name: "Ishan Kishan", team: "MI", role: "wicket_keeper", credits: 8.5, nationality: "India", battingStyle: "Left-hand" },
  { name: "Hardik Pandya", team: "MI", role: "all_rounder", credits: 9.5, nationality: "India", battingStyle: "Right-hand", bowlingStyle: "Right-arm fast-medium" },
  { name: "Jasprit Bumrah", team: "MI", role: "bowler", credits: 10.0, nationality: "India", bowlingStyle: "Right-arm fast" },
  { name: "Tim David", team: "MI", role: "all_rounder", credits: 8.5, nationality: "Australia", battingStyle: "Right-hand" },
  // RCB
  { name: "Virat Kohli", team: "RCB", role: "batsman", credits: 10.5, nationality: "India", battingStyle: "Right-hand" },
  { name: "Faf du Plessis", team: "RCB", role: "batsman", credits: 9.0, nationality: "South Africa", battingStyle: "Right-hand" },
  { name: "Glenn Maxwell", team: "RCB", role: "all_rounder", credits: 9.0, nationality: "Australia", battingStyle: "Right-hand", bowlingStyle: "Right-arm off break" },
  { name: "Dinesh Karthik", team: "RCB", role: "wicket_keeper", credits: 7.5, nationality: "India", battingStyle: "Right-hand" },
  { name: "Mohammed Siraj", team: "RCB", role: "bowler", credits: 8.5, nationality: "India", bowlingStyle: "Right-arm fast" },
  { name: "Wanindu Hasaranga", team: "RCB", role: "all_rounder", credits: 9.0, nationality: "Sri Lanka", bowlingStyle: "Right-arm leg break" },
  // KKR
  { name: "Shreyas Iyer", team: "KKR", role: "batsman", credits: 9.0, nationality: "India", battingStyle: "Right-hand" },
  { name: "Andre Russell", team: "KKR", role: "all_rounder", credits: 9.5, nationality: "West Indies", battingStyle: "Right-hand", bowlingStyle: "Right-arm fast" },
  { name: "Sunil Narine", team: "KKR", role: "all_rounder", credits: 9.0, nationality: "West Indies", bowlingStyle: "Right-arm off break" },
  { name: "Phil Salt", team: "KKR", role: "wicket_keeper", credits: 9.0, nationality: "England", battingStyle: "Right-hand" },
  { name: "Varun Chakaravarthy", team: "KKR", role: "bowler", credits: 8.0, nationality: "India", bowlingStyle: "Right-arm leg break" },
  { name: "Mitchell Starc", team: "KKR", role: "bowler", credits: 9.5, nationality: "Australia", bowlingStyle: "Left-arm fast" },
  // DC
  { name: "David Warner", team: "DC", role: "batsman", credits: 9.5, nationality: "Australia", battingStyle: "Left-hand" },
  { name: "Rishabh Pant", team: "DC", role: "wicket_keeper", credits: 10.0, nationality: "India", battingStyle: "Left-hand" },
  { name: "Axar Patel", team: "DC", role: "all_rounder", credits: 8.5, nationality: "India", bowlingStyle: "Left-arm orthodox" },
  { name: "Kuldeep Yadav", team: "DC", role: "bowler", credits: 8.5, nationality: "India", bowlingStyle: "Left-arm wrist spin" },
  { name: "Anrich Nortje", team: "DC", role: "bowler", credits: 8.5, nationality: "South Africa", bowlingStyle: "Right-arm fast" },
  // SRH
  { name: "Travis Head", team: "SRH", role: "batsman", credits: 9.5, nationality: "Australia", battingStyle: "Left-hand" },
  { name: "Heinrich Klaasen", team: "SRH", role: "wicket_keeper", credits: 9.5, nationality: "South Africa", battingStyle: "Right-hand" },
  { name: "Pat Cummins", team: "SRH", role: "bowler", credits: 9.5, nationality: "Australia", bowlingStyle: "Right-arm fast" },
  { name: "Abhishek Sharma", team: "SRH", role: "all_rounder", credits: 8.0, nationality: "India", battingStyle: "Left-hand", bowlingStyle: "Left-arm orthodox" },
  { name: "Bhuvneshwar Kumar", team: "SRH", role: "bowler", credits: 8.0, nationality: "India", bowlingStyle: "Right-arm medium-fast" },
  // PBKS
  { name: "Shikhar Dhawan", team: "PBKS", role: "batsman", credits: 8.5, nationality: "India", battingStyle: "Left-hand" },
  { name: "Sam Curran", team: "PBKS", role: "all_rounder", credits: 9.0, nationality: "England", bowlingStyle: "Left-arm medium-fast" },
  { name: "Liam Livingstone", team: "PBKS", role: "all_rounder", credits: 8.5, nationality: "England", battingStyle: "Right-hand", bowlingStyle: "Right-arm leg break" },
  { name: "Jonny Bairstow", team: "PBKS", role: "wicket_keeper", credits: 8.5, nationality: "England", battingStyle: "Right-hand" },
  { name: "Kagiso Rabada", team: "PBKS", role: "bowler", credits: 9.0, nationality: "South Africa", bowlingStyle: "Right-arm fast" },
  // GT
  { name: "Shubman Gill", team: "GT", role: "batsman", credits: 9.5, nationality: "India", battingStyle: "Right-hand" },
  { name: "Rashid Khan", team: "GT", role: "all_rounder", credits: 9.5, nationality: "Afghanistan", bowlingStyle: "Right-arm leg break" },
  { name: "Wriddhiman Saha", team: "GT", role: "wicket_keeper", credits: 7.0, nationality: "India", battingStyle: "Right-hand" },
  { name: "Mohammed Shami", team: "GT", role: "bowler", credits: 9.0, nationality: "India", bowlingStyle: "Right-arm fast-medium" },
  { name: "David Miller", team: "GT", role: "batsman", credits: 8.5, nationality: "South Africa", battingStyle: "Left-hand" },
  // LSG
  { name: "KL Rahul", team: "LSG", role: "wicket_keeper", credits: 10.0, nationality: "India", battingStyle: "Right-hand" },
  { name: "Quinton de Kock", team: "LSG", role: "wicket_keeper", credits: 9.0, nationality: "South Africa", battingStyle: "Left-hand" },
  { name: "Marcus Stoinis", team: "LSG", role: "all_rounder", credits: 8.5, nationality: "Australia", battingStyle: "Right-hand", bowlingStyle: "Right-arm medium" },
  { name: "Mark Wood", team: "LSG", role: "bowler", credits: 8.5, nationality: "England", bowlingStyle: "Right-arm fast" },
  // RR
  { name: "Jos Buttler", team: "RR", role: "wicket_keeper", credits: 10.0, nationality: "England", battingStyle: "Right-hand" },
  { name: "Sanju Samson", team: "RR", role: "wicket_keeper", credits: 9.0, nationality: "India", battingStyle: "Right-hand" },
  { name: "Yashasvi Jaiswal", team: "RR", role: "batsman", credits: 9.5, nationality: "India", battingStyle: "Left-hand" },
  { name: "Trent Boult", team: "RR", role: "bowler", credits: 8.5, nationality: "New Zealand", bowlingStyle: "Left-arm fast" },
  { name: "Yuzvendra Chahal", team: "RR", role: "bowler", credits: 8.5, nationality: "India", bowlingStyle: "Right-arm leg break" },
  { name: "Shimron Hetmyer", team: "RR", role: "batsman", credits: 8.0, nationality: "West Indies", battingStyle: "Left-hand" },
];

/**
 * Seed the database with IPL 2026 fixtures and player data.
 * Used for local development when no CricAPI is available.
 */
export async function seedCricketData(db: Database) {
  console.log("Seeding cricket data...");

  // Seed players
  const seededPlayers = [];
  for (const p of SEED_PLAYERS) {
    const [player] = await db
      .insert(players)
      .values({
        externalId: `seed-${p.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: p.name,
        team: p.team,
        role: p.role,
        nationality: p.nationality,
        battingStyle: p.battingStyle ?? null,
        bowlingStyle: p.bowlingStyle ?? null,
        stats: { credits: p.credits },
      })
      .onConflictDoNothing({ target: players.externalId })
      .returning();
    if (player) seededPlayers.push(player);
  }
  console.log(`  Seeded ${seededPlayers.length} players`);

  // Seed upcoming IPL 2026 matches
  const matchPairs = [
    { home: "CSK", away: "MI", venue: "MA Chidambaram Stadium", city: "Chennai", hoursFromNow: 2 },
    { home: "RCB", away: "KKR", venue: "M. Chinnaswamy Stadium", city: "Bengaluru", hoursFromNow: 26 },
    { home: "DC", away: "SRH", venue: "Arun Jaitley Stadium", city: "Delhi", hoursFromNow: 50 },
    { home: "GT", away: "RR", venue: "Narendra Modi Stadium", city: "Ahmedabad", hoursFromNow: 74 },
    { home: "PBKS", away: "LSG", venue: "IS Bindra Stadium", city: "Mohali", hoursFromNow: 98 },
    { home: "MI", away: "RCB", venue: "Wankhede Stadium", city: "Mumbai", hoursFromNow: 122 },
    { home: "KKR", away: "CSK", venue: "Eden Gardens", city: "Kolkata", hoursFromNow: 146 },
    { home: "SRH", away: "GT", venue: "Rajiv Gandhi Intl Stadium", city: "Hyderabad", hoursFromNow: 170 },
  ];

  const seededMatches = [];
  for (const m of matchPairs) {
    const startTime = new Date(Date.now() + m.hoursFromNow * 3600_000);
    const [match] = await db
      .insert(matches)
      .values({
        externalId: `ipl-2026-${m.home.toLowerCase()}-${m.away.toLowerCase()}-${m.hoursFromNow}`,
        sport: "cricket",
        format: "t20",
        tournament: "IPL 2026",
        teamHome: m.home,
        teamAway: m.away,
        venue: m.venue,
        city: m.city,
        startTime,
        status: m.hoursFromNow < 3 ? "upcoming" : "upcoming",
      })
      .onConflictDoNothing({ target: matches.externalId })
      .returning();
    if (match) seededMatches.push(match);
  }
  console.log(`  Seeded ${seededMatches.length} matches`);

  // Seed player-match associations for first match
  // Use newly seeded match or find existing CSK vs MI match
  const allDbPlayers = seededPlayers.length > 0 ? seededPlayers : await db.query.players.findMany();
  let targetMatch = seededMatches[0];
  if (!targetMatch) {
    // Find existing CSK vs MI match
    const existingMatch = await db.query.matches.findFirst({
      where: (m, { and, eq }) => and(eq(m.teamHome, "CSK"), eq(m.teamAway, "MI")),
    });
    targetMatch = existingMatch ?? undefined;
  }
  if (targetMatch && allDbPlayers.length > 0) {
    const matchPlayers = allDbPlayers.filter(
      (p) => p.team === "CSK" || p.team === "MI"
    );
    let linkedCount = 0;
    for (const player of matchPlayers) {
      const [inserted] = await db
        .insert(playerMatchScores)
        .values({
          playerId: player.id,
          matchId: targetMatch.id,
          isPlaying: true,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted) linkedCount++;
    }
    console.log(`  Linked ${linkedCount} players to match ${targetMatch.id.substring(0, 8)} (${matchPlayers.length} total)`);
  }

  // Seed World Cup 2026 matches (draft-enabled)
  const wcMatchPairs = [
    { home: "India", away: "Australia", venue: "Narendra Modi Stadium", city: "Ahmedabad", hoursFromNow: 240 },
    { home: "England", away: "South Africa", venue: "Lord's Cricket Ground", city: "London", hoursFromNow: 264 },
    { home: "India", away: "England", venue: "Eden Gardens", city: "Kolkata", hoursFromNow: 288 },
    { home: "Australia", away: "New Zealand", venue: "MCG", city: "Melbourne", hoursFromNow: 312 },
    { home: "South Africa", away: "West Indies", venue: "Wanderers Stadium", city: "Johannesburg", hoursFromNow: 336 },
    { home: "India", away: "New Zealand", venue: "Wankhede Stadium", city: "Mumbai", hoursFromNow: 360 },
  ];

  const seededWcMatches = [];
  for (const m of wcMatchPairs) {
    const startTime = new Date(Date.now() + m.hoursFromNow * 3600_000);
    const [match] = await db
      .insert(matches)
      .values({
        externalId: `wc-2026-${m.home.toLowerCase().replace(/\s+/g, "-")}-${m.away.toLowerCase().replace(/\s+/g, "-")}-${m.hoursFromNow}`,
        sport: "cricket",
        format: "odi",
        tournament: "ICC Cricket World Cup 2026",
        teamHome: m.home,
        teamAway: m.away,
        venue: m.venue,
        city: m.city,
        startTime,
        status: "upcoming",
        draftEnabled: true,
      })
      .onConflictDoNothing({ target: matches.externalId })
      .returning();
    if (match) seededWcMatches.push(match);
  }
  console.log(`  Seeded ${seededWcMatches.length} World Cup 2026 matches (draft-enabled)`);

  // Seed player_statuses for seed players only (not all DB players — too slow)
  let statusCount = 0;
  const statusPlayers = seededPlayers.length > 0 ? seededPlayers : [];
  for (const player of statusPlayers) {
    await db
      .insert(playerStatuses)
      .values({
        playerId: player.externalId,
        tournamentId: "ipl-2026",
        status: "available",
      })
      .onConflictDoNothing();
    await db
      .insert(playerStatuses)
      .values({
        playerId: player.externalId,
        tournamentId: "wc-2026",
        status: "available",
      })
      .onConflictDoNothing();
    statusCount++;
  }
  console.log(`  Seeded player_statuses for ${statusCount} players (2 tournaments each)`);

  // Seed a test user for league ownership
  const [testUser] = await db
    .insert(users)
    .values({
      firebaseUid: "seed-test-user",
      email: "test@draftplay.dev",
      username: "test_player",
      displayName: "Test Player",
      role: "user",
    })
    .onConflictDoNothing({ target: users.firebaseUid })
    .returning();
  const testUserId = testUser?.id ?? (await db.query.users.findFirst({ where: (u, { eq }) => eq(u.firebaseUid, "seed-test-user") }))?.id;
  console.log(`  Test user: ${testUserId ? "ready" : "missing"}`);

  // Seed contests for the first seeded match (CSK vs MI)
  let contestCount = 0;
  if (seededMatches.length > 0) {
    const firstMatchId = seededMatches[0]!.id;
    const contestDefs = [
      { name: "Mega Contest — 10L Prize Pool", entryFee: "49", prizePool: "1000000", maxEntries: 100000, contestType: "public", isGuaranteed: true },
      { name: "Head to Head", entryFee: "100", prizePool: "180", maxEntries: 2, contestType: "h2h", isGuaranteed: false },
      { name: "Winner Takes All", entryFee: "500", prizePool: "9000", maxEntries: 20, contestType: "public", isGuaranteed: false },
      { name: "Free Practice Contest", entryFee: "0", prizePool: "0", maxEntries: 1000, contestType: "public", isGuaranteed: true },
    ];
    for (const c of contestDefs) {
      const [contest] = await db
        .insert(contests)
        .values({
          matchId: firstMatchId,
          name: c.name,
          entryFee: c.entryFee,
          prizePool: c.prizePool,
          maxEntries: c.maxEntries,
          currentEntries: Math.floor(Math.random() * Math.min(c.maxEntries, 50)),
          contestType: c.contestType,
          isGuaranteed: c.isGuaranteed,
          status: "open",
          prizeDistribution: [{ rank: 1, amount: Number(c.prizePool) * 0.5 }, { rank: 2, amount: Number(c.prizePool) * 0.3 }, { rank: 3, amount: Number(c.prizePool) * 0.2 }],
        })
        .onConflictDoNothing()
        .returning();
      if (contest) contestCount++;
    }
  }
  console.log(`  Seeded ${contestCount} contests`);

  // Seed a league
  let leagueCount = 0;
  if (testUserId) {
    const [league] = await db
      .insert(leagues)
      .values({
        name: "DraftPlay Champions League",
        ownerId: testUserId,
        format: "salary_cap",
        sport: "cricket",
        tournament: "IPL 2026",
        season: "2026",
        isPrivate: false,
        inviteCode: "CRICK2026",
        maxMembers: 10,
        template: "competitive",
        rules: { tradeDeadline: true, waiverWire: true, playoffs: true },
      })
      .onConflictDoNothing()
      .returning();
    if (league) leagueCount++;
  }
  console.log(`  Seeded ${leagueCount} leagues`);

  console.log("Cricket data seeding complete.");
  return {
    players: seededPlayers.length,
    matches: seededMatches.length,
    wcMatches: seededWcMatches.length,
    playerStatuses: statusCount * 2,
    contests: contestCount,
    leagues: leagueCount,
  };
}

/**
 * Get player credits (price) from their stats JSONB.
 * Admin-set credits (adminCredits) take priority over Gemini-fetched credits.
 */
export function getPlayerCredits(stats: Record<string, unknown>): number {
  if (stats?.adminCredits != null) return stats.adminCredits as number;
  if (stats?.calculatedCredits != null) return stats.calculatedCredits as number;
  if (stats?.geminiCredits != null) return stats.geminiCredits as number;
  return (stats?.credits as number) ?? 8.0;
}
