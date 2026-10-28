import { Schema, model, type InferSchemaType } from "mongoose";

/** A user's name, as given by their Google account. */
const nameSchema = new Schema({
  full: { type: String, required: true },
  family: { type: String },
  given: { type: String },
}, { _id: false });

/**
 * A user in the `users` collection, keyed by `googleId` (the Google account's `sub`).
 * `googleId` is also what Gems store in `addedBy`.
 * See Requirements_and_Design.md section 4.2.
 */
const userSchema = new Schema({
  googleId: { type: String, required: true, unique: true },
  name: { type: nameSchema, required: true },
  displayName: { type: String }, // Name shown to other users; defaults to the Google name
}, { timestamps: true });

/** A stored User document, as read back from Mongo. */
export type UserDoc = InferSchemaType<typeof userSchema>;

/** What we write; createdAt / updatedAt are set by Mongoose. */
export type UserInput = Omit<UserDoc, 'createdAt' | 'updatedAt'>;

/** Mongoose model for the `users` collection. */
export const UserModel = model('User', userSchema);
