import { CommentModel, COMMENT_BODY_MAX_LENGTH, type CommentDoc, type CommentInput } from "../models/commentModel";
import type GemService from "./gemService";

/** Control characters other than tab, line feed and carriage return; newlines are fine in a comment. */
const DISALLOWED_CONTROL_CHARS = /[^\P{Cc}\t\n\r]/u;

/**
 * Checks a comment body a user wants to post.
 *
 * @param body value to check, usually taken straight from a request.
 * @returns `true` if it is a string that, once trimmed, is 1–1000 characters with no control
 *          characters other than tabs and newlines.
 */
export function isValidCommentBody(body: unknown): body is string {
  if (typeof body !== 'string') {
    return false;
  }

  const trimmed = body.trim();
  return trimmed.length > 0
    && trimmed.length <= COMMENT_BODY_MAX_LENGTH
    && !DISALLOWED_CONTROL_CHARS.test(trimmed);
}

/** Thrown when a comment body fails `isValidCommentBody`. The client's fault (400). */
export class InvalidCommentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCommentError';
  }
}

/** Thrown when comments are read or added for a Gem that is not stored. The client's fault (404). */
export class NoSuchGemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoSuchGemError';
  }
}

/**
 * A comment on a Gem. A weak entity: identified by `gem` and `id` together.
 */
class Comment {
  /** Owning Gem's name, `places/<place ID>`. */
  readonly gem: string;
  /** Comment ID, unique within its Gem. */
  readonly id: string;
  readonly body: string;

  /**
   * Does not validate the comment! Use `CommentService.addComment` to add a validated comment.
   *
   * @param gem owning Gem's name.
   * @param id comment ID, unique within the Gem.
   * @param body the comment text.
   */
  constructor(gem: string, id: string, body: string) {
    this.gem = gem;
    this.id = id;
    this.body = body;
  }

  /**
   * @returns what the API returns for a comment: its `id` and `body`. The Gem is already in the URL.
   */
  toJSON(): { id: string; body: string } {
    return { id: this.id, body: this.body };
  }
}

/**
 * Adds and lists the comments of Gems.
 */
class CommentService {
  private repo: CommentRepo = new CommentRepo();
  private gemService: GemService;

  /**
   * @param gemService used to check that a Gem exists before reading or adding its comments.
   */
  constructor(gemService: GemService) {
    this.gemService = gemService;
  }

  /**
   * @param gem Gem name, `places/<place ID>`.
   * @throws `NoSuchGemError` if no Gem has that name.
   */
  private async requireGem(gem: string): Promise<void> {
    if (!(await this.gemService.hasGem(gem))) {
      throw new NoSuchGemError('No such Gem.');
    }
  }

  /**
   * Gets every comment on a Gem, oldest first.
   *
   * @param gem Gem name, `places/<place ID>`.
   * @returns the comments; empty if the Gem has none.
   * @throws `NoSuchGemError` if no Gem has that name.
   * @throws the database error for anything else.
   */
  async getComments(gem: string): Promise<Comment[]> {
    await this.requireGem(gem);

    return this.repo.listByGem(gem);
  }

  /**
   * Validates and adds a comment to a Gem.
   *
   * @param gem Gem name, `places/<place ID>`.
   * @param body the comment text; stored trimmed.
   * @returns the new comment, with its new ID.
   * @throws `InvalidCommentError` if `body` fails `isValidCommentBody`; nothing is stored.
   * @throws `NoSuchGemError` if no Gem has that name; nothing is stored.
   * @throws the database error for anything else.
   * @constructs `Comment`
   */
  async addComment(gem: string, body: string): Promise<Comment> {
    if (!isValidCommentBody(body)) {
      throw new InvalidCommentError('Invalid comment body.');
    }

    await this.requireGem(gem);

    const comment = new Comment(gem, crypto.randomUUID(), body.trim());
    await this.repo.create(comment);

    return comment;
  }
}

/**
 * Maps a Comment to the document stored in Mongo.
 *
 * @param comment the Comment to store.
 * @returns the document; the comment ID goes in `commentId`.
 */
function toDoc(comment: Comment): CommentInput {
  return {
    gem: comment.gem,
    commentId: comment.id,
    body: comment.body,
  };
}

/**
 * Maps a stored Mongo document back to a Comment.
 *
 * @param doc the stored document.
 * @returns the Comment.
 */
function fromDoc(doc: CommentDoc): Comment {
  return new Comment(doc.gem, doc.commentId, doc.body);
}

/**
 * Stores Comments in the `comments` collection. Does no validation; `CommentService` does that.
 */
class CommentRepo {

  /**
   * Stores a new comment. Fails if its Gem already has a comment with the same ID (unique index).
   *
   * @param comment the Comment to store.
   */
  async create(comment: Comment): Promise<void> {
    await CommentModel.create(toDoc(comment));
  }

  /**
   * @param gem Gem name, `places/<place ID>`.
   * @returns the Gem's comments, oldest first (ties broken by insertion order).
   */
  async listByGem(gem: string): Promise<Comment[]> {
    const docs = await CommentModel.find({ gem }).sort({ createdAt: 1, _id: 1 }).lean<CommentDoc[]>();
    return docs.map(fromDoc);
  }

}

export { Comment };

export default CommentService
