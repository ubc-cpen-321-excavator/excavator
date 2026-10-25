import { OAuth2Client } from "google-auth-library";
import { env } from '../config/env'
import { alphnumDashOnly } from "../utils/trust";
import { TimedEntry } from '../utils/struct'
import type { Request, Response, NextFunction } from 'express';

const SESSION_TIMEOUT: number = 5 * 60 * 1000;
const BEARER_PREFIX: string = 'Bearer ';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

type Name = {
  readonly full: string;
  readonly family?: string | undefined;
  readonly given?: string | undefined;
}

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

class AuthService {
  private sessions: Map<string, TimedEntry<User>> = new Map<string, TimedEntry<User>>();
  private db: UserDB = new UserDB();
  private ggClient = new OAuth2Client({
    clientId: env.google_client_id,
    clientSecret: env.google_client_secret,
  });

  private genSessionId(_seed: number): string {
    return crypto.randomUUID();
  }

  private getUserBySessionId(sessionId: string): User {
    const user = this.sessions.get(sessionId)?.value
    if (!user) {
      throw new Error(`Invalid session: ${alphnumDashOnly(sessionId)}`);
    }

    return user;

  }

  private async getGoogleUser(idToken: string): Promise<User> {
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

  async login(idToken: string): Promise<string> {
    const ggUser = await this.getGoogleUser(idToken);
    const user = this.db.getOrCreate(ggUser.id, ggUser.name);

    const sessionId = this.genSessionId(0);
    this.sessions.set(sessionId, new TimedEntry(user));

    return sessionId;
  }

  logout(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  heartbeat(sessionId: string): void {
    this.sessions.get(sessionId)?.heartbeat();
  }

  sweep(olderThan: number = SESSION_TIMEOUT): void {
    const now = Date.now();
    const elders = [...this.sessions].filter(([_sid, en]) => (en.time + olderThan) < now).map(([sid, _en]) => sid)
    elders.forEach(sid => this.sessions.delete(sid))
  }

  getDisplayName(sessionId: string): string | undefined {
    return this.getUserBySessionId(sessionId).getDisplayName();
  }

  getOrCreateDisplayName(sessionId: string): string {
    const user = this.getUserBySessionId(sessionId);

    return user.getDisplayName();
  }

  setDisplayName(sessionId: string, displayName: string): void {
    const user = this.getUserBySessionId(sessionId);
    user.setDisplayName(displayName);

    this.db.set(user.id, user);
  }

  reqLogin(req: Request, res: Response, next: NextFunction): void {
    const auth = req.headers.authorization;

    if (!auth?.startsWith(BEARER_PREFIX)) {
      res.status(401).json({ message: 'Unauthorized request.' });
      return;
    }

    const sessionId = auth.slice(BEARER_PREFIX.length).trim();
    const session = this.sessions.get(sessionId);
    if (!session) {
      res.status(401).json({ message: 'Invalid session.' });
      return;
    }
    if ((session.time + SESSION_TIMEOUT) > Date.now()) {
      this.sessions.delete(sessionId);
      res.status(401).json({ message: 'Session timed out, please login again.' });
      return;
    }

    session.heartbeat();

    req.user = session.value;

    next();
  }
}

// HACK Stub for actual user repo.
class UserDB {

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

