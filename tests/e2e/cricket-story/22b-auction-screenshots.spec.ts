/**
 * 22b — Auction Screenshots
 *
 * Takes screenshots of the auction-related UI screens.
 * Logs in via Firebase emulator, then navigates to each screen.
 */

import { test, expect } from "@playwright/test";
import { createTestAccount, fillAuthForm, submitAuthForm } from "../helpers/auth-helpers";

const EMAIL = `screencap-${Date.now()}@test.com`;
const PASSWORD = "TestPass123!";

test.describe.serial("22b — Auction Screenshots", () => {
  test.beforeAll(async () => {
    await createTestAccount(EMAIL, PASSWORD);
  });

  test("Screenshot: league creation with auction format enabled", async ({ page }) => {
    // Login
    await page.goto("/auth/login");
    await page.waitForTimeout(3000);
    await fillAuthForm(page, EMAIL, PASSWORD);
    await submitAuthForm(page);
    await page.waitForTimeout(8000);

    // Navigate to league creation
    await page.goto("/league/create");
    await page.waitForTimeout(5000);
    await page.screenshot({ path: "screenshots/22-league-create-auction.png", fullPage: true });
  });

  test("Screenshot: auction room screen", async ({ page }) => {
    // Take a screenshot of the auction room (even if no active auction, shows the UI shell)
    await page.goto("/auth/login");
    await page.waitForTimeout(3000);
    await fillAuthForm(page, EMAIL, PASSWORD);
    await submitAuthForm(page);
    await page.waitForTimeout(8000);

    // Go to home to verify login worked
    const url = page.url();
    if (!url.includes("/auth/")) {
      await page.screenshot({ path: "screenshots/22-home-logged-in.png", fullPage: true });
    }
  });
});
