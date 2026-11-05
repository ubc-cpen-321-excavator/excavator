import request from 'supertest';

import { createApp } from '../../src/app';
import { FavoriteModel } from '../../src/models/favoriteModel';
import { GemModel } from '../../src/models/gemModel';
import { TEST_USER_ID, bearer } from '../helpers/auth';
import { DB_START_TIMEOUT_MS, UBC, clearDb, seedGem, seedUser, startDb, stopDb } from '../helpers/db';

beforeAll(startDb, DB_START_TIMEOUT_MS);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  await seedUser();
  await seedUser('google-sub-other', 'kyoko');
  await seedGem('cafe', UBC);
  await seedGem('park', UBC);
});

/** Names of the Gems in a list response, in order. */
function names(body: { name: string }[]): string[] {
  return body.map(g => g.name);
}

// Interface POST /user/favorites
describe('Unmocked: POST /user/favorites', () => {
  // Input: POST { gem: "places/cafe" } signed in, twice
  // Expected status code: 201, then 200
  // Expected behavior: one favorite stored for the signed-in user (the second add changes nothing)
  // Expected output: { gem: "places/cafe" } both times
  test('Add, then add again', async () => {
    const first = await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/cafe' });
    const second = await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/cafe' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ gem: 'places/cafe' });
    expect(await FavoriteModel.countDocuments({ user: TEST_USER_ID, gem: 'places/cafe' })).toBe(1);
  });

  // Input: POST { gem: "places/unknown" } signed in
  // Expected status code: 404
  // Expected behavior: nothing is stored
  // Expected output: { message: "No such Gem." }
  test('No such Gem', async () => {
    const response = await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/unknown' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
    expect(await FavoriteModel.countDocuments()).toBe(0);
  });

  // Input: POST { gem: "cafe" } signed in
  // Expected status code: 400
  // Expected output: { message: "Invalid Gem name." }
  test('Invalid gem', async () => {
    const response = await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'cafe' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem name.' });
  });

  // Input: POST { gem: "places/cafe" } without a token
  // Expected status code: 401
  // Expected behavior: nothing is stored
  // Expected output: { message: "Unauthorized request." }
  test('Not signed in', async () => {
    const response = await request(createApp()).post('/user/favorites').send({ gem: 'places/cafe' });

    expect(response.status).toBe(401);
    expect(await FavoriteModel.countDocuments()).toBe(0);
  });
});

// Interface GET /user/favorites
describe('Unmocked: GET /user/favorites', () => {
  // Input: the user favorites cafe, then park; another user favorites cafe; then GET /user/favorites
  // Expected status code: 200
  // Expected behavior: only the signed-in user's favorites, newest first, as full Gems
  // Expected output: [park, cafe]
  test('Own favorites, newest first', async () => {
    for (const gem of ['places/cafe', 'places/park']) {
      await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem });
    }
    await request(createApp()).post('/user/favorites').set('Authorization', bearer('google-sub-other')).send({ gem: 'places/cafe' });

    const response = await request(createApp()).get('/user/favorites').set('Authorization', bearer());

    expect(response.status).toBe(200);
    expect(names(response.body as { name: string }[])).toEqual(['places/park', 'places/cafe']);
    expect(response.body[0].place).toMatchObject({ name: 'places/park', ...UBC });
  });

  // Input: a favorite whose Gem was deleted afterwards
  // Expected status code: 200
  // Expected output: the list without that Gem
  test('Deleted Gem left out', async () => {
    await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/cafe' });
    await GemModel.deleteOne({ name: 'places/cafe' });

    const response = await request(createApp()).get('/user/favorites').set('Authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

// Interface DELETE /user/favorites/:placeId
describe('Unmocked: DELETE /user/favorites/:placeId', () => {
  // Input: the user and another user both favorite cafe; the user deletes it, then deletes it again
  // Expected status code: 204, then 404
  // Expected behavior: only the signed-in user's favorite is removed
  // Expected output: no body, then { message: "Not a favorite." }
  test('Remove own favorite', async () => {
    await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/cafe' });
    await request(createApp()).post('/user/favorites').set('Authorization', bearer('google-sub-other')).send({ gem: 'places/cafe' });

    const first = await request(createApp()).delete('/user/favorites/cafe').set('Authorization', bearer());
    const second = await request(createApp()).delete('/user/favorites/cafe').set('Authorization', bearer());

    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
    expect(second.body).toEqual({ message: 'Not a favorite.' });
    expect(await FavoriteModel.countDocuments({ user: TEST_USER_ID })).toBe(0);
    expect(await FavoriteModel.countDocuments({ user: 'google-sub-other' })).toBe(1);
  });
});
