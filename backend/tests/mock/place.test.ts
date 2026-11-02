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
const mockSearchNearby = jest.fn();
jest.mock('@googlemaps/places', () => ({
  PlacesClient: jest.fn().mockImplementation(() => ({
    getPlace: jest.fn(),
    searchNearby: (...args: unknown[]) => mockSearchNearby(...args),
  })),
}));

const mockedGemModel = GemModel as unknown as { find: jest.Mock };

/** A Google Places error, as thrown by the Places client. */
function placesError(code: number): Error & { code: number } {
  return Object.assign(new Error(`places error ${code}`), { code });
}

const USER = { lat: '49.26', lng: '-123.25' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

// Interface GET /place/nearby
describe('Mocked: GET /place/nearby', () => {
  // Mocked behavior: Google returns two places; one is already a gem
  // Input: GET request with the user's lat, lng and type "cafe"
  // Expected status code: 200
  // Expected behavior: Google is searched around the user, limited to the type
  // Expected output: both places, nearest first, with name, displayName, type, address, location, distance and isGem
  test('Places found', async () => {
    mockSearchNearby.mockResolvedValue([{
      places: [
        { name: 'places/a', displayName: { text: 'Cafe A' }, location: { latitude: 49.26, longitude: -123.25 }, primaryType: 'cafe', formattedAddress: '1 Main St' },
        { name: 'places/b', displayName: { text: 'Cafe B' }, location: { latitude: 49.261, longitude: -123.25 }, primaryType: 'cafe' },
      ],
    }]);
    mockedGemModel.find.mockReturnValue({ lean: () => Promise.resolve([{ name: 'places/b' }]) });

    const response = await request(createApp()).get('/place/nearby').query({ ...USER, type: 'cafe' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { name: 'places/a', displayName: 'Cafe A', type: 'cafe', address: '1 Main St', latitude: 49.26, longitude: -123.25, distance: 0, isGem: false },
      { name: 'places/b', displayName: 'Cafe B', type: 'cafe', latitude: 49.261, longitude: -123.25, distance: 111, isGem: true },
    ]);
    const req = mockSearchNearby.mock.calls[0][0];
    expect(req.locationRestriction.circle.center).toEqual({ latitude: 49.26, longitude: -123.25 });
    expect(req.includedTypes).toEqual(['cafe']);
  });

  // Mocked behavior: Google returns no places
  // Input: GET request with the user's lat and lng
  // Expected status code: 200
  // Expected output: []
  test('No places', async () => {
    mockSearchNearby.mockResolvedValue([{ places: [] }]);

    const response = await request(createApp()).get('/place/nearby').query(USER);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // Mocked behavior: none
  // Input: GET requests with a missing or out-of-range location, or a malformed type
  // Expected status code: 400
  // Expected behavior: Google is not called
  // Expected output: the matching message
  test.each([
    [{ lat: '49.26' }, 'Invalid location.'],
    [{ lat: '49.26', lng: '200' }, 'Invalid location.'],
    [{ ...USER, type: 'Cafe!' }, 'Invalid place type.'],
  ])('Invalid query %p', async (query, message) => {
    const response = await request(createApp()).get('/place/nearby').query(query);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message });
    expect(mockSearchNearby).not.toHaveBeenCalled();
  });

  // Mocked behavior: Google rejects with INVALID_ARGUMENT (3), as for an unknown type
  // Input: GET request with a well-formed but unknown type
  // Expected status code: 400
  // Expected output: { message: "Invalid place type." }
  test('Unknown type', async () => {
    mockSearchNearby.mockRejectedValue(placesError(3));

    const response = await request(createApp()).get('/place/nearby').query({ ...USER, type: 'not_a_type' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid place type.' });
  });

  // Mocked behavior: Google rejects with UNAVAILABLE (14)
  // Input: GET request with the user's lat and lng
  // Expected status code: 502
  // Expected behavior: error is logged
  // Expected output: { message: "Google Places unavailable." }
  test('Google Places error', async () => {
    mockSearchNearby.mockRejectedValue(placesError(14));

    const response = await request(createApp()).get('/place/nearby').query(USER);

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ message: 'Google Places unavailable.' });
  });

  // Mocked behavior: Google returns places; GemModel.find rejects (e.g. DB unreachable)
  // Input: GET request with the user's lat and lng
  // Expected status code: 500
  // Expected behavior: error is logged
  // Expected output: { message: "Nearby search failed." }
  test('Database error', async () => {
    mockSearchNearby.mockResolvedValue([{ places: [{ name: 'places/a', location: { latitude: 49.26, longitude: -123.25 } }] }]);
    mockedGemModel.find.mockReturnValue({ lean: () => Promise.reject(new Error('connection refused')) });

    const response = await request(createApp()).get('/place/nearby').query(USER);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Nearby search failed.' });
  });

  // Mocked behavior: none
  // Input: POST request to /place/nearby
  // Expected status code: 405
  // Expected behavior: Google is not called; Allow is GET
  // Expected output: { message: "Method not allowed." }
  test('Unsupported method', async () => {
    const response = await request(createApp()).post('/place/nearby').send({});

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('GET');
    expect(mockSearchNearby).not.toHaveBeenCalled();
  });
});
