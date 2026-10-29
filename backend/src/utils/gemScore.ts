/**
 * GemScore: how much of a hidden gem a place is, from 0 to 100.
 * A gem must be both good (quality) and little known (nicheness), so the two are multiplied.
 *
 *   R_adj = (v·rating + m·C) / (v + m)     rating pulled toward C when there are few reviews
 *   Q     = (R_adj − 1) / 4                quality, 0–1
 *   N     = 1 / (1 + v / k)                nicheness, 0–1: fewer reviews = more niche
 *   score = 100 · Q^a · N^b
 *
 * where v is the Google review count. See Requirements_and_Design.md.
 */

/** C: rating assumed for a place with no reviews; skeptical, so unknown places don't score high. */
export const PRIOR_RATING = 3.0;
/** m: how many reviews the prior counts as. */
export const PRIOR_WEIGHT = 15;
/** k: review count at which nicheness is 0.5. */
export const NICHENESS_HALF_COUNT = 200;
/** a: weight of quality; a little more than nicheness, so a good known place beats a poor obscure one. */
export const QUALITY_EXPONENT = 0.6;
/** b: weight of nicheness. */
export const NICHENESS_EXPONENT = 0.4;

/** What the score is computed from, as Google Places gives it. */
export interface ScoreInputs {
  /** Google rating, 1.0–5.0; `undefined` if the place has none. */
  rating?: number | undefined;
  /** Number of Google reviews; `undefined` counts as 0. */
  reviewCount?: number | undefined;
}

/** A computed GemScore and the parts it was computed from. */
export interface ScoreResult {
  /** 0–100, rounded to one decimal. */
  score: number;
  /** Q, 0–1. */
  quality: number;
  /** N, 0–1. */
  nicheness: number;
}

/**
 * @param inputs the place's Google rating and review count.
 * @returns the GemScore with its quality and nicheness.
 */
export function computeGemScore({ rating, reviewCount }: ScoreInputs): ScoreResult {
  // Without a rating, reviews say nothing about quality, so only the prior counts.
  const hasRating = typeof rating === 'number' && rating >= 1 && rating <= 5;
  const v = Math.max(0, reviewCount ?? 0);
  const vRated = hasRating ? v : 0;

  const adjusted = (vRated * (hasRating ? rating : 0) + PRIOR_WEIGHT * PRIOR_RATING) / (vRated + PRIOR_WEIGHT);
  const quality = (adjusted - 1) / 4;
  const nicheness = 1 / (1 + v / NICHENESS_HALF_COUNT);
  const score = 100 * quality ** QUALITY_EXPONENT * nicheness ** NICHENESS_EXPONENT;

  return { score: Math.round(score * 10) / 10, quality, nicheness };
}
