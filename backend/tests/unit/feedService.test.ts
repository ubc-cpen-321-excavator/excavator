import FeedService, { type FeedClient } from '../../src/services/feedService';
import { Gem, Place } from '../../src/services/gemService';

/** A client that records what it receives. */
function recordingClient(): FeedClient & { received: unknown[] } {
  const received: unknown[] = [];
  return { received, send: (data: string) => { received.push(JSON.parse(data)); } };
}

/** A Gem at the given point. */
function gemAt(latitude: number, longitude: number, name = 'places/abc'): Gem {
  return new Gem(name, new Place(name, latitude, longitude));
}

const UBC = { latitude: 49.2606, longitude: -123.246 };

// Interface FeedService.publishGemAdded
describe('FeedService.publishGemAdded', () => {
  // Input: one client subscribed 5 km around UBC; a Gem added at UBC
  // Expected behavior: the client gets one gem.added message with the Gem
  // Expected output: 1 (clients sent to)
  test('Client in range', () => {
    const feed = new FeedService();
    const client = recordingClient();
    feed.subscribe(client, { center: UBC, radius: 5000 });

    expect(feed.publishGemAdded(gemAt(UBC.latitude, UBC.longitude))).toBe(1);

    expect(client.received).toEqual([{
      type: 'gem.added',
      gem: expect.objectContaining({ name: 'places/abc', place: expect.objectContaining({ latitude: UBC.latitude }) }),
    }]);
  });

  // Input: clients subscribed 1 km and 20 km around UBC; a Gem added ~8.6 km away, downtown
  // Expected behavior: only the 20 km client gets it
  // Expected output: 1
  test('Only clients whose radius contains the Gem', () => {
    const feed = new FeedService();
    const near = recordingClient();
    const wide = recordingClient();
    feed.subscribe(near, { center: UBC, radius: 1000 });
    feed.subscribe(wide, { center: UBC, radius: 20000 });

    expect(feed.publishGemAdded(gemAt(49.2827, -123.1207))).toBe(1);

    expect(near.received).toEqual([]);
    expect(wide.received).toHaveLength(1);
  });

  // Input: a client subscribed at UBC, then re-subscribed downtown with 1 km
  // Expected behavior: the old subscription is replaced, so a Gem at UBC is not sent
  // Expected output: 0, and still one subscription
  test('Subscribing again moves the subscription', () => {
    const feed = new FeedService();
    const client = recordingClient();
    feed.subscribe(client, { center: UBC, radius: 5000 });
    feed.subscribe(client, { center: { latitude: 49.2827, longitude: -123.1207 }, radius: 1000 });

    expect(feed.publishGemAdded(gemAt(UBC.latitude, UBC.longitude))).toBe(0);
    expect(feed.size()).toBe(1);
  });

  // Input: a subscribed client that then unsubscribes
  // Expected behavior: it gets nothing; unsubscribing twice reports false
  // Expected output: true, then false; 0 sent
  test('Unsubscribed client gets nothing', () => {
    const feed = new FeedService();
    const client = recordingClient();
    feed.subscribe(client, { center: UBC, radius: 5000 });

    expect(feed.unsubscribe(client)).toBe(true);
    expect(feed.unsubscribe(client)).toBe(false);
    expect(feed.publishGemAdded(gemAt(UBC.latitude, UBC.longitude))).toBe(0);
    expect(client.received).toEqual([]);
  });

  // Input: two clients in range, one whose send throws (broken connection)
  // Expected behavior: the healthy client still gets the Gem; the broken one is unsubscribed
  // Expected output: 1, and one subscription left
  test('A failing client does not block the others', () => {
    const feed = new FeedService();
    const broken: FeedClient = { send: () => { throw new Error('socket closed'); } };
    const healthy = recordingClient();
    feed.subscribe(broken, { center: UBC, radius: 5000 });
    feed.subscribe(healthy, { center: UBC, radius: 5000 });

    expect(feed.publishGemAdded(gemAt(UBC.latitude, UBC.longitude))).toBe(1);

    expect(healthy.received).toHaveLength(1);
    expect(feed.size()).toBe(1);
  });

  // Input: no subscribers
  // Expected output: 0
  test('No subscribers', () => {
    expect(new FeedService().publishGemAdded(gemAt(UBC.latitude, UBC.longitude))).toBe(0);
  });
});
