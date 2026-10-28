import request from 'supertest';

import { createApp } from '../../src/app';
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

const mockedUserModel = UserModel as unknown as { findOneAndUpdate: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

// Interface POST /user/auth/google
describe('Mocked: POST /user/auth/google', () => {
  // Mocked behavior: none
  // Input: POST request with no body, or with an idToken that is missing or not a string
  // Expected status code: 400
  // Expected behavior: Google and the DB are not called
  // Expected output: an error message
  test.each([
    ['no body', undefined, 'Invalid request.'],
    ['empty body', {}, 'Wrong OAuth idToken.'],
    ['non-string idToken', { idToken: 37 }, 'Wrong OAuth idToken.'],
  ])('Invalid request: %s', async (_label, body, message) => {
    const req = request(createApp()).post('/user/auth/google');
    const response = body === undefined ? await req : await req.send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
    expect(mockedUserModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // Mocked behavior: Google accepts the token; UserModel.findOneAndUpdate upserts and returns the user
  // Input: POST request with a valid idToken
  // Expected status code: 200
  // Expected behavior: the user is upserted by googleId
  // Expected output: { sessionId }
  test('Valid token', async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'google-sub-123', name: 'Sayaka Miki' }) });
    mockedUserModel.findOneAndUpdate.mockReturnValue({
      lean: () => Promise.resolve({ googleId: 'google-sub-123', name: { full: 'Sayaka Miki' } }),
    });

    const response = await request(createApp()).post('/user/auth/google').send({ idToken: 'good-token' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sessionId: expect.any(String) });
    expect(mockedUserModel.findOneAndUpdate.mock.calls[0][0]).toEqual({ googleId: 'google-sub-123' });
  });

  // Mocked behavior: Google rejects the token
  // Input: POST request with an invalid idToken
  // Expected status code: 400
  // Expected behavior: the DB is not called
  // Expected output: { message: "Login failed." }
  test('Rejected token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Wrong number of segments'));

    const response = await request(createApp()).post('/user/auth/google').send({ idToken: 'bad-token' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Login failed.' });
    expect(mockedUserModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  // Mocked behavior: Google accepts the token; UserModel.findOneAndUpdate rejects (e.g. DB unreachable)
  // Input: POST request with a valid idToken
  // Expected status code: 500
  // Expected behavior: error is logged; no session is created
  // Expected output: { message: "Login failed." }
  test('Database error', async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'google-sub-123', name: 'Sayaka Miki' }) });
    mockedUserModel.findOneAndUpdate.mockReturnValue({ lean: () => Promise.reject(new Error('connection refused')) });

    const response = await request(createApp()).post('/user/auth/google').send({ idToken: 'good-token' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Login failed.' });
  });
});
