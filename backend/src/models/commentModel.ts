import { Schema, model, type InferSchemaType } from "mongoose";

/** Longest comment body accepted, in characters (after trimming). */
export const COMMENT_BODY_MAX_LENGTH = 1000;

/**
 * A comment in the `comments` collection.
 *
 * Comments are a weak entity of Gems (many comments to one Gem): a comment only exists for a
 * given Gem, and is identified by its Gem's name together with its own comment ID.
 * See Requirements_and_Design.md section 4.2.
 *
 * The comment ID is stored as `commentId` because Mongoose reserves `id` for `_id`;
 * the API calls it `id`.
 */
const commentSchema = new Schema({
  gem: { type: String, required: true },       // Owning Gem's name, `places/<place ID>`
  commentId: { type: String, required: true }, // Partial key: unique within its Gem
  body: { type: String, required: true, maxlength: COMMENT_BODY_MAX_LENGTH },
}, { timestamps: true });

// The weak entity's key: (gem, commentId). Also serves "all comments of a Gem".
commentSchema.index({ gem: 1, commentId: 1 }, { unique: true });
// Lists a Gem's comments oldest first without an in-memory sort.
commentSchema.index({ gem: 1, createdAt: 1 });

/** A stored comment document, as read back from Mongo. */
export type CommentDoc = InferSchemaType<typeof commentSchema>;

/** What we write; createdAt / updatedAt are set by Mongoose. */
export type CommentInput = Omit<CommentDoc, 'createdAt' | 'updatedAt'>;

/** Mongoose model for the `comments` collection. */
export const CommentModel = model('Comment', commentSchema);
