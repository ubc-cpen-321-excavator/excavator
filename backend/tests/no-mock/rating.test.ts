import request from 'supertest';

import { createApp } from '../../src/app';
import { GemModel } from '../../src/models/gemModel';
import { RatingModel } from '../../src/models/ratingModel';
import { computeGemScore } from '../../src/utils/gemScore';
import { TEST_USER_ID, bearer } from '../helpers/auth';
import { DB_START_TIMEOUT_MS, UBC, clearDb, seedGem, seedUser, startDb, stopDb } from '../helpers/db';

beforeAll(startDb, DB_START_TIMEOUT_MS);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  await seedUser();
  await seedUser('google-sub-other', 'kyoko');
  await seedGem('cafe', UBC);
});

// Interface PUT /gem/:pk/rating
describe('Unmocked: PUT /gem/:pk/rating', () => {
  // Input: the user rates cafe 5, another user rates it 2, then the user changes theirs to 4
  // Expected status code: 200 each time
  // Expected behavior: one rating per user is stored; the Gem's totals are recounted by MongoDB after each,
  //                    and its GemScore is recomputed from them and stored
  // Expected output: totals (1, 5), (2, 3.5), then (2, 3); the stored Gem matches the last response
  test('Ratings update the Gem', async () => {
    const put = (stars: number, userId = TEST_USER_ID): request.Test =>
      request(createApp()).put('/gem/cafe/rating').set('Authorization', bearer(userId)).send({ stars });

    const first = await put(5);
    const second = await put(2, 'google-sub-other');
    const third = await put(4);

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ stars: 5, gem: { ratingCount: 1, ratingAverage: 5 } });
    expect(second.body.gem).toMatchObject({ ratingCount: 2, ratingAverage: 3.5 });
    expect(third.body.gem).toMatchObject({ ratingCount: 2, ratingAverage: 3 });
    expect(third.body.gem.score).toBe(computeGemScore({ appRating: 3, appRatingCount: 2 }).score);

    expect(await RatingModel.countDocuments({ gem: 'places/cafe' })).toBe(2);
    expect(await GemModel.findOne({ name: 'places/cafe' }).lean())
      .toMatchObject({ ratingCount: 2, ratingAverage: 3, score: third.body.gem.score });
  });

  // Input: PUT { stars: 6 } signed in
  // Expected status code: 400
  // Expected behavior: nothing is stored
  // Expected output: { message: "Invalid stars." }
  test('Invalid stars', async () => {
    const response = await request(createApp()).put('/gem/cafe/rating').set('Authorization', bearer()).send({ stars: 6 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid stars.' });
    expect(await RatingModel.countDocuments()).toBe(0);
  });

  // Input: PUT /gem/unknown/rating signed in
  // Expected status code: 404
  // Expected behavior: nothing is stored
  // Expected output: { message: "No such Gem." }
  test('No such Gem', async () => {
    const response = await request(createApp()).put('/gem/unknown/rating').set('Authorization', bearer()).send({ stars: 4 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
    expect(await RatingModel.countDocuments()).toBe(0);
  });

  // Input: PUT { stars: 4 } without a token
  // Expected status code: 401
  // Expected behavior: nothing is stored
  test('Not signed in', async () => {
    const response = await request(createApp()).put('/gem/cafe/rating').send({ stars: 4 });

    expect(response.status).toBe(401);
    expect(await RatingModel.countDocuments()).toBe(0);
  });
});

// Interface GET /gem/:pk/rating
describe('Unmocked: GET /gem/:pk/rating', () => {
  // Input: GET before and after the user rates cafe 4; another user's rating doesn't count
  // Expected status code: 404, then 200
  // Expected output: { message: "No rating." }, then { stars: 4 }
  test('Own rating', async () => {
    await request(createApp()).put('/gem/cafe/rating').set('Authorization', bearer('google-sub-other')).send({ stars: 1 });

    const before = await request(createApp()).get('/gem/cafe/rating').set('Authorization', bearer());
    await request(createApp()).put('/gem/cafe/rating').set('Authorization', bearer()).send({ stars: 4 });
    const after = await request(createApp()).get('/gem/cafe/rating').set('Authorization', bearer());

    expect(before.status).toBe(404);
    expect(before.body).toEqual({ message: 'No rating.' });
    expect(after.status).toBe(200);
    expect(after.body).toEqual({ stars: 4 });
  });
});
