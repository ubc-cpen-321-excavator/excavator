import { Schema, model, type InferSchemaType } from "mongoose";

/** GeoJSON point. MongoDB stores coordinates as [longitude, latitude]. */
const pointSchema = new Schema({
  type: { type: String, enum: ['Point'], default: 'Point', required: true },
  coordinates: { type: [Number], required: true },
}, { _id: false });

/** The Google Places place a Gem is. */
const placeSchema = new Schema({
  name: { type: String, required: true }, // Google Places resource name, e.g. "places/ChIJ..."
  displayName: { type: String },
  location: { type: pointSchema, required: true },
}, { _id: false });

/**
 * A Gem in the `gems` collection, keyed by `name` (the Google Places resource name, `places/<place ID>`).
 * See Requirements_and_Design.md section 4.2.
 */
const gemSchema = new Schema({
  name: { type: String, required: true, unique: true },
  place: { type: placeSchema, required: true },
  description: { type: String },
  type: { type: String }, // Google Places primary type, e.g. "cafe"

  // GemScore is a weighted score of nicheness, quality, ...
  score: { type: Number },
  scoreTime: { type: Number }, // ms since epoch, same as Date.now()
  nicheness: { type: Number }, // From the nicheness API
  quality: { type: Number }, // Review quality from Google Places

  addedBy: { type: String }, // User id (Google sub) of the user who added the gem
}, { timestamps: true });

// For map browsing and the nearby gems feed ($near / $geoWithin).
gemSchema.index({ 'place.location': '2dsphere' });

// For filters and recommendations (sort by GemScore).
gemSchema.index({ type: 1 });
gemSchema.index({ score: -1 });

// TODO Ratings, comments, photos and notes go in their own collections, keyed by gem name.

/** A stored Gem document, as read back from Mongo. */
export type GemDoc = InferSchemaType<typeof gemSchema>;

/** What we write; createdAt / updatedAt are set by Mongoose. */
export type GemInput = Omit<GemDoc, 'createdAt' | 'updatedAt'>;

/** Mongoose model for the `gems` collection. */
export const GemModel = model('Gem', gemSchema);
