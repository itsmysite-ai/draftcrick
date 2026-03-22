import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

  // 1. Login
  await page.goto("http://localhost:8081/auth/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.fill('[data-testid="email-input"]', "test@test.com");
  await page.fill('[data-testid="password-input"]', "TestPass123!");
  const loginBtn = page.locator('[data-testid="submit-button"]');
  if (await loginBtn.count() > 0) {
    await loginBtn.click();
  } else {
    await page.locator('[data-testid="login-button"]').click();
  }
  await page.waitForTimeout(4000);

  // 2. Navigate to home
  await page.goto("http://localhost:8081/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // 3. Click featured match card to go to match center
  const featuredCard = page.locator('[data-testid="featured-match-card"]');
  if (await featuredCard.count() > 0) {
    console.log("Clicking featured match card...");
    await featuredCard.evaluate((el: any) => el.click());
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "/tmp/fab-02-match-center.png" });
    console.log("On match center, URL:", page.url());
  } else {
    console.log("No featured match card found");
    await page.screenshot({ path: "/tmp/fab-02-no-featured.png" });
    await browser.close();
    return;
  }

  // 4. Click "Build Team" on match center
  const buildTeamBtn = page.locator('[data-testid="build-team-btn"]');
  if (await buildTeamBtn.count() > 0) {
    console.log("Clicking build team btn...");
    await buildTeamBtn.evaluate((el: any) => el.click());
  } else {
    // Try navigating directly using URL
    const url = page.url();
    const matchId = url.split("/match/")[1]?.split(/[?#/]/)[0];
    if (matchId) {
      console.log(`Direct nav to team/create with matchId: ${matchId}`);
      await page.goto(`http://localhost:8081/team/create?matchId=${matchId}`, { waitUntil: "networkidle" });
    }
  }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "/tmp/fab-03-contest-select.png" });

  // 5. Click first contest option to advance to pick step
  const contestOption = page.locator('[data-testid^="contest-option-"]').first();
  if (await contestOption.count() > 0) {
    console.log("Found contest option, clicking...");
    await contestOption.evaluate((el: any) => el.click());
    await page.waitForTimeout(5000);
  } else {
    console.log("No contest options found, checking if already on pick step...");
  }

  await page.screenshot({ path: "/tmp/fab-04-player-pick.png" });

  // 6. Select a few players so the list has content behind FAB
  const playerCards = page.locator('[data-testid^="player-card-"]');
  const cardCount = await playerCards.count();
  console.log(`Player cards found: ${cardCount}`);
  // Click first 3 players to select them (adds visual content)
  for (let i = 0; i < Math.min(3, cardCount); i++) {
    await playerCards.nth(i).evaluate((el: any) => el.click());
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);

  // 7. Check for FAB
  const fab = page.locator('[data-testid="ai-insights-fab"]');
  const fabCount = await fab.count();
  console.log(`FAB elements found: ${fabCount}`);

  if (fabCount > 0) {
    const box = await fab.boundingBox();
    console.log("FAB position:", JSON.stringify(box));
  }

  await page.screenshot({ path: "/tmp/fab-05-final.png" });

  // 8. Scroll down so FAB overlaps player cards
  await page.evaluate(() => {
    const scrollable = document.querySelector('[data-testid="player-list"]')
      || document.querySelector('[role="list"]')
      || document.querySelector('div[style*="overflow"]');
    if (scrollable) scrollable.scrollTop = 200;
    else window.scrollBy(0, 300);
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/fab-06-scrolled.png" });

  await browser.close();
  console.log("Done! Check /tmp/fab-*.png");
})();
