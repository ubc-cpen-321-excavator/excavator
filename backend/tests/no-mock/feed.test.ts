import { createServer, type Server } from 'node:http';
import type { WebSocketServer } from 'ws';

import { createApp } from '../../src/app';
import { attachFeed, closeFeed } from '../../src/controllers/feedController';
import FeedService from '../../src/services/feedService';
import { Gem, Place } from '../../src/services/gemService';
import { TestFeedClient, feedUrl, waitFor } from '../helpers/feedClient';

const UBC = { latitude: 49.2606, longitude: -123.246 };
const DOWNTOWN = { latitude: 49.2827, longitude: -123.1207 };

let server: Server;
let wss: WebSocketServer;
let feed: FeedService;
let clients: TestFeedClient[];

/** Connects a client that the test cleans up afterwards. */
async function connect(options?: { autoPong: boolean }): Promise<TestFeedClient> {
  const client = await TestFeedClient.connect(feedUrl(server), options);
  clients.push(client);
  return client;
}

beforeEach(async () => {
  feed = new FeedService();
  clients = [];
  server = createServer(createApp());
  wss = attachFeed(server, feed, 100);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
});

afterEach(async () => {
  await Promise.all(clients.map(c => c.close()));
  await closeFeed(wss);
  await new Promise(resolve => server.close(resolve));
});

// Interface WS /feed
describe('Unmocked: WS /feed', () => {
  // Input: connect to /feed, send { type: "subscribe", latitude, longitude, radius: 2000 }
  // Expected behavior: the client is subscribed
  // Expected output: { type: "subscribed", latitude, longitude, radius: 2000 }
  test('Subscribe', async () => {
    const client = await connect();

    client.send({ type: 'subscribe', ...UBC, radius: 2000 });

    expect(await client.next()).toEqual({ type: 'subscribed', ...UBC, radius: 2000 });
    expect(feed.size()).toBe(1);
  });

  // Input: two subscribed clients, at UBC (5 km) and downtown (1 km); a Gem is published at UBC
  // Expected behavior: only the UBC client is pushed the Gem
  // Expected output: { type: "gem.added", gem } on the UBC client; nothing on the other
  test('New Gem pushed to clients in range', async () => {
    const ubc = await connect();
    const downtown = await connect();
    ubc.send({ type: 'subscribe', ...UBC });
    downtown.send({ type: 'subscribe', ...DOWNTOWN, radius: 1000 });
    await ubc.next();
    await downtown.next();

    feed.publishGemAdded(new Gem('places/abc', new Place('places/abc', UBC.latitude, UBC.longitude)));

    expect(await ubc.next()).toEqual({
      type: 'gem.added',
      gem: expect.objectContaining({ name: 'places/abc', place: expect.objectContaining(UBC) }),
    });
    expect(await downtown.drain()).toEqual([]);
  });

  // Input: invalid JSON, then a valid subscribe on the same connection
  // Expected behavior: the error doesn't close the connection
  // Expected output: { type: "error", message: "Invalid JSON." }, then { type: "subscribed", ... }
  test('Invalid message keeps the connection open', async () => {
    const client = await connect();

    client.send('{"type":');
    expect(await client.next()).toEqual({ type: 'error', message: 'Invalid JSON.' });

    client.send({ type: 'subscribe', ...UBC });
    expect(await client.next()).toMatchObject({ type: 'subscribed' });
  });

  // Input: a subscribe with a bad location
  // Expected behavior: the client is not subscribed
  // Expected output: { type: "error", message: "Invalid location." }
  test('Invalid location', async () => {
    const client = await connect();

    client.send({ type: 'subscribe', latitude: 'north', longitude: 0 });

    expect(await client.next()).toEqual({ type: 'error', message: 'Invalid location.' });
    expect(feed.size()).toBe(0);
  });

  // Input: a message bigger than 1024 bytes
  // Expected behavior: the server closes the connection
  // Expected output: close code 1009 (message too big)
  test('Message too big', async () => {
    const client = await connect();

    client.send({ type: 'subscribe', padding: 'x'.repeat(2000) });

    expect(await client.closed).toBe(1009);
  });

  // Input: a subscribed client disconnects
  // Expected behavior: it is unsubscribed
  // Expected output: no subscriptions left
  test('Disconnect unsubscribes', async () => {
    const client = await connect();
    client.send({ type: 'subscribe', ...UBC });
    await client.next();

    await client.close();

    await waitFor(() => feed.size() === 0);
  });

  // Input: a subscribed client that never answers pings (heartbeat set to 100 ms for the test)
  // Expected behavior: the server drops it after a missed ping and unsubscribes it
  // Expected output: the connection closes; no subscriptions left
  test('Unresponsive client is dropped', async () => {
    const client = await connect({ autoPong: false });
    client.send({ type: 'subscribe', ...UBC });
    await client.next();

    await client.closed;

    // The server's own close handler runs just after the client sees the close.
    await waitFor(() => feed.size() === 0);
  });

  // Input: two connected clients (one subscribed); closeFeed, then the HTTP server's close()
  // Expected behavior: both clients are disconnected, so the HTTP server finishes closing instead of hanging
  // Expected output: both connections close; server.close() calls back within 2 s with no error
  test('Shutdown with connected clients', async () => {
    const subscribed = await connect();
    const idle = await connect();
    subscribed.send({ type: 'subscribe', ...UBC });
    await subscribed.next();

    await closeFeed(wss);
    const closed = await Promise.race([
      new Promise<Error | undefined>(resolve => server.close(resolve)),
      new Promise<string>(resolve => setTimeout(() => resolve('timed out'), 2000)),
    ]);

    expect(closed).toBeUndefined();
    await subscribed.closed;
    await idle.closed;
    await waitFor(() => feed.size() === 0);

    // Already closed; give afterEach a fresh server to close.
    server = createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    wss = attachFeed(server, feed, 100);
  });

  // Input: a WebSocket connection to a path other than /feed
  // Expected behavior: the connection is refused
  // Expected output: the client fails to connect
  test('Wrong path', async () => {
    const url = feedUrl(server).replace('/feed', '/other');

    await expect(TestFeedClient.connect(url)).rejects.toThrow();
  });
});
