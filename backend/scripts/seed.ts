import { CommentModel } from '../src/models/commentModel';
import { FavoriteModel } from '../src/models/favoriteModel';
import { GemModel } from '../src/models/gemModel';
import { RatingModel } from '../src/models/ratingModel';
import { UserModel } from '../src/models/userModel';
import {
  DEMO_COMMENTS,
  DEMO_GEMS,
  DEMO_USERS,
  SEED_GEM_PATTERN,
  SEED_USER_PATTERN,
  commentDoc,
  gemDoc,
} from './demoData';

/**
 * Writes or removes the demo data in `demoData.ts`, on the database Mongoose is connected to.
 * The command-line entry point is `seedDemoData.ts` (`npm run seed`).
 */

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** How many documents `seed` wrote, by collection. */
export interface SeedCounts {
  users: number;
  gems: number;
  comments: number;
}

/** How many documents `reset` removed, by collection. */
export interface ResetCounts extends SeedCounts {
  ratings: number;
  favorites: number;
}

/**
 * Adds the demo users, Gems and comments, or refreshes them if they are already there.
 * The Gems are dated one hour apart, ending one hour ago, so the last demo Gem is the newest.
 *
 * @returns how many documents were written.
 */
export async function seed(): Promise<SeedCounts> {
  const now = Date.now();

  for (const user of DEMO_USERS) {
    await UserModel.updateOne(
      { googleId: user.googleId },
      { $set: { name: user.name, displayName: user.displayName } },
      { upsert: true, runValidators: true },
    );
  }

  // One hour apart, so the newest-Gems order on the dashboard is fixed: the last Gem is the newest.
  const gemTimes = new Map<string, number>();
  for (const [i, gem] of DEMO_GEMS.entries()) {
    const createdAt = now - (DEMO_GEMS.length - i) * HOUR_MS;
    gemTimes.set(gem.name, createdAt);
    await GemModel.updateOne(
      { name: gem.name },
      { $set: gemDoc(gem, new Date(createdAt)) },
      { upsert: true, runValidators: true, timestamps: false },
    );
  }

  // Five minutes apart, after their Gem was added, so they list in this order.
  for (const [i, comment] of DEMO_COMMENTS.entries()) {
    const createdAt = (gemTimes.get(comment.gem) ?? now) + (i + 1) * 5 * MINUTE_MS;
    await CommentModel.updateOne(
      { gem: comment.gem, commentId: comment.commentId },
      { $set: commentDoc(comment, new Date(createdAt)) },
      { upsert: true, runValidators: true, timestamps: false },
    );
  }

  return { users: DEMO_USERS.length, gems: DEMO_GEMS.length, comments: DEMO_COMMENTS.length };
}

/**
 * Removes the demo data, and any comments, ratings and favorites left on the demo Gems.
 * Nothing else is touched: only documents with `seed-` IDs match.
 *
 * @returns how many documents were removed.
 */
export async function reset(): Promise<ResetCounts> {
  const [gems, comments, ratings, favorites, users] = await Promise.all([
    GemModel.deleteMany({ name: SEED_GEM_PATTERN }),
    CommentModel.deleteMany({ gem: SEED_GEM_PATTERN }),
    RatingModel.deleteMany({ gem: SEED_GEM_PATTERN }),
    FavoriteModel.deleteMany({ gem: SEED_GEM_PATTERN }),
    UserModel.deleteMany({ googleId: SEED_USER_PATTERN }),
  ]);

  return {
    gems: gems.deletedCount,
    comments: comments.deletedCount,
    ratings: ratings.deletedCount,
    favorites: favorites.deletedCount,
    users: users.deletedCount,
  };
}
