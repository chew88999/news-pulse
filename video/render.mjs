// Renders promo.html to news-pulse-promo.mp4 (1920x1080, 30 fps) with headless Edge + ffmpeg.
//   node render.mjs                     → full video
//   node render.mjs --stills 3000,15000 → only those moments, as stills/*.png (for review)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import ffmpegPath from "ffmpeg-static";
import puppeteer from "puppeteer-core";

const EDGE = process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const FPS = 30;
const OUT = "news-pulse-promo.mp4";
const here = fileURLToPath(new URL(".", import.meta.url));
const stillsArg = process.argv.indexOf("--stills");
const stills = stillsArg > 0 ? process.argv[stillsArg + 1].split(",").map(Number) : null;

// --audio-only: redo just the narration and subtitle tracks on the existing MP4 (after editing
// narration.json and rerunning voice.ps1 + subtitles.mjs, if the picture hasn't changed).
if (process.argv.includes("--audio-only")) {
  const res = spawnSync(ffmpegPath, ["-hide_banner", "-i", `${here}${OUT}`], { encoding: "utf8" });
  const [, h, m, s] = /Duration: (\d+):(\d+):([\d.]+)/.exec(res.stderr);
  addVoiceAndSubtitles((Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000);
  process.exit(0);
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--allow-file-access-from-files", "--force-color-profile=srgb"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(`${here}promo.html`).href + "?render", { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() => window.__duration);

  if (stills) {
    mkdirSync(`${here}stills`, { recursive: true });
    for (const t of stills) {
      await page.evaluate((t) => window.__seek(t), t);
      await page.screenshot({ path: `${here}stills/t${String(t).padStart(5, "0")}.png` });
      console.log(`stills/t${t}.png`);
    }
  } else {
    const frames = Math.ceil((duration / 1000) * FPS);
    const ff = spawn(ffmpegPath, [
      "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart",
      `${here}${OUT}`,
    ], { stdio: ["pipe", "ignore", "pipe"] });
    let ffErr = "";
    ff.stderr.on("data", (d) => (ffErr = (ffErr + d).slice(-2000)));
    const done = new Promise((resolve, reject) => ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${ffErr}`)))));

    const started = Date.now();
    for (let f = 0; f < frames; f++) {
      await page.evaluate((t) => window.__seek(t), (f * 1000) / FPS);
      const jpg = await page.screenshot({ type: "jpeg", quality: 92 });
      if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r));
      if (f % 150 === 0) console.log(`frame ${f}/${frames} (${Math.round((Date.now() - started) / 1000)}s)`);
    }
    ff.stdin.end();
    await done;
    console.log(`video: ${frames} frames, ${(frames / FPS).toFixed(1)}s, rendered in ${Math.round((Date.now() - started) / 1000)}s`);
    addVoiceAndSubtitles(duration);
  }
} finally {
  await browser.close();
}

/**
 * Mixes the narration clips (voice/*.wav, placed at their start times from narration.json)
 * into one audio track, and embeds news-pulse-promo.srt as a subtitle track that players
 * can switch on or off. The picture already has the same subtitles burned in.
 */
function addVoiceAndSubtitles(durationMs) {
  const { lines } = JSON.parse(readFileSync(`${here}narration.json`, "utf8"));
  const silent = `${here}${OUT}`;
  const tmp = `${here}news-pulse-promo.tmp.mp4`;
  renameSync(silent, tmp);
  const inputs = ["-i", tmp];
  const filters = [];
  lines.forEach((l, i) => {
    inputs.push("-i", `${here}voice/${l.id}.wav`);
    filters.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${l.start}|${l.start}[a${i}]`);
  });
  const mix = `${lines.map((_, i) => `[a${i}]`).join("")}amix=inputs=${lines.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad,atrim=0:${(durationMs / 1000).toFixed(3)}[voice]`;
  const srtIndex = lines.length + 1;
  inputs.push("-i", `${here}news-pulse-promo.srt`);
  const res = spawnSync(ffmpegPath, [
    "-y", "-hide_banner", "-loglevel", "error", ...inputs,
    "-filter_complex", [...filters, mix].join(";"),
    "-map", "0:v", "-map", "[voice]", "-map", `${srtIndex}:s`,
    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-c:s", "mov_text",
    "-metadata:s:s:0", "language=eng", "-metadata:s:a:0", "language=eng",
    "-movflags", "+faststart", silent,
  ], { encoding: "utf8" });
  if (res.status !== 0) {
    renameSync(tmp, silent);
    throw new Error(`adding voice failed: ${res.stderr}`);
  }
  unlinkSync(tmp);
  console.log(`saved ${OUT} with narration (${lines.length} lines) and an English subtitle track`);
}
