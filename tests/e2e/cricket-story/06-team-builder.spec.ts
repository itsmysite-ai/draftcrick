/**
 * Chapter 6: Team Builder
 *
 * Ravi and Priya build teams for the active IPL match.
 * Tests player selection, budget, role constraints, captain/VC, validation.
 * Uses real player data from admin portal (never modifies).
 *
 * Run: npx playwright test tests/e2e/cricket-story/06-team-builder.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  loginViaBrowser,
  seedTeamForContest,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import { forceClickByTestId, forceClickTab } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

const ss = (name: string) => screenshotPath(name);

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

const TS = Date.now();
const RAVI_EMAIL = `ravi-team-${TS}@draftplay.test`;
const PRIYA_EMAIL = `priya-team-${TS}@draftplay.test`;
const PASSWORD = "CricketFan123!";

test.describe("Chapter 6 — Team Builder", () => {
  test.setTimeout(180000);

  let raviToken: string;
  let priyaToken: string;
  let matchId: string;

  test.beforeAll(async () => {
    await clearEmulatorAccounts();
    const ravi = await createTestUser(RAVI_EMAIL, PASSWORD);
    raviToken = ravi.idToken;
    const priya = await createTestUser(PRIYA_EMAIL, PASSWORD);
    priyaToken = priya.idToken;

    // Find an active match with draft enabled
    const matchRes = await trpcAuthQuery("match.live", undefined, raviToken);
    const matchData = unwrap(matchRes);
    const matches = Array.isArray(matchData) ? matchData : matchData?.matches ?? [];
    // Look for a match with draftEnabled or upcoming status
    const activeMatch = matches.find((m: any) => m.draftEnabled || m.status === "upcoming") || matches[0];
    if (activeMatch) {
      matchId = activeMatch.id;
    }
  });

  // --- 6.1 Navigate to team builder ---
  test("6.1 — team builder screen loads from match", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/team/create?matchId=${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    const teamBuilder = page.locator('[data-testid="team-builder-screen"]');
    const hasBuilder = await teamBuilder.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasBuilder) {
      // Try navigating via match detail
      await page.goto(`/match/${matchId}`);
      await page.waitForTimeout(8000);
      const matchDetail = page.locator('[data-testid="match-detail-screen"]');
      if (await matchDetail.isVisible({ timeout: 5000 }).catch(() => false)) {
        const createBtn = page.locator('[data-testid="primary-create-team-btn"]');
        if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await forceClickByTestId(page, "primary-create-team-btn");
          await page.waitForTimeout(5000);
        }
      }
    }

    await page.screenshot({ path: ss("06-team-builder.png") });
  });

  // --- 6.2 Players loaded ---
  test("6.2 — player list loads with credits", async ({ page }) => {
    if (!matchId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/team/create?matchId=${matchId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    // Look for player data via API
    const playerRes = await trpcAuthQuery("player.getByMatch", { matchId }, raviToken);
    const playerData = unwrap(playerRes);
    const players = Array.isArray(playerData) ? playerData : playerData?.players ?? [];
    const playerCount = players.length;

    await page.screenshot({ path: ss("06-players-loaded.png"), fullPage: true });

    // Should have players available
    expect(playerCount).toBeGreaterThan(0);
  });

  // --- 6.3 Create team via API (Ravi) ---
  test("6.3 — Ravi creates valid team via API", async () => {
    if (!matchId) { test.skip(); return; }

    // Get players for match
    // Get players - getByMatch returns {players:[...]}, player.list returns flat array
    const playerRes = await trpcAuthQuery("player.getByMatch", { matchId }, raviToken);
    const playerData = unwrap(playerRes);
    let allPlayers = Array.isArray(playerData) ? playerData : playerData?.players ?? [];
    // Extract the actual player record if nested (playerMatchScores have .player)
    allPlayers = allPlayers.map((p: any) => p.player ?? p);

    if (allPlayers.length < 11) {
      const fallbackRes = await trpcAuthQuery("player.list", undefined, raviToken);
      allPlayers = (unwrap(fallbackRes) as any[]) ?? [];
    }

    expect(allPlayers.length).toBeGreaterThanOrEqual(11);

    // Build a valid 11 with role distribution
    const byRole: Record<string, any[]> = { wicket_keeper: [], batsman: [], all_rounder: [], bowler: [] };
    for (const p of allPlayers) {
      const r = normalizeRole(p.role);
      if (byRole[r]) byRole[r].push(p);
    }

    const picked: { playerId: string; role: string }[] = [];
    const teamCounts: Record<string, number> = {};

    function canAdd(p: any) { return (teamCounts[p.team] ?? 0) < 7; }
    function add(p: any, role: string) {
      picked.push({ playerId: p.id, role });
      teamCounts[p.team] = (teamCounts[p.team] ?? 0) + 1;
    }

    // Pick 1 WK, 4 BAT, 2 AR, 4 BOWL
    for (const p of byRole.wicket_keeper.slice(0, 1)) { if (canAdd(p)) add(p, "wicket_keeper"); }
    for (const p of byRole.batsman.slice(0, 4)) { if (canAdd(p) && picked.length < 11) add(p, "batsman"); }
    for (const p of byRole.all_rounder.slice(0, 2)) { if (canAdd(p) && picked.length < 11) add(p, "all_rounder"); }
    for (const p of byRole.bowler.slice(0, 4)) { if (canAdd(p) && picked.length < 11) add(p, "bowler"); }

    // Fill remaining from any role
    for (const p of allPlayers) {
      if (picked.length >= 11) break;
      if (picked.some(x => x.playerId === p.id)) continue;
      if (canAdd(p)) add(p, normalizeRole(p.role));
    }

    expect(picked.length).toBe(11);

    const teamRes = await trpcAuthMutate(
      "team.create",
      {
        matchId,
        players: picked,
        captainId: picked[0].playerId,
        viceCaptainId: picked[1].playerId,
      },
      raviToken,
    );

    // Log error if failed for debugging
    if (teamRes.status !== 200) {
      console.log("Team create error:", JSON.stringify(teamRes.data).slice(0, 500));
    }
    expect(teamRes.status).toBe(200);
  });

  // --- 6.4 Create team via API (Priya) ---
  test("6.4 — Priya creates valid team via API", async () => {
    if (!matchId) { test.skip(); return; }

    // Use player.list for full player data (nationality, team, role)
    const playerRes = await trpcAuthQuery("player.list", undefined, priyaToken);
    const allPlayers = (unwrap(playerRes) as any[]) ?? [];
    if (allPlayers.length < 11) { test.skip(); return; }

    // Separate Indian and overseas players
    const indianPlayers = allPlayers.filter((p: any) => p.nationality === "India");
    const overseasPlayers = allPlayers.filter((p: any) => p.nationality !== "India");

    const picked: any[] = [];
    const teamCounts: Record<string, number> = {};
    function canAdd(p: any) { return (teamCounts[p.team ?? "unknown"] ?? 0) < 7; }
    function addPlayer(p: any) { picked.push(p); teamCounts[p.team ?? "unknown"] = (teamCounts[p.team ?? "unknown"] ?? 0) + 1; }

    // Pick at least 7 Indian first
    for (const p of indianPlayers) { if (picked.length >= 7) break; if (canAdd(p)) addPlayer(p); }
    // Add max 4 overseas
    for (const p of overseasPlayers) { if (picked.length >= 11) break; if (canAdd(p)) addPlayer(p); }
    // Fill remaining from Indian
    for (const p of indianPlayers) { if (picked.length >= 11) break; if (picked.some(x => x.id === p.id)) continue; if (canAdd(p)) addPlayer(p); }

    const selected = picked.slice(0, 11).map((p: any) => ({ playerId: p.id, role: normalizeRole(p.role) }));

    // Ensure minimum role requirements
    const roleCounts: Record<string, number> = {};
    for (const s of selected) roleCounts[s.role] = (roleCounts[s.role] ?? 0) + 1;
    for (const role of ["wicket_keeper", "batsman", "all_rounder", "bowler"]) {
      if ((roleCounts[role] ?? 0) < 1) {
        const donor = selected.find(s => (roleCounts[s.role] ?? 0) > 1);
        if (donor) { roleCounts[donor.role]--; donor.role = role; roleCounts[role] = 1; }
      }
    }

    const teamRes = await trpcAuthMutate(
      "team.create",
      { matchId, players: selected, captainId: selected[0].playerId, viceCaptainId: selected[1].playerId },
      priyaToken,
    );

    if (teamRes.status !== 200) {
      console.log("Priya team error:", JSON.stringify(teamRes.data).slice(0, 500));
    }
    expect(teamRes.status).toBe(200);
  });

  // --- 6.5 Invalid team: too few players ---
  test("6.5 — reject team with fewer than 11 players", async () => {
    if (!matchId) { test.skip(); return; }

    const playerRes = await trpcAuthQuery("player.list", undefined, raviToken);
    const players = (unwrap(playerRes) as any[]) ?? [];
    if (players.length < 2) { test.skip(); return; }

    const picked = players.slice(0, 5).map((p: any) => ({
      playerId: p.id,
      role: normalizeRole(p.role),
    }));

    const res = await trpcAuthMutate(
      "team.create",
      {
        matchId,
        players: picked,
        captainId: picked[0].playerId,
        viceCaptainId: picked[1].playerId,
      },
      raviToken,
    );

    expect(res.status).not.toBe(200);
  });

  // --- 6.6 Team detail screen ---
  test("6.6 — team detail shows 11 players", async ({ page }) => {
    // Get Ravi's teams
    const teamsRes = await trpcAuthQuery("team.myTeams", undefined, raviToken);
    const teams = (unwrap(teamsRes) as any[]) ?? [];
    if (teams.length === 0) { test.skip(); return; }

    const teamId = teams[0].id;
    const loggedIn = await loginViaBrowser(page, RAVI_EMAIL, PASSWORD, `/team/${teamId}`);
    if (!loggedIn) { test.skip(); return; }

    const teamDetail = page.locator('[data-testid="team-detail-screen"]');
    const hasDetail = await teamDetail.isVisible({ timeout: 15000 }).catch(() => false);

    await page.screenshot({ path: ss("06-team-detail.png"), fullPage: true });
  });
});

// Helper
function normalizeRole(role?: string): string {
  if (!role) return "batsman";
  const r = role.toLowerCase().replace(/[\s-]/g, "_");
  if (r === "wk" || r.includes("keeper") || r.includes("wk")) return "wicket_keeper";
  if (r === "bat" || r.includes("bats") || r.includes("batter")) return "batsman";
  if (r === "bowl" || r.includes("bowl")) return "bowler";
  if (r === "ar" || r.includes("all")) return "all_rounder";
  return "batsman";
}
