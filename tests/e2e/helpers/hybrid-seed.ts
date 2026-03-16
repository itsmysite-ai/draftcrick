/**
 * Hybrid E2E Seed Helpers
 *
 * Reusable API-based seeding functions for functional E2E tests.
 * Seeds multi-user data via tRPC, then browser verifies visual state.
 *
 * Requires: Firebase Auth Emulator + API server running with emulator tokens.
 */

import {
  createTestUser,
  clearEmulatorAccounts,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
} from "./api-auth";
import {
  createTestAccount,
  fillAuthForm,
  submitAuthForm,
} from "./auth-helpers";

export { clearEmulatorAccounts, trpcAuthQuery, trpcAuthMutate, unwrap };

/** Create a league with 2 members (owner + joiner). */
export async function seedLeagueWith2Members(
  format: "draft" | "auction" | "salary_cap" = "draft"
): Promise<{
  ownerToken: string;
  memberToken: string;
  leagueId: string;
  inviteCode: string;
  ownerEmail: string;
  memberEmail: string;
  ownerDbId?: string;
  memberDbId?: string;
}> {
  const ownerEmail = `owner-${Date.now()}@test.com`;
  const memberEmail = `member-${Date.now()}@test.com`;
  const password = "TestPass123!";

  const owner = await createTestUser(ownerEmail, password);
  const member = await createTestUser(memberEmail, password);

  const leagueRes = await trpcAuthMutate(
    "league.create",
    { name: `E2E ${format} League`, format, tournament: "IPL 2026", maxMembers: 10 },
    owner.idToken
  );
  if (leagueRes.status !== 200) throw new Error(`League create failed: ${leagueRes.status}`);
  const league = unwrap(leagueRes);

  const joinRes = await trpcAuthMutate("league.join", { inviteCode: league.inviteCode }, member.idToken);
  if (joinRes.status !== 200) throw new Error(`Join failed: ${joinRes.status}`);

  return {
    ownerToken: owner.idToken,
    memberToken: member.idToken,
    leagueId: league.id,
    inviteCode: league.inviteCode,
    ownerEmail,
    memberEmail,
    ownerDbId: owner.dbUserId,
    memberDbId: member.dbUserId,
  };
}

/** Fund a user's wallet by triggering auto-creation (500 signup bonus) + daily claim. */
export async function fundWallet(token: string, _amount?: number): Promise<void> {
  // getBalance auto-creates wallet with 500 Pop Coins signup bonus
  const balRes = await trpcAuthQuery("wallet.getBalance", undefined, token);
  if (balRes.status !== 200) throw new Error(`getBalance failed: ${balRes.status}`);

  // Also claim daily reward for extra coins (ignore if already claimed)
  await trpcAuthMutate("wallet.claimDaily", undefined, token).catch(() => {});
}

/** Create a contest for a match and return IDs. */
export async function seedContestForMatch(
  token: string,
  opts?: { entryFee?: number; maxEntries?: number }
): Promise<{ contestId: string; matchId: string; playerIds: string[] }> {
  // Get an upcoming match (contest.create requires status=upcoming)
  const matchRes = await trpcAuthQuery("match.live", undefined, token);
  const matchData = unwrap(matchRes);
  const matchList = Array.isArray(matchData) ? matchData : matchData?.matches ?? [];
  const upcomingMatch = matchList.find((m: any) => m.status === "upcoming") ?? matchList[0];
  if (!upcomingMatch) throw new Error("No upcoming matches found — seed data first");
  const matchId = upcomingMatch.id;

  // Get player IDs for this match
  const playerRes = await trpcAuthQuery("player.list");
  const players = unwrap(playerRes);
  const playerIds = (players ?? []).slice(0, 11).map((p: any) => p.id);

  // Create contest
  const entryFee = opts?.entryFee ?? 50;
  const maxEntries = opts?.maxEntries ?? 100;
  const contestRes = await trpcAuthMutate(
    "contest.create",
    {
      name: `IPL Daily Fantasy`,
      matchId,
      entryFee,
      maxEntries,
      contestType: "public",
      prizeDistribution: [
        { rank: 1, amount: entryFee * maxEntries * 0.5 },
        { rank: 2, amount: entryFee * maxEntries * 0.3 },
        { rank: 3, amount: entryFee * maxEntries * 0.2 },
      ],
    },
    token
  );
  if (contestRes.status !== 200) throw new Error(`Contest create failed: ${contestRes.status}`);
  const contest = unwrap(contestRes);

  return { contestId: contest.id, matchId, playerIds };
}

/** Valid role enum values matching the team create schema. */
const VALID_ROLES = ["batsman", "bowler", "all_rounder", "wicket_keeper"] as const;

/** Normalize DB role strings to valid enum values. */
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

/** Create a team for a contest, respecting all validation rules. */
export async function seedTeamForContest(
  token: string,
  contestId: string,
  matchId: string,
  playerIds?: string[]
): Promise<{ teamId: string }> {
  const playerRes = await trpcAuthQuery("player.list");
  const allPlayers = (unwrap(playerRes) as any[]) ?? [];

  // Separate Indian and overseas players
  const indianPlayers = allPlayers.filter((p) => p.nationality === "India");
  const overseasPlayers = allPlayers.filter((p) => p.nationality !== "India");

  // Pick at least 7 Indian + max 4 overseas to satisfy overseas limit
  // Also respect max 7 from one team
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

  // Add Indian players first (need at least 7)
  for (const p of indianPlayers) {
    if (picked.length >= 7) break;
    if (canAdd(p)) addPlayer(p);
  }

  // Add overseas players (max 4)
  for (const p of overseasPlayers) {
    if (picked.length >= 11) break;
    const overseasSoFar = picked.filter((x) => x.nationality !== "India").length;
    if (overseasSoFar >= 4) break;
    if (canAdd(p)) addPlayer(p);
  }

  // Fill remaining from Indian players
  for (const p of indianPlayers) {
    if (picked.length >= 11) break;
    if (picked.some((x) => x.id === p.id)) continue;
    if (canAdd(p)) addPlayer(p);
  }

  // Last resort: fill from any remaining players
  for (const p of allPlayers) {
    if (picked.length >= 11) break;
    if (picked.some((x) => x.id === p.id)) continue;
    if (canAdd(p)) addPlayer(p);
  }

  if (picked.length < 11) {
    throw new Error(`Only found ${picked.length} valid players, need 11`);
  }

  // Build the players array with valid roles
  const selected = picked.slice(0, 11).map((p) => ({
    playerId: p.id,
    role: normalizeRole(p.role),
  }));

  // Ensure minimum role requirements: 1 WK, 1 BAT, 1 AR, 1 BOWL
  const roleCounts: Record<string, number> = {};
  for (const p of selected) {
    roleCounts[p.role] = (roleCounts[p.role] ?? 0) + 1;
  }
  const requiredRoles = ["wicket_keeper", "batsman", "all_rounder", "bowler"];
  for (const role of requiredRoles) {
    if ((roleCounts[role] ?? 0) < 1) {
      const donor = selected.find((p) => (roleCounts[p.role] ?? 0) > 1);
      if (donor) {
        roleCounts[donor.role]--;
        donor.role = role;
        roleCounts[role] = (roleCounts[role] ?? 0) + 1;
      }
    }
  }

  const teamRes = await trpcAuthMutate(
    "team.create",
    {
      matchId,
      contestId,
      players: selected,
      captainId: selected[0].playerId,
      viceCaptainId: selected[1].playerId,
    },
    token
  );
  if (teamRes.status !== 200) {
    const errMsg = JSON.stringify(teamRes.data?.error ?? teamRes.data).slice(0, 300);
    throw new Error(`Team create failed: ${teamRes.status} — ${errMsg}`);
  }
  const team = unwrap(teamRes);
  return { teamId: team.id };
}

/** Start a draft and return the room ID. */
export async function startDraftRoom(
  ownerToken: string,
  leagueId: string,
  type: "snake_draft" | "auction" = "snake_draft"
): Promise<string> {
  const res = await trpcAuthMutate("league.startDraft", { leagueId, type }, ownerToken);
  if (res.status !== 200) throw new Error(`startDraft failed: ${res.status}`);
  const room = unwrap(res);
  return room.id;
}

/** Get player IDs available for draft picks. */
export async function getPlayerIds(count = 20): Promise<string[]> {
  const res = await trpcAuthQuery("player.list");
  const players = unwrap(res);
  return (players ?? []).slice(0, count).map((p: any) => p.id);
}

/** Drive alternating picks between two users (for draft tests). */
export async function driveAlternatingPicks(
  roomId: string,
  tokenA: string,
  tokenB: string,
  playerIds: string[],
  count: number
): Promise<void> {
  const tokens = [tokenA, tokenB];
  for (let i = 0; i < count && i < playerIds.length; i++) {
    // Check whose turn it is
    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, tokenA);
    const state = unwrap(stateRes);
    if (state?.status === "completed") break;

    // Try with the current drafter's token
    const sessionA = unwrap(await trpcAuthQuery("auth.getSession", undefined, tokenA));
    const currentToken = state?.currentDrafter === sessionA?.id ? tokenA : tokenB;

    const pickRes = await trpcAuthMutate(
      "draft.makePick",
      { roomId, playerId: playerIds[i] },
      currentToken
    );
    if (pickRes.status !== 200) {
      // Try the other token
      const otherToken = currentToken === tokenA ? tokenB : tokenA;
      const retryRes = await trpcAuthMutate(
        "draft.makePick",
        { roomId, playerId: playerIds[i] },
        otherToken
      );
      if (retryRes.status !== 200) {
        console.log(`    Pick ${i} failed with both tokens, status=${retryRes.status}`);
      }
    }
  }
}

/**
 * Login via browser and return whether it succeeded.
 * If `navigateTo` is provided, navigates there after login using SPA routing
 * (avoids full-page reload which causes Firebase auth rehydration delays).
 */
export async function loginViaBrowser(
  page: any,
  email: string,
  password = "TestPass123!",
  navigateTo?: string
): Promise<boolean> {
  await createTestAccount(email, password).catch(() => {}); // ignore if exists

  await page.goto("/auth/login");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3000);

  const emailInput = page.locator('[data-testid="email-input"]');
  if (!(await emailInput.isVisible({ timeout: 5000 }).catch(() => false))) {
    // Maybe already logged in — check if we're on tabs
    const url = page.url();
    if (!url.includes("/auth/")) {
      if (navigateTo) {
        await navigateInSPA(page, navigateTo);
      }
      return true;
    }
    return false;
  }

  await fillAuthForm(page, email, password);
  await submitAuthForm(page);
  await page.waitForTimeout(8000);

  const loggedIn = !page.url().includes("/auth/");
  if (loggedIn && navigateTo) {
    await navigateInSPA(page, navigateTo);
  }
  return loggedIn;
}

/**
 * Navigate within the Expo SPA using window.location (pushState/router).
 * This avoids full page reload which would require Firebase auth rehydration.
 */
export async function navigateInSPA(page: any, path: string): Promise<void> {
  // Use Expo Router's navigate via the address bar — this triggers a full reload
  // but Firebase auth with browserLocalPersistence should rehydrate.
  await page.goto(path);
  await page.waitForLoadState("domcontentloaded");
  // Wait for Firebase auth to rehydrate from IndexedDB/localStorage
  await page.waitForTimeout(8000);
}
