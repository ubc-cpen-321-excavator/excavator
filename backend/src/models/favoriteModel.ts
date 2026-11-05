import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A favorite in the `favorites` collection: one user marking one Gem as a favorite.
 *
 * Users and Gems are many-to-many through favorites, so each favorite is its own document,
 * identified by its user and Gem together, rather than a list on the user. That keeps them in the
 * order they were added and makes adding the same favorite twice harmless.
 * See Requirements_and_Design.md section 4.2.
 */
const favoriteSchema = new Schema({
  user: { type: String, required: true }, // User ID (Google `sub`)
  gem: { type: String, required: true },  // Gem name, `places/<place ID>`
}, { timestamps: true });

// The key: a user favorites a Gem at most once.
favoriteSchema.index({ user: 1, gem: 1 }, { unique: true });
// Lists a user's favorites newest first without an in-memory sort.
favoriteSchema.index({ user: 1, createdAt: -1 });

/** A stored favorite document, as read back from Mongo. */
export type FavoriteDoc = InferSchemaType<typeof favoriteSchema>;

/** Mongoose model for the `favorites` collection. */
export const FavoriteModel = model('Favorite', favoriteSchema);
