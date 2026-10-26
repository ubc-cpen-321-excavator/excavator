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

const mockedGemModel = GemModel as unknown as { findOne: jest.Mock };

function mockFindOne(result: unknown): void {
  mockedGemModel.findOne.mockReturnValue({ lean: () => result });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

// Interface GET /gem/get
describe('Mocked: GET /gem/get', () => {
  // Mocked behavior: none
  // Input: GET request to /gem/get with no name
  // Expected status code: 400
  // Expected behavior: request is rejected; DB is not queried
  // Expected output: { message: "Invalid Gem name." }
  test('Missing name', async () => {
    const response = await request(createApp()).get('/gem/get');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem name.' });
    expect(mockedGemModel.findOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.findOne finds no document
  // Input: GET request to /gem/get?name=places/unknown
  // Expected status code: 404
  // Expected behavior: DB is queried by name; no state is changed
  // Expected output: { message: "No such Gem." }
  test('Unknown gem', async () => {
    mockFindOne(Promise.resolve(null));

    const response = await request(createApp()).get('/gem/get').query({ name: 'places/unknown' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
    expect(mockedGemModel.findOne).toHaveBeenCalledWith({ name: 'places/unknown' });
  });

  // Mocked behavior: GemModel.findOne returns a stored gem document with all fields
  // Input: GET request to /gem/get?name=places/abc
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

    const response = await request(createApp()).get('/gem/get').query({ name: 'places/abc' });

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
  // Input: GET request to /gem/get?name=places/bare
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

    const response = await request(createApp()).get('/gem/get').query({ name: 'places/bare' });

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
  // Input: GET request to /gem/get?name=places/abc
  // Expected status code: 500
  // Expected behavior: error is logged; no state is changed
  // Expected output: { message: "Get Gem failed." }
  test('Database error', async () => {
    mockFindOne(Promise.reject(new Error('connection refused')));

    const response = await request(createApp()).get('/gem/get').query({ name: 'places/abc' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Get Gem failed.' });
  });
});
