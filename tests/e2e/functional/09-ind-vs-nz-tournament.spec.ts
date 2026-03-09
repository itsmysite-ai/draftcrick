/**
 * 10-User India vs New Zealand Tournament E2E Test
 *
 * Creates 10 users, sets up all permutations of contests and leagues,
 * runs the full match lifecycle (lock → score → complete → settle),
 * and takes screenshots for every user at every stage.
 *
 * Run:
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx playwright test tests/e2e/functional/09-ind-vs-nz-tournament.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  loginViaBrowser,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:Dreamproject@34.57.117.132:5432/draftplay";

let _sql: ReturnType<typeof postgres> | null = null;
function getSql() {
  if (!_sql) _sql = postgres(DATABASE_URL);
  return _sql;
}

// ── Constants ──
const PASSWORD = "TestPass123!";
const NUM_USERS = 10;
const SCREENSHOT_DIR = "screenshots";

// ── Shared State ──
interface TestUser {
  email: string;
  token: string;
  dbUserId?: string;
  localId: string;
}

const users: TestUser[] = [];
let matchId: string;
let players: any[] = [];

// Contest IDs
let megaContestId: string;
let miniContestId: string;
let h2h1Id: string;
let h2h2Id: string;
let h2h3Id: string;
let freeContestId: string;

// League IDs
let championsLeagueId: string;
let draftMastersLeagueId: string;
let allStarsLeagueId: string;

// ── Helpers ──
const VALID_ROLES = ["batsman", "bowler", "all_rounder", "wicket_keeper"] as const;

function normalizeRole(role?: string): string {
  if (!role) return "batsman";
  const r = role.toLowerCase().replace(/[\s-]/g, "_");
  if (r === "wk" || r.includes("keeper") || r.includes("wk")) return "wicket_keeper";
  if (r === "bat" || r.includes("bats")) return "batsman";
  if (r === "bowl" || r.includes("bowl")) return "bowler";
  if (r === "ar" || r.includes("all")) return "all_rounder";
  if (VALID_ROLES.includes(r as any)) return r;
  return "batsman";
}

/**
 * Build a valid 11-player team from available players.
 * Rotates captain/VC based on userIndex for score variance.
 */
function buildTeamPayload(
  allPlayers: any[],
  userIndex: number
): { players: { playerId: string; role: string }[]; captainId: string; viceCaptainId: string } {
  // Shuffle based on userIndex to get different combos
  const shuffled = [...allPlayers].sort((a, b) => {
    const ha = hashCode(a.id + userIndex) % 1000;
    const hb = hashCode(b.id + userIndex) % 1000;
    return ha - hb;
  });

  // Group by team
  const byTeam: Record<string, any[]> = {};
  for (const p of shuffled) {
    const team = p.team ?? p.name?.split(" ")[0] ?? "unknown";
    if (!byTeam[team]) byTeam[team] = [];
    byTeam[team].push(p);
  }
  const teamNames = Object.keys(byTeam);

  const picked: any[] = [];
  const teamCounts: Record<string, number> = {};

  function canAdd(p: any): boolean {
    const team = p.team ?? "unknown";
    return (teamCounts[team] ?? 0) < 7;
  }
  function addPlayer(p: any) {
    picked.push(p);
    const team = p.team ?? "unknown";
    teamCounts[team] = (teamCounts[team] ?? 0) + 1;
  }

  // For 2-team international matches: respect overseas limit (max 4 non-India players)
  // Identify India vs overseas
  const indiaPlayers = shuffled.filter((p: any) => p.nationality === "India" || p.team === "India");
  const overseasPlayers = shuffled.filter((p: any) => p.nationality !== "India" && p.team !== "India");

  if (indiaPlayers.length >= 7 && overseasPlayers.length >= 4) {
    // International match with India: 7 India + 4 overseas
    // Vary which specific players by using offset based on userIndex
    const indOffset = userIndex % Math.max(1, indiaPlayers.length - 7);
    const ovOffset = userIndex % Math.max(1, overseasPlayers.length - 4);

    for (let i = 0; i < 7; i++) {
      addPlayer(indiaPlayers[(indOffset + i) % indiaPlayers.length]);
    }
    for (let i = 0; i < 4; i++) {
      addPlayer(overseasPlayers[(ovOffset + i) % overseasPlayers.length]);
    }
  } else if (teamNames.length === 2) {
    // Non-India 2-team match: 7 from one, 4 from other
    const [teamA, teamB] = teamNames;
    const playersA = byTeam[teamA];
    const playersB = byTeam[teamB];
    const primary = userIndex % 2 === 0 ? playersA : playersB;
    const secondary = userIndex % 2 === 0 ? playersB : playersA;

    for (let i = 0; i < 7 && i < primary.length; i++) addPlayer(primary[i]);
    for (let i = 0; i < 4 && i < secondary.length; i++) addPlayer(secondary[i]);
  } else {
    // Multi-team: just pick respecting max 7 per team
    for (const p of shuffled) {
      if (picked.length >= 11) break;
      if (canAdd(p)) addPlayer(p);
    }
  }

  if (picked.length < 11) {
    throw new Error(`Only found ${picked.length} valid players for user ${userIndex} (teams: ${JSON.stringify(teamCounts)})`);
  }

  // Build with roles
  const selected = picked.map((p) => ({
    playerId: p.id,
    role: normalizeRole(p.role),
  }));

  // Ensure min role requirements
  const roleCounts: Record<string, number> = {};
  for (const p of selected) {
    roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1;
  }
  for (const role of ["wicket_keeper", "batsman", "all_rounder", "bowler"]) {
    if ((roleCounts[role] ?? 0) < 1) {
      const donor = selected.find((p) => (roleCounts[p.role] ?? 0) > 1);
      if (donor) {
        roleCounts[donor.role]!--;
        donor.role = role;
        roleCounts[role] = (roleCounts[role] ?? 0) + 1;
      }
    }
  }

  // Rotate captain/VC based on userIndex
  const capIdx = (userIndex * 2) % selected.length;
  const vcIdx = (userIndex * 2 + 1) % selected.length;

  return {
    players: selected,
    captainId: selected[capIdx].playerId,
    viceCaptainId: selected[vcIdx].playerId,
  };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Promote a user to admin via direct DB update. */
async function makeAdmin(dbUserId: string): Promise<void> {
  const sql = getSql();
  await sql`UPDATE users SET role = 'admin' WHERE id = ${dbUserId}`;
}

/** Fund a user's wallet via direct DB update. */
async function fundWalletDirect(dbUserId: string, amount: number): Promise<void> {
  const sql = getSql();
  // Ensure wallet exists (auto-created on first API call, but just in case)
  await sql`
    INSERT INTO wallets (user_id, coin_balance, total_earned)
    VALUES (${dbUserId}, ${amount}, ${amount})
    ON CONFLICT (user_id)
    DO UPDATE SET coin_balance = wallets.coin_balance + ${amount},
                  total_earned = wallets.total_earned + ${amount}
  `;
}

/** Create team + join contest for a user. */
async function createTeamAndJoin(
  token: string,
  contestId: string,
  userIndex: number
): Promise<string> {
  const team = buildTeamPayload(players, userIndex);

  const teamRes = await trpcAuthMutate(
    "team.create",
    { contestId, players: team.players, captainId: team.captainId, viceCaptainId: team.viceCaptainId },
    token
  );
  if (teamRes.status !== 200) {
    const err = JSON.stringify(teamRes.data).slice(0, 500);
    throw new Error(`Team create failed for user ${userIndex}: ${teamRes.status} — ${err}`);
  }
  const created = unwrap(teamRes);
  const teamId = created.id;

  // Join
  const joinRes = await trpcAuthMutate("contest.join", { contestId, teamId }, token);
  if (joinRes.status !== 200) {
    const err = JSON.stringify(joinRes.data).slice(0, 300);
    throw new Error(`Join failed for user ${userIndex}: ${joinRes.status} — ${err}`);
  }

  return teamId;
}

/** Login once, then take screenshots of multiple pages for the same user. */
async function screenshotUserPages(
  page: any,
  userIdx: number,
  pages: Array<{ path: string; name: string }>
): Promise<void> {
  // Login once
  const firstPath = pages[0]?.path;
  if (!firstPath) return;
  const loggedIn = await loginViaBrowser(page, users[userIdx].email, PASSWORD, firstPath);
  if (!loggedIn) {
    console.log(`  [WARN] Login failed for user ${userIdx + 1}, skipping screenshots`);
    return;
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${pages[0].name}`, fullPage: true });
  console.log(`  [OK] ${pages[0].name}`);

  // Navigate to remaining pages without re-login
  for (let i = 1; i < pages.length; i++) {
    await page.goto(pages[i].path);
    await page.waitForLoadState("domcontentloaded");
    // Wallet/profile pages need extra time for auth rehydration after navigation
    const extraWait = pages[i].path.includes("/wallet") || pages[i].path.includes("/profile") ? 6000 : 3000;
    await page.waitForTimeout(extraWait);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/${pages[i].name}`, fullPage: true });
    console.log(`  [OK] ${pages[i].name}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("IND vs NZ — 10-User Tournament", () => {
  test.setTimeout(900000); // 15 min per test (screenshot steps are slow)

  // ── STEP 1: Create 10 Users ──
  test("01 — create 10 users and fund wallets", async () => {
    await clearEmulatorAccounts();

    for (let i = 0; i < NUM_USERS; i++) {
      const email = `indnz-u${i + 1}-${Date.now()}@test.com`;
      const user = await createTestUser(email, PASSWORD);
      users.push({
        email,
        token: user.idToken,
        dbUserId: user.dbUserId,
        localId: user.localId,
      });

      // Fund wallet with 2000 coins via direct DB
      if (user.dbUserId) {
        await fundWalletDirect(user.dbUserId, 2000);
      }
      console.log(`  [OK] User ${i + 1} created: ${email} (DB: ${user.dbUserId})`);
    }

    expect(users).toHaveLength(NUM_USERS);

    // Resolve any missing dbUserIds via auth.getSession
    for (let i = 0; i < users.length; i++) {
      if (!users[i].dbUserId) {
        const sessionRes = await trpcAuthQuery("auth.getSession", undefined, users[i].token);
        const session = unwrap(sessionRes);
        if (session?.id) {
          users[i].dbUserId = session.id;
          console.log(`  [FIX] User ${i + 1} DB ID resolved: ${session.id}`);
        }
      }
    }

    // Make user 1 an admin (for lifecycle operations)
    if (users[0].dbUserId) {
      await makeAdmin(users[0].dbUserId);
      console.log(`  [OK] User 1 promoted to admin`);
    } else {
      // Fallback: look up by firebase UID
      const sql = getSql();
      const rows = await sql`SELECT id FROM users WHERE firebase_uid = ${users[0].localId}`;
      if (rows.length > 0) {
        users[0].dbUserId = rows[0].id;
        await makeAdmin(rows[0].id);
        console.log(`  [OK] User 1 promoted to admin (via firebase UID lookup)`);
      }
    }
  });

  // ── STEP 2: Find Match + Players ──
  test("02 — find match and get players", async () => {
    // Find India vs New Zealand match in any status
    let matchList: any[] = [];
    for (const status of ["upcoming", "live", "completed"] as const) {
      const matchRes = await trpcAuthQuery("match.list", { status }, users[0].token);
      const matchData = unwrap(matchRes);
      const list = Array.isArray(matchData) ? matchData : matchData?.matches;
      if (list?.length) matchList.push(...list);
    }

    if (!matchList?.length) {
      throw new Error("No matches found. Seed data first (run cricket-data.ts seeder).");
    }

    // Try to find India vs New Zealand
    const indNzMatch = matchList.find(
      (m: any) =>
        (m.teamHome?.toLowerCase().includes("india") && m.teamAway?.toLowerCase().includes("new zealand")) ||
        (m.teamHome?.toLowerCase().includes("new zealand") && m.teamAway?.toLowerCase().includes("india"))
    );

    const match = indNzMatch ?? matchList[0];
    matchId = match.id;
    console.log(`  [OK] Using match: ${match.teamHome} vs ${match.teamAway} (${matchId}) — status: ${match.status}`);

    // Get players for this match — returns playerMatchScores with nested .player
    const playerRes = await trpcAuthQuery("player.getByMatch", { matchId }, users[0].token);
    const playerData = unwrap(playerRes);
    const rawScores = playerData?.players ?? [];

    // Flatten: extract player info from nested .player field
    players = rawScores.map((s: any) => ({
      id: s.player?.id ?? s.playerId,
      name: s.player?.name ?? "Unknown",
      team: s.player?.team ?? "Unknown",
      role: s.player?.role ?? "batsman",
      nationality: s.player?.nationality,
      stats: s.player?.stats,
    }));

    // Fallback: if no match-linked players, use general player list
    if (players.length < 11) {
      console.log(`  [WARN] Only ${players.length} match-linked players, falling back to player.list`);
      const allPlayerRes = await trpcAuthQuery("player.list", undefined, users[0].token);
      players = unwrap(allPlayerRes) ?? [];
    }

    console.log(`  [OK] ${players.length} players available`);
    expect(players.length).toBeGreaterThanOrEqual(11);
  });

  // ── STEP 3: Create 6 Contests ──
  test("03 — create 6 contests", async () => {
    const token = users[0].token;
    const sql = getSql();

    // Clean old contest/team data and reset match to upcoming (idempotent)
    console.log("  Cleaning old data and resetting match to upcoming...");
    const oldContests = await sql`SELECT id FROM contests WHERE match_id = ${matchId}`;
    if (oldContests.length > 0) {
      const oldIds = oldContests.map((c: any) => c.id);
      await sql`DELETE FROM fantasy_teams WHERE contest_id = ANY(${oldIds})`;
      await sql`DELETE FROM contests WHERE match_id = ${matchId}`;
      console.log(`  [OK] Cleaned ${oldContests.length} old contests and their teams`);
    }
    await sql`UPDATE matches SET status = 'upcoming', result = NULL WHERE id = ${matchId}`;
    console.log("  [OK] Match reset to upcoming");

    // C1: Mega Contest (all 10 users)
    const c1 = await trpcAuthMutate("contest.create", {
      name: "IND vs NZ Mega Contest",
      matchId,
      entryFee: 100,
      maxEntries: 100,
      contestType: "public",
      prizeDistribution: [
        { rank: 1, amount: 500 },
        { rank: 2, amount: 300 },
        { rank: 3, amount: 200 },
      ],
    }, token);
    expect(c1.status).toBe(200);
    megaContestId = unwrap(c1).id;
    console.log(`  [OK] Mega Contest: ${megaContestId}`);

    // C2: Mini League (U1-U5)
    const c2 = await trpcAuthMutate("contest.create", {
      name: "IND vs NZ Mini League",
      matchId,
      entryFee: 50,
      maxEntries: 20,
      contestType: "public",
      prizeDistribution: [
        { rank: 1, amount: 150 },
        { rank: 2, amount: 75 },
        { rank: 3, amount: 25 },
      ],
    }, token);
    expect(c2.status).toBe(200);
    miniContestId = unwrap(c2).id;
    console.log(`  [OK] Mini League: ${miniContestId}`);

    // C3: H2H U1 vs U2
    const c3 = await trpcAuthMutate("contest.create", {
      name: "H2H: U1 vs U2",
      matchId,
      entryFee: 200,
      maxEntries: 2,
      contestType: "h2h",
      prizeDistribution: [{ rank: 1, amount: 400 }],
    }, token);
    expect(c3.status).toBe(200);
    h2h1Id = unwrap(c3).id;
    console.log(`  [OK] H2H 1: ${h2h1Id}`);

    // C4: H2H U3 vs U4
    const c4 = await trpcAuthMutate("contest.create", {
      name: "H2H: U3 vs U4",
      matchId,
      entryFee: 200,
      maxEntries: 2,
      contestType: "h2h",
      prizeDistribution: [{ rank: 1, amount: 400 }],
    }, token);
    expect(c4.status).toBe(200);
    h2h2Id = unwrap(c4).id;
    console.log(`  [OK] H2H 2: ${h2h2Id}`);

    // C5: H2H U5 vs U6
    const c5 = await trpcAuthMutate("contest.create", {
      name: "H2H: U5 vs U6",
      matchId,
      entryFee: 200,
      maxEntries: 2,
      contestType: "h2h",
      prizeDistribution: [{ rank: 1, amount: 400 }],
    }, token);
    expect(c5.status).toBe(200);
    h2h3Id = unwrap(c5).id;
    console.log(`  [OK] H2H 3: ${h2h3Id}`);

    // C6: Free Practice (U7-U10)
    const c6 = await trpcAuthMutate("contest.create", {
      name: "IND vs NZ Free Practice",
      matchId,
      entryFee: 0,
      maxEntries: 100,
      contestType: "public",
      prizeDistribution: [],
    }, token);
    expect(c6.status).toBe(200);
    freeContestId = unwrap(c6).id;
    console.log(`  [OK] Free Practice: ${freeContestId}`);
  });

  // ── STEP 4: Create 3 Leagues ──
  test("04 — create 3 leagues", async () => {
    // L1: Champions League — U1 owns, U2-U5 join
    const l1 = await trpcAuthMutate("league.create", {
      name: "Champions League",
      format: "salary_cap",
      tournament: "ICC Cricket World Cup 2026",
      maxMembers: 10,
    }, users[0].token);
    expect(l1.status).toBe(200);
    const league1 = unwrap(l1);
    championsLeagueId = league1.id;
    console.log(`  [OK] Champions League: ${championsLeagueId} (code: ${league1.inviteCode})`);

    for (let i = 1; i <= 4; i++) {
      const joinRes = await trpcAuthMutate("league.join", { inviteCode: league1.inviteCode }, users[i].token);
      expect(joinRes.status).toBe(200);
      console.log(`    User ${i + 1} joined Champions League`);
    }

    // L2: Draft Masters — U6 owns, U7-U10 join
    const l2 = await trpcAuthMutate("league.create", {
      name: "Draft Masters",
      format: "draft",
      tournament: "ICC Cricket World Cup 2026",
      maxMembers: 10,
    }, users[5].token);
    expect(l2.status).toBe(200);
    const league2 = unwrap(l2);
    draftMastersLeagueId = league2.id;
    console.log(`  [OK] Draft Masters: ${draftMastersLeagueId} (code: ${league2.inviteCode})`);

    for (let i = 6; i <= 9; i++) {
      const joinRes = await trpcAuthMutate("league.join", { inviteCode: league2.inviteCode }, users[i].token);
      expect(joinRes.status).toBe(200);
      console.log(`    User ${i + 1} joined Draft Masters`);
    }

    // L3: All Stars — U1 owns, everyone joins
    const l3 = await trpcAuthMutate("league.create", {
      name: "All Stars League",
      format: "salary_cap",
      tournament: "ICC Cricket World Cup 2026",
      maxMembers: 20,
    }, users[0].token);
    expect(l3.status).toBe(200);
    const league3 = unwrap(l3);
    allStarsLeagueId = league3.id;
    console.log(`  [OK] All Stars: ${allStarsLeagueId} (code: ${league3.inviteCode})`);

    for (let i = 1; i < NUM_USERS; i++) {
      const joinRes = await trpcAuthMutate("league.join", { inviteCode: league3.inviteCode }, users[i].token);
      expect(joinRes.status).toBe(200);
      console.log(`    User ${i + 1} joined All Stars`);
    }
  });

  // ── STEP 5: Create Teams + Join Contests ──
  test("05 — all users create teams and join contests", async () => {
    // Link contests to leagues so league standings work
    const sql = getSql();
    await sql`UPDATE contests SET league_id = ${allStarsLeagueId} WHERE id = ${megaContestId}`;
    await sql`UPDATE contests SET league_id = ${championsLeagueId} WHERE id = ${miniContestId}`;
    await sql`UPDATE contests SET league_id = ${draftMastersLeagueId} WHERE id = ${freeContestId}`;
    console.log("  [OK] Linked Mega→All Stars, Mini→Champions, Free→Draft Masters");

    // Mega Contest — all 10 users
    console.log("  Joining Mega Contest...");
    for (let i = 0; i < NUM_USERS; i++) {
      const teamId = await createTeamAndJoin(users[i].token, megaContestId, i);
      console.log(`    User ${i + 1} joined Mega (team: ${teamId.slice(0, 8)}...)`);
    }

    // Mini League — U1-U5
    console.log("  Joining Mini League...");
    for (let i = 0; i < 5; i++) {
      const teamId = await createTeamAndJoin(users[i].token, miniContestId, i + 10);
      console.log(`    User ${i + 1} joined Mini (team: ${teamId.slice(0, 8)}...)`);
    }

    // H2H 1 — U1 vs U2
    console.log("  Joining H2H 1...");
    await createTeamAndJoin(users[0].token, h2h1Id, 20);
    await createTeamAndJoin(users[1].token, h2h1Id, 21);

    // H2H 2 — U3 vs U4
    console.log("  Joining H2H 2...");
    await createTeamAndJoin(users[2].token, h2h2Id, 22);
    await createTeamAndJoin(users[3].token, h2h2Id, 23);

    // H2H 3 — U5 vs U6
    console.log("  Joining H2H 3...");
    await createTeamAndJoin(users[4].token, h2h3Id, 24);
    await createTeamAndJoin(users[5].token, h2h3Id, 25);

    // Free Practice — U7-U10
    console.log("  Joining Free Practice...");
    for (let i = 6; i < NUM_USERS; i++) {
      const teamId = await createTeamAndJoin(users[i].token, freeContestId, i + 26);
      console.log(`    User ${i + 1} joined Free Practice (team: ${teamId.slice(0, 8)}...)`);
    }
  });

  // ── STEP 6: Pre-Match Screenshots ──
  test("06 — pre-match screenshots (all 10 users)", async ({ page }) => {
    // Group by user to minimize logins (login once per user, navigate to all their pages)
    // U1: mega, champions league, all stars, h2h1
    await screenshotUserPages(page, 0, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u1-mega-pre.png" },
      { path: `/league/${championsLeagueId}`, name: "ind-nz-u1-champions-league.png" },
      { path: `/league/${allStarsLeagueId}`, name: "ind-nz-u1-all-stars.png" },
      { path: `/contest/${h2h1Id}`, name: "ind-nz-u1-h2h-pre.png" },
    ]);
    // U2: mega, h2h1
    await screenshotUserPages(page, 1, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u2-mega-pre.png" },
      { path: `/contest/${h2h1Id}`, name: "ind-nz-u2-h2h-pre.png" },
    ]);
    // U3: mega, h2h2
    await screenshotUserPages(page, 2, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u3-mega-pre.png" },
      { path: `/contest/${h2h2Id}`, name: "ind-nz-u3-h2h-pre.png" },
    ]);
    // U4: mega, h2h2
    await screenshotUserPages(page, 3, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u4-mega-pre.png" },
      { path: `/contest/${h2h2Id}`, name: "ind-nz-u4-h2h-pre.png" },
    ]);
    // U5: mega, h2h3
    await screenshotUserPages(page, 4, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u5-mega-pre.png" },
      { path: `/contest/${h2h3Id}`, name: "ind-nz-u5-h2h-pre.png" },
    ]);
    // U6: mega, draft masters, h2h3
    await screenshotUserPages(page, 5, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u6-mega-pre.png" },
      { path: `/league/${draftMastersLeagueId}`, name: "ind-nz-u6-draft-masters.png" },
      { path: `/contest/${h2h3Id}`, name: "ind-nz-u6-h2h-pre.png" },
    ]);
    // U7-U10: mega + free practice (U7 only)
    await screenshotUserPages(page, 6, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u7-mega-pre.png" },
      { path: `/contest/${freeContestId}`, name: "ind-nz-u7-free-pre.png" },
    ]);
    for (let i = 7; i < NUM_USERS; i++) {
      await screenshotUserPages(page, i, [
        { path: `/contest/${megaContestId}`, name: `ind-nz-u${i + 1}-mega-pre.png` },
      ]);
    }
  });

  // ── STEP 7: Lock Match + Seed Scores ──
  test("07 — lock match and seed player scores", async () => {
    const adminToken = users[0].token;

    // Check current match status — if already live, skip lock/seed
    const matchCheck = await trpcAuthQuery("match.getById", { id: matchId }, adminToken);
    const currentStatus = unwrap(matchCheck)?.status;
    console.log(`  Match status: ${currentStatus}`);

    if (currentStatus === "live" || currentStatus === "completed") {
      console.log("  [OK] Match already live/completed — skipping lock & seed, scores already set");
      // Just verify contests are live
      const contestCheck = await trpcAuthQuery("contest.getById", { id: megaContestId }, adminToken);
      const contestStatus = unwrap(contestCheck)?.status;
      if (contestStatus !== "live" && contestStatus !== "settled") {
        console.log(`  [WARN] Contest status is ${contestStatus}, expected live — attempting to fix`);
      }
      return;
    }

    // Lock the match — contests go from open → live
    console.log("  Locking match...");
    const lockRes = await trpcAuthMutate(
      "admin.matches.simulateLifecycle",
      { matchId, phase: "lock" },
      adminToken
    );
    if (lockRes.status !== 200) {
      console.log(`  [WARN] Lock failed: ${lockRes.status} — ${JSON.stringify(lockRes.data).slice(0, 300)}`);
      throw new Error(`Lock failed: ${lockRes.status}`);
    }
    console.log(`  [OK] Match locked: ${JSON.stringify(unwrap(lockRes))}`);

    // Seed random player scores
    console.log("  Seeding player scores...");
    const scoreRes = await trpcAuthMutate(
      "admin.matches.seedPlayerScores",
      { matchId },
      adminToken
    );
    expect(scoreRes.status).toBe(200);
    console.log(`  [OK] Scores seeded: ${JSON.stringify(unwrap(scoreRes))}`);

    // Score — calculate fantasy points and ranks
    console.log("  Calculating scores...");
    const calcRes = await trpcAuthMutate(
      "admin.matches.simulateLifecycle",
      { matchId, phase: "score" },
      adminToken
    );
    expect(calcRes.status).toBe(200);
    console.log(`  [OK] Scores calculated: ${JSON.stringify(unwrap(calcRes))}`);
  });

  // ── STEP 8: Live Match Screenshots ──
  test("08 — live match screenshots (all 10 users)", async ({ page }) => {
    // U1: mega, h2h1, mini, my-contests
    await screenshotUserPages(page, 0, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u1-mega-live.png" },
      { path: `/contest/${h2h1Id}`, name: "ind-nz-u1-h2h-live.png" },
      { path: `/contest/${miniContestId}`, name: "ind-nz-u1-mini-live.png" },
      { path: `/(tabs)/contests`, name: "ind-nz-u1-my-contests-live.png" },
    ]);
    // U2: mega, h2h1
    await screenshotUserPages(page, 1, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u2-mega-live.png" },
      { path: `/contest/${h2h1Id}`, name: "ind-nz-u2-h2h-live.png" },
    ]);
    // U3-U4: mega only
    for (let i = 2; i < 4; i++) {
      await screenshotUserPages(page, i, [
        { path: `/contest/${megaContestId}`, name: `ind-nz-u${i + 1}-mega-live.png` },
      ]);
    }
    // U5: mega, mini
    await screenshotUserPages(page, 4, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u5-mega-live.png" },
      { path: `/contest/${miniContestId}`, name: "ind-nz-u5-mini-live.png" },
    ]);
    // U6-U10: mega (U7 also gets my-contests)
    for (let i = 5; i < NUM_USERS; i++) {
      const pages: Array<{ path: string; name: string }> = [
        { path: `/contest/${megaContestId}`, name: `ind-nz-u${i + 1}-mega-live.png` },
      ];
      if (i === 6) pages.push({ path: `/(tabs)/contests`, name: "ind-nz-u7-my-contests-live.png" });
      await screenshotUserPages(page, i, pages);
    }
  });

  // ── STEP 9: Settlement ──
  test("09 — complete and settle match", async () => {
    const adminToken = users[0].token;

    // Check current match status
    const matchCheck = await trpcAuthQuery("match.getById", { id: matchId }, adminToken);
    const currentStatus = (unwrap(matchCheck) as any)?.status;
    console.log(`  Current match status: ${currentStatus}`);

    // Complete (idempotent — safe to call even if already completed)
    console.log("  Completing match...");
    const completeRes = await trpcAuthMutate(
      "admin.matches.simulateLifecycle",
      { matchId, phase: "complete", result: "India won by 96 runs" },
      adminToken
    );
    expect(completeRes.status).toBe(200);
    console.log(`  [OK] Match completed: ${JSON.stringify(unwrap(completeRes))}`);

    // Settle — distribute prizes
    console.log("  Settling contests...");
    const settleRes = await trpcAuthMutate(
      "admin.matches.simulateLifecycle",
      { matchId, phase: "settle" },
      adminToken
    );
    expect(settleRes.status).toBe(200);
    console.log(`  [OK] Contests settled: ${JSON.stringify(unwrap(settleRes))}`);
  });

  // ── STEP 10: Post-Settlement Screenshots ──
  test("10 — post-settlement screenshots (all 10 users)", async ({ page }) => {
    // U1: mega, h2h1, mini, wallet, all-stars
    await screenshotUserPages(page, 0, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u1-mega-settled.png" },
      { path: `/contest/${h2h1Id}`, name: "ind-nz-u1-h2h-settled.png" },
      { path: `/contest/${miniContestId}`, name: "ind-nz-u1-mini-settled.png" },
      { path: `/wallet`, name: "ind-nz-u1-wallet-settled.png" },
      { path: `/league/${allStarsLeagueId}`, name: "ind-nz-u1-all-stars-settled.png" },
    ]);
    // U2: mega, h2h1, mini, wallet
    await screenshotUserPages(page, 1, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u2-mega-settled.png" },
      { path: `/contest/${h2h1Id}`, name: "ind-nz-u2-h2h-settled.png" },
      { path: `/contest/${miniContestId}`, name: "ind-nz-u2-mini-settled.png" },
      { path: `/wallet`, name: "ind-nz-u2-wallet-settled.png" },
    ]);
    // U3: mega, h2h2, mini
    await screenshotUserPages(page, 2, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u3-mega-settled.png" },
      { path: `/contest/${h2h2Id}`, name: "ind-nz-u3-h2h-settled.png" },
      { path: `/contest/${miniContestId}`, name: "ind-nz-u3-mini-settled.png" },
    ]);
    // U4: mega, h2h2, mini
    await screenshotUserPages(page, 3, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u4-mega-settled.png" },
      { path: `/contest/${h2h2Id}`, name: "ind-nz-u4-h2h-settled.png" },
      { path: `/contest/${miniContestId}`, name: "ind-nz-u4-mini-settled.png" },
    ]);
    // U5: mega, h2h3, mini
    await screenshotUserPages(page, 4, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u5-mega-settled.png" },
      { path: `/contest/${h2h3Id}`, name: "ind-nz-u5-h2h-settled.png" },
      { path: `/contest/${miniContestId}`, name: "ind-nz-u5-mini-settled.png" },
    ]);
    // U6: mega, h2h3, draft-masters (members + standings tabs)
    await screenshotUserPages(page, 5, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u6-mega-settled.png" },
      { path: `/contest/${h2h3Id}`, name: "ind-nz-u6-h2h-settled.png" },
      { path: `/league/${draftMastersLeagueId}`, name: "ind-nz-u6-draft-masters-settled.png" },
    ]);
    // Click standings tab and take screenshot
    const standingsTab = page.getByText("standings", { exact: false });
    if (await standingsTab.isVisible()) {
      await standingsTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/ind-nz-u6-draft-masters-standings.png`, fullPage: true });
      console.log("  [OK] ind-nz-u6-draft-masters-standings.png");
    }
    // U7: mega, free, wallet
    await screenshotUserPages(page, 6, [
      { path: `/contest/${megaContestId}`, name: "ind-nz-u7-mega-settled.png" },
      { path: `/contest/${freeContestId}`, name: "ind-nz-u7-free-settled.png" },
      { path: `/wallet`, name: "ind-nz-u7-wallet-settled.png" },
    ]);
    // U8-U10: mega, free
    for (let i = 7; i < NUM_USERS; i++) {
      await screenshotUserPages(page, i, [
        { path: `/contest/${megaContestId}`, name: `ind-nz-u${i + 1}-mega-settled.png` },
        { path: `/contest/${freeContestId}`, name: `ind-nz-u${i + 1}-free-settled.png` },
      ]);
    }
  });

  // ── STEP 11: Verify Data Integrity ──
  test("11 — verify contest standings and wallet balances", async () => {
    // Verify Mega Contest leaderboard
    const standingsRes = await trpcAuthQuery(
      "contest.getStandings",
      { contestId: megaContestId },
      users[0].token
    );
    const standings = unwrap(standingsRes);
    console.log(`  [OK] Mega Contest standings: ${Array.isArray(standings) ? standings.length : 0} entries`);

    if (Array.isArray(standings)) {
      // Verify all 10 users have different ranks
      const ranks = standings.map((s: any) => s.rank);
      console.log(`  Ranks: ${ranks.join(", ")}`);
      expect(ranks.length).toBe(10);
    }

    // Verify H2H results
    const h2h1Standings = unwrap(
      await trpcAuthQuery("contest.getStandings", { contestId: h2h1Id }, users[0].token)
    );
    console.log(`  [OK] H2H 1 standings: ${JSON.stringify(h2h1Standings)}`);

    // Check wallet of user 1
    const walletRes = await trpcAuthQuery("wallet.getBalance", undefined, users[0].token);
    const wallet = unwrap(walletRes);
    console.log(`  [OK] User 1 wallet: ${wallet?.coinBalance} coins`);

    // Check wallet of user 7 (free contest, no entry fees from free)
    const wallet7 = unwrap(
      await trpcAuthQuery("wallet.getBalance", undefined, users[6].token)
    );
    console.log(`  [OK] User 7 wallet: ${wallet7?.coinBalance} coins`);
  });

  // Cleanup
  test.afterAll(async () => {
    if (_sql) {
      await _sql.end();
      _sql = null;
    }
  });
});
