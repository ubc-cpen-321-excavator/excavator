import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createApp } from '../../src/app';
import { UserModel } from '../../src/models/userModel';
import { TEST_USER_DOC, TEST_USER_ID, bearer } from '../helpers/auth';

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

const mockedUserModel = UserModel as unknown as { findOneAndUpdate: jest.Mock; findOne: jest.Mock; updateOne: jest.Mock };

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
  // Expected output: { sessionId } holding a JWT whose subject is the user's Google ID
  test('Valid token', async () => {
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'google-sub-123', name: 'Sayaka Miki' }) });
    mockedUserModel.findOneAndUpdate.mockReturnValue({
      lean: () => Promise.resolve({ googleId: 'google-sub-123', name: { full: 'Sayaka Miki' } }),
    });

    const response = await request(createApp()).post('/user/auth/google').send({ idToken: 'good-token' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ sessionId: expect.any(String) });
    expect(jwt.verify(response.body.sessionId, process.env.JWT_SECRET ?? '')).toMatchObject({ sub: 'google-sub-123' });
    expect(mockedUserModel.findOneAndUpdate.mock.calls[0][0]).toEqual({ googleId: 'google-sub-123' });
  });

  // Mocked behavior: Google rejects the token
  // Input: POST request with an invalid idToken
  // Expected status code: 401
  // Expected behavior: the DB is not called
  // Expected output: { message: "Login failed." }
  test('Rejected token', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Wrong number of segments'));

    const response = await request(createApp()).post('/user/auth/google').send({ idToken: 'bad-token' });

    expect(response.status).toBe(401);
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

  // Mocked behavior: none
  // Input: GET request to /user/auth/google
  // Expected status code: 405
  // Expected behavior: Google is not called; Allow is POST
  // Expected output: { message: "Method not allowed." }
  test('Unsupported method', async () => {
    const response = await request(createApp()).get('/user/auth/google');

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('POST');
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });
});

// Interface GET /user/me
describe('Mocked: GET /user/me', () => {
  // Mocked behavior: UserModel.findOne returns the signed-in user, who chose a display name
  // Input: GET /user/me signed in
  // Expected status code: 200
  // Expected output: { id, name, displayName }
  test('Signed in', async () => {
    mockedUserModel.findOne.mockReturnValue({ lean: () => Promise.resolve(TEST_USER_DOC) });

    const response = await request(createApp()).get('/user/me').set('Authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: TEST_USER_ID, name: TEST_USER_DOC.name, displayName: 'mermaid' });
  });

  // Mocked behavior: none
  // Input: GET /user/me without a token
  // Expected status code: 401
  // Expected output: { message: "Unauthorized request." }
  test('Not signed in', async () => {
    const response = await request(createApp()).get('/user/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized request.' });
  });
});

// Interface PATCH /user/me
describe('Mocked: PATCH /user/me', () => {
  // Mocked behavior: UserModel.findOne returns the signed-in user; UserModel.updateOne succeeds
  // Input: PATCH /user/me { displayName: "  kyoko  " } signed in
  // Expected status code: 200
  // Expected behavior: the trimmed name is stored for the signed-in user
  // Expected output: the profile with displayName "kyoko"
  test('Set display name', async () => {
    mockedUserModel.findOne.mockReturnValue({ lean: () => Promise.resolve(TEST_USER_DOC) });
    mockedUserModel.updateOne.mockResolvedValue({ acknowledged: true });

    const response = await request(createApp()).patch('/user/me').set('Authorization', bearer()).send({ displayName: '  kyoko  ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: TEST_USER_ID, name: TEST_USER_DOC.name, displayName: 'kyoko' });
    expect(mockedUserModel.updateOne.mock.calls[0][1].$set.displayName).toBe('kyoko');
  });

  // Mocked behavior: UserModel.findOne returns the signed-in user
  // Input: PATCH /user/me with a missing, blank or too long display name, signed in
  // Expected status code: 400
  // Expected behavior: nothing is stored
  // Expected output: { message: "Invalid display name." }
  test.each([[{}], [{ displayName: '   ' }], [{ displayName: 'a'.repeat(51) }]])('Invalid name %p', async (body) => {
    mockedUserModel.findOne.mockReturnValue({ lean: () => Promise.resolve(TEST_USER_DOC) });

    const response = await request(createApp()).patch('/user/me').set('Authorization', bearer()).send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid display name.' });
    expect(mockedUserModel.updateOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: UserModel.findOne returns the signed-in user; UserModel.updateOne rejects (e.g. DB unreachable)
  // Input: PATCH /user/me { displayName: "kyoko" } signed in
  // Expected status code: 500
  // Expected output: { message: "Update profile failed." }
  test('Database error', async () => {
    mockedUserModel.findOne.mockReturnValue({ lean: () => Promise.resolve(TEST_USER_DOC) });
    mockedUserModel.updateOne.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).patch('/user/me').set('Authorization', bearer()).send({ displayName: 'kyoko' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Update profile failed.' });
  });

  // Mocked behavior: none
  // Input: DELETE /user/me
  // Expected status code: 405
  // Expected output: Allow is "GET, PATCH"
  test('Unsupported method', async () => {
    const response = await request(createApp()).delete('/user/me');

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('GET, PATCH');
  });
});

