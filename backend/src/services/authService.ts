import { OAuth2Client } from "google-auth-library";
import type { NextFunction, Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env'
import { UserModel, type UserDoc, type UserInput } from "../models/userModel";
import { definedOnly } from "../utils/defined";
import { alphnumDashOnly } from "../utils/trust";

const BEARER_PREFIX: string = 'Bearer ';

/** How long a login token stays valid. jsonwebtoken reads strings like '7d'; a bare number would mean seconds. */
export const TOKEN_LIFETIME = '7d';

/** Longest display name accepted, in characters (after trimming). */
const DISPLAY_NAME_MAX_LENGTH = 50;

/** Used when a Google account has no name at all. */
const FALLBACK_FULL_NAME = 'Excavator user';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Do not assume one has so-called 'family' or 'given' name parts, or if they do, the preferred ordering.
 */
type Name = {
  readonly full: string;
  readonly family?: string | undefined;
  readonly given?: string | undefined;
}

/**
 * Our own in-memory user, not Google user or DB schema.
 */
class User {
  /** Google account ID (`sub`). Also what Gems store in `addedBy`. */
  readonly id: string;
  readonly name: Name;
  private displayName?: string | undefined;

  constructor(id: string, name: Name) {
    this.id = id;
    this.name = name;
  }

  /** @returns the name shown to other users: the one they chose, or their Google name. */
  getDisplayName(): string {
    return this.displayName ?? this.name.full;
  }

  /** @returns the display name the user chose, or `undefined` if they never set one. */
  getChosenDisplayName(): string | undefined {
    return this.displayName;
  }

  setDisplayName(displayName: string): void {
    this.displayName = displayName;
  }
}

/** Thrown when a Google ID token is invalid, expired, or carries no account ID. The client's fault (401). */
export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenError';
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

/** What jsonwebtoken accepts as a token lifetime. */
type TokenLifetime = NonNullable<SignOptions['expiresIn']>;

/**
 * Singleton service, holds its own cofigurations.
 * Logs users in with Google and issues JWTs; users are stored in the `users` collection.
 */
class AuthService {
  private tokenLifetime: TokenLifetime;
  private repo: UserRepo = new UserRepo();
  private ggClient = new OAuth2Client({
    clientId: env.google_client_id,
    clientSecret: env.google_client_secret,
  });

  /**
   * @param [tokenLifetime='7d'] how long a token stays valid, as jsonwebtoken reads it ('7d', '1h', or seconds).
   */
  constructor(tokenLifetime: TokenLifetime = TOKEN_LIFETIME) {
    this.tokenLifetime = tokenLifetime;
  }

  /**
   * @returns the JWT signing secret.
   * @throws if `JWT_SECRET` is not set, so a missing secret fails loudly instead of signing with nothing.
   */
  private secret(): string {
    if (!env.jwt_secret) {
      throw new Error('JWT_SECRET is not set.');
    }
    return env.jwt_secret;
  }

  /**
   * @param userId the user's Google account ID; stored as the token's subject (`sub`).
   * @returns a signed JWT that expires after the token lifetime.
   */
  private genJwt(userId: string): string {
    // The payload must be an object: jsonwebtoken refuses `expiresIn` with a string payload.
    return jwt.sign({}, this.secret(), {
      subject: userId,
      expiresIn: this.tokenLifetime,
    });
  }

  /**
   * Verifies a Google ID token and reads the account from it.
   *
   * @param idToken from Google Sign-In on the client.
   * @returns the account as a User (not stored).
   * @throws `InvalidTokenError` if Google rejects the token or it has no account ID.
   */
  private async getUserFromGoogle(idToken: string): Promise<User> {
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

    return new User(payload.sub, { full, family, given });
  }

  /**
   * Logs a user in with Google, storing them on their first login.
   *
   * @requires A valid Google OAuth session be initiated elsewhere.
   * @param idToken from Google.
   * @returns a JWT for the `Authorization: Bearer` header.
   * @throws `InvalidTokenError` if the Google token is bad; nothing is stored.
   * @throws the database error, or an error if `JWT_SECRET` is not set.
   */
  async login(idToken: string): Promise<string> {
    const ggUser = await this.getUserFromGoogle(idToken);
    const user = await this.repo.getOrCreate(ggUser.id, ggUser.name);

    return this.genJwt(user.id);
  }

  /**
   * Express middleware that requires a valid login token.
   * If the token is valid, populates `req.user` with the stored user.
   * An arrow function, so it keeps `this` when passed to a router as `authService.reqJwt`.
   *
   * @requires request header to include
   * ```http
   * Authorization: Bearer <token>
   * ```
   * Answers 401 `{ message }` if the header is missing, the token is invalid or expired, or the user
   * no longer exists, and 500 if the database fails.
   */
  reqJwt = (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;

    if (!auth?.startsWith(BEARER_PREFIX)) {
      res.status(401).json({ message: 'Unauthorized request.' });
      return;
    }

    const token = auth.slice(BEARER_PREFIX.length).trim();

    let userId: string | undefined;
    try {
      const payload = jwt.verify(token, this.secret());
      userId = typeof payload === 'object' ? payload.sub : undefined;
    } catch {
      res.status(401).json({ message: 'Invalid token.' });
      return;
    }

    if (!userId) {
      res.status(401).json({ message: 'Invalid user ID.' });
      return;
    }

    this.repo.get(userId)
      .then(user => {
        if (!user) {
          res.status(401).json({ message: 'Nonexistent user.' });
          return;
        }

        req.user = user;
        next();
      })
      .catch((err: unknown) => {
        console.log(`Login check failed: ${alphnumDashOnly(err)}`);
        res.status(500).json({ message: 'Login check failed.' });
      });
  }

  /**
   * @param userId Google account ID.
   * @returns the stored user, or `undefined` if there is none.
   */
  async getUser(userId: string): Promise<User | undefined> {
    return this.repo.get(userId);
  }

  /**
   * Sets and stores a user's display name.
   *
   * @param userId Google account ID.
   * @param displayName the new name; stored trimmed.
   * @returns `true` if stored, `false` if there is no such user.
   * @throws `InvalidDisplayNameError` if `displayName` fails `isValidDisplayName`; nothing is stored.
   * @throws the database error if the write fails.
   */
  async setDisplayName(userId: string, displayName: string): Promise<boolean> {
    if (!isValidDisplayName(displayName)) {
      throw new InvalidDisplayNameError('Invalid display name.');
    }

    const user = await this.repo.get(userId);
    if (!user) {
      return false;
    }

    user.setDisplayName(displayName.trim());
    return this.repo.set(user);
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
    ...definedOnly({ displayName: user.getChosenDisplayName() }),
  };
}

/**
 * Maps a stored Mongo document back to a User.
 *
 * @param doc the stored document.
 * @returns the User; `null` fields become `undefined`.
 */
function fromDoc(doc: UserDoc): User {
  const user = new User(doc.googleId, {
    full: doc.name.full,
    family: doc.name.family ?? undefined,
    given: doc.name.given ?? undefined,
  });
  if (doc.displayName) {
    user.setDisplayName(doc.displayName);
  }
  return user;
}

/**
 * Stores Users in the `users` collection. Does no validation; `AuthService` does that.
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
   * @returns the stored User.
   */
  async getOrCreate(id: string, name: Name): Promise<User> {
    const doc = await UserModel.findOneAndUpdate(
      { googleId: id },
      { $setOnInsert: toDoc(new User(id, name)) },
      { upsert: true, returnDocument: 'after' },
    ).lean<UserDoc>();

    if (!doc) {
      throw new Error('User not created.');
    }

    return fromDoc(doc);
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

export { User };
export type { Name };

export default AuthService
