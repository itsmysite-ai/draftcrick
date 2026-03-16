import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 }, // iPhone 15 Pro Max
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  // Login first
  console.log("Logging in...");
  await page.goto("http://localhost:8081/auth/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const emailInput = page.locator('[data-testid="email-input"]');
  const passwordInput = page.locator('[data-testid="password-input"]');
  if (await emailInput.isVisible()) {
    await emailInput.fill("admin@draftplay.ai");
    await passwordInput.fill("test1234");
    await page.locator('[data-testid="submit-button"]').click();
    await page.waitForTimeout(5000);
  }

  // Helper: force click by testID (for Tamagui)
  async function forceClick(testId: string) {
    await page.evaluate((id: string) => {
      const target = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse" as const };
      target.dispatchEvent(new PointerEvent("pointerdown", opts));
      target.dispatchEvent(new PointerEvent("pointerup", opts));
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
    }, testId);
    await page.waitForTimeout(1000);
  }

  // Helper: force click tab by label
  async function forceClickTab(label: string) {
    await page.evaluate((tabLabel: string) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent?.trim();
        if (text === tabLabel) {
          let target = walker.currentNode.parentElement;
          while (target && target !== document.body) {
            const cs = window.getComputedStyle(target);
            if (cs.cursor === "pointer") break;
            target = target.parentElement;
          }
          if (!target) target = walker.currentNode.parentElement;
          if (!target) return;
          const rect = target.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse" as const };
          target.dispatchEvent(new PointerEvent("pointerdown", opts));
          target.dispatchEvent(new PointerEvent("pointerup", opts));
          target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
          return;
        }
      }
    }, label);
    await page.waitForTimeout(3000);
  }

  // Helper: scroll element into view
  async function scrollTo(testId: string) {
    await page.evaluate((id: string) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, testId);
    await page.waitForTimeout(600);
  }

  // ═══════════════════════════════════════════
  // DASHBOARD QA
  // ═══════════════════════════════════════════
  console.log("\n═══ DASHBOARD QA ═══");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  // 1. Dashboard above the fold
  console.log("1. Dashboard - above the fold");
  await page.screenshot({ path: "screenshots/16-01-dashboard.png" });

  // 2. Featured match card
  const featured = page.locator('[data-testid="featured-match-card"]');
  if (await featured.isVisible()) {
    console.log("2. Featured match card ✓");
  } else {
    console.log("2. Featured match card ✗ NOT VISIBLE");
  }

  // ── BUTTON: Featured card "view match" / "create team" ──
  console.log("\n── CLICK: Featured card CTA ──");
  const viewMatchBtn = page.locator('[data-testid="featured-view-match-btn"]');
  const createTeamBtn = page.locator('[data-testid="featured-create-team-btn"]');
  if (await viewMatchBtn.isVisible().catch(() => false)) {
    console.log("   Button: view match");
    await forceClick("featured-view-match-btn");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-02-click-featured-view-match.png" });
    await page.goBack();
    await page.waitForTimeout(3000);
  } else if (await createTeamBtn.isVisible().catch(() => false)) {
    console.log("   Button: create team");
    await forceClick("featured-create-team-btn");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-02-click-featured-create-team.png" });
    await page.goBack();
    await page.waitForTimeout(3000);
  } else {
    console.log("   ✗ No CTA button found");
  }

  // ── BUTTON: More matches card 0 (whole card tap) ──
  console.log("\n── CLICK: More matches card 0 (card tap) ──");
  await scrollTo("upcoming-match-0");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/16-03-more-matches.png" });

  if (await page.locator('[data-testid="upcoming-match-0"]').isVisible().catch(() => false)) {
    await forceClick("upcoming-match-0");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-04-click-match-card-0.png" });
    await page.goBack();
    await page.waitForTimeout(3000);
  } else {
    console.log("   ✗ upcoming-match-0 not visible");
  }

  // ── BUTTON: More matches "view match" button 0 ──
  console.log("\n── CLICK: More matches 'view match' button 0 ──");
  await scrollTo("play-match-btn-0");
  if (await page.locator('[data-testid="play-match-btn-0"]').isVisible().catch(() => false)) {
    await forceClick("play-match-btn-0");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-05-click-view-match-btn-0.png" });
    await page.goBack();
    await page.waitForTimeout(3000);
  } else {
    console.log("   ✗ play-match-btn-0 not visible");
  }

  // ── BUTTON: "See all" ──
  console.log("\n── CLICK: 'see all' button ──");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text && /see all/i.test(text)) {
        let target = walker.currentNode.parentElement;
        while (target && target !== document.body) {
          const cs = window.getComputedStyle(target);
          if (cs.cursor === "pointer") break;
          target = target.parentElement;
        }
        if (!target) target = walker.currentNode.parentElement;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse" as const };
        target.dispatchEvent(new PointerEvent("pointerdown", opts));
        target.dispatchEvent(new PointerEvent("pointerup", opts));
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
        return;
      }
    }
  });
  await page.waitForTimeout(4000);
  console.log(`   → URL: ${page.url()}`);
  await page.screenshot({ path: "screenshots/16-06-click-see-all.png" });

  // ── BUTTON: Highlight - standings ──
  console.log("\n── CLICK: Highlight - standings ──");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await scrollTo("highlight-standings");
  if (await page.locator('[data-testid="highlight-standings"]').isVisible().catch(() => false)) {
    await forceClick("highlight-standings");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-07-click-highlight-standings.png" });
  } else {
    console.log("   ✗ highlight-standings not visible");
  }

  // ── BUTTON: Highlight - predictions ──
  console.log("\n── CLICK: Highlight - predictions ──");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await scrollTo("highlight-predictions");
  if (await page.locator('[data-testid="highlight-predictions"]').isVisible().catch(() => false)) {
    await forceClick("highlight-predictions");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-08-click-highlight-predictions.png" });
  } else {
    console.log("   ✗ highlight-predictions not visible");
  }

  // ── BUTTON: Highlight - awards ──
  console.log("\n── CLICK: Highlight - awards ──");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await scrollTo("highlight-awards");
  if (await page.locator('[data-testid="highlight-awards"]').isVisible().catch(() => false)) {
    await forceClick("highlight-awards");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-09-click-highlight-awards.png" });
  } else {
    console.log("   ✗ highlight-awards not visible");
  }

  // ── BUTTON: Quick action - Guru ──
  console.log("\n── CLICK: Quick action - Guru ──");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await scrollTo("nav-guru");
  if (await page.locator('[data-testid="nav-guru"]').isVisible().catch(() => false)) {
    await forceClick("nav-guru");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-10-click-guru.png" });
  } else {
    console.log("   ✗ nav-guru not visible");
  }

  // ── BUTTON: Quick action - My Teams ──
  console.log("\n── CLICK: Quick action - My Teams ──");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await scrollTo("nav-my-teams");
  if (await page.locator('[data-testid="nav-my-teams"]').isVisible().catch(() => false)) {
    await forceClick("nav-my-teams");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-11-click-my-teams.png" });
  } else {
    console.log("   ✗ nav-my-teams not visible");
  }

  // ── BUTTON: Quick action - Inbox ──
  console.log("\n── CLICK: Quick action - Inbox ──");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await scrollTo("nav-notifications");
  if (await page.locator('[data-testid="nav-notifications"]').isVisible().catch(() => false)) {
    await forceClick("nav-notifications");
    await page.waitForTimeout(4000);
    console.log(`   → URL: ${page.url()}`);
    await page.screenshot({ path: "screenshots/16-12-click-inbox.png" });
  } else {
    console.log("   ✗ nav-notifications not visible");
  }

  // ── Tab bar ──
  console.log("\n── CLICK: Tab bar - all tabs ──");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  for (const tab of ["contests", "live", "leagues", "profile"]) {
    await forceClickTab(tab);
    console.log(`   Tab "${tab}" → ${page.url()}`);
    await page.screenshot({ path: `screenshots/16-13-tab-${tab}.png` });
  }
  await forceClickTab("home");
  console.log(`   Tab "home" → ${page.url()}`);

  // ═══════════════════════════════════════════
  // MATCH CENTER COMPARISON
  // ═══════════════════════════════════════════
  console.log("\n═══ MATCH CENTER (GOLD STANDARD) ═══");
  await page.goto("http://localhost:8081/(tabs)/live", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "screenshots/16-14-match-center.png" });

  await browser.close();
  console.log("\n═══ ALL DONE ═══");
  console.log("All screenshots saved to screenshots/16-*.png");
}

main().catch(console.error);
