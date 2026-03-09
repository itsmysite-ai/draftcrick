import { test } from "@playwright/test";

test("DraftPlayLogo v4 — flipped D + play triangle", async ({ page }) => {
  await page.goto("http://localhost:8081");
  await page.waitForTimeout(5000);
  
  // Screenshot the login screen which has the DraftPlayLogo
  await page.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/logo-v4-login.png", fullPage: true });
});
