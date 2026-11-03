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

/** How many documents `seed` added, by collection. */
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
 * Adds whichever demo users, Gems and comments are missing. Ones already stored are left as they
 * are, so running it again (e.g. on every deploy) keeps their dates and any ratings or comments
 * users have added since. To start over, run `reset` first.
 * The Gems are dated one hour apart, ending one hour ago, so the last demo Gem is the newest.
 *
 * @returns how many documents were added.
 */
export async function seed(): Promise<SeedCounts> {
  const now = Date.now();
  const added: SeedCounts = { users: 0, gems: 0, comments: 0 };

  for (const user of DEMO_USERS) {
    const result = await UserModel.updateOne(
      { googleId: user.googleId },
      { $setOnInsert: { name: user.name, displayName: user.displayName } },
      { upsert: true, runValidators: true },
    );
    added.users += result.upsertedCount;
  }

  // One hour apart, so the newest-Gems order on the dashboard is fixed: the last Gem is the newest.
  const gemTimes = new Map<string, number>();
  for (const [i, gem] of DEMO_GEMS.entries()) {
    const createdAt = now - (DEMO_GEMS.length - i) * HOUR_MS;
    gemTimes.set(gem.name, createdAt);
    const result = await GemModel.updateOne(
      { name: gem.name },
      { $setOnInsert: gemDoc(gem, new Date(createdAt)) },
      { upsert: true, runValidators: true, timestamps: false },
    );
    added.gems += result.upsertedCount;
  }

  // Five minutes apart, after their Gem was added, so they list in this order.
  for (const [i, comment] of DEMO_COMMENTS.entries()) {
    const createdAt = (gemTimes.get(comment.gem) ?? now) + (i + 1) * 5 * MINUTE_MS;
    const result = await CommentModel.updateOne(
      { gem: comment.gem, commentId: comment.commentId },
      { $setOnInsert: commentDoc(comment, new Date(createdAt)) },
      { upsert: true, runValidators: true, timestamps: false },
    );
    added.comments += result.upsertedCount;
  }

  return added;
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
