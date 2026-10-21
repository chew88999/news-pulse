import Parser from "rss-parser";
import { FEEDS, KEYWORDS } from "./feeds.ts";
import type { Candidate, Feed } from "./types.ts";

const parser = new Parser();
const USER_AGENT = "NewsPulse/0.1 (+internal news digest)";

const MAX_AGE_HOURS = Number(process.env.MAX_AGE_HOURS ?? 48);

/** A time window to collect from: the last MAX_AGE_HOURS by default, or one calendar day. */
export interface Window {
  /** "latest" for the rolling window, otherwise the day as YYYY-MM-DD. */
  key: string;
  from: number;
  to: number;
  label: string;
}

/** "yesterday", "today" or "YYYY-MM-DD" → that local calendar day; nothing → the last MAX_AGE_HOURS. */
export function parseWindow(day?: string): Window {
  if (!day || day === "latest") {
    return { key: "latest", from: Date.now() - MAX_AGE_HOURS * 3_600_000, to: Date.now(), label: `last ${MAX_AGE_HOURS}h` };
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (day === "yesterday") start.setDate(start.getDate() - 1);
  else if (day !== "today") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
    if (!m) throw new Error(`day must be "today", "yesterday" or YYYY-MM-DD, got "${day}"`);
    start.setFullYear(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (start.getDate() !== Number(m[3])) throw new Error(`"${day}" is not a real date`);
  }
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return { key, from: start.getTime(), to: end.getTime(), label: start.toDateString() };
}

/** Pulls every feed, keeps items inside the window, removes duplicates and gives each a cheap prescore. */
export async function collect(window: Window = parseWindow()): Promise<Candidate[]> {
  const results = await Promise.allSettled(FEEDS.map((feed) => readFeed(feed, window)));
  const all: Candidate[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.warn(`[collector] skipped ${FEEDS[i].name}: ${(r.reason as Error).message}`);
  });
  return dedupe(all).sort((a, b) => b.prescore - a.prescore);
}

async function readFeed(feed: Feed, window: Window): Promise<Candidate[]> {
  const res = await fetch(feed.url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`HTTP ${res.status}`);
  }
  const parsed = await parser.parseString(await res.text());
  const out: Candidate[] = [];
  for (const item of parsed.items) {
    const url = item.link?.trim();
    const title = item.title?.trim();
    const published = item.isoDate ?? item.pubDate;
    if (!url || !title || !published) continue;
    if (/partner-content|sponsored/i.test(url)) continue; // paid placements aren't news
    const time = new Date(published).getTime();
    if (Number.isNaN(time) || time < window.from || time >= window.to) continue;

    const snippet = stripHtml(item.contentSnippet ?? item.summary ?? item.content ?? "").slice(0, 500);
    out.push({
      title,
      url,
      source: feed.name,
      sourceTier: feed.tier,
      domain: feed.domain,
      publishedAt: new Date(time).toISOString(),
      snippet,
      prescore: prescore(`${title} ${snippet}`, (time - window.from) / (window.to - window.from), feed.tier),
    });
  }
  return out;
}

/** `recency` is 1 at the end of the window (newest) and 0 at its start. */
function prescore(text: string, recency: number, tier: number): number {
  const lower = text.toLowerCase();
  let keywordScore = 0;
  for (const [word, weight] of Object.entries(KEYWORDS)) {
    if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)) keywordScore += weight;
  }
  const tierBonus = (5 - tier) * 0.5; // tier 1 = 2, tier 4 = 0.5
  return Math.min(keywordScore, 10) + recency * 3 + tierBonus;
}

/** Drops repeats of the same URL, and near-identical headlines from different outlets (keeps the better one). */
function dedupe(items: Candidate[]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const item of items) {
    const keys = [normaliseUrl(item.url), titleKey(item.title)];
    const existing = keys.map((k) => byKey.get(k)).find(Boolean);
    if (existing && existing.prescore >= item.prescore) continue;
    if (existing) for (const k of [normaliseUrl(existing.url), titleKey(existing.title)]) byKey.delete(k);
    for (const k of keys) byKey.set(k, item);
  }
  return [...new Set(byKey.values())];
}

function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const p of [...u.searchParams.keys()]) if (p.startsWith("utm_")) u.searchParams.delete(p);
    return `url:${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return `url:${raw}`;
  }
}

function titleKey(title: string): string {
  return "title:" + title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 3).slice(0, 8).join(" ");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
