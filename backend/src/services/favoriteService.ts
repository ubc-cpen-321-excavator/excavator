import { FavoriteModel, type FavoriteDoc } from "../models/favoriteModel";
import GemService, { NoSuchGemError, type Gem } from "./gemService";

/** Most favorites one user can have; well above normal use, but bounds the list and the storage. */
export const MAX_FAVORITES = 500;

/** MongoDB's error code for a unique index violation. */
const MONGO_DUPLICATE_KEY = 11000;

/** Thrown when a user who already has `MAX_FAVORITES` favorites adds another (409). */
export class TooManyFavoritesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TooManyFavoritesError';
  }
}

/**
 * Adds, removes and lists a user's favorite Gems.
 */
class FavoriteService {
  private repo: FavoriteRepo = new FavoriteRepo();
  private gemService: GemService;

  /**
   * @param gemService used to check that a Gem exists, and to load the favorite Gems.
   */
  constructor(gemService: GemService) {
    this.gemService = gemService;
  }

  /**
   * Gets a user's favorite Gems, most recently added first.
   *
   * @param userId the user's ID (Google `sub`).
   * @returns the Gems; a favorite whose Gem no longer exists is left out.
   * @throws the database error.
   */
  async getFavorites(userId: string): Promise<Gem[]> {
    const names = await this.repo.listByUser(userId, MAX_FAVORITES);
    return this.gemService.getGems(names);
  }

  /**
   * Adds a Gem to a user's favorites. Adding one that is already a favorite changes nothing.
   *
   * @param userId the user's ID (Google `sub`).
   * @param gem Gem name, `places/<place ID>`.
   * @returns `true` if it was added, `false` if it already was a favorite.
   * @throws `NoSuchGemError` if there is no such Gem; nothing is stored.
   * @throws `TooManyFavoritesError` if the user already has `MAX_FAVORITES`; nothing is stored.
   * @throws the database error.
   */
  async addFavorite(userId: string, gem: string): Promise<boolean> {
    if (!(await this.gemService.hasGem(gem))) {
      throw new NoSuchGemError('No such Gem.');
    }

    if (await this.repo.has(userId, gem)) {
      return false;
    }

    // Checked before inserting; two adds racing at the limit could go one over, which is harmless.
    if (await this.repo.countByUser(userId) >= MAX_FAVORITES) {
      throw new TooManyFavoritesError('Too many favorites.');
    }

    return this.repo.insert(userId, gem);
  }

  /**
   * Removes a Gem from a user's favorites.
   *
   * @param userId the user's ID (Google `sub`).
   * @param gem Gem name, `places/<place ID>`.
   * @returns `true` if it was removed, `false` if it wasn't a favorite.
   * @throws the database error.
   */
  async removeFavorite(userId: string, gem: string): Promise<boolean> {
    return this.repo.remove(userId, gem);
  }
}

/**
 * Stores favorites in the `favorites` collection. Does no validation; `FavoriteService` does that.
 */
class FavoriteRepo {

  /**
   * @param userId the user's ID.
   * @param limit most favorites to return.
   * @returns the names of the user's favorite Gems, most recently added first.
   */
  async listByUser(userId: string, limit: number): Promise<string[]> {
    const docs = await FavoriteModel.find({ user: userId }).sort({ createdAt: -1, _id: -1 }).limit(limit)
      .lean<FavoriteDoc[]>();
    return docs.map(d => d.gem);
  }

  /**
   * @returns `true` if the user has that Gem as a favorite.
   */
  async has(userId: string, gem: string): Promise<boolean> {
    return (await FavoriteModel.exists({ user: userId, gem })) !== null;
  }

  /**
   * @returns how many favorites the user has.
   */
  async countByUser(userId: string): Promise<number> {
    return FavoriteModel.countDocuments({ user: userId });
  }

  /**
   * Stores a favorite.
   *
   * @returns `true` if stored, `false` if it already existed (also when added twice at once).
   */
  async insert(userId: string, gem: string): Promise<boolean> {
    try {
      await FavoriteModel.create({ user: userId, gem });
      return true;
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === MONGO_DUPLICATE_KEY) {
        return false;
      }
      throw err;
    }
  }

  /**
   * @returns `true` if a favorite was deleted.
   */
  async remove(userId: string, gem: string): Promise<boolean> {
    const res = await FavoriteModel.deleteOne({ user: userId, gem });
    return res.deletedCount > 0;
  }
}

export default FavoriteService
