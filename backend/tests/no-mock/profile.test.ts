import request from 'supertest';

import { createApp } from '../../src/app';
import { UserModel } from '../../src/models/userModel';
import { TEST_USER_DOC, TEST_USER_ID, bearer } from '../helpers/auth';
import { DB_START_TIMEOUT_MS, clearDb, seedUser, startDb, stopDb } from '../helpers/db';

beforeAll(startDb, DB_START_TIMEOUT_MS);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  await seedUser();
});

// Interface GET /user/me
describe('Unmocked: GET /user/me', () => {
  // Input: GET /user/me signed in as the stored user
  // Expected status code: 200
  // Expected output: { id, name, displayName } from the database
  test('Signed in', async () => {
    const response = await request(createApp()).get('/user/me').set('Authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: TEST_USER_ID, name: TEST_USER_DOC.name, displayName: 'mermaid' });
  });

  // Input: GET /user/me with a valid token for a user that isn't stored
  // Expected status code: 401
  // Expected output: { message: "Nonexistent user." }
  test('Unknown user', async () => {
    const response = await request(createApp()).get('/user/me').set('Authorization', bearer('google-sub-gone'));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Nonexistent user.' });
  });
});

// Interface PATCH /user/me
describe('Unmocked: PATCH /user/me', () => {
  // Input: PATCH { displayName: "  kyoko  " } signed in
  // Expected status code: 200
  // Expected behavior: the trimmed name is stored; the user's other fields and createdAt are kept
  // Expected output: the profile with displayName "kyoko"
  test('Set display name', async () => {
    const before = await UserModel.findOne({ googleId: TEST_USER_ID }).lean();

    const response = await request(createApp()).patch('/user/me').set('Authorization', bearer()).send({ displayName: '  kyoko  ' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: TEST_USER_ID, displayName: 'kyoko' });
    const after = await UserModel.findOne({ googleId: TEST_USER_ID }).lean();
    expect(after).toMatchObject({ displayName: 'kyoko', name: TEST_USER_DOC.name });
    expect(after?.createdAt).toEqual(before?.createdAt);
  });

  // Input: PATCH { displayName: "" } signed in
  // Expected status code: 400
  // Expected behavior: the stored name is unchanged
  // Expected output: { message: "Invalid display name." }
  test('Invalid name', async () => {
    const response = await request(createApp()).patch('/user/me').set('Authorization', bearer()).send({ displayName: '' });

    expect(response.status).toBe(400);
    expect(await UserModel.findOne({ googleId: TEST_USER_ID }).lean()).toMatchObject({ displayName: 'mermaid' });
  });
});
