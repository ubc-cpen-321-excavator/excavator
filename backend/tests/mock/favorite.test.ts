import request from 'supertest';

import { createApp } from '../../src/app';
import { FavoriteModel } from '../../src/models/favoriteModel';
import { GemModel } from '../../src/models/gemModel';
import { UserModel } from '../../src/models/userModel';
import { TEST_USER_DOC, TEST_USER_ID, bearer } from '../helpers/auth';

jest.mock('../../src/models/favoriteModel', () => ({
  FavoriteModel: { find: jest.fn(), exists: jest.fn(), countDocuments: jest.fn(), create: jest.fn(), deleteOne: jest.fn() },
}));
jest.mock('../../src/models/gemModel', () => ({
  GemModel: { findOne: jest.fn(), find: jest.fn(), exists: jest.fn(), create: jest.fn(), updateOne: jest.fn() },
}));
// The login check (AuthService.reqJwt) looks the signed-in user up.
jest.mock('../../src/models/userModel', () => ({
  UserModel: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() },
}));
// The app builds a PlacesClient at load; favorites never call Google.
jest.mock('@googlemaps/places', () => ({
  PlacesClient: jest.fn().mockImplementation(() => ({ getPlace: jest.fn() })),
}));

const mockedFavoriteModel = FavoriteModel as unknown as {
  find: jest.Mock; exists: jest.Mock; countDocuments: jest.Mock; create: jest.Mock; deleteOne: jest.Mock;
};
const mockedGemModel = GemModel as unknown as { find: jest.Mock; exists: jest.Mock };

/** A stored Gem document named `places/<id>`. */
function gemDoc(id: string): object {
  const name = `places/${id}`;
  return { name, place: { name, displayName: id, location: { type: 'Point', coordinates: [-123.25, 49.26] } } };
}

/** Makes `FavoriteModel.find(...).sort(...).limit(...).lean()` resolve or reject with `docs`. */
function mockFavorites(docs: Promise<unknown>): void {
  const chain = { sort: () => chain, limit: () => chain, lean: () => docs };
  mockedFavoriteModel.find.mockReturnValue(chain);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  (UserModel as unknown as { findOne: jest.Mock }).findOne.mockReturnValue({ lean: () => Promise.resolve(TEST_USER_DOC) });
});

// Interface GET /user/favorites
describe('Mocked: GET /user/favorites', () => {
  // Mocked behavior: the user has two favorites, newest first; GemModel.find returns both Gems (in another order)
  // Input: GET /user/favorites signed in
  // Expected status code: 200
  // Expected behavior: only the signed-in user's favorites are read; their Gems loaded in one query
  // Expected output: [Gem, Gem] in favorite order (newest first)
  test('User with favorites', async () => {
    mockFavorites(Promise.resolve([{ user: TEST_USER_ID, gem: 'places/new' }, { user: TEST_USER_ID, gem: 'places/old' }]));
    mockedGemModel.find.mockReturnValue({ lean: () => Promise.resolve([gemDoc('old'), gemDoc('new')]) });

    const response = await request(createApp()).get('/user/favorites').set('Authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body.map((g: { name: string }) => g.name)).toEqual(['places/new', 'places/old']);
    expect(mockedFavoriteModel.find).toHaveBeenCalledWith({ user: TEST_USER_ID });
  });

  // Mocked behavior: the user has no favorites
  // Input: GET /user/favorites signed in
  // Expected status code: 200
  // Expected behavior: Gems are not queried
  // Expected output: []
  test('No favorites', async () => {
    mockFavorites(Promise.resolve([]));

    const response = await request(createApp()).get('/user/favorites').set('Authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mockedGemModel.find).not.toHaveBeenCalled();
  });

  // Mocked behavior: none
  // Input: GET /user/favorites without a token
  // Expected status code: 401
  // Expected behavior: no favorites are read
  // Expected output: { message: "Unauthorized request." }
  test('Not signed in', async () => {
    const response = await request(createApp()).get('/user/favorites');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized request.' });
    expect(mockedFavoriteModel.find).not.toHaveBeenCalled();
  });

  // Mocked behavior: FavoriteModel.find rejects (e.g. DB unreachable)
  // Input: GET /user/favorites signed in
  // Expected status code: 500
  // Expected output: { message: "Get favorites failed." }
  test('Database error', async () => {
    mockFavorites(Promise.reject(new Error('connection refused')));

    const response = await request(createApp()).get('/user/favorites').set('Authorization', bearer());

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Get favorites failed.' });
  });
});

// Interface POST /user/favorites
describe('Mocked: POST /user/favorites', () => {
  // Mocked behavior: the Gem exists; it isn't a favorite yet; the user has none; FavoriteModel.create succeeds
  // Input: POST { gem: "places/abc" } signed in
  // Expected status code: 201
  // Expected behavior: one favorite stored for the signed-in user
  // Expected output: { gem: "places/abc" }
  test('New favorite', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedFavoriteModel.exists.mockResolvedValue(null);
    mockedFavoriteModel.countDocuments.mockResolvedValue(0);
    mockedFavoriteModel.create.mockResolvedValue({});

    const response = await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/abc' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ gem: 'places/abc' });
    expect(mockedFavoriteModel.create).toHaveBeenCalledWith({ user: TEST_USER_ID, gem: 'places/abc' });
  });

  // Mocked behavior: the Gem exists and is already a favorite
  // Input: POST { gem: "places/abc" } signed in
  // Expected status code: 200
  // Expected behavior: nothing is stored
  // Expected output: { gem: "places/abc" }
  test('Already a favorite', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedFavoriteModel.exists.mockResolvedValue({ _id: 'fav' });

    const response = await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/abc' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ gem: 'places/abc' });
    expect(mockedFavoriteModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: none
  // Input: POST with no body, or a gem that is not places/<place ID>
  // Expected status code: 400
  // Expected behavior: nothing is read or stored
  // Expected output: { message: "Invalid Gem name." }
  test.each([['no body', undefined], ['malformed', { gem: 'abc' }], ['not a string', { gem: 37 }]])('Invalid gem: %s', async (_label, body) => {
    const req = request(createApp()).post('/user/favorites').set('Authorization', bearer());
    const response = body === undefined ? await req : await req.send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem name.' });
    expect(mockedGemModel.exists).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem does not exist
  // Input: POST { gem: "places/unknown" } signed in
  // Expected status code: 404
  // Expected behavior: nothing is stored
  // Expected output: { message: "No such Gem." }
  test('No such Gem', async () => {
    mockedGemModel.exists.mockResolvedValue(null);

    const response = await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/unknown' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
    expect(mockedFavoriteModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem exists; not a favorite yet; the user already has 500 favorites
  // Input: POST { gem: "places/abc" } signed in
  // Expected status code: 409
  // Expected behavior: nothing is stored
  // Expected output: { message: "Too many favorites." }
  test('Too many favorites', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedFavoriteModel.exists.mockResolvedValue(null);
    mockedFavoriteModel.countDocuments.mockResolvedValue(500);

    const response = await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/abc' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: 'Too many favorites.' });
    expect(mockedFavoriteModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem exists; FavoriteModel.exists rejects (e.g. DB unreachable)
  // Input: POST { gem: "places/abc" } signed in
  // Expected status code: 500
  // Expected output: { message: "Add favorite failed." }
  test('Database error', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedFavoriteModel.exists.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).post('/user/favorites').set('Authorization', bearer()).send({ gem: 'places/abc' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Add favorite failed.' });
  });
});

// Interface DELETE /user/favorites/:placeId
describe('Mocked: DELETE /user/favorites/:placeId', () => {
  // Mocked behavior: FavoriteModel.deleteOne deletes one
  // Input: DELETE /user/favorites/abc signed in
  // Expected status code: 204
  // Expected behavior: the signed-in user's favorite of places/abc is deleted
  // Expected output: no body
  test('Removed', async () => {
    mockedFavoriteModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const response = await request(createApp()).delete('/user/favorites/abc').set('Authorization', bearer());

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(mockedFavoriteModel.deleteOne).toHaveBeenCalledWith({ user: TEST_USER_ID, gem: 'places/abc' });
  });

  // Mocked behavior: FavoriteModel.deleteOne deletes nothing
  // Input: DELETE /user/favorites/abc signed in, not a favorite
  // Expected status code: 404
  // Expected output: { message: "Not a favorite." }
  test('Not a favorite', async () => {
    mockedFavoriteModel.deleteOne.mockResolvedValue({ deletedCount: 0 });

    const response = await request(createApp()).delete('/user/favorites/abc').set('Authorization', bearer());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Not a favorite.' });
  });

  // Mocked behavior: none
  // Input: DELETE with a placeId that is not a place ID
  // Expected status code: 400
  // Expected behavior: nothing is deleted
  // Expected output: { message: "Invalid Gem ID." }
  test('Invalid placeId', async () => {
    const response = await request(createApp()).delete('/user/favorites/a.b').set('Authorization', bearer());

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem ID.' });
    expect(mockedFavoriteModel.deleteOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: FavoriteModel.deleteOne rejects (e.g. DB unreachable)
  // Input: DELETE /user/favorites/abc signed in
  // Expected status code: 500
  // Expected output: { message: "Remove favorite failed." }
  test('Database error', async () => {
    mockedFavoriteModel.deleteOne.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).delete('/user/favorites/abc').set('Authorization', bearer());

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Remove favorite failed.' });
  });

  // Mocked behavior: none
  // Input: methods the favorites paths don't support, signed in
  // Expected status code: 405
  // Expected output: Allow lists the supported methods
  test.each([
    ['put', '/user/favorites', 'GET, POST'],
    ['get', '/user/favorites/abc', 'DELETE'],
  ] as const)('%s %s not allowed', async (method, path, allow) => {
    const response = await request(createApp())[method](path).set('Authorization', bearer());

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe(allow);
  });
});
