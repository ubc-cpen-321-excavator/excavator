import { OAuth2Client } from "google-auth-library";
import { env } from '../config/env'
import { UserModel, type UserDoc, type UserInput } from "../models/userModel";
import { definedOnly } from "../utils/defined";
import { alphnumDashOnly } from "../utils/trust";

/** Longest display name accepted, in characters (after trimming). */
const DISPLAY_NAME_MAX_LENGTH = 50;

/** Used when a Google account has no name at all. */
const FALLBACK_FULL_NAME = 'Excavator user';

/** A user's name, as given by their Google account. */
interface Name {
  readonly full: string;
  readonly family?: string | undefined;
  readonly given?: string | undefined;
}

/** A user of Excavator. */
interface User {
  /** Google account ID (`sub`). Also what Gems store in `addedBy`. */
  readonly id: string;
  readonly name: Name;
  /** Name shown to other users; set from the Google name the first time it is needed. */
  displayName?: string | undefined;
}

/** Thrown when a Google ID token is invalid, expired, or carries no account ID. The client's fault (400). */
export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

/** Thrown when a session ID does not belong to a logged-in user. The client's fault (401). */
export class InvalidSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSessionError';
  }
}

/** Thrown when a display name fails `isValidDisplayName`. The client's fault (400). */
export class InvalidDisplayNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDisplayNameError';
  }
}

/**
 * Checks a display name a user wants to set.
 *
 * @param displayName value to check, usually taken straight from a request.
 * @returns `true` if it is a string that, once trimmed, is 1–50 characters with no control characters.
 */
export function isValidDisplayName(displayName: unknown): displayName is string {
  if (typeof displayName !== 'string') {
    return false;
  }

  const trimmed = displayName.trim();
  return trimmed.length > 0
    && trimmed.length <= DISPLAY_NAME_MAX_LENGTH
    && !/\p{Cc}/u.test(trimmed);
}

/**
 * The display name a user gets before choosing one.
 *
 * @param name the user's Google name.
 * @returns "Given Family" when Google has both, otherwise the full name.
 */
function defaultDisplayName(name: Name): string {
  return name.given && name.family ? `${name.given} ${name.family}` : name.full;
}

/**
 * A value with the time it was last used, for expiring idle sessions.
 */
class TimedEntry<T> {
  value: T;
  /** Last use, in ms since epoch. */
  time: number = Date.now();

  constructor(value: T) {
    this.value = value;
  }

  /** Marks the entry as used now. */
  heartbeat(): void {
    this.time = Date.now();
  }
}

/**
 * Logs users in with Google and keeps their sessions and profile.
 * Sessions live in memory; users are stored in the `users` collection.
 */
class UserService {
  private sessions: Map<string, TimedEntry<User>> = new Map<string, TimedEntry<User>>();
  private repo: UserRepo = new UserRepo();
  private ggClient = new OAuth2Client({
    clientId: env.google_client_id,
    clientSecret: env.google_client_secret,
  });

  // TODO Use JWT later
  private genSessionId(_seed: number): string {
    return crypto.randomUUID();
  }

  /**
   * @param sessionId from `login`.
   * @returns the session's user.
   * @throws `InvalidSessionError` if there is no such session.
   */
  private getUserBySessionId(sessionId: string): User {
    const user = this.sessions.get(sessionId)?.value
    if (!user) {
      throw new InvalidSessionError(`Invalid session: ${alphnumDashOnly(sessionId)}`);
    }

    return user;
  }

  /**
   * Verifies a Google ID token and reads the account from it.
   *
   * @param idToken from Google Sign-In on the client.
   * @returns the account as a User (not stored, no display name).
   * @throws `InvalidTokenError` if Google rejects the token or it has no account ID.
   */
  private async getGoogleUser(idToken: string): Promise<User> {
    let ticket;
    try {
      ticket = await this.ggClient.verifyIdToken({
        idToken,
        audience: env.google_client_id
      });
    } catch (err) {
      console.log(`idToken rejected: ${alphnumDashOnly(err)}`);
      throw new InvalidTokenError('idToken rejected.');
    }

    const payload = ticket.getPayload();
    if (!payload?.sub) { // requires 'openid' in client req. scope
      throw new InvalidTokenError(`Invalid Google Account info.`);
    }

    // Names require 'profile' in client req. scope
    const given = payload.given_name || undefined;
    const family = payload.family_name || undefined;
    const full = payload.name || [given, family].filter(Boolean).join(' ') || FALLBACK_FULL_NAME;

    return {
      id: payload.sub,
      name: { full, family, given },
    };
  }

  /**
   * Stores a user and updates every live session of theirs, so no session sees a stale profile.
   *
   * @param user the updated user.
   * @throws the database error if the write fails.
   */
  private async saveUser(user: User): Promise<void> {
    if (!(await this.repo.set(user))) {
      throw new Error('User write not acknowledged.');
    }

    for (const entry of this.sessions.values()) {
      if (entry.value.id === user.id) {
        entry.value = user;
      }
    }
  }

  /**
   * Logs a user in with Google, storing them on their first login.
   *
   * @param idToken from Google Sign-In on the client.
   * @returns a new session ID.
   * @throws `InvalidTokenError` if the token is bad; nothing is stored.
   * @throws the database error if the user cannot be read or stored.
   */
  async login(idToken: string): Promise<string> {
    const ggUser = await this.getGoogleUser(idToken);
    const user = await this.repo.getOrCreate(ggUser.id, ggUser.name);

    const sessionId = this.genSessionId(0);
    this.sessions.set(sessionId, new TimedEntry(user));

    return sessionId;
  }

  /**
   * @param sessionId from `login`.
   * @returns `true` if the session existed and is now ended.
   */
  logout(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Marks a session as used now, so `sweep` keeps it.
   *
   * @param sessionId from `login`; unknown IDs are ignored.
   */
  heartbeat(sessionId: string): void {
    this.sessions.get(sessionId)?.heartbeat();
  }

  // TODO Review after JWT
  /**
   * Ends every session idle for longer than `olderThan`.
   *
   * @param olderThan idle time in ms.
   */
  sweep(olderThan: number): void {
    const now = Date.now();
    const elders = [...this.sessions].filter(([_sid, en]) => (en.time + olderThan) < now).map(([sid, _en]) => sid)
    elders.forEach(sid => this.sessions.delete(sid))
  }

  /**
   * @param sessionId from `login`.
   * @returns the session's user ID (Google `sub`), e.g. for a Gem's `addedBy`.
   * @throws `InvalidSessionError` if there is no such session.
   */
  getUserId(sessionId: string): string {
    return this.getUserBySessionId(sessionId).id;
  }

  /**
   * @param sessionId from `login`.
   * @returns the user's display name, or `undefined` if none has been set yet.
   * @throws `InvalidSessionError` if there is no such session.
   */
  getDisplayName(sessionId: string): string | undefined {
    return this.getUserBySessionId(sessionId).displayName;
  }

  /**
   * Gets the user's display name, setting and storing the default from their Google name if there is none.
   *
   * @param sessionId from `login`.
   * @returns the display name.
   * @throws `InvalidSessionError` if there is no such session.
   * @throws the database error if the default cannot be stored.
   */
  async getOrCreateDisplayName(sessionId: string): Promise<string> {
    const user = this.getUserBySessionId(sessionId);

    if (!user.displayName) {
      const displayName = defaultDisplayName(user.name);
      await this.saveUser({ ...user, displayName });
      return displayName;
    }

    return user.displayName;
  }

  /**
   * Sets and stores the user's display name.
   *
   * @param sessionId from `login`.
   * @param displayName the new name; stored trimmed.
   * @throws `InvalidDisplayNameError` if `displayName` fails `isValidDisplayName`; nothing is stored.
   * @throws `InvalidSessionError` if there is no such session.
   * @throws the database error if the write fails.
   */
  async setDisplayName(sessionId: string, displayName: string): Promise<void> {
    if (!isValidDisplayName(displayName)) {
      throw new InvalidDisplayNameError('Invalid display name.');
    }

    const user = this.getUserBySessionId(sessionId);

    await this.saveUser({ ...user, displayName: displayName.trim() });
  }
}

/**
 * Maps a User to the document stored in Mongo.
 *
 * @param user the User to store.
 * @returns the document, keyed by `googleId`, with no `undefined` fields.
 */
function toDoc(user: User): UserInput {
  return {
    googleId: user.id,
    name: {
      full: user.name.full,
      ...definedOnly({ family: user.name.family, given: user.name.given }),
    },
    ...definedOnly({ displayName: user.displayName }),
  };
}

/**
 * Maps a stored Mongo document back to a User.
 *
 * @param doc the stored document.
 * @returns the User; `null` fields become `undefined`.
 */
function fromDoc(doc: UserDoc): User {
  return {
    id: doc.googleId,
    name: {
      full: doc.name.full,
      family: doc.name.family ?? undefined,
      given: doc.name.given ?? undefined,
    },
    displayName: doc.displayName ?? undefined,
  };
}

/**
 * Stores Users in the `users` collection. Does no validation; `UserService` does that.
 */
class UserRepo {

  /**
   * @param id Google account ID.
   * @returns the stored User, or `undefined` if there is none.
   */
  async get(id: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ googleId: id }).lean<UserDoc>();
    return doc ? fromDoc(doc) : undefined;
  }

  /**
   * Gets the stored User, creating it first if there is none.
   * Atomic, so two first logins at once cannot create two users.
   * An existing user's stored name is kept, not overwritten.
   *
   * @param id Google account ID.
   * @param name used only if the User has to be created.
   * @param displayName used only if the User has to be created.
   * @returns the stored User.
   */
  async getOrCreate(id: string, name: Name, displayName?: string): Promise<User> {
    const doc = await UserModel.findOneAndUpdate(
      { googleId: id },
      { $setOnInsert: toDoc({ id, name, displayName }) },
      { upsert: true, returnDocument: 'after' },
    ).lean<UserDoc>();

    if (!doc) {
      throw new Error('User not created.');
    }

    return fromDoc(doc);
  }

  /**
   * @param id Google account ID.
   * @returns `true` if a User with that ID is stored.
   */
  async has(id: string): Promise<boolean> {
    return (await UserModel.exists({ googleId: id })) !== null;
  }

  /**
   * Inserts the User, or updates the stored one with the same ID.
   * Uses `$set` rather than a replace, so `createdAt` is kept.
   *
   * @param user the User to store.
   * @returns `true` if the write was acknowledged.
   */
  async set(user: User): Promise<boolean> {
    const { googleId, ...fields } = toDoc(user);
    const res = await UserModel.updateOne({ googleId }, { $set: fields }, { upsert: true });
    return res.acknowledged;
  }
}

export type { Name, User };

export default UserService
