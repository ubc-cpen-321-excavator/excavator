import UserService, {
  InvalidDisplayNameError,
  InvalidSessionError,
  InvalidTokenError,
  isValidDisplayName,
} from '../../src/services/userService';
import { UserModel } from '../../src/models/userModel';

jest.mock('../../src/models/userModel', () => ({
  UserModel: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
    updateOne: jest.fn(),
  },
}));

// Called lazily, so it is initialized by the time UserService builds its OAuth2Client.
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  // Keep the rest of the library: the Places client (loaded by the app) needs it.
  ...jest.requireActual('google-auth-library'),
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  })),
}));

const mockedUserModel = UserModel as unknown as {
  findOneAndUpdate: jest.Mock;
  updateOne: jest.Mock;
};

/** Makes Google accept the token with this payload. */
function mockGooglePayload(payload: Record<string, unknown> | undefined): void {
  mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });
}

/** Makes `findOneAndUpdate` return `doc`, like Mongo after an upsert. */
function mockStoredUser(doc: unknown): void {
  mockedUserModel.findOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(doc) });
}

const SAYAKA = { sub: 'google-sub-123', name: 'Sayaka Miki', given_name: 'Sayaka', family_name: 'Miki' };

/** Logs in a user with no display name yet and returns the session ID. */
async function loginSayaka(service: UserService): Promise<string> {
  mockGooglePayload(SAYAKA);
  mockStoredUser({ googleId: 'google-sub-123', name: { full: 'Sayaka Miki', given: 'Sayaka', family: 'Miki' } });
  return service.login('good-token');
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

// Interface UserService.login
describe('Mocked: UserService.login', () => {
  // Mocked behavior: Google accepts the token; UserModel.findOneAndUpdate upserts and returns the user
  // Input: a valid ID token for a user logging in for the first time
  // Expected behavior: the user is upserted atomically by googleId with their Google name ($setOnInsert, so an existing user's data is kept)
  // Expected output: a session ID
  test('New user', async () => {
    const service = new UserService();

    const sessionId = await loginSayaka(service);

    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);
    expect(mockVerifyIdToken).toHaveBeenCalledWith(expect.objectContaining({ idToken: 'good-token' }));
    expect(mockedUserModel.findOneAndUpdate).toHaveBeenCalledWith(
      { googleId: 'google-sub-123' },
      { $setOnInsert: { googleId: 'google-sub-123', name: { full: 'Sayaka Miki', given: 'Sayaka', family: 'Miki' } } },
      { upsert: true, returnDocument: 'after' },
    );
    expect(service.getUserId(sessionId)).toBe('google-sub-123');
  });

  // Mocked behavior: Google accepts the token; UserModel.findOneAndUpdate returns a stored user with a display name
  // Input: a valid ID token for a returning user
  // Expected behavior: the stored display name is used
  // Expected output: a session ID whose display name is the stored one
  test('Returning user', async () => {
    const service = new UserService();
    mockGooglePayload(SAYAKA);
    mockStoredUser({ googleId: 'google-sub-123', name: { full: 'Sayaka Miki' }, displayName: 'mermaid' });

    const sessionId = await service.login('good-token');

    expect(service.getDisplayName(sessionId)).toBe('mermaid');
  });

  // Mocked behavior: Google accepts the token, whose payload has only `sub` (no 'profile' scope)
  // Input: a valid ID token without names
  // Expected behavior: the user is stored with the fallback full name and no given / family name
  // Expected output: a session ID
  test('Token without names', async () => {
    const service = new UserService();
    mockGooglePayload({ sub: 'google-sub-456' });
    mockStoredUser({ googleId: 'google-sub-456', name: { full: 'Excavator user' } });

    await service.login('good-token');

    const update = mockedUserModel.findOneAndUpdate.mock.calls[0][1];
    expect(update.$setOnInsert.name).toEqual({ full: 'Excavator user' });
  });

  // Mocked behavior: Google rejects the token
  // Input: an invalid or expired ID token
  // Expected behavior: the DB is not touched
  // Expected output: rejects with InvalidTokenError
  test('Rejected token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token used too late'));

    await expect(new UserService().login('bad-token')).rejects.toBeInstanceOf(InvalidTokenError);

    expect(mockedUserModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // Mocked behavior: Google accepts the token, but its payload is missing or has no `sub`
  // Input: an ID token without an account ID
  // Expected behavior: the DB is not touched
  // Expected output: rejects with InvalidTokenError
  test.each([undefined, { name: 'No Sub' }])('Token without account ID: %p', async (payload) => {
    mockGooglePayload(payload);

    await expect(new UserService().login('good-token')).rejects.toBeInstanceOf(InvalidTokenError);

    expect(mockedUserModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // Mocked behavior: Google accepts the token; UserModel.findOneAndUpdate rejects (e.g. DB unreachable)
  // Input: a valid ID token
  // Expected behavior: no session is created
  // Expected output: rejects with the DB error, not InvalidTokenError
  test('Database error', async () => {
    mockGooglePayload(SAYAKA);
    const err = new Error('connection refused');
    mockedUserModel.findOneAndUpdate.mockReturnValue({ lean: () => Promise.reject(err) });

    const result = new UserService().login('good-token');

    await expect(result).rejects.toBe(err);
    await expect(result).rejects.not.toBeInstanceOf(InvalidTokenError);
  });
});

// Interface UserService display names
describe('Mocked: UserService display names', () => {
  // Mocked behavior: UserModel.updateOne succeeds
  // Input: a session whose user has no display name
  // Expected behavior: "Given Family" is stored once via $set (keeping createdAt); later calls use the session copy
  // Expected output: "Sayaka Miki"
  test('Default display name', async () => {
    const service = new UserService();
    const sessionId = await loginSayaka(service);

    expect(service.getDisplayName(sessionId)).toBeUndefined();
    await expect(service.getOrCreateDisplayName(sessionId)).resolves.toBe('Sayaka Miki');
    await expect(service.getOrCreateDisplayName(sessionId)).resolves.toBe('Sayaka Miki');

    expect(mockedUserModel.updateOne).toHaveBeenCalledTimes(1);
    expect(mockedUserModel.updateOne).toHaveBeenCalledWith(
      { googleId: 'google-sub-123' },
      { $set: { name: { full: 'Sayaka Miki', given: 'Sayaka', family: 'Miki' }, displayName: 'Sayaka Miki' } },
      { upsert: true },
    );
  });

  // Mocked behavior: UserModel.updateOne succeeds
  // Input: two sessions of the same user; setDisplayName with surrounding spaces on one of them
  // Expected behavior: the trimmed name is stored and both sessions see it
  // Expected output: "mermaid" from both sessions
  test('Set display name', async () => {
    const service = new UserService();
    const phone = await loginSayaka(service);
    const tablet = await loginSayaka(service);

    await service.setDisplayName(phone, '  mermaid  ');

    expect(mockedUserModel.updateOne.mock.calls[0][1].$set.displayName).toBe('mermaid');
    expect(service.getDisplayName(phone)).toBe('mermaid');
    expect(service.getDisplayName(tablet)).toBe('mermaid');
  });

  // Mocked behavior: none
  // Input: setDisplayName with an empty name
  // Expected behavior: nothing is stored; the display name is unchanged
  // Expected output: rejects with InvalidDisplayNameError
  test('Invalid display name', async () => {
    const service = new UserService();
    const sessionId = await loginSayaka(service);

    await expect(service.setDisplayName(sessionId, '   ')).rejects.toBeInstanceOf(InvalidDisplayNameError);

    expect(mockedUserModel.updateOne).not.toHaveBeenCalled();
    expect(service.getDisplayName(sessionId)).toBeUndefined();
  });

  // Mocked behavior: UserModel.updateOne rejects (e.g. DB unreachable)
  // Input: setDisplayName with a valid name
  // Expected behavior: the session keeps the old display name
  // Expected output: rejects with the DB error
  test('Database error', async () => {
    const service = new UserService();
    const sessionId = await loginSayaka(service);
    mockedUserModel.updateOne.mockRejectedValue(new Error('connection refused'));

    await expect(service.setDisplayName(sessionId, 'mermaid')).rejects.toThrow('connection refused');

    expect(service.getDisplayName(sessionId)).toBeUndefined();
  });
});

// Interface UserService sessions
describe('Mocked: UserService sessions', () => {
  // Mocked behavior: none
  // Input: a session ID that was never issued
  // Expected behavior: nothing is stored
  // Expected output: InvalidSessionError from every session method
  test('Unknown session', async () => {
    const service = new UserService();

    expect(() => service.getUserId('nope')).toThrow(InvalidSessionError);
    expect(() => service.getDisplayName('nope')).toThrow(InvalidSessionError);
    await expect(service.getOrCreateDisplayName('nope')).rejects.toBeInstanceOf(InvalidSessionError);
    await expect(service.setDisplayName('nope', 'mermaid')).rejects.toBeInstanceOf(InvalidSessionError);
    expect(mockedUserModel.updateOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: none
  // Input: logout of a live session, then of the same session again
  // Expected behavior: the session is ended
  // Expected output: true, then false; the session is invalid afterwards
  test('Logout', async () => {
    const service = new UserService();
    const sessionId = await loginSayaka(service);

    expect(service.logout(sessionId)).toBe(true);
    expect(service.logout(sessionId)).toBe(false);
    expect(() => service.getUserId(sessionId)).toThrow(InvalidSessionError);
  });

  // Mocked behavior: Date.now is advanced by hand
  // Input: two sessions, one kept alive with heartbeat; sweep of sessions idle > 1 min
  // Expected behavior: only the idle session is ended
  // Expected output: the heartbeat session is still valid, the idle one is not
  test('Sweep idle sessions', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const service = new UserService();
    const idle = await loginSayaka(service);
    const active = await loginSayaka(service);

    now.mockReturnValue(1_000_000 + 90_000);
    service.heartbeat(active);
    service.sweep(60_000);

    expect(() => service.getUserId(idle)).toThrow(InvalidSessionError);
    expect(service.getUserId(active)).toBe('google-sub-123');
    now.mockRestore();
  });
});
