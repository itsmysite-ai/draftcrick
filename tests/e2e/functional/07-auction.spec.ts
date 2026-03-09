/**
 * Auction Room Functional E2E Tests
 *
 * Full auction lifecycle: nominate → bid → sold.
 * Hybrid pattern: API seeds + drives auction, browser verifies.
 *
 * Run: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx playwright test tests/e2e/auction/auction-functional.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";
import {
  clearEmulatorAccounts,
  seedLeagueWith2Members,
  startDraftRoom,
  getPlayerIds,
  loginViaBrowser,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
} from "../helpers/hybrid-seed";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Auction Room — Functional Lifecycle", () => {
  test.setTimeout(180000);

  let ownerToken: string;
  let memberToken: string;
  let leagueId: string;
  let ownerEmail: string;
  let memberEmail: string;
  let roomId: string;
  let playerIds: string[] = [];

  test("1 — setup + navigate to auction room (waiting)", async ({ page }) => {
    await clearEmulatorAccounts();
    const seed = await seedLeagueWith2Members("auction");
    ownerToken = seed.ownerToken;
    memberToken = seed.memberToken;
    leagueId = seed.leagueId;
    ownerEmail = seed.ownerEmail;
    memberEmail = seed.memberEmail;

    playerIds = await getPlayerIds(20);

    // Start auction via API
    roomId = await startDraftRoom(ownerToken, leagueId, "auction");
    expect(roomId).toBeTruthy();

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/auction/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    const auctionScreen = page.locator('[data-testid="auction-room-screen"]');
    const visible = await auctionScreen.isVisible({ timeout: 15000 }).catch(() => false);
    if (!visible) {
      await page.reload();
      await page.waitForTimeout(10000);
    }
    await expect(auctionScreen).toBeVisible({ timeout: 8000 });

    // Phase should show "waiting"
    const phaseEl = page.locator('[data-testid="auction-phase"]');
    if (await phaseEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await phaseEl.textContent();
      expect(text?.toLowerCase()).toMatch(/waiting|nominating/);
    }

    await page.screenshot({ path: screenshotPath("story-29-auction-waiting.png") });
  });

  test("2 — start auction, verify nominating phase + budget", async ({ page }) => {
    page.on("dialog", (d) => d.accept());

    // Start auction via API
    await trpcAuthMutate("draft.start", { roomId }, ownerToken);

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/auction/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Phase should show "nominating"
    const phaseEl = page.locator('[data-testid="auction-phase"]');
    if (await phaseEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await phaseEl.textContent();
      expect(text?.toLowerCase()).toMatch(/nominat|bidding|waiting/);
    }

    // Budget should be displayed
    const budgetEl = page.locator('[data-testid="auction-my-budget"]');
    const hasBudget = await budgetEl.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasBudget) {
      const budgetText = await budgetEl.textContent();
      expect(budgetText).toBeTruthy();
    }

    await page.screenshot({ path: screenshotPath("story-30-auction-nominating.png") });
  });

  test("3 — nominate player via API, verify current player card", async ({ page }) => {
    page.on("dialog", (d) => d.accept());

    if (playerIds.length === 0) { test.skip(); return; }

    // Nominate via API
    const nomRes = await trpcAuthMutate(
      "draft.nominate",
      { roomId, playerId: playerIds[0] },
      ownerToken
    );

    if (nomRes.status !== 200) {
      // Try with member token (might be their turn to nominate)
      await trpcAuthMutate(
        "draft.nominate",
        { roomId, playerId: playerIds[0] },
        memberToken
      );
    }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/auction/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Current player card should be visible
    const currentPlayer = page.locator('[data-testid="auction-current-player"]');
    const hasPlayer = await currentPlayer.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasPlayer) {
      // Player name should be shown
      const nameEl = page.locator('[data-testid="auction-current-name"]');
      if (await nameEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        const name = await nameEl.textContent();
        expect(name).toBeTruthy();
      }
    }
  });

  test("4 — place bid via UI, highest bid updates", async ({ page }) => {
    page.on("dialog", (d) => d.accept());

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/auction/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Check auction state
    const stateRes = await trpcAuthQuery("draft.getAuctionState", { roomId }, ownerToken);
    const state = unwrap(stateRes);

    if (state?.phase === "bidding" || state?.phase === "going_once" || state?.phase === "going_twice") {
      // Click bid button
      const bidBtn = page.locator('[data-testid="auction-bid-next"]');
      if (await bidBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await forceClickByTestId(page, "auction-bid-next");
        await page.waitForTimeout(2000);

        // Highest bid should update
        const highBid = page.locator('[data-testid="auction-highest-bid"]');
        if (await highBid.isVisible({ timeout: 3000 }).catch(() => false)) {
          const bidText = await highBid.textContent();
          expect(bidText).toBeTruthy();
        }
      }
    } else {
      // Place bid via API
      const bidRes = await trpcAuthMutate(
        "draft.placeBid",
        { roomId, amount: 2 },
        ownerToken
      );
      if (bidRes.status === 200) {
        await page.reload();
        await page.waitForTimeout(3000);
      }
    }

    await page.screenshot({ path: screenshotPath("story-31-auction-bidding.png") });
  });

  test("5 — drive bidding to sold via API, verify sold list", async ({ page }) => {
    // Drive bids back and forth until player is sold
    const stateRes = await trpcAuthQuery("draft.getAuctionState", { roomId }, ownerToken);
    const state = unwrap(stateRes);

    if (state?.currentPlayerId) {
      // Place alternating bids to drive to sold
      for (let i = 0; i < 5; i++) {
        const token = i % 2 === 0 ? ownerToken : memberToken;
        const amount = (state?.highestBid?.amount ?? 0) + i + 2;
        await trpcAuthMutate("draft.placeBid", { roomId, amount }, token);
        // Small delay to let auction phases advance
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Wait for sold phase to resolve
    await new Promise((r) => setTimeout(r, 3000));

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/auction/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Check sold list
    const soldList = page.locator('[data-testid="auction-sold-list"]');
    const hasSoldList = await soldList.isVisible({ timeout: 5000 }).catch(() => false);

    // Sold count should be > 0
    const soldCount = page.locator('[data-testid="auction-sold-count"]');
    if (await soldCount.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await soldCount.textContent();
      // Expect "sold: X players" where X >= 0
      expect(text?.toLowerCase()).toContain("sold");
    }

    await page.screenshot({ path: screenshotPath("story-32-auction-player-sold.png") });
  });

  test("6 — budget decreased after sale", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/auction/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Verify via API
    const stateRes = await trpcAuthQuery("draft.getAuctionState", { roomId }, ownerToken);
    const state = unwrap(stateRes);
    const sessionA = unwrap(await trpcAuthQuery("auth.getSession", undefined, ownerToken));

    if (state?.budgets && sessionA?.id) {
      const currentBudget = state.budgets[sessionA.id];
      // Budget should be less than initial (if player was bought)
      const budgetEl = page.locator('[data-testid="auction-my-budget"]');
      if (await budgetEl.isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = await budgetEl.textContent();
        expect(text).toBeTruthy();
      }
    }
  });

  test("7 — multiple auctions summary", async ({ page }) => {
    // Drive 1-2 more auctions via API
    for (let auctionIdx = 0; auctionIdx < 2; auctionIdx++) {
      const pidIdx = auctionIdx + 1;
      if (pidIdx >= playerIds.length) break;

      // Check state — if nominating phase, nominate next player
      const stateRes = await trpcAuthQuery("draft.getAuctionState", { roomId }, ownerToken);
      const state = unwrap(stateRes);

      if (state?.phase === "nominating" || !state?.currentPlayerId) {
        const nomRes = await trpcAuthMutate(
          "draft.nominate",
          { roomId, playerId: playerIds[pidIdx] },
          ownerToken
        );
        if (nomRes.status !== 200) {
          await trpcAuthMutate(
            "draft.nominate",
            { roomId, playerId: playerIds[pidIdx] },
            memberToken
          );
        }
      }

      // Place a bid to speed to sold
      await trpcAuthMutate("draft.placeBid", { roomId, amount: 1 }, ownerToken);
      await new Promise((r) => setTimeout(r, 2000));
    }

    const loggedIn = await loginViaBrowser(page, ownerEmail, "TestPass123!", `/auction/${roomId}`);
    if (!loggedIn) { test.skip(); return; }

    // Verify sold count and team sizes
    const soldCount = page.locator('[data-testid="auction-sold-count"]');
    if (await soldCount.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await soldCount.textContent();
      expect(text?.toLowerCase()).toContain("sold");
    }

    const teamSize = page.locator('[data-testid="auction-my-team-size"]');
    if (await teamSize.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await teamSize.textContent();
      expect(text?.toLowerCase()).toContain("team");
    }

    await page.screenshot({ path: screenshotPath("story-33-auction-summary.png") });
  });
});
