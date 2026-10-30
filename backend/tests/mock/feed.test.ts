import { createServer, type Server } from 'node:http';
import request from 'supertest';
import type { WebSocketServer } from 'ws';

import { createApp } from '../../src/app';
import { attachFeed, feedService } from '../../src/controllers/feedController';
import { GemModel } from '../../src/models/gemModel';
import { TestFeedClient, feedUrl } from '../helpers/feedClient';

jest.mock('../../src/models/gemModel', () => ({
  GemModel: {
    findOne: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    replaceOne: jest.fn(),
    create: jest.fn(),
  },
}));

// Called lazily, so it is initialized by the time GemService builds its PlacesClient.
const mockGetPlace = jest.fn();
jest.mock('@googlemaps/places', () => ({
  PlacesClient: jest.fn().mockImplementation(() => ({
    getPlace: (...args: unknown[]) => mockGetPlace(...args),
  })),
}));

const mockedGemModel = GemModel as unknown as { exists: jest.Mock; create: jest.Mock };

const UBC = { latitude: 49.2606, longitude: -123.246 };

let server: Server;
let wss: WebSocketServer;
let client: TestFeedClient;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);

  server = createServer(createApp());
  // The app's own feed, the one POST /gem publishes to.
  wss = attachFeed(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  client = await TestFeedClient.connect(feedUrl(server));
  client.send({ type: 'subscribe', ...UBC });
  await client.next();
});

afterEach(async () => {
  jest.restoreAllMocks();
  await client.close();
  wss.close();
  await new Promise(resolve => server.close(resolve));
});

/** Makes Google return a place at `location`, and the DB accept it as a new Gem. */
function mockNewPlace(location: { latitude: number; longitude: number }): void {
  mockedGemModel.exists.mockResolvedValue(null);
  mockedGemModel.create.mockResolvedValue({});
  mockGetPlace.mockResolvedValue([{ name: 'places/abc', displayName: { text: 'Mitakihara Cafe' }, location }]);
}

// Interface WS /feed (fed by POST /gem)
describe('Mocked: WS /feed', () => {
  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place at UBC; GemModel.create succeeds
  // Input: a client subscribed 5 km around UBC; POST /gem for a place at UBC
  // Expected status code: 201
  // Expected behavior: the new Gem is pushed to the client
  // Expected output: { type: "gem.added", gem } with the same Gem the POST returned
  test('Gem added near the client', async () => {
    mockNewPlace(UBC);

    const response = await request(server).post('/gem').send({ name: 'places/abc', ...UBC });

    expect(response.status).toBe(201);
    expect(await client.next()).toEqual({ type: 'gem.added', gem: response.body });
  });

  // Mocked behavior: as above, but the place is ~8.6 km away, downtown
  // Input: a client subscribed 5 km around UBC; POST /gem for that place, from next to it
  // Expected status code: 201
  // Expected behavior: nothing is pushed to the client
  // Expected output: no message
  test('Gem added out of range', async () => {
    const downtown = { latitude: 49.2827, longitude: -123.1207 };
    mockNewPlace(downtown);

    const response = await request(server).post('/gem').send({ name: 'places/abc', ...downtown });

    expect(response.status).toBe(201);
    expect(await client.drain()).toEqual([]);
  });

  // Mocked behavior: GemModel.exists finds an existing gem
  // Input: POST /gem for a place that is already a Gem
  // Expected status code: 409
  // Expected behavior: nothing is pushed, since nothing was added
  // Expected output: no message
  test('No message when the Gem is not added', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'existing' });

    const response = await request(server).post('/gem').send({ name: 'places/abc', ...UBC });

    expect(response.status).toBe(409);
    expect(await client.drain()).toEqual([]);
  });

  // Mocked behavior: Google Places and the DB accept the Gem; feedService.publishGemAdded throws
  // Input: POST /gem for a place at UBC
  // Expected status code: 201
  // Expected behavior: the feed failure is logged and the Gem is still added
  // Expected output: the new Gem
  test('Feed failure does not fail POST /gem', async () => {
    mockNewPlace(UBC);
    jest.spyOn(feedService, 'publishGemAdded').mockImplementation(() => { throw new Error('feed down'); });

    const response = await request(server).post('/gem').send({ name: 'places/abc', ...UBC });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: 'places/abc' });
    expect(mockedGemModel.create).toHaveBeenCalledTimes(1);
  });
});
