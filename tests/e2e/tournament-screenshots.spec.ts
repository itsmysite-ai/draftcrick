/**
 * Tournament display & filtering screenshot verification.
 * Captures: tournament filter strip, active filter, tournament details screen.
 */
import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:8081";
const SCREENSHOT_DIR = "screenshots";

/** Mock dashboard data with tournaments + matches for deterministic screenshots */
const MOCK_DASHBOARD = {
  tournaments: [
    {
      id: "t1",
      name: "ICC Champions Trophy 2025",
      sport: "cricket",
      category: "international",
      startDate: "2025-02-19",
      endDate: "2025-03-09",
      imageUrl: null,
      sourceUrl: null,
    },
    {
      id: "t2",
      name: "Indian Premier League 2025",
      sport: "cricket",
      category: "league",
      startDate: "2025-03-22",
      endDate: "2025-05-25",
      imageUrl: null,
      sourceUrl: null,
    },
    {
      id: "t3",
      name: "Ranji Trophy 2024-25",
      sport: "cricket",
      category: "domestic",
      startDate: "2024-10-11",
      endDate: "2025-02-15",
      imageUrl: null,
      sourceUrl: null,
    },
  ],
  matches: [
    {
      id: "ai-m1",
      teamA: "India",
      teamB: "Australia",
      sport: "cricket",
      format: "ODI",
      tournamentName: "ICC Champions Trophy 2025",
      time: "2:00 PM IST",
      date: "Feb 23, 2025",
      venue: "Dubai International Stadium",
      status: "upcoming",
      scoreSummary: null,
      sourceUrl: null,
    },
    {
      id: "ai-m2",
      teamA: "England",
      teamB: "Pakistan",
      sport: "cricket",
      format: "ODI",
      tournamentName: "ICC Champions Trophy 2025",
      time: "10:30 AM IST",
      date: "Feb 22, 2025",
      venue: "Rawalpindi Cricket Stadium",
      status: "upcoming",
      scoreSummary: null,
      sourceUrl: null,
    },
    {
      id: "ai-m3",
      teamA: "Chennai Super Kings",
      teamB: "Mumbai Indians",
      sport: "cricket",
      format: "T20",
      tournamentName: "Indian Premier League 2025",
      time: "7:30 PM IST",
      date: "Mar 22, 2025",
      venue: "MA Chidambaram Stadium",
      status: "upcoming",
      scoreSummary: null,
      sourceUrl: null,
    },
    {
      id: "ai-m4",
      teamA: "Mumbai",
      teamB: "Karnataka",
      sport: "cricket",
      format: "First Class",
      tournamentName: "Ranji Trophy 2024-25",
      time: "9:30 AM IST",
      date: "Feb 12, 2025",
      venue: "Wankhede Stadium",
      status: "live",
      scoreSummary: "Mumbai 284/6 (78 ov)",
      sourceUrl: null,
    },
  ],
  lastFetched: new Date().toISOString(),
  sources: [],
  sport: "cricket",
};

function mockDashboardRoute(page: any, data = MOCK_DASHBOARD) {
  return page.route("**/trpc/sports.dashboard**", (route: any) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { result: { data: { json: data } } },
      ]),
    });
  });
}

test.describe("Tournament Display & Filtering", () => {
  test("capture tournament filter strip on home screen", async ({ page }) => {
    await mockDashboardRoute(page);
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/tournament-list.png`,
      fullPage: true,
    });
  });

  test("capture active tournament filter", async ({ page }) => {
    await mockDashboardRoute(page);
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    // Click on the ICC Champions Trophy filter pill (first match is the pill text)
    const pill = page.getByText("icc champions trophy 2025", { exact: true }).first();
    if (await pill.isVisible()) {
      await pill.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/tournament-filter.png`,
      fullPage: true,
    });
  });

  test("capture tournament details screen", async ({ page }) => {
    await mockDashboardRoute(page);

    // Navigate directly to tournament details
    const encodedName = encodeURIComponent("ICC Champions Trophy 2025");
    await page.goto(`${BASE_URL}/tournament/${encodedName}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/tournament-details.png`,
      fullPage: true,
    });
  });

  test("capture tournament details stats tab", async ({ page }) => {
    await mockDashboardRoute(page);

    const encodedName = encodeURIComponent("ICC Champions Trophy 2025");
    await page.goto(`${BASE_URL}/tournament/${encodedName}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(2000);

    // Click stats tab
    const statsTab = page.getByText("stats");
    if (await statsTab.isVisible()) {
      await statsTab.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/tournament-details-stats.png`,
      fullPage: true,
    });
  });
});
