import request from 'supertest';

import { createApp } from '../../src/app';
import { feedService } from '../../src/controllers/feedController';
import { GemModel } from '../../src/models/gemModel';
import { RatingModel } from '../../src/models/ratingModel';
import { UserModel } from '../../src/models/userModel';
import { computeGemScore } from '../../src/utils/gemScore';
import { TEST_USER_DOC, TEST_USER_ID, bearer } from '../helpers/auth';

jest.mock('../../src/models/ratingModel', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../src/models/ratingModel'),
  RatingModel: { updateOne: jest.fn(), findOne: jest.fn(), aggregate: jest.fn() },
}));
jest.mock('../../src/models/gemModel', () => ({
  GemModel: { findOne: jest.fn(), find: jest.fn(), exists: jest.fn(), create: jest.fn(), updateOne: jest.fn() },
}));
// The login check (AuthService.reqJwt) looks the signed-in user up.
jest.mock('../../src/models/userModel', () => ({
  UserModel: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() },
}));
// The app builds a PlacesClient at load; ratings never call Google.
jest.mock('@googlemaps/places', () => ({
  PlacesClient: jest.fn().mockImplementation(() => ({ getPlace: jest.fn() })),
}));

const mockedRatingModel = RatingModel as unknown as { updateOne: jest.Mock; findOne: jest.Mock; aggregate: jest.Mock };
const mockedGemModel = GemModel as unknown as { findOne: jest.Mock; exists: jest.Mock; updateOne: jest.Mock };

/** The stored Gem the tests rate: 20 Google reviews at 4.0. */
const STORED = {
  name: 'places/abc',
  place: { name: 'places/abc', displayName: 'Mitakihara Cafe', location: { type: 'Point', coordinates: [-123.25, 49.26] } },
  quality: 4.0,
  reviewCount: 20,
};

/** The Gem exists, and the rating store and Gem update succeed with these totals. */
function mockRatingFlow(count: number, average: number): void {
  mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
  mockedGemModel.findOne.mockReturnValue({ lean: () => Promise.resolve(STORED) });
  mockedGemModel.updateOne.mockResolvedValue({ acknowledged: true });
  mockedRatingModel.updateOne.mockResolvedValue({ acknowledged: true });
  mockedRatingModel.aggregate.mockResolvedValue([{ _id: null, count, average }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  (UserModel as unknown as { findOne: jest.Mock }).findOne.mockReturnValue({ lean: () => Promise.resolve(TEST_USER_DOC) });
});

// Interface PUT /gem/:pk/rating
describe('Mocked: PUT /gem/:pk/rating', () => {
  // Mocked behavior: the Gem exists; the rating is stored; the Gem now has 2 ratings averaging 4.5
  // Input: PUT /gem/abc/rating { stars: 5 } signed in
  // Expected status code: 200
  // Expected behavior: the rating is upserted for (places/abc, signed-in user); the Gem's totals and new GemScore
  //                    are stored; the updated Gem is pushed to the live feed as gem.updated
  // Expected output: { stars: 5, gem } with ratingCount 2, ratingAverage 4.5 and the recomputed score
  test('Rate a Gem', async () => {
    mockRatingFlow(2, 4.5);
    const publish = jest.spyOn(feedService, 'publishGemUpdated');
    const expected = computeGemScore({ rating: 4.0, reviewCount: 20, appRating: 4.5, appRatingCount: 2 });

    const response = await request(createApp()).put('/gem/abc/rating').set('Authorization', bearer()).send({ stars: 5 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ stars: 5, gem: { name: 'places/abc', ratingCount: 2, ratingAverage: 4.5, score: expected.score } });
    expect(mockedRatingModel.updateOne).toHaveBeenCalledWith(
      { gem: 'places/abc', user: TEST_USER_ID }, { $set: { stars: 5 } }, { upsert: true },
    );
    expect(mockedGemModel.updateOne.mock.calls[0][1].$set).toMatchObject({ ratingCount: 2, ratingAverage: 4.5, score: expected.score });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({ name: 'places/abc' }));
  });

  // Mocked behavior: none
  // Input: PUT with missing, fractional, out-of-range or string stars, signed in
  // Expected status code: 400
  // Expected behavior: nothing is read or stored
  // Expected output: { message: "Invalid stars." }
  test.each([[{}], [{ stars: 0 }], [{ stars: 6 }], [{ stars: 3.5 }], [{ stars: '4' }]])('Invalid stars %p', async (body) => {
    const response = await request(createApp()).put('/gem/abc/rating').set('Authorization', bearer()).send(body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid stars.' });
    expect(mockedRatingModel.updateOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: none
  // Input: PUT /gem/a.b/rating
  // Expected status code: 400
  // Expected output: { message: "Invalid Gem ID." }
  test('Invalid pk', async () => {
    const response = await request(createApp()).put('/gem/a.b/rating').set('Authorization', bearer()).send({ stars: 4 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem ID.' });
  });

  // Mocked behavior: none
  // Input: PUT /gem/abc/rating without a token
  // Expected status code: 401
  // Expected behavior: nothing is stored
  // Expected output: { message: "Unauthorized request." }
  test('Not signed in', async () => {
    const response = await request(createApp()).put('/gem/abc/rating').send({ stars: 4 });

    expect(response.status).toBe(401);
    expect(mockedRatingModel.updateOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem does not exist
  // Input: PUT /gem/unknown/rating { stars: 4 } signed in
  // Expected status code: 404
  // Expected behavior: nothing is stored
  // Expected output: { message: "No such Gem." }
  test('No such Gem', async () => {
    mockedGemModel.exists.mockResolvedValue(null);

    const response = await request(createApp()).put('/gem/unknown/rating').set('Authorization', bearer()).send({ stars: 4 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
    expect(mockedRatingModel.updateOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: the rating flow succeeds; feedService.publishGemUpdated throws
  // Input: PUT /gem/abc/rating { stars: 4 } signed in
  // Expected status code: 200
  // Expected behavior: the feed failure is logged; the rating is still stored and returned
  // Expected output: { stars: 4, gem }
  test('Feed failure does not fail the rating', async () => {
    mockRatingFlow(1, 4);
    jest.spyOn(feedService, 'publishGemUpdated').mockImplementation(() => { throw new Error('feed down'); });

    const response = await request(createApp()).put('/gem/abc/rating').set('Authorization', bearer()).send({ stars: 4 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ stars: 4 });
  });

  // Mocked behavior: the Gem exists; RatingModel.updateOne rejects (e.g. DB unreachable)
  // Input: PUT /gem/abc/rating { stars: 4 } signed in
  // Expected status code: 500
  // Expected output: { message: "Rate Gem failed." }
  test('Database error', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedRatingModel.updateOne.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).put('/gem/abc/rating').set('Authorization', bearer()).send({ stars: 4 });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Rate Gem failed.' });
  });
});

// Interface GET /gem/:pk/rating
describe('Mocked: GET /gem/:pk/rating', () => {
  // Mocked behavior: the Gem exists; the user rated it 4
  // Input: GET /gem/abc/rating signed in
  // Expected status code: 200
  // Expected output: { stars: 4 }
  test('Rated', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedRatingModel.findOne.mockReturnValue({ lean: () => Promise.resolve({ stars: 4 }) });

    const response = await request(createApp()).get('/gem/abc/rating').set('Authorization', bearer());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ stars: 4 });
    expect(mockedRatingModel.findOne).toHaveBeenCalledWith({ gem: 'places/abc', user: TEST_USER_ID });
  });

  // Mocked behavior: the Gem exists; the user hasn't rated it
  // Input: GET /gem/abc/rating signed in
  // Expected status code: 404
  // Expected output: { message: "No rating." }
  test('Not rated', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedRatingModel.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    const response = await request(createApp()).get('/gem/abc/rating').set('Authorization', bearer());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No rating.' });
  });

  // Mocked behavior: the Gem does not exist
  // Input: GET /gem/unknown/rating signed in
  // Expected status code: 404
  // Expected output: { message: "No such Gem." }
  test('No such Gem', async () => {
    mockedGemModel.exists.mockResolvedValue(null);

    const response = await request(createApp()).get('/gem/unknown/rating').set('Authorization', bearer());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
  });

  // Mocked behavior: none
  // Input: GET /gem/a.b/rating signed in
  // Expected status code: 400
  // Expected output: { message: "Invalid Gem ID." }
  test('Invalid pk', async () => {
    const response = await request(createApp()).get('/gem/a.b/rating').set('Authorization', bearer());

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem ID.' });
  });

  // Mocked behavior: the Gem exists; RatingModel.findOne rejects (e.g. DB unreachable)
  // Input: GET /gem/abc/rating signed in
  // Expected status code: 500
  // Expected output: { message: "Get rating failed." }
  test('Database error', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedRatingModel.findOne.mockReturnValue({ lean: () => Promise.reject(new Error('connection refused')) });

    const response = await request(createApp()).get('/gem/abc/rating').set('Authorization', bearer());

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Get rating failed.' });
  });

  // Mocked behavior: none
  // Input: DELETE /gem/abc/rating signed in
  // Expected status code: 405
  // Expected output: Allow is "GET, PUT"
  test('Unsupported method', async () => {
    const response = await request(createApp()).delete('/gem/abc/rating').set('Authorization', bearer());

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('GET, PUT');
  });
});
