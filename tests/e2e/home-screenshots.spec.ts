/**
 * Home screen screenshot verification for Prompt 4.
 * Captures: loading, data loaded, empty state, error state.
 */
import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:8081";
const SCREENSHOT_DIR = "screenshots";

test.describe("Home Screen — Real Data Integration", () => {
  test("capture data loaded state", async ({ page }) => {
    // Navigate to home screen and wait for data to load
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // Wait for content to render (either matches tab content or player cards)
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/home-data.png`,
      fullPage: true,
    });
  });

  test("capture loading state", async ({ page }) => {
    // Block the API to simulate loading state
    await page.route("**/trpc/**", async (route) => {
      // Delay response to keep loading state visible
      await new Promise((resolve) => setTimeout(resolve, 60000));
      await route.abort();
    });

    await page.goto(BASE_URL);
    // The loading spinner should appear immediately
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/home-loading.png`,
      fullPage: true,
    });
  });

  test("capture error state", async ({ page }) => {
    // Block all tRPC calls to simulate API failure
    await page.route("**/trpc/**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(5000); // Wait for React Query retries to exhaust

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/home-error.png`,
      fullPage: true,
    });
  });

  test("capture empty state (matches tab)", async ({ page }) => {
    // Return empty data for sports dashboard
    await page.route("**/trpc/sports.dashboard**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: {
                  tournaments: [],
                  matches: [],
                  lastFetched: new Date().toISOString(),
                  sources: [],
                  sport: "cricket",
                },
              },
            },
          },
        ]),
      });
    });

    // Let player.list go through normally
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/home-empty.png`,
      fullPage: true,
    });
  });
});
