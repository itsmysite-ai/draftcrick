import { test, expect } from "@playwright/test";

const BASE = "http://localhost:8081";

test.describe("Contest UI — Match Detail & Contest Detail", () => {
  test("match detail — shows real contests from DB", async ({ page }) => {
    await page.goto(`${BASE}/match/india_vs_new_zealand_mar082026`);
    await page.waitForTimeout(4000);
    await page.screenshot({
      path: "screenshots/contest-ui-match-detail-real-contests.png",
      fullPage: true,
    });
  });

  test("contest detail — settled contest with results", async ({ page }) => {
    // Get a settled contest ID from the API
    const contestsRes = await fetch(
      "http://localhost:3001/trpc/contest.listByMatch?input=" +
        encodeURIComponent(
          JSON.stringify({ json: { matchId: "67fca130-652b-45d8-be49-36af00a68d25" } })
        )
    );
    const contestsData = await contestsRes.json();
    const contests = contestsData.result?.data?.json || [];

    expect(contests.length).toBeGreaterThan(0);
    const settledContest = contests.find((c: any) => c.status === "settled") || contests[0];

    await page.goto(`${BASE}/contest/${settledContest.id}`);
    await page.waitForTimeout(4000);
    await page.screenshot({
      path: "screenshots/contest-ui-settled-contest-detail.png",
      fullPage: true,
    });
  });
});
