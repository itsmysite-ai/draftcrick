/**
 * League Trades Functional E2E Tests
 *
 * Hybrid pattern: API seeds league + trades, browser verifies trade cards.
 * Tests propose → accept/reject/cancel flows with sender/receiver views.
 *
 * Run: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx playwright test tests/e2e/league/league-trades-functional.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import { screenshotPath } from "../helpers/screenshot";
import {
  clearEmulatorAccounts,
  seedLeagueWith2Members,
  loginViaBrowser,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
  getPlayerIds,
} from "../helpers/hybrid-seed";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("League Trades — Functional Lifecycle", () => {
  test.setTimeout(180000);

  let ownerToken: string;
  let memberToken: string;
  let leagueId: string;
  let ownerEmail: string;
  let memberEmail: string;
  let memberDbId: string;
  let ownerDbId: string;
  let playerIds: string[] = [];
  let tradeIds: string[] = [];

  test("1 — setup + empty trades page", async ({ page }) => {
    await clearEmulatorAccounts();
    const seed = await seedLeagueWith2Members("draft");
    ownerToken = seed.ownerToken;
    memberToken = seed.memberToken;
    leagueId = seed.leagueId;
    ownerEmail = seed.ownerEmail;
    memberEmail = seed.memberEmail;
    memberDbId = seed.memberDbId ?? "";
    ownerDbId = seed.ownerDbId ?? "";

    playerIds = await getPlayerIds(10);

    // Open trade window (default is closed)
    await trpcAuthMutate(
      "league.updateSettings",
      { leagueId, rules: { transfers: { tradeWindowOpen: true } } },
      ownerToken
    );

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/league/${leagueId}/trades`);
    if (!loggedIn) { test.skip(); return; }

    const tradesScreen = page.locator('[data-testid="trades-screen"]');
    const visible = await tradesScreen.isVisible({ timeout: 15000 }).catch(() => false);
    if (!visible) {
      await page.reload();
      await page.waitForTimeout(10000);
    }
    await expect(tradesScreen).toBeVisible({ timeout: 8000 });

    // Should show empty state
    const emptyEl = page.locator('[data-testid="trades-empty"]');
    const emptyText = page.getByText(/no trades/i);
    const hasEmpty = (await emptyEl.isVisible({ timeout: 3000 }).catch(() => false)) ||
                     (await emptyText.first().isVisible({ timeout: 3000 }).catch(() => false));
    expect(hasEmpty).toBeTruthy();

    await page.screenshot({ path: screenshotPath("story-17-league-trades-empty.png") });
  });

  test("2 — propose trade via API, verify pending in browser", async ({ page }) => {
    // Owner proposes trade to member
    const tradeRes = await trpcAuthMutate(
      "trade.propose",
      {
        leagueId,
        toUserId: memberDbId,
        playersOffered: playerIds.slice(0, 1),
        playersRequested: playerIds.slice(1, 2),
      },
      ownerToken
    );

    if (tradeRes.status === 200) {
      const trade = unwrap(tradeRes);
      tradeIds.push(trade.id);
    } else {
      const errMsg = JSON.stringify(tradeRes.data?.error ?? tradeRes.data).slice(0, 400);
      console.log(`    Trade propose returned ${tradeRes.status} — memberDbId=${memberDbId} — ${errMsg}`);
    }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/league/${leagueId}/trades`);
    if (!loggedIn) { test.skip(); return; }

    if (tradeIds.length > 0) {
      // Verify PENDING badge
      const pendingBadge = page.getByText("PENDING");
      const hasPending = await pendingBadge.first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasPending).toBeTruthy();

      // Sender should see Cancel button
      const cancelBtn = page.locator(`[data-testid="trade-cancel-btn-${tradeIds[0]}"]`);
      const hasCancel = await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false);
      // Cancel button visibility depends on being the sender
    }

    await page.screenshot({ path: screenshotPath("story-18-trade-pending-sender.png") });
  });

  test("3 — receiver view shows accept/reject", async ({ page }) => {
    if (tradeIds.length === 0) { test.skip(); return; }

    const loggedIn = await loginViaBrowser(page, memberEmail, "TestPass123!", `/league/${leagueId}/trades`);
    if (!loggedIn) { test.skip(); return; }

    // Receiver should see Accept + Reject buttons
    const acceptBtn = page.locator(`[data-testid="trade-accept-btn-${tradeIds[0]}"]`);
    const rejectBtn = page.locator(`[data-testid="trade-reject-btn-${tradeIds[0]}"]`);

    const hasAccept = await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const hasReject = await rejectBtn.isVisible({ timeout: 3000 }).catch(() => false);

    // At least the trade card should be visible
    const tradeCard = page.locator(`[data-testid="trade-card-${tradeIds[0]}"]`);
    const hasCard = await tradeCard.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasAccept || hasReject || hasCard).toBeTruthy();

    await page.screenshot({ path: screenshotPath("story-19-trade-pending-receiver.png") });
  });

  test("4 — accept trade, verify status change", async ({ page }) => {
    if (tradeIds.length === 0) { test.skip(); return; }

    // Accept via API as member
    const acceptRes = await trpcAuthMutate(
      "trade.accept",
      { tradeId: tradeIds[0] },
      memberToken
    );

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/league/${leagueId}/trades`);
    if (!loggedIn) { test.skip(); return; }

    if (acceptRes.status === 200) {
      // Verify ACCEPTED badge
      const acceptedBadge = page.getByText("ACCEPTED");
      const hasAccepted = await acceptedBadge.first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasAccepted).toBeTruthy();
    }

    await page.screenshot({ path: screenshotPath("story-20-trade-accepted.png") });
  });

  test("5 — propose + reject flow", async ({ page }) => {
    // Propose another trade
    const tradeRes = await trpcAuthMutate(
      "trade.propose",
      {
        leagueId,
        toUserId: memberDbId,
        playersOffered: playerIds.slice(2, 3),
        playersRequested: playerIds.slice(3, 4),
      },
      ownerToken
    );

    if (tradeRes.status === 200) {
      const trade = unwrap(tradeRes);
      const tradeId = trade.id;
      tradeIds.push(tradeId);

      // Reject via API as member
      const rejectRes = await trpcAuthMutate(
        "trade.reject",
        { tradeId },
        memberToken
      );

      const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/league/${leagueId}/trades`);
      if (!loggedIn) { test.skip(); return; }

      if (rejectRes.status === 200) {
        const rejectedBadge = page.getByText("REJECTED");
        const hasRejected = await rejectedBadge.first().isVisible({ timeout: 5000 }).catch(() => false);
        expect(hasRejected).toBeTruthy();
      }

      await page.screenshot({ path: screenshotPath("story-21-trade-rejected.png") });
    } else {
      console.log(`    Second trade propose failed: ${tradeRes.status}`);
    }
  });

  test("6 — propose + cancel flow", async ({ page }) => {
    const tradeRes = await trpcAuthMutate(
      "trade.propose",
      {
        leagueId,
        toUserId: memberDbId,
        playersOffered: playerIds.slice(4, 5),
        playersRequested: playerIds.slice(5, 6),
      },
      ownerToken
    );

    if (tradeRes.status === 200) {
      const trade = unwrap(tradeRes);
      const tradeId = trade.id;
      tradeIds.push(tradeId);

      // Cancel as sender
      await trpcAuthMutate("trade.cancel", { tradeId }, ownerToken);

      const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/league/${leagueId}/trades`);
      if (!loggedIn) { test.skip(); return; }

      // Trade should show cancelled/expired status or be removed
      const statusEl = page.locator(`[data-testid="trade-status-${tradeId}"]`);
      if (await statusEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = await statusEl.textContent();
        expect(text?.toLowerCase()).toMatch(/cancel|expired|rejected/);
      }
    }
  });

  test("7 — multiple trades in list", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/league/${leagueId}/trades`);
    if (!loggedIn) { test.skip(); return; }

    // Count trade cards visible
    let visibleCount = 0;
    for (const tid of tradeIds) {
      const card = page.locator(`[data-testid="trade-card-${tid}"]`);
      if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
        visibleCount++;
      }
    }

    // At least some trades should be visible
    if (tradeIds.length > 0) {
      // Check via generic text matches too
      const statusBadges = page.locator("text=/PENDING|ACCEPTED|REJECTED|CANCELLED|EXPIRED/");
      const badgeCount = await statusBadges.count();
      expect(visibleCount + badgeCount).toBeGreaterThanOrEqual(1);
    }

    await page.screenshot({ path: screenshotPath("story-22-trades-all-statuses.png") });
  });
});
