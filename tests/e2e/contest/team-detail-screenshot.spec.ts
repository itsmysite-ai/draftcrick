import { test } from "@playwright/test";

const BASE = "http://localhost:8081";

test.describe("Team Detail Page", () => {
  test("team detail — free play team view", async ({ page }) => {
    // Navigate to team detail page
    await page.goto(`${BASE}/team/8e5bdb26-3993-432a-a1a5-ed87c7f9309f`);
    await page.waitForTimeout(4000);
    await page.screenshot({
      path: "screenshots/contest-ui-team-detail-free-play.png",
      fullPage: true,
    });
  });
});
