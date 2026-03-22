import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

  // Login
  await page.goto("http://localhost:8081/auth/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.fill('[data-testid="email-input"]', "test@test.com");
  await page.fill('[data-testid="password-input"]', "TestPass123!");
  const loginBtn = page.locator('[data-testid="submit-button"]');
  if (await loginBtn.count() > 0) await loginBtn.click();
  else await page.locator('[data-testid="login-button"]').click();
  await page.waitForTimeout(4000);

  // Go to home → match → team builder
  await page.goto("http://localhost:8081/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const card = page.locator('[data-testid="featured-match-card"]');
  if (await card.count() > 0) await card.evaluate((el: any) => el.click());
  await page.waitForTimeout(3000);

  const url = page.url();
  const matchId = url.split("/match/")[1]?.split(/[?#/]/)[0];
  if (!matchId) { console.log("No match found"); await browser.close(); return; }

  // Go directly to team builder, skip to pick step by selecting a contest if available
  await page.goto(`http://localhost:8081/team/create?matchId=${matchId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // Select first contest if available
  const contestOpt = page.locator('[data-testid^="contest-option-"]').first();
  if (await contestOpt.count() > 0) {
    await contestOpt.evaluate((el: any) => el.click());
    await page.waitForTimeout(3000);
  }

  // We need to pick 11 players and get to captain step to see the team name
  // For now just screenshot whatever state we're in
  await page.screenshot({ path: "/tmp/team-name-01-current.png" });
  console.log("Current URL:", page.url());
  console.log("Done! Check /tmp/team-name-01-current.png");

  await browser.close();
})();
