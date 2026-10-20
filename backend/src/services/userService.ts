import { OAuth2Client } from "google-auth-library";
import { env } from '../config/env'

interface Name {
  readonly full: string;
  readonly family?: string | undefined;
  readonly given?: string | undefined;
}

interface User {
  readonly id: string;
  readonly name: Name;
  displayName?: string | undefined;
}

class TimedEntry<T> {
  value: T;
  time: number = Date.now();

  constructor(value: T) {
    this.value = value;
  }

  heartbeat(): void {
    this.time = Date.now();
  }
}

class UserService {
  private sessions: Map<string, TimedEntry<User>> = new Map<string, TimedEntry<User>>;
  private db: UserDB = new UserDB();
  private ggClient = new OAuth2Client({
    clientId: env.google_client_id,
    clientSecret: env.google_client_secret,
  });

  private genSessionId(_seed: number): string {
    // TODO UUID
    return "37";
  }

  private getUserBySessionId(sessionId: string): User {
    const user = this.sessions.get(sessionId)?.value
    if (!user) {
      throw `Invalid session: ${sessionId}`;
    }

    return user;

  }

  private async getGoogleUser(code: string): Promise<User> {
    const { tokens } = await this.ggClient.getToken(code);
    if (!tokens.id_token) {
      throw `Invalid Google OAuth ID token.`
    }

    const ticket = await this.ggClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: env.google_client_id
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw `Invalid Google Account info.`
    }

    return {
      id: payload.sub, // req. 'openid' in scope
      name: {
        full: payload.name as string, // req. 'profile' in scope
        family: payload.family_name,
        given: payload.given_name,
      }
    }
  }

  async login(code: string): Promise<string> {
    const ggUser = await this.getGoogleUser(code);
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

  sweep(olderThan: number): void {
    const now = Date.now();
    const elders = [...this.sessions].filter(([_sid, en]) => (en.time + olderThan) < now).map(([sid, _en]) => sid)
    elders.forEach(sid => this.sessions.delete(sid))
  }

  getDisplayName(sessionId: string): string | undefined {
    return this.getUserBySessionId(sessionId).displayName;
  }

  getOrCreateDisplayName(sessionId: string): string {
    const user = this.getUserBySessionId(sessionId);

    if (!user.displayName) {
      const displayName = `${user.name.given} ${user.name.family}`;
      this.db.set(user.id, { ...user, displayName: displayName });
      return displayName;
    }

    return user.displayName;
  }

  setDisplayName(sessionId: string, displayName: string): void {
    const user = this.getUserBySessionId(sessionId);

    this.db.set(user.id, { ...user, displayName: displayName });
  }
}

// HACK Move to user repo.
class UserDB {
  // TODO

  create(id: string, name: Name, displayName?: string): User {
    return {
      id: id,
      name: name,
      displayName: displayName
    };
  }

  get(id: string): User | undefined {
    return this.create(id, { full: 'nadeok sengoku' });
  }

  getOrCreate(id: string, name: Name, displayName?: string): User {
    return this.get(id) ?? this.create(id, name, displayName);
  }

  set(_id: string, _user: User): boolean {
    return true;
  }
}

export default UserService

