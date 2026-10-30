import request from 'supertest';

import { createApp } from '../../src/app';
import { CommentModel } from '../../src/models/commentModel';
import { DB_START_TIMEOUT_MS, UBC, clearDb, seedGem, startDb, stopDb } from '../helpers/db';

beforeAll(startDb, DB_START_TIMEOUT_MS);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  await seedGem('cafe', UBC);
});

// Interface POST /gem/:pk/comments
describe('Unmocked: POST /gem/:pk/comments', () => {
  // Input: POST /gem/cafe/comments with { body: "  Great view!  " }
  // Expected status code: 201
  // Expected behavior: the comment is stored under places/cafe with the trimmed body
  // Expected output: { id, body: "Great view!" }
  test('Valid comment', async () => {
    const response = await request(createApp()).post('/gem/cafe/comments').send({ body: '  Great view!  ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), body: 'Great view!' });
    expect(await CommentModel.findOne({ gem: 'places/cafe', commentId: response.body.id }).lean())
      .toMatchObject({ body: 'Great view!' });
  });

  // Input: POST /gem/unknown/comments with a valid body
  // Expected status code: 404
  // Expected behavior: nothing is stored
  // Expected output: { message: "No such Gem." }
  test('Unknown Gem', async () => {
    const response = await request(createApp()).post('/gem/unknown/comments').send({ body: 'hello' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
    expect(await CommentModel.countDocuments()).toBe(0);
  });

  // Input: POST /gem/cafe/comments with a blank body
  // Expected status code: 400
  // Expected behavior: nothing is stored
  // Expected output: { message: "Invalid comment body." }
  test('Invalid body', async () => {
    const response = await request(createApp()).post('/gem/cafe/comments').send({ body: '   ' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid comment body.' });
    expect(await CommentModel.countDocuments()).toBe(0);
  });
});

// Interface GET /gem/:pk/comments
describe('Unmocked: GET /gem/:pk/comments', () => {
  // Input: three comments posted to places/cafe in order, one to another Gem
  // Expected status code: 200
  // Expected behavior: only places/cafe's comments, oldest first
  // Expected output: [first, second, third]
  test('Comments oldest first', async () => {
    await seedGem('other', UBC);
    for (const body of ['first', 'second', 'third']) {
      await request(createApp()).post('/gem/cafe/comments').send({ body });
    }
    await request(createApp()).post('/gem/other/comments').send({ body: 'elsewhere' });

    const response = await request(createApp()).get('/gem/cafe/comments');

    expect(response.status).toBe(200);
    expect(response.body.map((c: { body: string }) => c.body)).toEqual(['first', 'second', 'third']);
  });

  // Input: GET /gem/cafe/comments with no comments
  // Expected status code: 200
  // Expected output: []
  test('No comments', async () => {
    const response = await request(createApp()).get('/gem/cafe/comments');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // Input: GET /gem/unknown/comments
  // Expected status code: 404
  // Expected output: { message: "No such Gem." }
  test('Unknown Gem', async () => {
    const response = await request(createApp()).get('/gem/unknown/comments');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
  });
});
