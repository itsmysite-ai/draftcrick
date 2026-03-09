import { test, expect } from "@playwright/test";
import { clearEmulatorAccounts, fillAuthForm } from "./auth-helpers";
import { forceClickByTestId } from "../helpers/tamagui";

const TEST_PASSWORD = "TestPass123!";

test.describe("Registration Compliance Flow", () => {
  test.beforeEach(async () => {
    await clearEmulatorAccounts();
  });

  test("full registration flow with compliance checkboxes", async ({ page }) => {
    const email = `compliance_${Date.now()}@draftplay.test`;

    // Capture console logs from the browser
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("[tRPC]") || msg.text().includes("[AUTH]")) {
        consoleLogs.push(msg.text());
      }
    });

    // Track network requests
    const requests: { url: string; status: number }[] = [];
    page.on("response", (response) => {
      if (response.url().includes("/trpc/")) {
        requests.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto("/auth/register");
    await page.waitForTimeout(3000);

    // Fill in email and password
    await fillAuthForm(page, email, TEST_PASSWORD);

    // Check both checkboxes
    await forceClickByTestId(page, "age-confirm-checkbox");
    await page.waitForTimeout(500);
    await forceClickByTestId(page, "terms-accept-checkbox");
    await page.waitForTimeout(500);

    // Click submit
    await forceClickByTestId(page, "submit-button");

    // Wait for registration + API calls
    await page.waitForTimeout(8000);

    // Take screenshot
    await page.screenshot({ path: "screenshots/compliance-register-result.png" });

    // Log all console output and network
    console.log("=== Console logs ===");
    consoleLogs.forEach((l) => console.log(" ", l));
    console.log("=== Network requests ===");
    requests.forEach((r) => console.log(` ${r.status} ${r.url.split("?")[0]}`));
    console.log("=== Final URL ===");
    console.log(" ", page.url());

    // Check for visible auth error
    const errorEl = page.locator('[data-testid="auth-error"]');
    const errorVisible = await errorEl.isVisible().catch(() => false);
    if (errorVisible) {
      console.log("Auth error:", await errorEl.textContent());
    }

    // Assertions
    const acceptTermsReqs = requests.filter((r) => r.url.includes("acceptTerms"));
    expect(acceptTermsReqs.every((r) => r.status === 200)).toBe(true);
    expect(page.url()).not.toContain("/auth/register");
  });
});
