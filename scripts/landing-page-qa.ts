import { chromium } from "playwright-core";

async function main() {
  const browser = await chromium.launch();

  // === DESKTOP ===
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await desktop.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-01-hero.png" });
  await desktop.evaluate(() => window.scrollBy(0, 900));
  await desktop.waitForTimeout(300);
  await desktop.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-02-manifesto.png" });
  await desktop.evaluate(() => window.scrollBy(0, 800));
  await desktop.waitForTimeout(300);
  await desktop.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-03-features.png" });
  await desktop.evaluate(() => window.scrollBy(0, 800));
  await desktop.waitForTimeout(300);
  await desktop.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-04-comparison.png" });
  await desktop.evaluate(() => window.scrollBy(0, 800));
  await desktop.waitForTimeout(300);
  await desktop.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-05-pricing.png" });
  await desktop.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await desktop.waitForTimeout(300);
  await desktop.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-06-footer.png" });
  await desktop.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-full-page.png", fullPage: true });
  await desktop.close();

  // === MOBILE ===
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } }); // iPhone 14
  await mobile.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await mobile.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-mobile-01-hero.png" });
  await mobile.evaluate(() => window.scrollBy(0, 700));
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-mobile-02-manifesto.png" });
  await mobile.evaluate(() => window.scrollBy(0, 700));
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-mobile-03-features.png" });
  await mobile.evaluate(() => window.scrollBy(0, 700));
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-mobile-04-comparison.png" });
  await mobile.evaluate(() => window.scrollBy(0, 700));
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-mobile-05-pricing.png" });
  await mobile.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-mobile-06-footer.png" });
  await mobile.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-landing-mobile-full.png", fullPage: true });

  // Check for overflow on mobile
  const overflow = await mobile.evaluate(() => {
    return document.body.scrollWidth > document.body.clientWidth;
  });
  console.log(`Mobile horizontal overflow: ${overflow ? "❌ YES" : "✅ NO"}`);

  await mobile.close();
  await browser.close();
  console.log("🎯 Desktop + Mobile screenshots done.");
}

main().catch(console.error);
