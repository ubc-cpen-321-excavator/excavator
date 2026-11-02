import { MAX_STARS, MIN_STARS, RatingModel } from "../models/ratingModel";
import GemService, { NoSuchGemError, type Gem } from "./gemService";

/**
 * Checks a rating a user wants to give.
 *
 * @param stars value to check, usually taken straight from a request.
 * @returns `true` if it is a whole number from 1 to 5.
 */
export function isValidStars(stars: unknown): stars is number {
  return typeof stars === 'number' && Number.isInteger(stars) && stars >= MIN_STARS && stars <= MAX_STARS;
}

/** Thrown when `stars` fails `isValidStars`. The client's fault (400). */
export class InvalidStarsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStarsError';
  }
}

/** A Gem's Excavator ratings, summed up. */
export interface RatingTotals {
  count: number;
  /** 1–5; `undefined` when `count` is 0. */
  average: number | undefined;
}

/**
 * Gives and reads users' ratings of Gems, and keeps each Gem's GemScore up to date with them.
 */
class RatingService {
  private repo: RatingRepo = new RatingRepo();
  private gemService: GemService;

  /**
   * @param gemService used to check that a Gem exists, and to rescore it.
   */
  constructor(gemService: GemService) {
    this.gemService = gemService;
  }

  /**
   * Gives a Gem a rating, or changes the user's earlier one, then rescores the Gem.
   *
   * The Gem's totals are recounted from all its ratings rather than adjusted, so they stay right
   * even when two users rate at once (the later recount sees both).
   *
   * @param userId the user's ID (Google `sub`).
   * @param gem Gem name, `places/<place ID>`.
   * @param stars 1 to 5.
   * @returns the Gem with its new rating totals and GemScore.
   * @throws `InvalidStarsError` if `stars` fails `isValidStars`; nothing is stored.
   * @throws `NoSuchGemError` if there is no such Gem; nothing is stored.
   * @throws the database error.
   */
  async rate(userId: string, gem: string, stars: number): Promise<Gem> {
    if (!isValidStars(stars)) {
      throw new InvalidStarsError('Invalid stars.');
    }
    if (!(await this.gemService.hasGem(gem))) {
      throw new NoSuchGemError('No such Gem.');
    }

    await this.repo.set(gem, userId, stars);
    const { count, average } = await this.repo.totals(gem);

    return this.gemService.applyAppRatings(gem, count, average);
  }

  /**
   * Gets the rating a user gave a Gem.
   *
   * @param userId the user's ID (Google `sub`).
   * @param gem Gem name, `places/<place ID>`.
   * @returns the stars, or `undefined` if the user hasn't rated it.
   * @throws `NoSuchGemError` if there is no such Gem.
   * @throws the database error.
   */
  async getRating(userId: string, gem: string): Promise<number | undefined> {
    if (!(await this.gemService.hasGem(gem))) {
      throw new NoSuchGemError('No such Gem.');
    }

    return this.repo.get(gem, userId);
  }
}

/**
 * Stores ratings in the `ratings` collection. Does no validation; `RatingService` does that.
 */
class RatingRepo {

  /**
   * Stores a user's rating of a Gem, replacing their earlier one. Atomic, so it never makes two.
   */
  async set(gem: string, userId: string, stars: number): Promise<void> {
    await RatingModel.updateOne({ gem, user: userId }, { $set: { stars } }, { upsert: true });
  }

  /**
   * @returns the user's stars for the Gem, or `undefined` if they haven't rated it.
   */
  async get(gem: string, userId: string): Promise<number | undefined> {
    const doc = await RatingModel.findOne({ gem, user: userId }).lean<{ stars: number }>();
    return doc?.stars;
  }

  /**
   * @returns how many ratings the Gem has and their average, computed by MongoDB from all of them.
   */
  async totals(gem: string): Promise<RatingTotals> {
    const [row] = await RatingModel.aggregate<{ count: number; average: number }>([
      { $match: { gem } },
      { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$stars' } } },
    ]);

    return row ? { count: row.count, average: row.average } : { count: 0, average: undefined };
  }
}

export default RatingService
