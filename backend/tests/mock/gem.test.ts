import request from 'supertest';

import { createApp } from '../../src/app';
import { GemModel } from '../../src/models/gemModel';

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

const mockedGemModel = GemModel as unknown as {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  exists: jest.Mock;
  replaceOne: jest.Mock;
};

/** The user's location, at the place the POST tests add. */
const USER = { latitude: 49.26, longitude: -123.25 };

function mockFindOne(result: unknown): void {
  mockedGemModel.findOne.mockReturnValue({ lean: () => result });
}

/** A Google Places error, as thrown by the Places client. */
function placesError(code: number): Error & { code: number } {
  return Object.assign(new Error(`places error ${code}`), { code });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

// Interface GET /gem
describe('Mocked: GET /gem', () => {
  // Mocked behavior: none
  // Input: GET request to /gem with no name
  // Expected status code: 400
  // Expected behavior: request is rejected; DB is not queried
  // Expected output: { message: "Invalid Gem name." }
  test('Missing name', async () => {
    const response = await request(createApp()).get('/gem');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem name.' });
    expect(mockedGemModel.findOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: none
  // Input: GET request to /gem with a name that is not `places/<place ID>` (incl. a repeated query param, which Express parses as an array)
  // Expected status code: 400
  // Expected behavior: request is rejected; DB is not queried
  // Expected output: { message: "Invalid Gem name." }
  test.each(['?name=abc', '?name=places/a%20b', '?name=places/abc&name=places/def'])('Malformed name: %s', async (query) => {
    const response = await request(createApp()).get(`/gem${query}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem name.' });
    expect(mockedGemModel.findOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.findOne finds no document
  // Input: GET request to /gem?name=places/unknown
  // Expected status code: 404
  // Expected behavior: DB is queried by name; no state is changed
  // Expected output: { message: "No such Gem." }
  test('Unknown gem', async () => {
    mockFindOne(Promise.resolve(null));

    const response = await request(createApp()).get('/gem').query({ name: 'places/unknown' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
    expect(mockedGemModel.findOne).toHaveBeenCalledWith({ name: 'places/unknown' });
  });

  // Mocked behavior: GemModel.findOne returns a stored gem document with all fields
  // Input: GET request to /gem?name=places/abc
  // Expected status code: 200
  // Expected behavior: document is mapped back to a Gem ([lng, lat] -> latitude / longitude)
  // Expected output: the Gem with its place (incl. type, description), addedBy, score, scoreTime, nicheness and quality
  test('Existing gem', async () => {
    mockFindOne(Promise.resolve({
      name: 'places/abc',
      place: {
        name: 'places/abc',
        displayName: 'Mitakihara Cafe',
        location: { type: 'Point', coordinates: [-123.25, 49.26] },
      },
      description: 'Quiet cafe behind the library.',
      type: 'cafe',
      score: 87,
      scoreTime: 1761000000000,
      nicheness: 0.9,
      quality: 0.8,
      addedBy: 'google-sub-123',
    }));

    const response = await request(createApp()).get('/gem').query({ name: 'places/abc' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: 'places/abc',
      place: {
        name: 'places/abc',
        displayName: 'Mitakihara Cafe',
        latitude: 49.26,
        longitude: -123.25,
        type: 'cafe',
        description: 'Quiet cafe behind the library.',
      },
      addedBy: 'google-sub-123',
      score: 87,
      scoreTime: 1761000000000,
      nicheness: 0.9,
      quality: 0.8,
    });
  });

  // Mocked behavior: GemModel.findOne returns a stored gem with only required fields
  // Input: GET request to /gem?name=places/bare
  // Expected status code: 200
  // Expected behavior: missing optional fields are left out
  // Expected output: { name, place: { name, latitude, longitude } }
  test('Existing gem without optional fields', async () => {
    mockFindOne(Promise.resolve({
      name: 'places/bare',
      place: {
        name: 'places/bare',
        location: { type: 'Point', coordinates: [10, 20] },
      },
    }));

    const response = await request(createApp()).get('/gem').query({ name: 'places/bare' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      name: 'places/bare',
      place: {
        name: 'places/bare',
        latitude: 20,
        longitude: 10,
      },
    });
  });

  // Mocked behavior: GemModel.findOne rejects (e.g. DB unreachable)
  // Input: GET request to /gem?name=places/abc
  // Expected status code: 500
  // Expected behavior: error is logged; no state is changed
  // Expected output: { message: "Get Gem failed." }
  test('Database error', async () => {
    mockFindOne(Promise.reject(new Error('connection refused')));

    const response = await request(createApp()).get('/gem').query({ name: 'places/abc' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Get Gem failed.' });
  });
});

// Interface POST /gem
describe('Mocked: POST /gem', () => {
  // Mocked behavior: none
  // Input: POST request to /gem with no body, an empty body, or a name that is not a `places/<place ID>` string
  // Expected status code: 400
  // Expected behavior: request is rejected; neither the DB nor Google Places is called
  // Expected output: { message: "Invalid place name." }
  test.each([
    ['no body', undefined],
    ['empty body', {}],
    ['malformed name', { name: 'abc' }],
    ['non-string name', { name: 37 }],
    ['query operator as name', { name: { $ne: null } }],
  ])('Invalid name: %s', async (_label, body) => {
    const req = request(createApp()).post('/gem');
    const response = body === undefined ? await req : await req.send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid place name.' });
    expect(mockedGemModel.exists).not.toHaveBeenCalled();
    expect(mockGetPlace).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place; GemModel.create succeeds
  // Input: POST request to /gem with { name: "places/abc", latitude, longitude } at the place
  // Expected status code: 201
  // Expected behavior: the gem is inserted once, with addedBy set and scored; Location points at it
  // Expected output: the new Gem
  test('New gem', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockedGemModel.create.mockResolvedValue({});
    mockGetPlace.mockResolvedValue([{
      name: 'places/abc',
      displayName: { text: 'Mitakihara Cafe' },
      location: { latitude: 49.26, longitude: -123.25 },
      primaryType: 'cafe',
    }]);

    const response = await request(createApp()).post('/gem').send({ name: 'places/abc', ...USER });

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/gem?name=places%2Fabc');
    expect(response.body).toMatchObject({
      name: 'places/abc',
      place: { name: 'places/abc', displayName: 'Mitakihara Cafe', latitude: 49.26, longitude: -123.25, type: 'cafe' },
      score: expect.any(Number),
    });
    expect(mockedGemModel.create).toHaveBeenCalledTimes(1);
    expect(mockedGemModel.create.mock.calls[0][0]).toMatchObject({ name: 'places/abc', type: 'cafe', addedBy: expect.any(String) });
    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds a gem with the same name
  // Input: POST request to /gem with { name: "places/abc", latitude, longitude } at the place
  // Expected status code: 409
  // Expected behavior: Google Places is not called; nothing is written
  // Expected output: { message: "Gem already exists." }
  test('Existing gem', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'existing' });

    const response = await request(createApp()).post('/gem').send({ name: 'places/abc', ...USER });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Gem already exists.' });
    expect(mockGetPlace).not.toHaveBeenCalled();
    expect(mockedGemModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places rejects with NOT_FOUND (5)
  // Input: POST request to /gem with { name: "places/unknown", latitude, longitude }
  // Expected status code: 422
  // Expected behavior: nothing is written
  // Expected output: { message: "Place does not exist." }
  test('Place does not exist', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockRejectedValue(placesError(5));

    const response = await request(createApp()).post('/gem').send({ name: 'places/unknown', ...USER });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: 'Place does not exist.' });
    expect(mockedGemModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places rejects with UNAVAILABLE (14)
  // Input: POST request to /gem with { name: "places/abc", latitude, longitude } at the place
  // Expected status code: 502
  // Expected behavior: error is logged; nothing is written
  // Expected output: { message: "Google Places unavailable." }
  test('Google Places error', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockRejectedValue(placesError(14));

    const response = await request(createApp()).post('/gem').send({ name: 'places/abc', ...USER });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ message: 'Google Places unavailable.' });
    expect(mockedGemModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists rejects (e.g. DB unreachable)
  // Input: POST request to /gem with { name: "places/abc", latitude, longitude } at the place
  // Expected status code: 500
  // Expected behavior: error is logged; Google Places is not called
  // Expected output: { message: "Add Gem failed." }
  test('Database error', async () => {
    mockedGemModel.exists.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).post('/gem').send({ name: 'places/abc', ...USER });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Add Gem failed.' });
    expect(mockGetPlace).not.toHaveBeenCalled();
  });
});

// Interface POST /gem: user location
describe('Mocked: POST /gem location', () => {
  // Mocked behavior: none
  // Input: POST request with a valid name but a missing, non-numeric or out-of-range location
  // Expected status code: 400
  // Expected behavior: neither the DB nor Google Places is called
  // Expected output: { message: "Invalid location." }
  test.each([
    ['missing', {}],
    ['latitude only', { latitude: 49.26 }],
    ['strings', { latitude: 'north', longitude: 'west' }],
    ['out of range', { latitude: 91, longitude: 0 }],
  ])('Invalid location: %s', async (_label, location) => {
    const response = await request(createApp()).post('/gem').send({ name: 'places/abc', ...location });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid location.' });
    expect(mockedGemModel.exists).not.toHaveBeenCalled();
    expect(mockGetPlace).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place at USER
  // Input: POST request from about 1.1 km away (0.01° latitude)
  // Expected status code: 422
  // Expected behavior: nothing is written
  // Expected output: { message: "Too far from place." }
  test('Too far from place', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockResolvedValue([{ name: 'places/abc', location: USER }]);

    const response = await request(createApp()).post('/gem')
      .send({ name: 'places/abc', latitude: USER.latitude + 0.01, longitude: USER.longitude });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ message: 'Too far from place.' });
    expect(mockedGemModel.create).not.toHaveBeenCalled();
  });
});

/** One stored gem document, and its JSON as the API returns it. */
const STORED_DOC = {
  name: 'places/abc',
  place: { name: 'places/abc', displayName: 'Mitakihara Cafe', location: { type: 'Point', coordinates: [-123.25, 49.26] } },
  score: 82.2,
};
const STORED_JSON = {
  name: 'places/abc',
  place: { name: 'places/abc', displayName: 'Mitakihara Cafe', latitude: 49.26, longitude: -123.25 },
  score: 82.2,
  scoreTime: expect.any(Number),
};

/** Makes GemModel.find(...)[.sort(...)].limit(...).lean() resolve or reject with `docs`; returns the chain's mocks. */
function mockFindChain(docs: Promise<unknown>): { sort: jest.Mock; limit: jest.Mock } {
  const chain = { sort: jest.fn(), limit: jest.fn(), lean: () => docs };
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  mockedGemModel.find.mockReturnValue(chain);
  return chain;
}

// Interface GET /gem/nearby
describe('Mocked: GET /gem/nearby', () => {
  // Mocked behavior: GemModel.find returns one gem
  // Input: GET request with lat, lng, radius 1000 and limit 5
  // Expected status code: 200
  // Expected behavior: a $nearSphere query around [lng, lat] within 1000 m, limited to 5
  // Expected output: [Gem]
  test('Gems found', async () => {
    const { limit } = mockFindChain(Promise.resolve([STORED_DOC]));

    const response = await request(createApp()).get('/gem/nearby')
      .query({ lat: '49.26', lng: '-123.25', radius: '1000', limit: '5' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([STORED_JSON]);
    expect(mockedGemModel.find.mock.calls[0][0]['place.location'].$nearSphere).toEqual({
      $geometry: { type: 'Point', coordinates: [-123.25, 49.26] },
      $maxDistance: 1000,
    });
    expect(limit).toHaveBeenCalledWith(5);
  });

  // Mocked behavior: GemModel.find returns nothing
  // Input: GET request with only lat and lng
  // Expected status code: 200
  // Expected behavior: default radius 5000 m and limit 20
  // Expected output: []
  test('Defaults', async () => {
    const { limit } = mockFindChain(Promise.resolve([]));

    const response = await request(createApp()).get('/gem/nearby').query({ lat: '49.26', lng: '-123.25' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mockedGemModel.find.mock.calls[0][0]['place.location'].$nearSphere.$maxDistance).toBe(5000);
    expect(limit).toHaveBeenCalledWith(20);
  });

  // Mocked behavior: none
  // Input: GET requests with a bad location, radius or limit
  // Expected status code: 400
  // Expected behavior: the DB is not queried
  // Expected output: the matching message
  test.each([
    [{ lng: '-123.25' }, 'Invalid location.'],
    [{ lat: '95', lng: '0' }, 'Invalid location.'],
    [{ lat: '49', lng: '-123', radius: '0' }, 'Invalid radius.'],
    [{ lat: '49', lng: '-123', radius: '50001' }, 'Invalid radius.'],
    [{ lat: '49', lng: '-123', limit: '51' }, 'Invalid limit.'],
    [{ lat: '49', lng: '-123', limit: '2.5' }, 'Invalid limit.'],
  ])('Invalid query %p', async (query, message) => {
    const response = await request(createApp()).get('/gem/nearby').query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(mockedGemModel.find).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.find rejects (e.g. DB unreachable)
  // Input: GET request with lat and lng
  // Expected status code: 500
  // Expected output: { message: "Get Gems failed." }
  test('Database error', async () => {
    mockFindChain(Promise.reject(new Error('connection refused')));

    const response = await request(createApp()).get('/gem/nearby').query({ lat: '49.26', lng: '-123.25' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Get Gems failed.' });
  });
});

// Interface GET /gem/within
describe('Mocked: GET /gem/within', () => {
  // Mocked behavior: GemModel.find returns one gem
  // Input: GET request with south, west, north, east
  // Expected status code: 200
  // Expected behavior: a $geoWithin polygon query, best GemScore first, default limit 20
  // Expected output: [Gem]
  test('Gems found', async () => {
    const { sort, limit } = mockFindChain(Promise.resolve([STORED_DOC]));

    const response = await request(createApp()).get('/gem/within')
      .query({ south: '49', west: '-124', north: '50', east: '-123' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([STORED_JSON]);
    expect(mockedGemModel.find.mock.calls[0][0]['place.location'].$geoWithin.$geometry.type).toBe('Polygon');
    expect(sort).toHaveBeenCalledWith({ score: -1, _id: 1 });
    expect(limit).toHaveBeenCalledWith(20);
  });

  // Mocked behavior: none
  // Input: GET requests with missing, inverted or antimeridian-crossing bounds, or a bad limit
  // Expected status code: 400
  // Expected behavior: the DB is not queried
  // Expected output: the matching message
  test.each([
    [{ south: '49', west: '-124', north: '50' }, 'Invalid bounds.'],
    [{ south: '50', west: '-124', north: '49', east: '-123' }, 'Invalid bounds.'],
    [{ south: '-10', west: '170', north: '10', east: '-170' }, 'Invalid bounds.'],
    [{ south: '49', west: '-124', north: '50', east: '-123', limit: '0' }, 'Invalid limit.'],
  ])('Invalid query %p', async (query, message) => {
    const response = await request(createApp()).get('/gem/within').query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(mockedGemModel.find).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.find rejects
  // Input: GET request with valid bounds
  // Expected status code: 500
  // Expected output: { message: "Get Gems failed." }
  test('Database error', async () => {
    mockFindChain(Promise.reject(new Error('connection refused')));

    const response = await request(createApp()).get('/gem/within')
      .query({ south: '49', west: '-124', north: '50', east: '-123' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Get Gems failed.' });
  });
});

// Interface GET /gem/newest
describe('Mocked: GET /gem/newest', () => {
  // Mocked behavior: GemModel.find returns one gem
  // Input: GET request with limit 3
  // Expected status code: 200
  // Expected behavior: all gems sorted newest first, limited to 3
  // Expected output: [Gem]
  test('Gems found', async () => {
    const { sort, limit } = mockFindChain(Promise.resolve([STORED_DOC]));

    const response = await request(createApp()).get('/gem/newest').query({ limit: '3' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([STORED_JSON]);
    expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(limit).toHaveBeenCalledWith(3);
  });

  // Mocked behavior: none
  // Input: GET request with an invalid limit
  // Expected status code: 400
  // Expected output: { message: "Invalid limit." }
  test('Invalid limit', async () => {
    const response = await request(createApp()).get('/gem/newest').query({ limit: 'all' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid limit.' });
    expect(mockedGemModel.find).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.find rejects
  // Input: GET request
  // Expected status code: 500
  // Expected output: { message: "Get Gems failed." }
  test('Database error', async () => {
    mockFindChain(Promise.reject(new Error('connection refused')));

    const response = await request(createApp()).get('/gem/newest');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Get Gems failed.' });
  });
});

// Interface: unsupported methods
describe('Mocked: unsupported methods on gem paths', () => {
  // Mocked behavior: none
  // Input: a method a path doesn't support
  // Expected status code: 405
  // Expected behavior: no state is changed; Allow lists the supported methods
  // Expected output: { message: "Method not allowed." }
  test.each([
    ['delete', '/gem', 'GET, POST'],
    ['put', '/gem', 'GET, POST'],
    ['post', '/gem/nearby', 'GET'],
    ['delete', '/gem/within', 'GET'],
    ['patch', '/gem/newest', 'GET'],
    ['delete', '/gem/abc/comments', 'GET, POST'],
  ] as const)('%s %s', async (method, path, allow) => {
    const response = await request(createApp())[method](path);

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe(allow);
    expect(response.body).toEqual({ message: 'Method not allowed.' });
    expect(mockedGemModel.exists).not.toHaveBeenCalled();
    expect(mockedGemModel.find).not.toHaveBeenCalled();
  });
});
