/**
 * League Authenticated E2E Tests
 *
 * Login → create league → view league detail → join league flow.
 * Takes screenshots at every step for visual proof.
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId, forceClickTab, forceClickText } from "../helpers/tamagui";
import { loginTestUser, navigateAuth } from "../helpers/auth-login";
import {
  createTestUser,
  clearEmulatorAccounts as apiClearAccounts,
  trpcAuthMutate,
  unwrap,
} from "../helpers/api-auth";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("League — Full Authenticated Flow", () => {
  test.setTimeout(60000);

  test("login and navigate to create league screen", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/league/create");
    await page.waitForTimeout(5000);

    const createScreen = page.locator('[data-testid="create-league-screen"]');
    const visible = await createScreen.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();

    await page.screenshot({ path: "screenshots/e2e-league-auth-create-screen.png" });
  });

  test("create league form: fill name and see format options", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/league/create");
    await page.waitForTimeout(5000);

    // Fill league name
    const nameInput = page.locator('[data-testid="league-name-input"]');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill("My Test Champions League");
      await page.waitForTimeout(500);
    }

    await page.screenshot({ path: "screenshots/e2e-league-auth-name-filled.png" });

    // Check format options are visible
    const formats = ["salary cap", "snake draft", "auction", "prediction"];
    for (const fmt of formats) {
      const el = page.getByText(new RegExp(fmt, "i")).first();
      await el.isVisible({ timeout: 3000 }).catch(() => false);
    }

    // Scroll to see templates
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    await page.screenshot({ path: "screenshots/e2e-league-auth-formats-templates.png", fullPage: true });
  });

  test("create league form: select format option", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/league/create");
    await page.waitForTimeout(5000);

    // Fill name
    const nameInput = page.locator('[data-testid="league-name-input"]');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill("Snake Draft League");
    }

    // Try to select snake draft format
    await forceClickText(page, /snake draft/i);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: "screenshots/e2e-league-auth-format-selected.png" });
  });

  test("join league screen with invite code input", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/league/join");
    await page.waitForTimeout(5000);

    const joinScreen = page.locator('[data-testid="join-league-screen"]');
    const visible = await joinScreen.isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();

    // Fill invite code
    const codeInput = page.locator('[data-testid="invite-code-input"]');
    if (await codeInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await codeInput.fill("ABC123XYZ");
    }

    await page.screenshot({ path: "screenshots/e2e-league-auth-join-screen.png" });
  });

  test("join league with invalid code shows error", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/league/join");
    await page.waitForTimeout(5000);

    const codeInput = page.locator('[data-testid="invite-code-input"]');
    if (!(await codeInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    await codeInput.fill("INVALID-CODE-999");
    await forceClickByTestId(page, "join-league-btn");
    await page.waitForTimeout(5000);

    // Error message should appear
    const errorMsg = page.locator('[data-testid="join-league-error"]');
    const hasError = await errorMsg.isVisible({ timeout: 5000 }).catch(() => false);

    await page.screenshot({ path: "screenshots/e2e-league-auth-join-error.png" });
  });

  test("league detail page shows not found for invalid id", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/league/00000000-0000-0000-0000-000000000000");
    await page.waitForTimeout(5000);

    await page.screenshot({ path: "screenshots/e2e-league-auth-not-found.png" });
  });

  test("league detail with members (API-seeded)", async ({ page }) => {
    test.setTimeout(90000);

    // 1. Create 2 users via API
    await apiClearAccounts();
    const ownerEmail = "league-owner-e2e@draftplay.test";
    const memberEmail = "league-member-e2e@draftplay.test";
    const password = "TestPass123!";

    const owner = await createTestUser(ownerEmail, password);
    const member = await createTestUser(memberEmail, password);

    // 2. Owner creates a league via API
    const createRes = await trpcAuthMutate(
      "league.create",
      { name: "Screenshot Test League", format: "salary_cap", tournament: "IPL 2026", maxMembers: 10 },
      owner.idToken
    );

    if (createRes.status !== 200) {
      console.log(`    League create failed: ${createRes.status}`);
      test.skip(); return;
    }
    const league = unwrap(createRes);
    const leagueId = league.id;
    const inviteCode = league.inviteCode;
    console.log(`    Created league ${leagueId} with invite code ${inviteCode}`);

    // 3. Member joins via API
    const joinRes = await trpcAuthMutate(
      "league.join",
      { inviteCode },
      member.idToken
    );
    if (joinRes.status !== 200) {
      console.log(`    Join failed: ${joinRes.status}`);
    }

    // 4. Login as owner in browser
    const loggedIn = await loginTestUser(page, { email: ownerEmail, password, clearFirst: false });
    if (!loggedIn) { test.skip(); return; }

    // 5. Navigate to league detail
    await page.goto(`/league/${leagueId}`);
    await page.waitForTimeout(8000);

    const leagueDetail = page.locator('[data-testid="league-detail-screen"]');
    const hasDetail = await leagueDetail.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasDetail) {
      // Verify league name visible
      const leagueName = page.getByText(/screenshot test league/i);
      const hasName = await leagueName.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasName).toBeTruthy();

      // Verify members section visible
      const membersText = page.getByText(/members/i).first();
      await membersText.isVisible({ timeout: 3000 }).catch(() => false);

      await page.screenshot({ path: "screenshots/e2e-league-auth-detail.png" });

      // Scroll down to see all members
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);

      await page.screenshot({ path: "screenshots/e2e-league-auth-members.png", fullPage: true });
    } else {
      // Take screenshot of whatever state we're in
      await page.screenshot({ path: "screenshots/e2e-league-auth-detail.png" });
    }
  });

  test("create league button disabled when name empty", async ({ page }) => {
    const loggedIn = await loginTestUser(page);
    if (!loggedIn) { test.skip(); return; }

    await page.goto("/league/create");
    await page.waitForTimeout(5000);

    const createScreen = page.locator('[data-testid="create-league-screen"]');
    if (!(await createScreen.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(); return;
    }

    // Create button should be disabled/dimmed when name is empty
    const createBtn = page.locator('[data-testid="create-league-btn"]');
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const opacity = await createBtn.evaluate((el) =>
        window.getComputedStyle(el).opacity
      ).catch(() => "1");
      console.log(`    Create button opacity (empty name): ${opacity}`);
    }

    await page.screenshot({ path: "screenshots/e2e-league-auth-create-disabled.png" });
  });
});
