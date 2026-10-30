import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { env } from '../../src/config/env';
import { UserModel } from '../../src/models/userModel';
import AuthService, {
  InvalidDisplayNameError,
  InvalidTokenError,
  TOKEN_LIFETIME,
  isValidDisplayName,
} from '../../src/services/authService';

jest.mock('../../src/models/userModel', () => ({
  UserModel: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));

// Called lazily, so it is initialized by the time AuthService builds its OAuth2Client.
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  // Keep the rest of the library: the Places client needs it.
  ...jest.requireActual('google-auth-library'),
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  })),
}));

const mockedUserModel = UserModel as unknown as {
  findOne: jest.Mock;
  findOneAndUpdate: jest.Mock;
  updateOne: jest.Mock;
};

const SECRET = process.env.JWT_SECRET ?? '';
const SAYAKA = { sub: 'google-sub-123', name: 'Sayaka Miki', given_name: 'Sayaka', family_name: 'Miki' };
const SAYAKA_DOC = { googleId: 'google-sub-123', name: { full: 'Sayaka Miki', given: 'Sayaka', family: 'Miki' } };

/** Makes Google accept the token with this payload. */
function mockGooglePayload(payload: Record<string, unknown> | undefined): void {
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
}

/** Makes `findOneAndUpdate(...).lean()` resolve to `doc`, like Mongo after an upsert. */
function mockUpsert(doc: unknown): void {
  mockedUserModel.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(doc) });
}

/** Makes `findOne(...).lean()` resolve or reject with `doc`. */
function mockFindOne(doc: Promise<unknown>): void {
  mockedUserModel.findOne.mockReturnValue({ lean: () => doc });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  mockedUserModel.updateOne.mockResolvedValue({ acknowledged: true });
});

// Interface isValidDisplayName
describe('isValidDisplayName', () => {
  // Input: names of 1–50 characters after trimming, incl. non-ASCII and emoji
  // Expected output: true
  test.each(['Sayaka', '  Sayaka Miki  ', 'S', 'a'.repeat(50), 'Kyōko', '佐倉杏子', 'gem hunter 💎'])('Valid: %p', (name) => {
    expect(isValidDisplayName(name)).toBe(true);
  });

  // Input: non-strings, empty or whitespace-only, too long, or with control characters
  // Expected output: false
  test.each([undefined, null, 37, {}, ['Sayaka'], '', '   ', 'a'.repeat(51), 'Saya\nka', 'Saya\u0000ka'])('Invalid: %p', (name) => {
    expect(isValidDisplayName(name)).toBe(false);
  });
});

// Interface AuthService.login
describe('Mocked: AuthService.login', () => {
  // Mocked behavior: Google accepts the token; UserModel.findOneAndUpdate upserts and returns the user
  // Input: a valid ID token for a first-time user
  // Expected behavior: the user is upserted atomically by googleId with their Google name ($setOnInsert keeps an existing user's data)
  // Expected output: a JWT with the user's Google ID as subject, valid for TOKEN_LIFETIME (7 days)
  test('New user', async () => {
    mockGooglePayload(SAYAKA);
    mockUpsert(SAYAKA_DOC);

    const token = await new AuthService().login('good-token');

    expect(mockedUserModel.findOneAndUpdate).toHaveBeenCalledWith(
      { googleId: 'google-sub-123' },
      { $setOnInsert: SAYAKA_DOC },
      { upsert: true, returnDocument: 'after' },
    );
    const payload = jwt.verify(token, SECRET) as jwt.JwtPayload;
    expect(payload.sub).toBe('google-sub-123');
    expect(TOKEN_LIFETIME).toBe('7d');
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(7 * 24 * 60 * 60);
  });

  // Mocked behavior: Google accepts the token, whose payload has only `sub` (no 'profile' scope)
  // Input: a valid ID token without names
  // Expected behavior: the user is stored with the fallback full name and no given / family name
  // Expected output: a JWT
  test('Token without names', async () => {
    mockGooglePayload({ sub: 'google-sub-456' });
    mockUpsert({ googleId: 'google-sub-456', name: { full: 'Excavator user' } });

    await new AuthService().login('good-token');

    expect(mockedUserModel.findOneAndUpdate.mock.calls[0][1].$setOnInsert.name).toEqual({ full: 'Excavator user' });
  });

  // Mocked behavior: Google rejects the token
  // Input: an invalid or expired ID token
  // Expected behavior: the DB is not touched
  // Expected output: rejects with InvalidTokenError
  test('Rejected token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token used too late'));

    await expect(new AuthService().login('bad-token')).rejects.toBeInstanceOf(InvalidTokenError);

    expect(mockedUserModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // Mocked behavior: Google accepts the token, but its payload is missing or has no `sub`
  // Input: an ID token without an account ID
  // Expected behavior: the DB is not touched
  // Expected output: rejects with InvalidTokenError
  test.each([undefined, { name: 'No Sub' }])('Token without account ID: %p', async (payload) => {
    mockGooglePayload(payload);

    await expect(new AuthService().login('good-token')).rejects.toBeInstanceOf(InvalidTokenError);

    expect(mockedUserModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // Mocked behavior: Google accepts the token; UserModel.findOneAndUpdate rejects (e.g. DB unreachable)
  // Input: a valid ID token
  // Expected output: rejects with the DB error, not InvalidTokenError
  test('Database error', async () => {
    mockGooglePayload(SAYAKA);
    const err = new Error('connection refused');
    mockedUserModel.findOneAndUpdate.mockReturnValue({ lean: () => Promise.reject(err) });

    await expect(new AuthService().login('good-token')).rejects.toBe(err);
  });

  // Mocked behavior: Google accepts the token; the user is stored; JWT_SECRET is not set
  // Input: a valid ID token
  // Expected behavior: no token is signed with an empty secret
  // Expected output: rejects with "JWT_SECRET is not set.", not InvalidTokenError
  test('Missing JWT secret', async () => {
    mockGooglePayload(SAYAKA);
    mockUpsert(SAYAKA_DOC);
    const mutableEnv = env as { jwt_secret?: string | undefined };
    const saved = mutableEnv.jwt_secret;
    mutableEnv.jwt_secret = undefined;

    try {
      await expect(new AuthService().login('good-token')).rejects.toThrow('JWT_SECRET is not set.');
    } finally {
      mutableEnv.jwt_secret = saved;
    }
  });
});

// Interface AuthService.reqJwt
describe('Mocked: AuthService.reqJwt', () => {
  /** An app with one protected route that echoes `req.user`, using the middleware unbound, as routers do. */
  function protectedApp(service: AuthService): express.Express {
    const app = express();
    app.get('/me', service.reqJwt, (req, res) => {
      res.json({ id: req.user?.id, displayName: req.user?.getDisplayName() });
    });
    return app;
  }

  /** A token for `sub`, signed with `secret`, optionally already expired. */
  function token(sub: string | undefined, secret = SECRET, expired = false): string {
    const claims = expired ? { exp: Math.floor(Date.now() / 1000) - 60 } : {};
    return jwt.sign(claims, secret, sub === undefined ? {} : { subject: sub });
  }

  // Mocked behavior: UserModel.findOne returns the user with a chosen display name
  // Input: GET /me with a valid Bearer token
  // Expected status code: 200
  // Expected behavior: the user is looked up by the token's subject and put on req.user; the next handler runs
  // Expected output: the user's ID and display name
  test('Valid token', async () => {
    mockFindOne(Promise.resolve({ ...SAYAKA_DOC, displayName: 'mermaid' }));

    const response = await request(protectedApp(new AuthService())).get('/me')
      .set('Authorization', `Bearer ${token('google-sub-123')}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'google-sub-123', displayName: 'mermaid' });
    expect(mockedUserModel.findOne).toHaveBeenCalledWith({ googleId: 'google-sub-123' });
  });

  // Mocked behavior: none
  // Input: GET /me without a Bearer token, or with a bad, wrongly signed, expired or subject-less one
  // Expected status code: 401
  // Expected behavior: the next handler does not run; the DB is not queried
  // Expected output: the matching message
  test.each([
    ['no header', undefined, 'Unauthorized request.'],
    ['not Bearer', 'Basic abc', 'Unauthorized request.'],
    ['garbage', 'Bearer not-a-jwt', 'Invalid token.'],
    ['wrong secret', `Bearer ${token('google-sub-123', 'other-secret')}`, 'Invalid token.'],
    ['expired', `Bearer ${token('google-sub-123', SECRET, true)}`, 'Invalid token.'],
    ['no subject', `Bearer ${token(undefined)}`, 'Invalid user ID.'],
  ])('Rejected: %s', async (_label, header, message) => {
    const req = request(protectedApp(new AuthService())).get('/me');
    const response = header === undefined ? await req : await req.set('Authorization', header);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message });
    expect(mockedUserModel.findOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: UserModel.findOne finds no user
  // Input: GET /me with a valid token for a user that no longer exists
  // Expected status code: 401
  // Expected output: { message: "Nonexistent user." }
  test('Nonexistent user', async () => {
    mockFindOne(Promise.resolve(null));

    const response = await request(protectedApp(new AuthService())).get('/me')
      .set('Authorization', `Bearer ${token('google-sub-gone')}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Nonexistent user.' });
  });

  // Mocked behavior: UserModel.findOne rejects (e.g. DB unreachable)
  // Input: GET /me with a valid token
  // Expected status code: 500
  // Expected behavior: error is logged; the next handler does not run
  // Expected output: { message: "Login check failed." }
  test('Database error', async () => {
    mockFindOne(Promise.reject(new Error('connection refused')));

    const response = await request(protectedApp(new AuthService())).get('/me')
      .set('Authorization', `Bearer ${token('google-sub-123')}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Login check failed.' });
  });
});

// Interface AuthService.setDisplayName
describe('Mocked: AuthService.setDisplayName', () => {
  // Mocked behavior: UserModel.findOne returns the user; UserModel.updateOne succeeds
  // Input: a stored user's ID and "  mermaid  "
  // Expected behavior: the trimmed name is stored via $set (keeping createdAt)
  // Expected output: true
  test('Valid name', async () => {
    mockFindOne(Promise.resolve(SAYAKA_DOC));

    await expect(new AuthService().setDisplayName('google-sub-123', '  mermaid  ')).resolves.toBe(true);

    expect(mockedUserModel.updateOne).toHaveBeenCalledWith(
      { googleId: 'google-sub-123' },
      { $set: { name: SAYAKA_DOC.name, displayName: 'mermaid' } },
      { upsert: true },
    );
  });

  // Mocked behavior: none
  // Input: a blank name
  // Expected behavior: the DB is not touched
  // Expected output: rejects with InvalidDisplayNameError
  test('Invalid name', async () => {
    await expect(new AuthService().setDisplayName('google-sub-123', '   ')).rejects.toBeInstanceOf(InvalidDisplayNameError);

    expect(mockedUserModel.findOne).not.toHaveBeenCalled();
    expect(mockedUserModel.updateOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: UserModel.findOne finds no user
  // Input: an unknown user's ID and a valid name
  // Expected behavior: nothing is stored
  // Expected output: false
  test('No such user', async () => {
    mockFindOne(Promise.resolve(null));

    await expect(new AuthService().setDisplayName('google-sub-gone', 'mermaid')).resolves.toBe(false);

    expect(mockedUserModel.updateOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: UserModel.findOne returns the user without a chosen name
  // Input: AuthService.getUser
  // Expected output: the user, whose display name falls back to the Google name
  test('Display name defaults to the Google name', async () => {
    mockFindOne(Promise.resolve(SAYAKA_DOC));

    const user = await new AuthService().getUser('google-sub-123');

    expect(user?.getDisplayName()).toBe('Sayaka Miki');
    expect(user?.getChosenDisplayName()).toBeUndefined();
  });
});
