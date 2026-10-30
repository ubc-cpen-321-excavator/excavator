import { OAuth2Client } from "google-auth-library";
import { env } from '../config/env'
import { alphnumDashOnly } from "../utils/trust";
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const BEARER_PREFIX: string = 'Bearer ';

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
  readonly id: string;
  readonly name: Name;
  private displayName?: string | undefined;

  constructor(id: string, name: Name) {
    this.id = id;
    this.name = name;
  }

  getDisplayName(): string {
    return this.displayName ?? this.name.full;
  }

  setDisplayName(displayName: string): void {
    this.displayName = displayName;
  }
}

/**
 * Singleton service, holds its own cofigurations.
 */
class AuthService {
  private tokenTimeout: number;
  private repo: UserRepo = new UserRepo();
  private ggClient = new OAuth2Client({
    clientId: env.google_client_id,
    clientSecret: env.google_client_secret,
  });

  /**
   * @param [tokenTimeout=7 * 24 * 60 * 60 * 1000] in miliseconds.
   */
  constructor(tokenTimeout: number = 7 * 24 * 60 * 60 * 1000) {
    this.tokenTimeout = tokenTimeout;
  }

  private genJwt(userId: string): string {
    return jwt.sign(userId, env.jwt_secret, {
      expiresIn: this.tokenTimeout
    });
  }

  private async getUserFromGoogle(idToken: string): Promise<User> {
    const ticket = await this.ggClient.verifyIdToken({
      idToken,
      audience: env.google_client_id
    }).catch(err => {
      console.log(`idToken rejected: ${alphnumDashOnly(err)}`);
    });

    const payload = ticket?.getPayload();
    if (!payload) {
      throw new Error(`Invalid Google Account info.`);
    }

    return new User(
      payload.sub, // requires 'openid' in client req. scope
      {
        full: payload.name as string, // requires 'profile' in client req. scope
        family: payload.family_name,
        given: payload.given_name,
      }
    )
  }

  /**
   * Logs a user in with Google.
   *
   * @requires A valid Google OAuth session be initiated elsewhere.
   * @param idToken from Google.
   * @returns session ID.
   */
  async login(idToken: string): Promise<string> {
    const ggUser = await this.getUserFromGoogle(idToken);
    const user = this.repo.getOrCreate(ggUser.id, ggUser.name);

    return this.genJwt(user.id);
  }

  /**
   * Express middleware that requires an existing session.
   * If a session does exist, populate `req.user`
   *
   * @requires request header to include
   * ```http
   * Authorization: Bearer <sessionId>
   * ```
   */
  reqJwt(req: Request, res: Response, next: NextFunction): void {
    const auth = req.headers.authorization;

    if (!auth?.startsWith(BEARER_PREFIX)) {
      res.status(401).json({ message: 'Unauthorized request.' });
      return;
    }

    const token = auth.slice(BEARER_PREFIX.length).trim();

    jwt.verify(token, env.jwt_secret, (err, userId) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid token.' })
      }
      if (!userId || typeof (userId) !== 'string') {
        return res.status(403).json({ message: 'Invalid user ID.' })
      }

      const user = this.repo.get(userId);
      if (!user) {
        return res.status(403).json({ message: 'Nonexistent user.' })
      }

      req.user = user;
      next();
    })
  }
}

// HACK Stub for actual user repo.
class UserRepo {

  // HACK Stub.
  create(id: string, name: Name, displayName?: string): User {
    const user = new User(id, name);
    if (displayName !== undefined) {
      user.setDisplayName(displayName);
    }

    return user;
  }

  // HACK Stub.
  get(id: string): User | undefined {
    return this.create(id, { full: 'nadeko sengoku' });
  }

  // HACK Stub.
  getOrCreate(id: string, name: Name, displayName?: string): User {
    return this.get(id) ?? this.create(id, name, displayName);
  }

  // HACK Stub.
  set(_id: string, _user: User): boolean {
    return true;
  }
}

export default AuthService

