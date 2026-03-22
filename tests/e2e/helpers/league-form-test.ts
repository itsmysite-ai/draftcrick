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

  // Go to home → match center → team builder
  await page.goto("http://localhost:8081/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const card = page.locator('[data-testid="featured-match-card"]');
  if (await card.count() > 0) await card.evaluate((el: any) => el.click());
  await page.waitForTimeout(3000);

  const url = page.url();
  const matchId = url.split("/match/")[1]?.split(/[?#/]/)[0];
  if (matchId) {
    await page.goto(`http://localhost:8081/team/create?matchId=${matchId}`, { waitUntil: "networkidle" });
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: "/tmp/league-01-contest-select.png" });

  // Expand the league form
  const leagueCard = page.locator('[data-testid="create-league-option"]');
  if (await leagueCard.count() > 0) {
    await leagueCard.evaluate((el: any) => {
      const pressable = el.querySelector('[role="button"]') || el.querySelector('div[tabindex]') || el.children[0];
      if (pressable) pressable.click();
      else el.click();
    });
    await page.waitForTimeout(2000);
  }

  // Verify config step shows (league type, "name my league" button)
  const nameBtn = page.locator('[data-testid="generate-name-btn"]');
  const nameBtnCount = await nameBtn.count();
  console.log(`"name my league" button found: ${nameBtnCount}`);

  await page.screenshot({ path: "/tmp/league-02-config.png" });

  // Scroll to see full config + button
  await page.evaluate(() => {
    const els = document.querySelectorAll('div');
    for (const el of els) {
      if (el.scrollHeight > el.clientHeight && getComputedStyle(el).overflow !== 'visible') {
        el.scrollTop = 600;
        break;
      }
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/tmp/league-03-config-scrolled.png" });

  // Click "name my league" to advance to Q1
  if (nameBtnCount > 0) {
    console.log("Clicking 'name my league'...");
    await nameBtn.evaluate((el: any) => el.click());
    await page.waitForTimeout(1500);
  }
  await page.screenshot({ path: "/tmp/league-04-q1.png" });

  // Check Q1 shows
  const q1Text = page.locator("text=who's this league for");
  console.log(`Q1 text found: ${await q1Text.count()}`);

  await browser.close();
  console.log("Done! Check /tmp/league-*.png");
})();
