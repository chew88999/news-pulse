import type { Feed } from "./types.ts";

// Feeds the collector reads. Tiers match the defence-tech-news skill.
// Add or remove feeds here; anything that fails to load is skipped with a warning.
export const FEEDS: Feed[] = [
  { name: "U.S. Department of Defense", url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=20", tier: 1, domain: "defence" },
  { name: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml", tier: 2, domain: "defence" },
  { name: "Breaking Defense", url: "https://breakingdefense.com/feed/", tier: 2, domain: "defence" },
  { name: "DefenseScoop", url: "https://defensescoop.com/feed/", tier: 2, domain: "defence" },
  { name: "C4ISRNET", url: "https://www.c4isrnet.com/arc/outboundfeeds/rss/?outputType=xml", tier: 2, domain: "defence" },
  { name: "The War Zone", url: "https://www.twz.com/feed", tier: 2, domain: "defence" },
  { name: "Naval News", url: "https://www.navalnews.com/feed/", tier: 2, domain: "defence" },
  { name: "IEEE Spectrum", url: "https://spectrum.ieee.org/feeds/feed.rss", tier: 2, domain: "technology" },
  { name: "The Register", url: "https://www.theregister.com/headlines.atom", tier: 2, domain: "technology" },
  { name: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/index", tier: 2, domain: "technology" },
  { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", tier: 2, domain: "technology" },
  { name: "The Record", url: "https://therecord.media/feed", tier: 2, domain: "technology" },
];

// Words that make an item more likely to matter to IT and engineering staff.
// Used only to choose which candidates the agent spends time on.
export const KEYWORDS: Record<string, number> = {
  cyber: 3, vulnerability: 3, cve: 3, ransomware: 3, breach: 2, "zero-day": 3,
  ai: 2, "artificial intelligence": 2, autonomous: 2, drone: 2, uas: 2, "counter-drone": 2,
  satellite: 2, space: 1, semiconductor: 3, chip: 2, quantum: 2, "electronic warfare": 2,
  radar: 1, network: 1, cloud: 1, software: 2, "export control": 3, sanction: 2,
  contract: 1, procurement: 1, award: 1, hypersonic: 2, "5g": 2, encryption: 2, standard: 1,
};
