import type { Candidate, ValidatedItem, Validation } from "./types.ts";

const VERDICT_WEIGHT: Record<Validation["verdict"], number> = {
  verified: 1,
  to_be_verified: 0.5,
  likely_fake: 0,
};

/**
 * Picks the three items to show. Relevance matters most; verification boosts an item.
 * Likely-fake items are never shown as "most important".
 */
export function rankTop3(results: { candidate: Candidate; validation: Validation }[]): {
  items: ValidatedItem[];
  rejectedAsFake: number;
} {
  const scored = results.map(({ candidate, validation }) => ({
    ...candidate,
    validation,
    score: 0.65 * validation.relevance + 0.35 * VERDICT_WEIGHT[validation.verdict] * validation.confidence,
  }));
  const shown = scored.filter((i) => i.validation.verdict !== "likely_fake");
  return {
    items: shown.sort((a, b) => b.score - a.score).slice(0, 3),
    rejectedAsFake: scored.length - shown.length,
  };
}
