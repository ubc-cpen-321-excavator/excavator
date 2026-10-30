import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createApp } from '../../src/app';
import { authService } from '../../src/controllers/authController';
import { UserModel } from '../../src/models/userModel';
import { DB_START_TIMEOUT_MS, clearDb, startDb, stopDb } from '../helpers/db';

beforeAll(startDb, DB_START_TIMEOUT_MS);
afterAll(stopDb);
beforeEach(clearDb);

// Interface POST /user/auth/google
describe('Unmocked: POST /user/auth/google', () => {
  // Input: POST with no body, or with an idToken that is missing or not a string
  // Expected status code: 400
  // Expected behavior: Google is not asked; no user is stored
  // Expected output: the matching message
  test.each([
    ['no body', undefined, 'Invalid request.'],
    ['empty body', {}, 'Wrong OAuth idToken.'],
    ['non-string idToken', { idToken: 37 }, 'Wrong OAuth idToken.'],
  ])('Invalid request: %s', async (_label, body, message) => {
    const req = request(createApp()).post('/user/auth/google');
    const response = body === undefined ? await req : await req.send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(await UserModel.countDocuments()).toBe(0);
  });

  // Input: POST with an idToken that is not a real Google token
  // Expected status code: 401
  // Expected behavior: the real Google library rejects it; no user is stored
  // Expected output: { message: "Login failed." }
  test('Rejected Google token', async () => {
    const response = await request(createApp()).post('/user/auth/google').send({ idToken: 'not-a-google-token' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Login failed.' });
    expect(await UserModel.countDocuments()).toBe(0);
  }, 20_000);
});

// Interface: login check (AuthService.reqJwt) on a protected route
describe('Unmocked: login check', () => {
  /** An app with one protected route that echoes `req.user`. */
  function protectedApp(): express.Express {
    const app = express();
    app.get('/me', authService.reqJwt, (req, res) => {
      res.json({ id: req.user?.id, displayName: req.user?.getDisplayName() });
    });
    return app;
  }

  const SECRET = process.env.JWT_SECRET ?? '';

  // Input: a user stored in the database, and a token for them
  // Expected status code: 200
  // Expected behavior: the user is read from the real database and put on req.user
  // Expected output: the user's ID and display name
  test('Stored user', async () => {
    await UserModel.create({ googleId: 'google-sub-123', name: { full: 'Sayaka Miki' }, displayName: 'mermaid' });

    const response = await request(protectedApp()).get('/me')
      .set('Authorization', `Bearer ${jwt.sign({}, SECRET, { subject: 'google-sub-123', expiresIn: '7d' })}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'google-sub-123', displayName: 'mermaid' });
  });

  // Input: a valid token for a user that is not in the database
  // Expected status code: 401
  // Expected output: { message: "Nonexistent user." }
  test('Unknown user', async () => {
    const response = await request(protectedApp()).get('/me')
      .set('Authorization', `Bearer ${jwt.sign({}, SECRET, { subject: 'google-sub-gone' })}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Nonexistent user.' });
  });

  // Input: no Authorization header
  // Expected status code: 401
  // Expected output: { message: "Unauthorized request." }
  test('No token', async () => {
    const response = await request(protectedApp()).get('/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized request.' });
  });
});
