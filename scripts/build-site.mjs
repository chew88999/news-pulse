// Builds the read-only public site into site/ (published to GitHub Pages by .github/workflows/pages.yml):
//   site/index.html      the page, switched to static mode
//   site/data/top3.json  the latest snapshot, if there is one
//   site/promo.mp4, site/promo.vtt, site/video.html  the promo video and a page that plays it
// No server and no AI calls: visitors only read what the scheduled job published.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const VIDEO_PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>News Pulse Video</title>
  <style>
    :root { --bg: #f6f7f9; --text: #16191d; --muted: #5d6670; --accent: #2556c9; }
    @media (prefers-color-scheme: dark) { :root { --bg: #111417; --text: #e8eaed; --muted: #9aa3ad; --accent: #8fb1ff; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
    main { max-width: 1000px; margin: 0 auto; padding: 32px 16px 48px; }
    h1 { margin: 0 0 4px; font-size: 1.5rem; }
    p { margin: 0 0 20px; color: var(--muted); }
    a { color: var(--accent); }
    video { display: block; width: 100%; height: auto; border-radius: 12px; background: #000; }
  </style>
</head>
<body>
  <main>
    <h1>News Pulse</h1>
    <p>A one-minute introduction for IT and engineering teams in defence. <a href="./">See today's top three</a> · <a href="promo.mp4" download>Download the video</a></p>
    <video controls preload="metadata" playsinline>
      <source src="promo.mp4" type="video/mp4" />
      <track kind="subtitles" src="promo.vtt" srclang="en" label="English" />
      Your browser can't play this video. <a href="promo.mp4">Download it instead.</a>
    </video>
  </main>
</body>
</html>
`;

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
// The promo video. Browsers only play WebVTT captions, so the .srt is converted.
const video = `${root}video/news-pulse-promo.mp4`;
if (existsSync(video)) {
  copyFileSync(video, `${site}promo.mp4`);
  const srt = readFileSync(`${root}video/news-pulse-promo.srt`, "utf8");
  writeFileSync(`${site}promo.vtt`, "WEBVTT\n\n" + srt.replace(/\r/g, "").replace(/(\d\d:\d\d:\d\d),(\d{3})/g, "$1.$2"));
  writeFileSync(`${site}video.html`, VIDEO_PAGE);
  console.log("site/: promo video");
}
writeFileSync(`${site}.nojekyll`, ""); // serve files as-is
