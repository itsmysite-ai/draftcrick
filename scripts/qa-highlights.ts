import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
  });
  const page = await context.newPage();

  // Force click helper for Tamagui
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

  async function scrollTo(testId: string) {
    await page.evaluate((id: string) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, testId);
    await page.waitForTimeout(600);
  }

  // Login
  console.log("Logging in...");
  await page.goto("http://localhost:8081/auth/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const emailInput = page.locator('[data-testid="email-input"]');
  if (await emailInput.isVisible()) {
    await emailInput.fill("admin@draftplay.ai");
    await page.locator('[data-testid="password-input"]').fill("test1234");
    await page.locator('[data-testid="submit-button"]').click();
    await page.waitForTimeout(5000);
  }

  // Go to dashboard
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  console.log("\n═══ HIGHLIGHTS SECTION QA ═══\n");

  // 1. Screenshot the full highlights area
  await scrollTo("highlight-standings");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/16-highlights-overview.png" });

  // 2. Check which highlight cards exist
  const highlightKeys = ["standings", "predictions", "awards", "tournaments"];
  for (const key of highlightKeys) {
    const testId = `highlight-${key}`;
    const el = page.locator(`[data-testid="${testId}"]`);
    const visible = await el.isVisible().catch(() => false);
    if (visible) {
      const text = await el.textContent();
      console.log(`✓ highlight-${key}: "${text?.replace(/\s+/g, " ").trim()}"`);
      // Screenshot the individual card
      await el.screenshot({ path: `screenshots/16-highlight-card-${key}.png` });
    } else {
      console.log(`✗ highlight-${key}: NOT VISIBLE`);
    }
  }

  // 3. Click each card and verify destination
  console.log("\n── Click Tests ──\n");

  for (const key of highlightKeys) {
    const testId = `highlight-${key}`;
    await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    await scrollTo(testId);

    const el = page.locator(`[data-testid="${testId}"]`);
    const visible = await el.isVisible().catch(() => false);
    if (!visible) {
      console.log(`SKIP highlight-${key} (not visible)`);
      continue;
    }

    await forceClick(testId);
    await page.waitForTimeout(4000);
    const url = page.url();
    console.log(`highlight-${key} → ${url}`);
    await page.screenshot({ path: `screenshots/16-highlight-click-${key}.png` });

    // Validate correct destination
    let expected = "";
    let correct = false;
    switch (key) {
      case "standings":
        expected = "/tournament/";
        correct = url.includes("/tournament/");
        break;
      case "predictions":
        expected = "/predictions/leaderboard";
        correct = url.includes("/predictions/leaderboard");
        break;
      case "awards":
        expected = "/tournament/";
        correct = url.includes("/tournament/");
        break;
      case "tournaments":
        expected = "/live";
        correct = url.includes("/live");
        break;
    }
    console.log(`   Expected: ${expected} → ${correct ? "✓ CORRECT" : "✗ WRONG"}`);
  }

  // 4. Visual QA — check card sizes, text truncation, spacing
  console.log("\n── Visual QA ──\n");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await scrollTo("highlight-standings");

  // Check card dimensions
  for (const key of highlightKeys) {
    const testId = `highlight-${key}`;
    const el = page.locator(`[data-testid="${testId}"]`);
    if (!(await el.isVisible().catch(() => false))) continue;

    const box = await el.boundingBox();
    if (box) {
      console.log(`highlight-${key}: ${Math.round(box.width)}x${Math.round(box.height)}px at (${Math.round(box.x)}, ${Math.round(box.y)})`);
      // Check if card is too narrow or too wide
      if (box.width < 100) console.log(`   ⚠️ Card too narrow (${box.width}px)`);
      if (box.width > 200) console.log(`   ⚠️ Card too wide (${box.width}px)`);
    }
  }

  // 5. Check text content for truncation issues
  console.log("\n── Text Content ──\n");
  await page.goto("http://localhost:8081/(tabs)", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  for (const key of highlightKeys) {
    const testId = `highlight-${key}`;
    const el = page.locator(`[data-testid="${testId}"]`);
    if (!(await el.isVisible().catch(() => false))) continue;

    const fullText = await el.textContent();
    console.log(`highlight-${key}: "${fullText?.trim()}"`);
  }

  // 6. Final overview screenshot with all cards visible
  await scrollTo("highlight-standings");
  // Try to scroll the horizontal scroll to show all cards
  await page.evaluate(() => {
    const scrollViews = document.querySelectorAll('[data-testid="highlight-standings"]');
    if (scrollViews.length > 0) {
      const parent = scrollViews[0].parentElement;
      if (parent?.parentElement) {
        parent.parentElement.scrollLeft = 0;
      }
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/16-highlights-final.png" });

  await browser.close();
  console.log("\n═══ HIGHLIGHTS QA COMPLETE ═══");
}

main().catch(console.error);
