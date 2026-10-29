import request from 'supertest';

import { createApp } from '../../src/app';

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

// Interface: app-wide error handler
describe('Unmocked: malformed requests', () => {
  // Input: POST request with Content-Type application/json and a body that is not valid JSON, to each JSON route
  // Expected status code: 400
  // Expected behavior: rejected by express.json() before any route handler; no state is changed
  // Expected output: { message: "Invalid JSON." } as JSON, not Express's HTML error page
  test.each(['/gem', '/gem/abc/comments', '/user/auth/google'])('Malformed JSON to %s', async (path) => {
    const response = await request(createApp())
      .post(path)
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ message: 'Invalid JSON.' });
  });
});
