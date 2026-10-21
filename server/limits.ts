// Guards for running News Pulse on the public internet, where anyone can press the buttons
// that spend OpenCode Go usage. All counters are in memory and reset when the server restarts.

/** Requests per visitor (IP) per hour for the buttons that start AI work. */
const PER_HOUR = {
  crawl: Number(process.env.RATE_CRAWLS_PER_HOUR ?? 3),
  check: Number(process.env.RATE_CHECKS_PER_HOUR ?? 5),
};
/** AI article checks per day for the whole server, across all visitors and the schedule. */
export const DAILY_AI_LIMIT = Number(process.env.DAILY_AI_LIMIT ?? 150);

const hits = new Map<string, number[]>();

/** Records a request; returns how many seconds to wait if the visitor is over the limit, else 0. */
export function rateLimited(kind: keyof typeof PER_HOUR, ip: string): number {
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_HOUR[kind]) {
    hits.set(key, recent);
    return Math.ceil((recent[0] + 3_600_000 - now) / 1000);
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 10_000) hits.clear(); // don't grow without bound under a flood
  return 0;
}

let aiDay = "";
let aiUsed = 0;

/** Takes one AI article check from today's budget. Returns false when the budget is used up. */
export function takeAiCheck(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== aiDay) {
    aiDay = today;
    aiUsed = 0;
  }
  if (aiUsed >= DAILY_AI_LIMIT) return false;
  aiUsed++;
  return true;
}
