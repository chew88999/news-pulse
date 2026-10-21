// Screenshots the running app (npm start in the project root) for the promo video.
// Output: assets/app-top3.png (the 20 Oct top three).
import puppeteer from "puppeteer-core";

const EDGE = process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true });
try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.setViewport({ width: 900, height: 1300, deviceScaleFactor: 2 });
  await page.goto(`${APP}/?day=2026-10-20`, { waitUntil: "networkidle0" });
  await page.waitForSelector("article");
  const main = await page.$("main");
  const box = await main.boundingBox();
  // Header, day picker and the three cards; stop before the footer.
  const lastCard = await page.$("#list > li:last-child");
  const last = await lastCard.boundingBox();
  await page.screenshot({
    path: "assets/app-top3.png",
    clip: { x: box.x, y: 0, width: box.width, height: last.y + last.height + 24 },
  });
  console.log("saved assets/app-top3.png");
} finally {
  await browser.close();
}
