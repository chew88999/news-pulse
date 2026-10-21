import { z } from "zod";

export type Tier = 1 | 2 | 3 | 4;

export interface Feed {
  name: string;
  url: string;
  tier: Tier;
  domain: "defence" | "technology";
}

export interface Candidate {
  title: string;
  url: string;
  source: string;
  sourceTier: Tier;
  domain: Feed["domain"];
  /** ISO date, or "" when unknown (a link a user pasted, with no date found on the page). */
  publishedAt: string;
  snippet: string;
  /** Cheap keyword + recency score used to decide which items the agent checks. */
  prescore: number;
  /** True for a link a user pasted into "Check a link": no feed, so no configured tier. */
  submittedByUser?: boolean;
}

/** One "Check a link" request, kept in memory only. */
export interface LinkCheck {
  id: string;
  url: string;
  status: "running" | "done" | "failed";
  startedAt: string;
  item?: ValidatedItem;
  error?: string;
}

export const Verdict = z.enum(["verified", "to_be_verified", "likely_fake"]);
export type Verdict = z.infer<typeof Verdict>;

/** What the news-validator agent must return for each article. */
export const Validation = z.object({
  summary: z
    .string()
    .max(220)
    .describe("At most 200 characters (1-2 short lines), in your own words: what happened and why an engineer should care"),
  verdict: Verdict,
  confidence: z.number().min(0).max(1).describe("How sure you are of the verdict"),
  relevance: z.number().min(0).max(1).describe("Relevance to IT and engineering staff, per the skill's rubric"),
  source_tier: z.number().int().min(1).max(4),
  corroborating_urls: z.array(z.string()).describe("Only URLs you fetched that carry the same claim"),
  red_flags: z.array(z.string()),
  reasons: z.array(z.string()).describe("Short reasons for the verdict"),
});
export type Validation = z.infer<typeof Validation>;

export interface ValidatedItem extends Candidate {
  validation: Validation;
  score: number;
}

export interface Snapshot {
  generatedAt: string;
  /** Which news the snapshot covers, e.g. "last 48h" or "Tue Oct 20 2026". */
  window: string;
  /** Set when the snapshot is for one chosen day (YYYY-MM-DD). */
  day?: string;
  items: ValidatedItem[];
  stats: {
    collected: number;
    validated: number;
    rejectedAsFake: number;
    failed: number;
  };
}
