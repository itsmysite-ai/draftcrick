import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const htmlPath = path.resolve(__dirname, "generate-favicon.html");
  await page.goto(`file://${htmlPath}`);

  const logo = page.locator("#logo");

  // 64x64 high-res favicon
  await logo.screenshot({
    path: path.resolve(__dirname, "../apps/mobile/assets/favicon.png"),
    omitBackground: true,
  });

  // 32x32 standard favicon for web
  await page.setViewportSize({ width: 32, height: 32 });
  await page.evaluate(() => {
    const el = document.getElementById("logo")!;
    el.style.transform = "scale(0.5)";
    el.style.transformOrigin = "top left";
  });
  await logo.screenshot({
    path: path.resolve(__dirname, "../apps/web/public/favicon.png"),
    omitBackground: true,
  });

  // Also save a copy for screenshots
  await browser.close();
  console.log("Favicons generated!");
}

main().catch(console.error);
