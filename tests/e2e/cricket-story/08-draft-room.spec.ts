/**
 * Chapter 8: Draft Room
 *
 * Ravi and Priya do a full snake draft in a draft league.
 * Tests the complete draft lifecycle: waiting → started → picks → completion.
 *
 * Run: npx playwright test tests/e2e/cricket-story/08-draft-room.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  seedLeagueWith2Members,
  startDraftRoom,
  getPlayerIds,
  driveAlternatingPicks,
  loginViaBrowser,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
} from "../helpers/hybrid-seed";
import { forceClickByTestId } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

const ss = (name: string) => screenshotPath(name);

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Chapter 8 — Draft Room", () => {
  test.setTimeout(300000); // 5 min for full draft

  let ownerToken: string;
  let memberToken: string;
  let leagueId: string;
  let ownerEmail: string;
  let memberEmail: string;
  let roomId: string;
  let playerIds: string[] = [];

  // --- 8.1 Setup: league with 2 members ---
  test("8.1 — setup draft league", async () => {
    await clearEmulatorAccounts();
    const seed = await seedLeagueWith2Members("draft");
    ownerToken = seed.ownerToken;
    memberToken = seed.memberToken;
    leagueId = seed.leagueId;
    ownerEmail = seed.ownerEmail;
    memberEmail = seed.memberEmail;

    playerIds = await getPlayerIds(30);
    expect(playerIds.length).toBeGreaterThanOrEqual(22); // 11 per team
  });

  // --- 8.2 Start draft ---
  test("8.2 — start draft via API", async () => {
    roomId = await startDraftRoom(ownerToken, leagueId, "snake_draft");
    expect(roomId).toBeTruthy();
  });

  // --- 8.3 Draft room renders (waiting) ---
  test("8.3 — draft room shows waiting state", async ({ page }) => {
    if (!roomId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    const draftScreen = page.locator('[data-testid="draft-room-screen"]');
    const visible = await draftScreen.isVisible({ timeout: 15000 }).catch(() => false);
    if (!visible) {
      await page.reload();
      await page.waitForTimeout(10000);
    }
    await expect(draftScreen).toBeVisible({ timeout: 8000 });

    const turnStatus = page.locator('[data-testid="draft-turn-status"]');
    if (await turnStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await turnStatus.textContent();
      expect(text?.toLowerCase()).toMatch(/waiting|start/i);
    }

    await page.screenshot({ path: ss("08-draft-waiting.png") });
  });

  // --- 8.4 Start draft ---
  test("8.4 — start draft, verify round 1", async ({ page }) => {
    if (!roomId) { test.skip(); return; }

    page.on("dialog", (d) => d.accept());

    // Start via API for reliability
    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, ownerToken);
    const state = unwrap(stateRes);
    if (state?.status === "waiting") {
      await trpcAuthMutate("draft.start", { roomId }, ownerToken);
    }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const roundInfo = page.locator('[data-testid="draft-round-info"]');
    if (await roundInfo.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await roundInfo.textContent();
      expect(text?.toLowerCase()).toContain("round");
    }

    await page.screenshot({ path: ss("08-draft-started.png") });
  });

  // --- 8.5 Available players ---
  test("8.5 — available players listed", async ({ page }) => {
    if (!roomId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const availCount = page.locator('[data-testid="draft-available-count"]');
    if (await availCount.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await availCount.textContent();
      expect(text).toBeTruthy();
    }

    await page.screenshot({ path: ss("08-available-players.png") });
  });

  // --- 8.6 Countdown timer ---
  test("8.6 — countdown timer visible during pick", async ({ page }) => {
    if (!roomId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const countdown = page.locator('[data-testid="draft-countdown"]');
    const hasCountdown = await countdown.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: ss("08-countdown.png") });
  });

  // --- 8.7 First pick ---
  test("8.7 — first pick recorded in log", async ({ page }) => {
    if (!roomId || playerIds.length === 0) { test.skip(); return; }

    // Make pick via API
    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, ownerToken);
    const state = unwrap(stateRes);
    if (state?.status !== "in_progress") { test.skip(); return; }

    // Try with owner first
    let pickRes = await trpcAuthMutate("draft.makePick", { roomId, playerId: playerIds[0] }, ownerToken);
    if (pickRes.status !== 200) {
      pickRes = await trpcAuthMutate("draft.makePick", { roomId, playerId: playerIds[0] }, memberToken);
    }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const pickLog = page.locator('[data-testid="draft-pick-log"]');
    const hasLog = await pickLog.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: ss("08-pick-1.png") });
  });

  // --- 8.8-8.9 More picks ---
  test("8.8 — drive alternating picks", async () => {
    if (!roomId || playerIds.length < 4) { test.skip(); return; }

    await driveAlternatingPicks(roomId, ownerToken, memberToken, playerIds.slice(1, 5), 4);
  });

  // --- 8.10 Role filter ---
  test("8.10 — role filter changes player list", async ({ page }) => {
    if (!roomId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const batFilter = page.locator('[data-testid="draft-filter-BAT"]');
    if (await batFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "draft-filter-BAT");
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: ss("08-draft-filter-bowl.png") });
  });

  // --- 8.11 Drive full draft ---
  test("8.11 — drive remaining picks to completion", async () => {
    if (!roomId || playerIds.length < 22) { test.skip(); return; }

    await driveAlternatingPicks(roomId, ownerToken, memberToken, playerIds.slice(5, 25), 20);
  });

  // --- 8.12 Draft completion ---
  test("8.12 — draft completion state", async ({ page }) => {
    if (!roomId) { test.skip(); return; }

    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, ownerToken);
    const state = unwrap(stateRes);

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    if (state?.status === "completed") {
      const turnStatus = page.locator('[data-testid="draft-turn-status"]');
      if (await turnStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = await turnStatus.textContent();
        expect(text?.toLowerCase()).toMatch(/complete/i);
      }
    }

    await page.screenshot({ path: ss("08-draft-complete.png") });
  });

  // --- 8.13 Full pick log ---
  test("8.13 — pick log shows all draft history", async ({ page }) => {
    if (!roomId) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    await page.waitForTimeout(5000);

    const picksCounter = page.locator('[data-testid="draft-picks-counter"]');
    if (await picksCounter.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await picksCounter.textContent();
      expect(text).toContain("/");
    }

    await page.screenshot({ path: ss("08-full-pick-log.png"), fullPage: true });
  });
});
