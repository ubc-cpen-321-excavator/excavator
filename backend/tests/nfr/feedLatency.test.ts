import { createServer, type Server } from 'node:http';
import request from 'supertest';
import type { WebSocketServer } from 'ws';

import { createApp } from '../../src/app';
import { attachFeed, closeFeed, feedService } from '../../src/controllers/feedController';
import { TEST_USER_ID, bearer } from '../helpers/auth';
import { DB_START_TIMEOUT_MS, UBC, clearDb, seedUser, startDb, stopDb } from '../helpers/db';
import { TestFeedClient, feedUrl } from '../helpers/feedClient';

/**
 * NFR 1 — Live updates are fast (Requirements_and_Design.md 3.7 and 4.7).
 * With 200 users watching the area and 50 watching elsewhere, a new Gem, or a GemScore change from
 * a rating, reaches every user in range within 1 second of the request that caused it, and no one else.
 *
 * Real server, real WebSockets and a real (in-memory) MongoDB. Only Google Places is mocked:
 * its response time is Google's, not ours, so it is kept out of what this measures.
 */

// Called lazily, so it is initialized by the time GemService builds its PlacesClient.
const mockGetPlace = jest.fn();
jest.mock('@googlemaps/places', () => ({
  PlacesClient: jest.fn().mockImplementation(() => ({
    getPlace: (...args: unknown[]) => mockGetPlace(...args),
  })),
}));

/** Users subscribed around the new Gem, and elsewhere (Toronto). */
const NEARBY_CLIENTS = 200;
const FAR_CLIENTS = 50;
/** The requirement: every nearby user has the update within this long. */
const MAX_LATENCY_MS = 1000;
const TORONTO = { latitude: 43.65, longitude: -79.38 };

let server: Server;
let wss: WebSocketServer;
let nearby: TestFeedClient[];
let far: TestFeedClient[];

/**
 * Clients opened at the same moment. Operating systems queue only so many connections that are
 * waiting to be accepted (128 by default on macOS), so opening all 250 at once can reset some.
 * This limits how the test sets up, not what it measures: by the time a Gem is published, all
 * clients are connected and subscribed.
 */
const CONNECT_BATCH = 50;

/** Connects `count` clients, in batches, and subscribes each 5 km around `at`. */
async function subscribeClients(count: number, at: typeof UBC): Promise<TestFeedClient[]> {
  const clients: TestFeedClient[] = [];
  for (let i = 0; i < count; i += CONNECT_BATCH) {
    const batch = Math.min(CONNECT_BATCH, count - i);
    clients.push(...await Promise.all(Array.from({ length: batch }, () => TestFeedClient.connect(feedUrl(server)))));
  }
  // Subscribing is rate-limited per client, not globally, so all can subscribe at once.
  clients.forEach(c => c.send({ type: 'subscribe', ...at }));
  await Promise.all(clients.map(c => c.next(5000)));
  return clients;
}

/**
 * Waits for one message on every client and records when each arrived.
 *
 * @returns arrival times (ms since epoch) and the messages, in client order.
 */
function arrivals(clients: TestFeedClient[]): Promise<{ at: number; message: unknown }[]> {
  return Promise.all(clients.map(async c => {
    const message = await c.next(MAX_LATENCY_MS * 5);
    return { at: Date.now(), message };
  }));
}

/** Logs the measured latencies so the run doubles as verification evidence for Testing.md. */
function report(label: string, start: number, times: number[]): number {
  const latencies = times.map(t => t - start).sort((a, b) => a - b);
  const max = latencies[latencies.length - 1] ?? 0;
  const median = latencies[Math.floor(latencies.length / 2)] ?? 0;
  console.info(`[NFR1] ${label}: ${latencies.length} clients, median ${median} ms, max ${max} ms (limit ${MAX_LATENCY_MS} ms)`);
  return max;
}

beforeAll(async () => {
  await startDb();
  server = createServer(createApp());
  wss = attachFeed(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
}, DB_START_TIMEOUT_MS);

afterAll(async () => {
  await closeFeed(wss);
  await new Promise(resolve => server.close(resolve));
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
  await seedUser();
  mockGetPlace.mockResolvedValue([{ name: 'places/nfr', displayName: { text: 'NFR Cafe' }, location: UBC, rating: 4.5, userRatingCount: 40 }]);
  nearby = await subscribeClients(NEARBY_CLIENTS, UBC);
  far = await subscribeClients(FAR_CLIENTS, TORONTO);
}, 60_000);

afterEach(async () => {
  await Promise.all([...nearby, ...far].map(c => c.close()));
});

// Interface WS /feed (non-functional: latency under load)
describe('NFR: live updates within 1 second', () => {
  // Input: 200 clients subscribed 5 km around UBC, 50 around Toronto; POST /gem for a place at UBC
  // Expected status code: 201
  // Expected behavior: every UBC client gets the new Gem within 1 s of the request starting; Toronto clients get nothing
  // Expected output: 200 gem.added messages, max latency < 1000 ms
  test('New Gem', async () => {
    const received = arrivals(nearby);
    const start = Date.now();

    const response = await request(server).post('/gem').set('Authorization', bearer()).send({ name: 'places/nfr', ...UBC });
    const times = await received;

    expect(response.status).toBe(201);
    expect(times.every(t => (t.message as { type: string }).type === 'gem.added')).toBe(true);
    expect(report('gem.added', start, times.map(t => t.at))).toBeLessThan(MAX_LATENCY_MS);
    expect(feedService.size()).toBe(NEARBY_CLIENTS + FAR_CLIENTS);
    expect((await Promise.all(far.map(c => c.drain(0)))).flat()).toEqual([]);
  }, 30_000);

  // Input: the same clients; the Gem exists; PUT /gem/nfr/rating { stars: 5 }
  // Expected status code: 200
  // Expected behavior: every UBC client gets the rescored Gem within 1 s; Toronto clients get nothing
  // Expected output: 200 gem.updated messages carrying the new score, max latency < 1000 ms
  test('GemScore change from a rating', async () => {
    const added = arrivals(nearby);
    await request(server).post('/gem').set('Authorization', bearer()).send({ name: 'places/nfr', ...UBC });
    await added;

    const received = arrivals(nearby);
    const start = Date.now();
    const response = await request(server).put('/gem/nfr/rating').set('Authorization', bearer()).send({ stars: 5 });
    const times = await received;

    expect(response.status).toBe(200);
    expect(times.every(t => {
      const message = t.message as { type: string; gem: { score: number; addedBy: string } };
      return message.type === 'gem.updated' && message.gem.score === response.body.gem.score && message.gem.addedBy === TEST_USER_ID;
    })).toBe(true);
    expect(report('gem.updated', start, times.map(t => t.at))).toBeLessThan(MAX_LATENCY_MS);
    expect((await Promise.all(far.map(c => c.drain(0)))).flat()).toEqual([]);
  }, 30_000);
});
