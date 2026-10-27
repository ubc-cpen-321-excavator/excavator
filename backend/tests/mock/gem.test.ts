import request from 'supertest';

import { createApp } from '../../src/app';
import { GemModel } from '../../src/models/gemModel';

jest.mock('../../src/models/gemModel', () => ({
  GemModel: {
    findOne: jest.fn(),
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
  exists: jest.Mock;
  replaceOne: jest.Mock;
};

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

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place; GemModel.replaceOne succeeds
  // Input: POST request to /gem with { name: "places/abc" }
  // Expected status code: 200
  // Expected behavior: the gem is written once, keyed by name, with addedBy set
  // Expected output: { added: true }
  test('New gem', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockedGemModel.replaceOne.mockResolvedValue({ acknowledged: true });
    mockGetPlace.mockResolvedValue([{
      name: 'places/abc',
      displayName: { text: 'Mitakihara Cafe' },
      location: { latitude: 49.26, longitude: -123.25 },
      primaryType: 'cafe',
    }]);

    const response = await request(createApp()).post('/gem').send({ name: 'places/abc' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ added: true });
    expect(mockedGemModel.replaceOne).toHaveBeenCalledTimes(1);
    const [filter, doc] = mockedGemModel.replaceOne.mock.calls[0];
    expect(filter).toEqual({ name: 'places/abc' });
    expect(doc).toMatchObject({ name: 'places/abc', type: 'cafe', addedBy: expect.any(String) });
  });

  // Mocked behavior: GemModel.exists finds a gem with the same name
  // Input: POST request to /gem with { name: "places/abc" }
  // Expected status code: 200
  // Expected behavior: Google Places is not called; nothing is written
  // Expected output: { added: false }
  test('Existing gem', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'existing' });

    const response = await request(createApp()).post('/gem').send({ name: 'places/abc' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ added: false });
    expect(mockGetPlace).not.toHaveBeenCalled();
    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places rejects with NOT_FOUND (5)
  // Input: POST request to /gem with { name: "places/unknown" }
  // Expected status code: 400
  // Expected behavior: nothing is written
  // Expected output: { message: "Place does not exist." }
  test('Place does not exist', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockRejectedValue(placesError(5));

    const response = await request(createApp()).post('/gem').send({ name: 'places/unknown' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Place does not exist.' });
    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places rejects with UNAVAILABLE (14)
  // Input: POST request to /gem with { name: "places/abc" }
  // Expected status code: 500
  // Expected behavior: error is logged; nothing is written
  // Expected output: { message: "Add Gem failed." }
  test('Google Places error', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockRejectedValue(placesError(14));

    const response = await request(createApp()).post('/gem').send({ name: 'places/abc' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Add Gem failed.' });
    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists rejects (e.g. DB unreachable)
  // Input: POST request to /gem with { name: "places/abc" }
  // Expected status code: 500
  // Expected behavior: error is logged; Google Places is not called
  // Expected output: { message: "Add Gem failed." }
  test('Database error', async () => {
    mockedGemModel.exists.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).post('/gem').send({ name: 'places/abc' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Add Gem failed.' });
    expect(mockGetPlace).not.toHaveBeenCalled();
  });
});
