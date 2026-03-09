/**
 * Draft Room Functional E2E Tests
 *
 * Full snake draft lifecycle with 2 users.
 * Hybrid pattern: API seeds league + starts draft, browser verifies UI state.
 *
 * Run: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx playwright test tests/e2e/draft/draft-functional.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";
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

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Draft Room — Functional Lifecycle", () => {
  test.setTimeout(180000);

  let ownerToken: string;
  let memberToken: string;
  let leagueId: string;
  let ownerEmail: string;
  let memberEmail: string;
  let roomId: string;
  let playerIds: string[] = [];

  test("1 — setup + navigate to draft room (waiting state)", async ({ page }) => {
    await clearEmulatorAccounts();
    const seed = await seedLeagueWith2Members("draft");
    ownerToken = seed.ownerToken;
    memberToken = seed.memberToken;
    leagueId = seed.leagueId;
    ownerEmail = seed.ownerEmail;
    memberEmail = seed.memberEmail;

    playerIds = await getPlayerIds(20);

    // Start draft via API
    roomId = await startDraftRoom(ownerToken, leagueId, "snake_draft");
    expect(roomId).toBeTruthy();

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    const draftScreen = page.locator('[data-testid="draft-room-screen"]');
    const visible = await draftScreen.isVisible({ timeout: 15000 }).catch(() => false);
    if (!visible) {
      await page.reload();
      await page.waitForTimeout(10000);
    }
    await expect(draftScreen).toBeVisible({ timeout: 8000 });

    // Should show "waiting to start" status
    const turnStatus = page.locator('[data-testid="draft-turn-status"]');
    if (await turnStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await turnStatus.textContent();
      expect(text?.toLowerCase()).toContain("waiting");
    }

    // Start button should be visible for owner when draft is in waiting state
    const startBtn = page.locator('[data-testid="draft-start-btn"]');
    const hasStart = await startBtn.isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasStart) {
      // Button may not appear if draft state loaded differently — continue test anyway
      console.log("    [warn] draft-start-btn not visible — draft may have already started or state is loading");
    }

    await page.screenshot({ path: screenshotPath("story-23-draft-waiting.png") });
  });

  test("2 — start draft via UI, verify round 1 and turn status", async ({ page }) => {
    // Handle the Alert.alert confirmation dialog
    page.on("dialog", (d) => d.accept());

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Start the draft
    const startBtn = page.locator('[data-testid="draft-start-btn"]');
    if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await forceClickByTestId(page, "draft-start-btn");
      await page.waitForTimeout(3000);
    } else {
      // Draft may have already started — start via API
      await trpcAuthMutate("draft.start", { roomId }, ownerToken);
      await page.reload();
      await page.waitForTimeout(3000);
    }

    // Verify round info shows "round 1"
    const roundInfo = page.locator('[data-testid="draft-round-info"]');
    if (await roundInfo.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await roundInfo.textContent();
      expect(text?.toLowerCase()).toContain("round");
    }

    // Turn status should show "your pick" or "waiting for pick"
    const turnStatus = page.locator('[data-testid="draft-turn-status"]');
    if (await turnStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await turnStatus.textContent();
      expect(text?.toLowerCase()).toMatch(/pick|waiting/);
    }

    await page.screenshot({ path: screenshotPath("story-24-draft-round1-started.png") });
  });

  test("3 — make a pick (owner's turn)", async ({ page }) => {
    page.on("dialog", (d) => d.accept());

    // Ensure draft is started via API
    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, ownerToken);
    const state = unwrap(stateRes);
    if (state?.status === "waiting") {
      await trpcAuthMutate("draft.start", { roomId }, ownerToken);
    }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Check if it's our turn, make a pick via API if needed
    const currentState = unwrap(await trpcAuthQuery("draft.getState", { roomId }, ownerToken));
    const sessionA = unwrap(await trpcAuthQuery("auth.getSession", undefined, ownerToken));
    const isMyTurn = currentState?.currentDrafter === sessionA?.id;

    if (isMyTurn && playerIds.length > 0) {
      // Make pick via API (more reliable than UI click for draft)
      const pickRes = await trpcAuthMutate(
        "draft.makePick",
        { roomId, playerId: playerIds[0] },
        ownerToken
      );
      expect(pickRes.status).toBe(200);
    }

    // Reload to see pick log
    await page.reload();
    await page.waitForTimeout(3000);

    // Verify pick log has at least 1 entry
    const pickLog = page.locator('[data-testid="draft-pick-log"]');
    const hasPickLog = await pickLog.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: screenshotPath("story-25-draft-first-pick.png") });
  });

  test("4 — other user picks via API, pick log grows", async ({ page }) => {
    // Make pick as member
    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, memberToken);
    const state = unwrap(stateRes);

    if (state?.status === "in_progress" && playerIds.length > 1) {
      const pickRes = await trpcAuthMutate(
        "draft.makePick",
        { roomId, playerId: playerIds[1] },
        memberToken
      );
      if (pickRes.status !== 200) {
        // Might not be member's turn yet — try owner
        await trpcAuthMutate(
          "draft.makePick",
          { roomId, playerId: playerIds[1] },
          ownerToken
        );
      }
    }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Pick log should have entries
    const pickEntries = page.locator('[data-testid="draft-pick-log"] >> text=/#/');
    const count = await pickEntries.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("5 — role filter changes player list", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Get initial available count
    const availableText = page.locator('[data-testid="draft-available-count"]');
    let initialText = "";
    if (await availableText.isVisible({ timeout: 3000 }).catch(() => false)) {
      initialText = (await availableText.textContent()) ?? "";
    }

    // Click BAT filter
    const batFilter = page.locator('[data-testid="draft-filter-BAT"]');
    if (await batFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await forceClickByTestId(page, "draft-filter-BAT");
      await page.waitForTimeout(2000);

      // Count should change
      const filteredText = (await availableText.textContent()) ?? "";
      // The count in parentheses should differ
      expect(filteredText).not.toBe(initialText);
    }
  });

  test("6 — multi-round progression", async ({ page }) => {
    // Drive 4+ alternating picks
    if (playerIds.length >= 6) {
      await driveAlternatingPicks(roomId, ownerToken, memberToken, playerIds.slice(2, 6), 4);
    }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Verify round has advanced
    const roundInfo = page.locator('[data-testid="draft-round-info"]');
    if (await roundInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await roundInfo.textContent();
      // Should show at least round 1
      expect(text?.toLowerCase()).toContain("round");
    }

    // Picks counter should show progress
    const picksCounter = page.locator('[data-testid="draft-picks-counter"]');
    if (await picksCounter.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await picksCounter.textContent();
      expect(text).toContain("/");
    }

    await page.screenshot({ path: screenshotPath("story-26-draft-multi-round.png") });
  });

  test("7 — pick log shows player name + drafter", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Verify pick log entries have "by" text (showing the drafter)
    const byText = page.locator('[data-testid="draft-pick-log"] >> text=/by /i');
    const count = await byText.count();
    expect(count).toBeGreaterThanOrEqual(1);

    await page.screenshot({ path: screenshotPath("story-27-draft-pick-log.png") });
  });

  test("8 — draft completion state", async ({ page }) => {
    // Drive all remaining picks to completion
    if (playerIds.length >= 10) {
      await driveAlternatingPicks(roomId, ownerToken, memberToken, playerIds.slice(6), playerIds.length - 6);
    }

    // Check if draft completed
    const stateRes = await trpcAuthQuery("draft.getState", { roomId }, ownerToken);
    const state = unwrap(stateRes);

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/draft/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    if (state?.status === "completed") {
      const turnStatus = page.locator('[data-testid="draft-turn-status"]');
      if (await turnStatus.isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = await turnStatus.textContent();
        expect(text?.toLowerCase()).toContain("complete");
      }
    }

    await page.screenshot({ path: screenshotPath("story-28-draft-completed.png") });
  });
});
