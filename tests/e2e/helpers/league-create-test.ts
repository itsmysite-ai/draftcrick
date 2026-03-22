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

  // Navigate to create league page
  await page.goto("http://localhost:8081/league/create", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/tmp/create-league-01-config.png" });

  // Scroll down to see full config
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/create-league-02-config-scroll.png" });

  // Scroll to bottom to see "name my league" button
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/create-league-03-config-bottom.png" });

  // Click "name my league"
  const nameBtn = page.locator('[data-testid="generate-name-btn"]');
  if (await nameBtn.count() > 0) {
    console.log("Clicking 'name my league'...");
    await nameBtn.evaluate((el: any) => el.click());
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: "/tmp/create-league-04-q1.png" });

  // Check Q1 shows
  const q1Text = page.locator("text=who's this league for");
  console.log(`Q1 text found: ${await q1Text.count()}`);

  await browser.close();
  console.log("Done! Check /tmp/create-league-*.png");
})();
