import { test, expect } from "@playwright/test";

test("verify favicon and browser title", async ({ page }) => {
  await page.goto("http://localhost:8081");
  await page.waitForTimeout(3000);

  // Check title
  const title = await page.title();
  console.log("Browser tab title:", title);

  // Full page screenshot to see the result
  await page.screenshot({
    path: "/Users/chandanreddy/Documents/draftcrick/screenshots/favicon-browser-tab.png",
    fullPage: true,
  });
});
