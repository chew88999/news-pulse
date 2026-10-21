// "Check a link": a user pastes an article URL and the validator agent checks it.
// Results stay in memory only (no history, per the product brief).
import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { FEEDS } from "./feeds.ts";
import type { Candidate, LinkCheck } from "./types.ts";
import { assertReachable, validateOne } from "./validate.ts";

const MAX_RUNNING = 2;
const MAX_KEPT = 50;
const checks = new Map<string, LinkCheck>();

// Addresses on this machine or the local network. The agent must not be pointed at them.
const PRIVATE = new BlockList();
for (const [net, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16]] as const) {
  PRIVATE.addSubnet(net, bits, "ipv4");
}
for (const [net, bits] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10]] as const) PRIVATE.addSubnet(net, bits, "ipv6");

/** Returns the cleaned URL, or throws with a message the page can show. */
async function checkUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That doesn't look like a web address. Paste the full link, starting with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http and https links can be checked.");
  if (url.username || url.password) throw new Error("Links with a username or password can't be checked.");
  url.hash = "";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Links to this computer or the local network can't be checked.");
  }
  let addresses: { address: string; family: number }[];
  try {
    addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  } catch {
    throw new Error(`Couldn't find the site ${host}. Check the link is typed correctly.`);
  }
  if (addresses.some((a) => PRIVATE.check(a.address, a.family === 6 ? "ipv6" : "ipv4"))) {
    throw new Error("Links to this computer or the local network can't be checked.");
  }
  return url;
}

/** Best effort: the page's title, site name, date and description, so the result card has something to show. */
async function pageInfo(url: URL): Promise<{ title?: string; site?: string; published?: string; description?: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "NewsPulse/0.1 (+internal news check)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("html")) {
      await res.body?.cancel();
      return {};
    }
    const html = (await res.text()).slice(0, 1_000_000);
    const meta = (name: string) =>
      new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i").exec(html)?.[1] ??
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i").exec(html)?.[1];
    const title = meta("og:title") ?? /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1];
    const published = meta("article:published_time") ?? meta("og:published_time") ?? meta("date");
    return {
      title: title && decode(title),
      site: meta("og:site_name") && decode(meta("og:site_name")!),
      published: published && !Number.isNaN(new Date(published).getTime()) ? new Date(published).toISOString() : undefined,
      description: meta("og:description") ?? meta("description"),
    };
  } catch {
    return {}; // the agent will still try to fetch the page itself
  }
}

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Starts a check, or returns the one already running or done for the same link. */
export async function startCheck(raw: string): Promise<LinkCheck> {
  const url = await checkUrl(raw);
  const existing = [...checks.values()].find((c) => c.url === url.href && c.status !== "failed");
  if (existing) return existing;
  if ([...checks.values()].filter((c) => c.status === "running").length >= MAX_RUNNING) {
    throw new Error("Two links are already being checked. Try again in a minute.");
  }
  await assertReachable();

  const check: LinkCheck = { id: randomUUID(), url: url.href, status: "running", startedAt: new Date().toISOString() };
  checks.set(check.id, check);
  for (const id of [...checks.keys()].slice(0, Math.max(0, checks.size - MAX_KEPT))) checks.delete(id);

  void run(check, url);
  return check;
}

async function run(check: LinkCheck, url: URL): Promise<void> {
  const started = Date.now();
  try {
    const info = await pageInfo(url);
    const host = url.hostname.replace(/^www\./, "");
    // If the link is from one of our feed sites, reuse that site's tier and name.
    const feed = FEEDS.find((f) => {
      const feedHost = new URL(f.url).hostname.replace(/^(www|feeds)\./, "");
      return host === feedHost || host.endsWith(`.${feedHost}`);
    });
    const candidate: Candidate = {
      title: info.title || url.href,
      url: url.href,
      source: info.site || feed?.name || host,
      sourceTier: feed?.tier ?? 4,
      domain: feed?.domain ?? "technology",
      publishedAt: info.published ?? "",
      snippet: (info.description ?? "").slice(0, 500),
      prescore: 0,
      submittedByUser: true,
    };
    const { validation, model } = await validateOne(candidate);
    check.item = { ...candidate, validation, score: validation.relevance };
    check.status = "done";
    console.log(`[check] ${model}  ${validation.verdict}  ${Math.round((Date.now() - started) / 1000)}s  ${url.href}`);
  } catch (err) {
    check.status = "failed";
    check.error = (err as Error).message;
    console.warn(`[check] failed: ${url.href}: ${check.error}`);
  }
}

export function getCheck(id: string): LinkCheck | undefined {
  return checks.get(id);
}
