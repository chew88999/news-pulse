import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { readFile } from "node:fs/promises";
import cron from "node-cron";
import { getCheck, startCheck } from "./check.ts";
import { parseWindow, type Window } from "./collector.ts";
import { loadSnapshot, refresh, refreshState } from "./pipeline.ts";

const PORT = Number(process.env.PORT ?? 3000);
const REFRESH_CRON = process.env.REFRESH_CRON ?? "0 */2 * * *";
const INDEX_HTML = new URL("../web/index.html", import.meta.url);
// News feeds only keep roughly the last week, so older days would come back empty.
const MAX_DAYS_BACK = 7;

const app = new Hono();

app.get("/", async (c) => c.html(await readFile(INDEX_HTML, "utf8")));

/** ?day=YYYY-MM-DD (or nothing for the rolling view) → Window, or an error message. */
function windowFrom(day: string | undefined): Window | string {
  try {
    const window = parseWindow(day);
    if (window.key === "latest") return window;
    if (window.from > Date.now()) return "That day is in the future.";
    if (window.to < Date.now() - (MAX_DAYS_BACK + 1) * 86_400_000) return `Pick a day within the last ${MAX_DAYS_BACK} days; feeds don't keep older news.`;
    return window;
  } catch (err) {
    return (err as Error).message;
  }
}

// 200 snapshot | 202 still running | 404 not crawled yet (with the last error, if any)
app.get("/api/top3", async (c) => {
  const window = windowFrom(c.req.query("day"));
  if (typeof window === "string") return c.json({ error: window }, 400);
  const snapshot = await loadSnapshot(window.key);
  if (snapshot) return c.json(snapshot);
  const state = refreshState(window.key);
  if (state.running) return c.json({ status: "running", window: window.label }, 202);
  return c.json({ status: "missing", window: window.label, error: state.error }, 404);
});

// Starts a crawl for one day. Only accepts JSON requests from this page's own origin, so
// another website open in the browser can't trigger crawls (and spend OpenCode Go usage).
app.post("/api/crawl", async (c) => {
  const origin = c.req.header("origin");
  if (!c.req.header("content-type")?.startsWith("application/json") || (origin && new URL(origin).host !== c.req.header("host"))) {
    return c.json({ error: "forbidden" }, 403);
  }
  const window = windowFrom(c.req.query("day"));
  if (typeof window === "string") return c.json({ error: window }, 400);
  refresh(window).catch((err) => console.error(`[crawl ${window.key}] failed:`, (err as Error).message));
  return c.json({ status: "running", window: window.label }, 202);
});

// "Check a link": POST { url } → 202 { id }, then poll GET /api/check/:id.
app.post("/api/check", async (c) => {
  const origin = c.req.header("origin");
  if (!c.req.header("content-type")?.startsWith("application/json") || (origin && new URL(origin).host !== c.req.header("host"))) {
    return c.json({ error: "forbidden" }, 403);
  }
  const body = await c.req.json().catch(() => ({}));
  if (typeof body?.url !== "string" || body.url.length > 2000) return c.json({ error: "Paste a link to check." }, 400);
  try {
    return c.json(await startCheck(body.url), 202);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

app.get("/api/check/:id", (c) => {
  const check = getCheck(c.req.param("id"));
  return check ? c.json(check) : c.json({ error: "Not found. The server may have restarted; check the link again." }, 404);
});

cron.schedule(REFRESH_CRON, () => {
  refresh().catch((err) => console.error("[cron] refresh failed:", (err as Error).message));
});

serve({ fetch: app.fetch, port: PORT, hostname: "127.0.0.1" }, () => {
  console.log(`News Pulse on http://127.0.0.1:${PORT} (refresh: "${REFRESH_CRON}")`);
});

// Fill the page on first start.
if (!(await loadSnapshot())) refresh().catch((err) => console.error("[startup] refresh failed:", (err as Error).message));
