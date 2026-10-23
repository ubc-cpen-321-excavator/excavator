import { Schema, model, type InferSchemaType } from "mongoose";

// GeoJSON point. MongoDB stores coordinates as [longitude, latitude].
const pointSchema = new Schema({
  type: { type: String, enum: ['Point'], default: 'Point', required: true },
  coordinates: { type: [Number], required: true },
}, { _id: false });

const placeSchema = new Schema({
  name: { type: String, required: true }, // Google Places resource name, e.g. "places/ChIJ..."
  displayName: { type: String },
  location: { type: pointSchema, required: true },
}, { _id: false });

const gemSchema = new Schema({
  name: { type: String, required: true, unique: true },
  place: { type: placeSchema, required: true },
  description: { type: String },
  type: { type: String }, // Google Places primary type, e.g. "cafe"

  // GemScore is a weighted score of nicheness, certainty, popularity, ...
  score: { type: Number },
  scoreTime: { type: Number }, // ms since epoch, same as Date.now()
  nicheness: { type: Number }, // From the nicheness API
  popularity: { type: Number },
  certainty: { type: Number }, // How confident we are in the score

  addedBy: { type: String }, // User id (Google sub) of the user who added the gem
}, { timestamps: true });

// For map browsing and the nearby gems feed ($near / $geoWithin).
gemSchema.index({ 'place.location': '2dsphere' });

// For filters and recommendations (sort by GemScore).
gemSchema.index({ type: 1 });
gemSchema.index({ score: -1 });

// TODO Ratings, comments, photos and notes go in their own collections, keyed by gem name.

export type GemDoc = InferSchemaType<typeof gemSchema>;

// What we write; createdAt / updatedAt are set by Mongoose.
export type GemInput = Omit<GemDoc, 'createdAt' | 'updatedAt'>;

export const GemModel = model('Gem', gemSchema);
