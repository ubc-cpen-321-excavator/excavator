import request from 'supertest';

import { createApp } from '../../src/app';
import { GemModel } from '../../src/models/gemModel';
import { DB_START_TIMEOUT_MS, startDb, stopDb } from '../helpers/db';

/**
 * NFR 2 — The map stays fast with many Gems (Requirements_and_Design.md 3.7 and 4.7).
 * With 10,000 Gems stored, 95% of the map queries (Gems in a viewport, Gems near a point) answer
 * within 500 ms. Real app and a real (in-memory) MongoDB with the app's indexes; nothing is mocked.
 */

/** Gems stored, spread over Metro Vancouver. */
const GEM_COUNT = 10_000;
/** Requests timed per query type. */
const REQUESTS = 50;
/** The requirement: the 95th-percentile response time. */
const MAX_P95_MS = 500;

/** Metro Vancouver, where the Gems are spread. */
const AREA = { south: 49.0, west: -123.3, north: 49.4, east: -122.7 };

/** Deterministic pseudo-random numbers in [0, 1), so every run stores the same Gems and asks the same queries. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

/**
 * Times `REQUESTS` GETs one after another.
 *
 * @param label for the log.
 * @param query makes the i-th request's query string.
 * @returns the 95th-percentile response time, in ms.
 */
async function timeRequests(label: string, path: string, query: (i: number) => Record<string, string>): Promise<number> {
  const app = createApp();
  const times: number[] = [];

  for (let i = 0; i < REQUESTS; i++) {
    const start = performance.now();
    const response = await request(app).get(path).query(query(i));
    times.push(performance.now() - start);
    expect(response.status).toBe(200);
  }

  times.sort((a, b) => a - b);
  const p95 = times[Math.ceil(times.length * 0.95) - 1] ?? 0;
  const median = times[Math.floor(times.length / 2)] ?? 0;
  console.info(`[NFR2] ${label}: ${REQUESTS} requests on ${GEM_COUNT} Gems, median ${median.toFixed(1)} ms, `
    + `p95 ${p95.toFixed(1)} ms, max ${(times[times.length - 1] ?? 0).toFixed(1)} ms (limit p95 ${MAX_P95_MS} ms)`);
  return p95;
}

beforeAll(async () => {
  await startDb();

  const next = random(321);
  const docs = Array.from({ length: GEM_COUNT }, (_v, i) => {
    const name = `places/nfr${i}`;
    const latitude = AREA.south + next() * (AREA.north - AREA.south);
    const longitude = AREA.west + next() * (AREA.east - AREA.west);
    return {
      name,
      place: { name, displayName: `Gem ${i}`, location: { type: 'Point', coordinates: [longitude, latitude] } },
      score: Math.round(next() * 1000) / 10,
    };
  });
  await GemModel.insertMany(docs, { ordered: false });
}, DB_START_TIMEOUT_MS);

afterAll(stopDb);

// Interface GET /gem/within (non-functional: response time with many Gems)
describe('NFR: map queries within 500 ms', () => {
  // Input: 10,000 Gems; 50 viewports from neighbourhood size (~1 km) to city size (~20 km), max 50 Gems each
  // Expected status code: 200
  // Expected behavior: Gems inside the viewport, best GemScore first
  // Expected output: p95 response time < 500 ms
  test('Gems in a viewport', async () => {
    const next = random(7);
    const p95 = await timeRequests('GET /gem/within', '/gem/within', () => {
      const size = 0.01 + next() * 0.17;
      const south = AREA.south + next() * (AREA.north - AREA.south - size);
      const west = AREA.west + next() * (AREA.east - AREA.west - size);
      return { south: String(south), west: String(west), north: String(south + size), east: String(west + size), limit: '50' };
    });

    expect(p95).toBeLessThan(MAX_P95_MS);
  }, 60_000);

  // Input: 10,000 Gems; 50 random points, 5 km radius, max 50 Gems each
  // Expected status code: 200
  // Expected behavior: Gems near the point, nearest first
  // Expected output: p95 response time < 500 ms
  test('Gems near a point', async () => {
    const next = random(11);
    const p95 = await timeRequests('GET /gem/nearby', '/gem/nearby', () => ({
      lat: String(AREA.south + next() * (AREA.north - AREA.south)),
      lng: String(AREA.west + next() * (AREA.east - AREA.west)),
      radius: '5000',
      limit: '50',
    }));

    expect(p95).toBeLessThan(MAX_P95_MS);
  }, 60_000);
});
