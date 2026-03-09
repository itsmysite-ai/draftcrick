import { test } from "@playwright/test";

test("generate DraftPlay favicon from actual component", async ({ page }) => {
  await page.goto("http://localhost:8081");
  await page.waitForTimeout(4000);

  const logo = page.locator('[data-testid="draftplay-logo"]').first();

  // Favicon for mobile assets (Expo web)
  await logo.screenshot({
    path: "/Users/chandanreddy/Documents/draftcrick/apps/mobile/assets/favicon.png",
    omitBackground: true,
  });

  // Same favicon for web portal (Next.js)
  await logo.screenshot({
    path: "/Users/chandanreddy/Documents/draftcrick/apps/web/public/favicon.png",
    omitBackground: true,
  });

  // Preview
  await logo.screenshot({
    path: "/Users/chandanreddy/Documents/draftcrick/screenshots/favicon-final.png",
    omitBackground: true,
  });

  console.log("Favicons generated for both mobile and web!");
});
