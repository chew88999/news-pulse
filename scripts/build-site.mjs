// Builds the read-only public site into site/ (published to GitHub Pages by .github/workflows/pages.yml):
//   site/index.html      the page, switched to static mode
//   site/data/top3.json  the latest snapshot, if there is one
// No server and no AI calls: visitors only read what the scheduled job published.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const site = `${root}site/`;

rmSync(site, { recursive: true, force: true });
mkdirSync(`${site}data`, { recursive: true });

const html = readFileSync(`${root}web/index.html`, "utf8");
const marker = '<meta name="news-pulse-mode" content="server" />';
if (!html.includes(marker)) throw new Error("web/index.html is missing the news-pulse-mode meta tag");
writeFileSync(`${site}index.html`, html.replace(marker, '<meta name="news-pulse-mode" content="static" />'));

const snapshot = `${root}data/top3.json`;
if (existsSync(snapshot)) {
  const { items, generatedAt } = JSON.parse(readFileSync(snapshot, "utf8"));
  copyFileSync(snapshot, `${site}data/top3.json`);
  console.log(`site/: ${items.length} stories from ${generatedAt}`);
} else {
  console.log("site/: no snapshot yet; the page will say so");
}
writeFileSync(`${site}.nojekyll`, ""); // serve files as-is
