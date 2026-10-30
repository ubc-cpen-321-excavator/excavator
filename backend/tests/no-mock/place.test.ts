import request from 'supertest';

import { createApp } from '../../src/app';
import { DB_START_TIMEOUT_MS, clearDb, seedGem, startDb, stopDb } from '../helpers/db';

beforeAll(startDb, DB_START_TIMEOUT_MS);
afterAll(stopDb);
beforeEach(clearDb);

// Interface GET /place/nearby
describe('Unmocked: GET /place/nearby', () => {
  // Input: GET /place/nearby without a location, or with a malformed type
  // Expected status code: 400
  // Expected behavior: Google Places is not called
  // Expected output: { message: "Invalid location." } or { message: "Invalid place type." }
  test.each([
    [{ lat: '49.26' }, 'Invalid location.'],
    [{ lat: '49.26', lng: '-123.25', type: 'Cafe!' }, 'Invalid place type.'],
  ])('Invalid query %p', async (query, message) => {
    const response = await request(createApp()).get('/place/nearby').query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
  });
});

// These call the real Google Places API, so they run only when GOOGLE_PLACES_API_KEY is set.
const describeWithPlaces = process.env.GOOGLE_PLACES_API_KEY ? describe : describe.skip;

/** Next to Google Sydney, a busy area with many places. */
const AT_GOOGLE_SYDNEY = { lat: '-33.866971', lng: '151.195875' };

// Interface GET /place/nearby (with Google Places)
describeWithPlaces('Unmocked: GET /place/nearby with Google Places', () => {
  // Input: GET /place/nearby next to Google Sydney; one nearby place is already a Gem
  // Expected status code: 200
  // Expected behavior: Google Places lists places within 200 m, nearest first
  // Expected output: up to 20 places, each within 200 m; the stored one has isGem: true
  test('Places found', async () => {
    const first = await request(createApp()).get('/place/nearby').query(AT_GOOGLE_SYDNEY);
    expect(first.status).toBe(200);
    expect(first.body.length).toBeGreaterThan(0);
    expect(first.body.length).toBeLessThanOrEqual(20);

    const placeId = (first.body[0].name as string).slice('places/'.length);
    await seedGem(placeId, { latitude: first.body[0].latitude, longitude: first.body[0].longitude });
    const second = await request(createApp()).get('/place/nearby').query(AT_GOOGLE_SYDNEY);

    const distances = (second.body as { distance: number }[]).map(p => p.distance);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(Math.max(...distances)).toBeLessThanOrEqual(200);
    expect(second.body.find((p: { name: string }) => p.name === first.body[0].name)).toMatchObject({ isGem: true });
  }, 20_000);

  // Input: GET /place/nearby with a well-formed type Google doesn't know
  // Expected status code: 400
  // Expected output: { message: "Invalid place type." }
  test('Unknown type', async () => {
    const response = await request(createApp()).get('/place/nearby').query({ ...AT_GOOGLE_SYDNEY, type: 'not_a_real_type' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid place type.' });
  }, 20_000);
});
