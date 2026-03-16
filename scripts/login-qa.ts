import { chromium } from "playwright-core";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto("http://localhost:8081/auth/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-login-mobile.png" });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto("http://localhost:8081/auth/login", { waitUntil: "networkidle" });
  await desktop.screenshot({ path: "/Users/chandanreddy/Documents/draftcrick/screenshots/17-login-desktop.png" });

  await browser.close();
  console.log("Done");
}
main().catch(console.error);
