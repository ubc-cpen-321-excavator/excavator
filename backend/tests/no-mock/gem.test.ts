import request from 'supertest';

import { createApp } from '../../src/app';
import { GemModel } from '../../src/models/gemModel';
import {
  DB_START_TIMEOUT_MS, DOWNTOWN, NEAR_UBC, SEED_SCORE_TIME, UBC,
  clearDb, seedGem, startDb, stopDb,
} from '../helpers/db';

beforeAll(startDb, DB_START_TIMEOUT_MS);
afterAll(stopDb);
beforeEach(clearDb);

/** Place IDs of the Gems in a list response, in order. */
function names(body: { name: string }[]): string[] {
  return body.map(g => g.name);
}

// Interface GET /gem
describe('Unmocked: GET /gem', () => {
  // Input: GET /gem?name=places/cafe, a Gem stored with score 82.2
  // Expected status code: 200
  // Expected behavior: the Gem is read from the database; nothing changes
  // Expected output: the Gem, with its location as latitude / longitude
  test('Existing Gem', async () => {
    await seedGem('cafe', UBC, 82.2);

    const response = await request(createApp()).get('/gem').query({ name: 'places/cafe' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: 'places/cafe',
      place: { name: 'places/cafe', displayName: 'cafe', ...UBC },
      score: 82.2,
      scoreTime: SEED_SCORE_TIME,
    });
  });

  // Input: GET /gem?name=places/unknown with an empty database
  // Expected status code: 404
  // Expected behavior: nothing changes
  // Expected output: { message: "No such Gem." }
  test('Unknown Gem', async () => {
    const response = await request(createApp()).get('/gem').query({ name: 'places/unknown' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
  });

  // Input: GET /gem with a name that is not places/<place ID>
  // Expected status code: 400
  // Expected behavior: nothing changes
  // Expected output: { message: "Invalid Gem name." }
  test('Invalid name', async () => {
    const response = await request(createApp()).get('/gem').query({ name: 'cafe' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem name.' });
  });
});

// Interface POST /gem
describe('Unmocked: POST /gem', () => {
  // Input: POST /gem with a name that is not places/<place ID>, or without the user's location
  // Expected status code: 400
  // Expected behavior: nothing is stored
  // Expected output: { message: "Invalid place name." } or { message: "Invalid location." }
  test.each([
    [{ name: 'cafe', ...UBC }, 'Invalid place name.'],
    [{ name: 'places/cafe' }, 'Invalid location.'],
  ])('Invalid request %p', async (body, message) => {
    const response = await request(createApp()).post('/gem').send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(await GemModel.countDocuments()).toBe(0);
  });

  // Input: POST /gem for a place that is already a Gem
  // Expected status code: 409
  // Expected behavior: the stored Gem is unchanged and no second one is created
  // Expected output: { message: "Gem already exists." }
  test('Existing Gem', async () => {
    await seedGem('cafe', UBC, 82.2);

    const response = await request(createApp()).post('/gem').send({ name: 'places/cafe', ...UBC });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Gem already exists.' });
    expect(await GemModel.countDocuments()).toBe(1);
    expect(await GemModel.findOne({ name: 'places/cafe' }).lean()).toMatchObject({ score: 82.2 });
  });
});

// These call the real Google Places API, so they run only when GOOGLE_PLACES_API_KEY is set.
const describeWithPlaces = process.env.GOOGLE_PLACES_API_KEY ? describe : describe.skip;

/** Google's own example place (Google Sydney), and a point next to it. */
const GOOGLE_SYDNEY = 'places/ChIJN1t_tDeuEmsRUsoyG83frY4';
const AT_GOOGLE_SYDNEY = { latitude: -33.866971, longitude: 151.195875 };

// Interface POST /gem (with Google Places)
describeWithPlaces('Unmocked: POST /gem with Google Places', () => {
  // Input: POST /gem for Google Sydney, from next to it
  // Expected status code: 201
  // Expected behavior: Google Places is asked for the place; the scored Gem is stored once
  // Expected output: the new Gem, with Google's display name and a score from 0 to 100
  test('New Gem', async () => {
    const response = await request(createApp()).post('/gem').send({ name: GOOGLE_SYDNEY, ...AT_GOOGLE_SYDNEY });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: GOOGLE_SYDNEY, place: { name: GOOGLE_SYDNEY } });
    expect(response.body.place.displayName).toEqual(expect.any(String));
    expect(response.body.score).toBeGreaterThanOrEqual(0);
    expect(response.body.score).toBeLessThanOrEqual(100);
    expect(await GemModel.countDocuments({ name: GOOGLE_SYDNEY })).toBe(1);
  }, 20_000);

  // Input: POST /gem for Google Sydney, from UBC (~12,500 km away)
  // Expected status code: 422
  // Expected behavior: nothing is stored
  // Expected output: { message: "Too far from place." }
  test('Too far from place', async () => {
    const response = await request(createApp()).post('/gem').send({ name: GOOGLE_SYDNEY, ...UBC });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: 'Too far from place.' });
    expect(await GemModel.countDocuments()).toBe(0);
  }, 20_000);

  // Input: POST /gem for a well-formed place ID that doesn't exist
  // Expected status code: 422
  // Expected behavior: nothing is stored
  // Expected output: { message: "Place does not exist." }
  test('Place does not exist', async () => {
    const response = await request(createApp()).post('/gem').send({ name: 'places/doesNotExist000', ...UBC });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: 'Place does not exist.' });
    expect(await GemModel.countDocuments()).toBe(0);
  }, 20_000);
});

// Interface GET /gem/nearby
describe('Unmocked: GET /gem/nearby', () => {
  beforeEach(async () => {
    await seedGem('downtown', DOWNTOWN);
    await seedGem('near', NEAR_UBC);
    await seedGem('ubc', UBC);
  });

  // Input: GET /gem/nearby at UBC with radius 2000, 10000, and the default (5000)
  // Expected status code: 200
  // Expected behavior: only Gems within the radius, nearest first, using the 2dsphere index
  // Expected output: [ubc, near], [ubc, near, downtown], [ubc, near]
  test.each([
    ['2000', ['places/ubc', 'places/near']],
    ['10000', ['places/ubc', 'places/near', 'places/downtown']],
    [undefined, ['places/ubc', 'places/near']],
  ])('Radius %p', async (radius, expected) => {
    const query = { lat: String(UBC.latitude), lng: String(UBC.longitude), ...(radius ? { radius } : {}) };

    const response = await request(createApp()).get('/gem/nearby').query(query);

    expect(response.status).toBe(200);
    expect(names(response.body)).toEqual(expected);
  });

  // Input: GET /gem/nearby at UBC, radius 10000, limit 1
  // Expected status code: 200
  // Expected output: only the nearest Gem
  test('Limit', async () => {
    const response = await request(createApp()).get('/gem/nearby')
      .query({ lat: String(UBC.latitude), lng: String(UBC.longitude), radius: '10000', limit: '1' });

    expect(response.status).toBe(200);
    expect(names(response.body)).toEqual(['places/ubc']);
  });

  // Input: GET /gem/nearby in Toronto
  // Expected status code: 200
  // Expected output: []
  test('No Gems nearby', async () => {
    const response = await request(createApp()).get('/gem/nearby').query({ lat: '43.65', lng: '-79.38' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // Input: GET /gem/nearby without a longitude
  // Expected status code: 400
  // Expected output: { message: "Invalid location." }
  test('Invalid location', async () => {
    const response = await request(createApp()).get('/gem/nearby').query({ lat: '49.26' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid location.' });
  });
});

// Interface GET /gem/within
describe('Unmocked: GET /gem/within', () => {
  beforeEach(async () => {
    await seedGem('low', UBC, 40);
    await seedGem('high', NEAR_UBC, 90);
    await seedGem('downtown', DOWNTOWN, 99);
  });

  /** A viewport around UBC that excludes downtown. */
  const AROUND_UBC = { south: '49.25', west: '-123.26', north: '49.28', east: '-123.23' };

  // Input: GET /gem/within a viewport around UBC (downtown is outside it)
  // Expected status code: 200
  // Expected behavior: only Gems inside the viewport, highest GemScore first
  // Expected output: [high, low]
  test('Gems inside the viewport', async () => {
    const response = await request(createApp()).get('/gem/within').query(AROUND_UBC);

    expect(response.status).toBe(200);
    expect(names(response.body)).toEqual(['places/high', 'places/low']);
  });

  // Input: the same viewport with limit 1
  // Expected status code: 200
  // Expected output: [high]
  test('Limit', async () => {
    const response = await request(createApp()).get('/gem/within').query({ ...AROUND_UBC, limit: '1' });

    expect(response.status).toBe(200);
    expect(names(response.body)).toEqual(['places/high']);
  });

  // Input: a viewport with south above north
  // Expected status code: 400
  // Expected output: { message: "Invalid bounds." }
  test('Invalid bounds', async () => {
    const response = await request(createApp()).get('/gem/within').query({ ...AROUND_UBC, south: '49.3' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid bounds.' });
  });
});

// Interface GET /gem/newest
describe('Unmocked: GET /gem/newest', () => {
  // Input: three Gems added one after another; GET /gem/newest, then with limit 2
  // Expected status code: 200
  // Expected behavior: newest first
  // Expected output: [third, second, first], then [third, second]
  test('Newest first', async () => {
    await seedGem('first', UBC);
    await seedGem('second', UBC);
    await seedGem('third', UBC);

    const all = await request(createApp()).get('/gem/newest');
    const two = await request(createApp()).get('/gem/newest').query({ limit: '2' });

    expect(all.status).toBe(200);
    expect(names(all.body)).toEqual(['places/third', 'places/second', 'places/first']);
    expect(names(two.body)).toEqual(['places/third', 'places/second']);
  });

  // Input: GET /gem/newest with an empty database
  // Expected status code: 200
  // Expected output: []
  test('No Gems', async () => {
    const response = await request(createApp()).get('/gem/newest');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // Input: GET /gem/newest?limit=0
  // Expected status code: 400
  // Expected output: { message: "Invalid limit." }
  test('Invalid limit', async () => {
    const response = await request(createApp()).get('/gem/newest').query({ limit: '0' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid limit.' });
  });
});
