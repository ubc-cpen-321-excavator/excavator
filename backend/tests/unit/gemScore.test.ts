import { computeGemScore } from '../../src/utils/gemScore';

// Interface computeGemScore
describe('computeGemScore', () => {
  // Input: worked examples (rating, review count)
  // Expected output: the scores documented in Requirements_and_Design.md, to one decimal
  test.each([
    [undefined, undefined, 66.0], // no data: prior only
    [5.0, 2, 70.2],               // two perfect reviews: barely moves from the prior
    [4.8, 60, 82.2],              // well rated, still little known: a gem
    [4.5, 300, 63.2],             // well rated, well known
    [4.7, 1000, 46.4],            // famous
    [3.5, 60, 66.3],              // mediocre, little known
  ])('rating %p, %p reviews -> %p', (rating, reviewCount, expected) => {
    expect(computeGemScore({ rating, reviewCount }).score).toBeCloseTo(expected, 1);
  });

  // Input: same review count, higher rating
  // Expected output: higher score
  test('Better rated scores higher', () => {
    expect(computeGemScore({ rating: 4.8, reviewCount: 60 }).score)
      .toBeGreaterThan(computeGemScore({ rating: 4.0, reviewCount: 60 }).score);
  });

  // Input: same rating, many more reviews
  // Expected output: lower score and lower nicheness
  test('Better known scores lower', () => {
    const niche = computeGemScore({ rating: 4.6, reviewCount: 80 });
    const famous = computeGemScore({ rating: 4.6, reviewCount: 5000 });
    expect(famous.score).toBeLessThan(niche.score);
    expect(famous.nicheness).toBeLessThan(niche.nicheness);
  });

  // Input: extremes, incl. an out-of-range rating (ignored) and a negative review count (treated as 0)
  // Expected output: score within 0–100; quality and nicheness within 0–1
  test.each([
    [1.0, 100000], [5.0, 100000], [5.0, 1], [1.0, 1], [7, 10], [4, -5],
  ])('Bounded: rating %p, %p reviews', (rating, reviewCount) => {
    const { score, quality, nicheness } = computeGemScore({ rating, reviewCount });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(quality).toBeGreaterThanOrEqual(0);
    expect(quality).toBeLessThanOrEqual(1);
    expect(nicheness).toBeGreaterThan(0);
    expect(nicheness).toBeLessThanOrEqual(1);
  });
});
