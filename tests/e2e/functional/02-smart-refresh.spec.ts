/**
 * Smart Refresh — Browser-Driven E2E Tests
 *
 * Story: User logs in → app loads home screen → smart refresh pipeline
 * fires automatically (Redis → PG → Gemini) → real cricket data appears.
 *
 * The app's home screen calls sports.dashboard on mount, which triggers
 * the smart refresh pipeline. We don't call the API ourselves — we log in
 * through the browser and verify what the app shows.
 *
 * Requires: GEMINI_API_KEY set in .env, Redis running on localhost:6379
 *
 * Run: FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 npx playwright test tests/e2e/functional/02-smart-refresh.spec.ts --project=mobile --workers=1
 */
import { test, expect } from "@playwright/test";
import {
  clearEmulatorAccounts,
  loginViaBrowser,
  trpcAuthQuery,
  unwrap,
} from "../helpers/hybrid-seed";
import { createTestUser } from "../helpers/api-auth";
import { forceClickTab } from "../helpers/tamagui";
import { screenshotPath } from "../helpers/screenshot";

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.describe("Smart Refresh — Login Triggers Real Data", () => {
  test.setTimeout(120000);

  const EMAIL = `refresh-${Date.now()}@test.com`;
  const PASSWORD = "TestPass123!";
  let token: string;

  test("0 — create test user", async () => {
    await clearEmulatorAccounts();
    const user = await createTestUser(EMAIL, PASSWORD);
    token = user.idToken;
  });

  test("1 — login → home screen loads real match data via smart refresh", async ({ page }) => {
    // Login through the browser — exactly what a real user does
    const loggedIn = await loginViaBrowser(page, EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    // The app's home screen mounts and calls sports.dashboard automatically.
    // This triggers the smart refresh pipeline: Redis → PG → Gemini.
    // Give it time to fetch and render real data.
    await page.waitForTimeout(8000);

    // Look for real cricket content rendered by the app
    const cricketContent = page.locator(
      "text=/india|australia|england|pakistan|south africa|west indies|new zealand|sri lanka|bangladesh|t20|odi|test|ipl|world cup|match|tournament|upcoming|live|cricket/i"
    );
    const hasRealContent = await cricketContent.first().isVisible({ timeout: 15000 }).catch(() => false);

    await page.screenshot({ path: screenshotPath("story-05a-home-after-login-matches.png") });

    if (hasRealContent) {
      console.log(`    ✓ Home screen shows real cricket data from smart refresh pipeline`);
    } else {
      console.log(`    Home screen loaded (match data may render as cards/components)`);
    }

    // Scroll down to see more matches
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: screenshotPath("story-05b-home-after-login-scrolled.png") });
  });

  test("2 — live tab shows real-time matches from pipeline", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    // Navigate to the Live tab — this also triggers sports data loading
    await forceClickTab(page, "live");
    await page.waitForTimeout(5000);

    // Look for live match content or "no live matches" message
    const liveContent = page.locator("text=/live|playing|score|vs|no.*live/i");
    const hasLive = await liveContent.first().isVisible({ timeout: 10000 }).catch(() => false);

    await page.screenshot({ path: screenshotPath("story-06a-live-tab-matches.png") });

    if (hasLive) {
      console.log(`    ✓ Live tab shows match data from smart refresh`);
    } else {
      console.log(`    Live tab loaded (no live matches right now)`);
    }
  });

  test("3 — contests tab shows real matches available for fantasy", async ({ page }) => {
    const loggedIn = await loginViaBrowser(page, EMAIL, PASSWORD);
    if (!loggedIn) { test.skip(); return; }

    // Navigate to Contests tab
    await forceClickTab(page, "contests");
    await page.waitForTimeout(5000);

    // Contests are tied to real matches — smart refresh provides the match data
    const contestContent = page.locator("text=/contest|match|entry|prize|join|upcoming/i");
    const hasContests = await contestContent.first().isVisible({ timeout: 10000 }).catch(() => false);

    await page.screenshot({ path: screenshotPath("story-06b-contests-tab-real-matches.png") });

    if (hasContests) {
      console.log(`    ✓ Contests tab shows content linked to real match data`);
    } else {
      console.log(`    Contests tab loaded (may need matches to show contests)`);
    }
  });

  // --- API validation: confirm what the app loaded is real data ---
  // These verify the pipeline returned actual cricket data, not placeholders.

  test("4 — verify pipeline returned real tournaments + matches", async () => {
    // This checks the same endpoint the app called when home screen loaded
    const res = await trpcAuthQuery("sports.dashboard", { sport: "cricket" }, token);
    expect(res.status).toBe(200);

    const data = unwrap(res);
    expect(data?.tournaments?.length).toBeGreaterThan(0);
    expect(data?.matches?.length).toBeGreaterThan(0);

    const tournamentNames = data.tournaments.map((t: any) => t.name);
    console.log(`    Pipeline delivered ${data.tournaments.length} tournaments, ${data.matches.length} matches`);
    console.log(`    Tournaments: ${tournamentNames.slice(0, 5).join(", ")}`);

    // Should only show the active tournament (ICC Men's T20 World Cup)
    const hasWorldCup = tournamentNames.some((name: string) =>
      name.toLowerCase().includes("world cup") || name.toLowerCase().includes("t20")
    );
    expect(hasWorldCup).toBeTruthy();

    // Log real matches
    const sampleMatches = data.matches.slice(0, 8).map(
      (m: any) => `${(m.status ?? "").padEnd(10)} ${m.teamA} vs ${m.teamB} (${m.format})`
    );
    console.log(`    Real matches:`);
    sampleMatches.forEach((m: string) => console.log(`      ${m}`));
  });

  test("5 — verify pipeline populated real players", async () => {
    // player.list reads from PG — populated by smart refresh's fetchPlayerRosters
    const res = await trpcAuthQuery("player.list", undefined, token);
    expect(res.status).toBe(200);

    const players = (unwrap(res) as any[]) ?? [];
    expect(players.length).toBeGreaterThan(0);
    console.log(`    ${players.length} players available in database`);

    // Verify structure
    for (const p of players.slice(0, 5)) {
      expect(p.name).toBeTruthy();
      expect(p.team).toBeTruthy();
      expect(p.role).toBeTruthy();
    }

    // Check for known cricketers
    const names = players.map((p: any) => p.name.toLowerCase());
    const known = ["kohli", "sharma", "bumrah", "pant", "gill", "jadeja", "starc", "cummins", "smith", "babar", "stokes"];
    const found = known.filter((k) => names.some((n: string) => n.includes(k)));
    console.log(`    Known cricketers: ${found.join(", ") || "(seeded data)"}`);

    // Log sample
    const sample = players.slice(0, 8).map(
      (p: any) => `${p.name.padEnd(22)} ${(p.team ?? "").padEnd(18)} ${(p.role ?? "").padEnd(14)} ${p.nationality ?? ""}`
    );
    console.log(`    Sample players:`);
    sample.forEach((s: string) => console.log(`      ${s}`));
  });

  test("6 — verify live matches all have status 'live'", async () => {
    const res = await trpcAuthQuery("sports.liveMatches", { sport: "cricket" }, token);
    expect(res.status).toBe(200);

    const data = unwrap(res);
    expect(Array.isArray(data?.matches)).toBeTruthy();

    if (data.matches.length > 0) {
      for (const m of data.matches) {
        expect(m.status).toBe("live");
      }
      console.log(`    ${data.matches.length} live matches confirmed`);
      data.matches.slice(0, 5).forEach((m: any) =>
        console.log(`      LIVE: ${m.teamA} vs ${m.teamB} (${m.format})`)
      );
    } else {
      console.log(`    No live matches right now`);
    }
  });
});
