import { Schema, model, type InferSchemaType } from "mongoose";

/** Lowest and highest number of stars in a rating. */
export const MIN_STARS = 1;
export const MAX_STARS = 5;

/**
 * A rating in the `ratings` collection: one user's 1–5 star rating of one Gem.
 *
 * Ratings are a weak entity of Gems (many ratings to one Gem), identified by their Gem together
 * with the user who gave them, so each user has at most one rating per Gem; rating again changes it.
 * The Gem keeps the count and average (`ratingCount`, `ratingAverage`), which feed its GemScore.
 * See Requirements_and_Design.md section 4.2.
 */
const ratingSchema = new Schema({
  gem: { type: String, required: true },  // Gem name, `places/<place ID>`
  user: { type: String, required: true }, // User ID (Google `sub`)
  stars: { type: Number, required: true, min: MIN_STARS, max: MAX_STARS },
}, { timestamps: true });

// The weak entity's key: (gem, user). Also serves "all ratings of a Gem" for the average.
ratingSchema.index({ gem: 1, user: 1 }, { unique: true });

/** A stored rating document, as read back from Mongo. */
export type RatingDoc = InferSchemaType<typeof ratingSchema>;

/** Mongoose model for the `ratings` collection. */
export const RatingModel = model('Rating', ratingSchema);
