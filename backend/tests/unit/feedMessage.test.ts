import {
  MIN_SUBSCRIBE_INTERVAL_MS,
  handleFeedMessage,
  parseMessage,
  type FeedConnection,
} from '../../src/controllers/feedController';
import FeedService from '../../src/services/feedService';

/** A connection that records what it is sent. */
function connection(): FeedConnection & { sent: unknown[] } {
  const sent: unknown[] = [];
  const conn = {
    sent,
    lastSubscribe: 0,
    send: (data: string) => { sent.push(JSON.parse(data)); },
    sendError: (message: string) => { conn.send(JSON.stringify({ type: 'error', message })); },
  };
  return conn;
}

const NOW = 10_000_000;

// Interface parseMessage
describe('parseMessage', () => {
  // Input: a JSON text message, invalid JSON, and a binary message
  // Expected output: the parsed value, undefined, undefined
  test('Text, invalid and binary messages', () => {
    expect(parseMessage(Buffer.from('{"type":"subscribe"}'), false)).toEqual({ type: 'subscribe' });
    expect(parseMessage(Buffer.from('{"type":'), false)).toBeUndefined();
    expect(parseMessage(Buffer.from('{"type":"subscribe"}'), true)).toBeUndefined();
  });
});

// Interface handleFeedMessage
describe('handleFeedMessage', () => {
  // Input: a valid subscribe message without a radius
  // Expected behavior: the client is subscribed with the default 5000 m radius
  // Expected output: { type: "subscribed", latitude, longitude, radius: 5000 }
  test('Valid subscribe', () => {
    const feed = new FeedService();
    const conn = connection();

    handleFeedMessage(feed, conn, { type: 'subscribe', latitude: 49.26, longitude: -123.25 }, NOW);

    expect(conn.sent).toEqual([{ type: 'subscribed', latitude: 49.26, longitude: -123.25, radius: 5000 }]);
    expect(feed.size()).toBe(1);
    expect(conn.lastSubscribe).toBe(NOW);
  });

  // Input: invalid messages (not JSON, not a subscribe, bad location, bad radius)
  // Expected behavior: the client is not subscribed; the connection stays usable
  // Expected output: { type: "error", message } with the matching message
  test.each([
    [undefined, 'Invalid JSON.'],
    [{ type: 'hello' }, 'Unknown message type.'],
    [[1, 2], 'Unknown message type.'],
    [{ type: 'subscribe', latitude: 49.26 }, 'Invalid location.'],
    [{ type: 'subscribe', latitude: 91, longitude: 0 }, 'Invalid location.'],
    [{ type: 'subscribe', latitude: 49.26, longitude: -123.25, radius: 0 }, 'Invalid radius.'],
    [{ type: 'subscribe', latitude: 49.26, longitude: -123.25, radius: 50001 }, 'Invalid radius.'],
  ])('Invalid message %p', (message, error) => {
    const feed = new FeedService();
    const conn = connection();

    handleFeedMessage(feed, conn, message, NOW);

    expect(conn.sent).toEqual([{ type: 'error', message: error }]);
    expect(feed.size()).toBe(0);
  });

  // Input: two valid subscribes less than MIN_SUBSCRIBE_INTERVAL_MS apart, then a third after it
  // Expected behavior: the second is refused and the subscription stays where it was; the third moves it
  // Expected output: subscribed, error "Too many subscriptions.", subscribed
  test('Subscribing too often', () => {
    const feed = new FeedService();
    const conn = connection();
    const msg = { type: 'subscribe', latitude: 49.26, longitude: -123.25 };

    handleFeedMessage(feed, conn, msg, NOW);
    handleFeedMessage(feed, conn, { ...msg, latitude: 49.28 }, NOW + MIN_SUBSCRIBE_INTERVAL_MS - 1);
    handleFeedMessage(feed, conn, { ...msg, latitude: 49.28 }, NOW + MIN_SUBSCRIBE_INTERVAL_MS);

    expect(conn.sent).toEqual([
      expect.objectContaining({ type: 'subscribed', latitude: 49.26 }),
      { type: 'error', message: 'Too many subscriptions.' },
      expect.objectContaining({ type: 'subscribed', latitude: 49.28 }),
    ]);
    expect(feed.size()).toBe(1);
  });
});
