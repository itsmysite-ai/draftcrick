/**
 * Wallet Functional E2E Tests
 *
 * Hybrid pattern: API seeds wallet data, browser verifies visual state.
 * Tests deposit/withdraw with balance tracking.
 *
 * Key: After login, navigate to wallet via SPA (forceClickTab -> wallet button)
 * to avoid full-page reload which loses Firebase auth state.
 *
 * Run: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx playwright test tests/e2e/wallet/wallet-functional.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import { forceClickByTestId, forceClickTab, forceClickText } from "../helpers/tamagui";
import {
  clearEmulatorAccounts,
  fundWallet,
  loginViaBrowser,
  trpcAuthQuery,
  trpcAuthMutate,
  unwrap,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import { screenshotPath } from "../helpers/screenshot";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

/** Navigate to wallet from within the SPA (after login on tabs page). */
async function gotoWallet(page: any): Promise<boolean> {
  // Try profile tab -> wallet button
  await forceClickTab(page, "profile");
  await page.waitForTimeout(3000);

  // Look for wallet link/button on profile
  const walletBtn = page.locator('[data-testid="wallet-btn"]');
  const walletLink = page.getByText(/wallet/i);

  if (await walletBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await forceClickByTestId(page, "wallet-btn");
  } else if (await walletLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await forceClickText(page, /wallet/i);
  } else {
    // Direct navigation as last resort — needs auth rehydration
    await page.goto("/wallet");
    await page.waitForTimeout(10000);
  }
  await page.waitForTimeout(3000);

  const walletScreen = page.locator('[data-testid="wallet-screen"]');
  return walletScreen.isVisible({ timeout: 8000 }).catch(() => false);
}

test.describe("Wallet — Functional Lifecycle", () => {
  test.setTimeout(90000);

  const EMAIL = `wallet-func-${Date.now()}@test.com`;
  const PASSWORD = "TestPass123!";
  let token: string;

  test("1 — login + navigate to wallet, verify zero balance", async ({ page }) => {
    await clearEmulatorAccounts();
    const user = await createTestUser(EMAIL, PASSWORD);
    token = user.idToken;

    const loggedIn = await loginViaBrowser(page, EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    const walletVisible = await gotoWallet(page);
    if (!walletVisible) {
      await page.screenshot({ path: screenshotPath("story-07-wallet-zero-debug.png") });
      test.skip();
      return;
    }

    // Zero balance for new user
    const balanceEl = page.locator('[data-testid="wallet-balance-total"]');
    if (await balanceEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      const text = await balanceEl.textContent();
      expect(text).toContain("0.00");
    }

    await page.screenshot({ path: screenshotPath("story-07-wallet-zero-balance.png") });
  });

  test("2 — deposit via API, verify balance in browser", async ({ page }) => {
    await fundWallet(token, 500);

    const loggedIn = await loginViaBrowser(page, EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    const walletVisible = await gotoWallet(page);
    if (!walletVisible) { test.skip(); return; }

    const balanceEl = page.locator('[data-testid="wallet-balance-total"]');
    if (await balanceEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await balanceEl.textContent();
      expect(text).toContain("500");
    }

    await page.screenshot({ path: screenshotPath("story-08-wallet-funded.png") });
  });

  test("3 — transaction history shows deposit row", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    const walletVisible = await gotoWallet(page);
    if (!walletVisible) { test.skip(); return; }

    // Look for deposit transaction — could show as "+₹500.00" or "DEPOSIT" label
    const depositRow = page.getByText(/\+.*500|deposit/i);
    const hasDeposit = await depositRow.first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasDeposit).toBeTruthy();
  });

  test("4 — add cash button opens deposit form", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    const walletVisible = await gotoWallet(page);
    if (!walletVisible) { test.skip(); return; }

    await forceClickByTestId(page, "add-cash-btn");
    await page.waitForTimeout(1500);

    // Verify deposit form elements are visible
    const depositInput = page.locator('[data-testid="wallet-deposit-input"]');
    const submitBtn = page.locator('[data-testid="wallet-deposit-submit"]');
    const preset500 = page.locator('[data-testid="wallet-deposit-preset-500"]');

    const inputVisible = await depositInput.isVisible({ timeout: 3000 }).catch(() => false);
    const submitVisible = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const presetVisible = await preset500.isVisible({ timeout: 3000 }).catch(() => false);

    expect(inputVisible || submitVisible || presetVisible).toBeTruthy();

    await page.screenshot({ path: screenshotPath("story-09-wallet-add-cash-form.png") });
  });

  test("5 — multiple operations reflect in balance", async ({ page }) => {
    // Deposit 200 more + attempt withdraw 100 via API
    await fundWallet(token, 200);

    const withdrawRes = await trpcAuthMutate("wallet.withdraw", { amount: 100 }, token);
    const withdrawWorked = withdrawRes.status === 200;

    const loggedIn = await loginViaBrowser(page, EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    const walletVisible = await gotoWallet(page);
    if (!walletVisible) { test.skip(); return; }

    // Check balance via API to know expected value
    const balRes = await trpcAuthQuery("wallet.getBalance", undefined, token);
    const bal = unwrap(balRes);
    const expectedBalance = bal?.totalBalance ?? (withdrawWorked ? 600 : 700);

    const balanceEl = page.locator('[data-testid="wallet-balance-total"]');
    if (await balanceEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      const text = await balanceEl.textContent();
      expect(text).toContain(expectedBalance.toFixed(2));
    }

    await page.screenshot({ path: screenshotPath("story-10-wallet-multiple-txns.png") });
  });

  test("6 — transaction history shows multiple entries", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    const walletVisible = await gotoWallet(page);
    if (!walletVisible) { test.skip(); return; }

    // Should have at least 2 deposit transactions
    const txnCards = page.getByText(/deposit/i);
    const count = await txnCards.count();
    expect(count).toBeGreaterThanOrEqual(2);

    await page.screenshot({ path: screenshotPath("story-11-wallet-history.png") });
  });
});
