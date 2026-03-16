/**
 * Chapter 17: Landing Page — Moat-Focused Marketing QA
 *
 * Validates the public landing page at draftplay.ai:
 * - Hero tagline: "Fantasy Gaming, not Gambling." with correct colors
 * - Sticky subheader with App Store, Google Play, and Start Free Trial
 * - All sections render: manifesto, features, comparison, pricing, CTA, footer
 * - Mobile responsive: no horizontal overflow, stacked CTAs
 * - All links point to valid routes
 * - Pricing section anchored via #pricing
 *
 * Run: npx playwright test tests/e2e/cricket-story/17-landing-page.spec.ts --workers=1
 */
import { test, expect } from "@playwright/test";
import { screenshotPath } from "../helpers/screenshot";

const ss = (name: string) => screenshotPath(name);
const BASE = "http://localhost:3000";

test.describe("=== Chapter 17: Landing Page Tests ===", () => {
  test.describe("Desktop (1440x900)", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("17.1 — Hero renders with correct tagline and colors", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });

      // Check the H1 exists
      const h1 = page.locator("h1");
      await expect(h1).toBeVisible();
      const h1Text = await h1.textContent();
      expect(h1Text).toContain("Fantasy Gaming.");
      expect(h1Text).toContain("Not Gambling.");
      expect(h1Text).toContain("Day Pass");

      // "not Gambling." should be red (#E5484D)
      const redSpan = h1.locator("span").first();
      const redColor = await redSpan.evaluate((el) => getComputedStyle(el).color);
      expect(redColor).toBe("rgb(229, 72, 77)");

      // Day Pass button should be inside the H1
      const dayPassLink = h1.locator("a");
      await expect(dayPassLink).toBeVisible();
      const dayPassText = await dayPassLink.textContent();
      expect(dayPassText).toContain("Day Pass");

      await page.screenshot({ path: ss("17.1-desktop-hero.png") });
    });

    test("17.2 — Anti-gambling badge visible", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      const badge = page.getByText("Proudly Anti-Gambling");
      await expect(badge).toBeVisible();
    });

    test("17.3 — Sticky subheader stays on scroll", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(300);

      // Subheader should still be at top
      const subheader = page.locator(".landing-subheader");
      const rect = await subheader.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.y).toBe(0);

      await page.screenshot({ path: ss("17.3-sticky-subheader.png") });
    });

    test("17.4 — Subheader has Day Pass, app buttons, and CTA", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });

      const subheader = page.locator(".landing-subheader");
      await expect(subheader.locator(".landing-subheader-tagline")).toBeVisible();
      await expect(subheader.getByText("App Store")).toBeVisible();
      await expect(subheader.getByText("Google Play")).toBeVisible();
      await expect(subheader.getByText("Trial")).toBeVisible();
    });

    test("17.5 — All sections render on desktop", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });

      // Manifesto
      await expect(page.getByText("Our Promise")).toBeVisible();
      await expect(page.getByText("We disagree.")).toBeVisible();

      // Features
      await expect(page.getByText("The DraftPlay Difference")).toBeVisible();
      await expect(page.getByText("Smart Tools, Better Decisions")).toBeVisible();
      await expect(page.getByRole("heading", { name: "No Deposits. No Withdrawals." })).toBeVisible();
      await expect(page.getByText("Legal in Every Indian State")).toBeVisible();
      await expect(page.getByText("Safe for All Ages")).toBeVisible();

      // Comparison
      await expect(page.getByText("Typical Fantasy Apps vs DraftPlay")).toBeVisible();

      // Pricing
      await expect(page.getByText("Simple Pricing")).toBeVisible();
      await expect(page.getByText("Less than a cup of chai per day.")).toBeVisible();

      // Pricing tiers
      await expect(page.getByText("Basic", { exact: true })).toBeVisible();
      await expect(page.getByText("Pro", { exact: true })).toBeVisible();
      await expect(page.getByText("Elite", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("MOST POPULAR")).toBeVisible();

      // Day Pass
      await expect(page.getByText("Day Pass", { exact: false }).first()).toBeVisible();

      // Final CTA
      await expect(page.getByText("Ready to play")).toBeVisible();

      // Footer
      await expect(page.getByText("Terms of Service")).toBeVisible();
      await expect(page.getByText("Privacy Policy")).toBeVisible();

      await page.screenshot({ path: ss("17.5-desktop-full.png"), fullPage: true });
    });

    test("17.6 — Pricing #pricing anchor exists", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      const pricing = page.locator("#pricing");
      await expect(pricing).toBeAttached();
    });

    test("17.7 — See Pricing scrolls to #pricing", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.getByText("See Pricing").click();
      await page.waitForTimeout(500);
      const pricing = page.locator("#pricing");
      const box = await pricing.boundingBox();
      // Pricing section should be near the top of viewport
      expect(box).not.toBeNull();
      expect(box!.y).toBeLessThan(200);
    });

    test("17.8 — Comparison strip shows red vs green", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });

      // Red side (them)
      const redCell = page.locator(".landing-comparison-cell").first();
      const redColor = await redCell.evaluate((el) => getComputedStyle(el).color);
      expect(redColor).toBe("rgb(229, 72, 77)");

      // Green side (us)
      const greenCell = page.locator(".landing-comparison-cell").nth(1);
      const greenColor = await greenCell.evaluate((el) => getComputedStyle(el).color);
      expect(greenColor).toBe("rgb(93, 184, 130)");

      await page.screenshot({ path: ss("17.8-comparison.png") });
    });

    test("17.9 — No broken links (all href targets are valid routes)", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });

      const hrefs = await page.$$eval("a[href]", (els) =>
        els
          .map((el) => el.getAttribute("href"))
          .filter((h) => h && !h.startsWith("/_next") && !h.startsWith("/favicon"))
      );

      const validPrefixes = ["/register", "/legal/", "#", "http"];
      for (const href of hrefs) {
        const isValid = validPrefixes.some((p) => href!.startsWith(p));
        expect(isValid, `Invalid link: ${href}`).toBe(true);
      }
    });
  });

  test.describe("Mobile (390x844)", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("17.10 — No horizontal overflow on mobile", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });

      const hasOverflow = await page.evaluate(
        () => document.body.scrollWidth > document.body.clientWidth
      );
      expect(hasOverflow).toBe(false);

      await page.screenshot({ path: ss("17.10-mobile-hero.png") });
    });

    test("17.11 — Subheader tagline hidden on mobile", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      const tagline = page.locator(".landing-subheader-tagline");
      await expect(tagline).toBeHidden();
    });

    test("17.12 — CTA buttons stack vertically on mobile", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });

      const ctaContainer = page.locator(".landing-hero-cta");
      const direction = await ctaContainer.evaluate(
        (el) => getComputedStyle(el).flexDirection
      );
      expect(direction).toBe("column");

      await page.screenshot({ path: ss("17.12-mobile-cta-stack.png") });
    });

    test("17.13 — Mobile full page scroll", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.screenshot({ path: ss("17.13-mobile-full.png"), fullPage: true });
    });

    test("17.14 — Sticky subheader works on mobile scroll", async ({ page }) => {
      await page.goto(BASE, { waitUntil: "networkidle" });
      await page.evaluate(() => window.scrollTo(0, 800));
      await page.waitForTimeout(300);

      const subheader = page.locator(".landing-subheader");
      const rect = await subheader.boundingBox();
      expect(rect).not.toBeNull();
      expect(rect!.y).toBe(0);

      await page.screenshot({ path: ss("17.14-mobile-sticky.png") });
    });
  });
});
