import request from 'supertest';

import { createApp } from '../../src/app';
import { CommentModel } from '../../src/models/commentModel';
import { GemModel } from '../../src/models/gemModel';

jest.mock('../../src/models/commentModel', () => ({
  ...jest.requireActual('../../src/models/commentModel'),
  CommentModel: {
    create: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('../../src/models/gemModel', () => ({
  GemModel: {
    findOne: jest.fn(),
    exists: jest.fn(),
    replaceOne: jest.fn(),
    create: jest.fn(),
  },
}));

// The app builds a PlacesClient at load; comments never call Google.
jest.mock('@googlemaps/places', () => ({
  PlacesClient: jest.fn().mockImplementation(() => ({ getPlace: jest.fn() })),
}));

const mockedCommentModel = CommentModel as unknown as { create: jest.Mock; find: jest.Mock };
const mockedGemModel = GemModel as unknown as { exists: jest.Mock };

/** Makes `CommentModel.find(...).sort(...).lean()` resolve or reject with `docs`. */
function mockFind(docs: Promise<unknown>): void {
  mockedCommentModel.find.mockReturnValue({ sort: () => ({ lean: () => docs }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

// Interface GET /gem/:pk/comments
describe('Mocked: GET /gem/:pk/comments', () => {
  // Mocked behavior: the Gem exists; CommentModel.find returns two comments
  // Input: GET request to /gem/abc/comments
  // Expected status code: 200
  // Expected behavior: the Gem is looked up as places/abc; only its comments are read
  // Expected output: [{ id, body }, ...], oldest first, without the Gem name
  test('Gem with comments', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockFind(Promise.resolve([
      { gem: 'places/abc', commentId: 'c1', body: 'first' },
      { gem: 'places/abc', commentId: 'c2', body: 'second' },
    ]));

    const response = await request(createApp()).get('/gem/abc/comments');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'c1', body: 'first' }, { id: 'c2', body: 'second' }]);
    expect(mockedGemModel.exists).toHaveBeenCalledWith({ name: 'places/abc' });
    expect(mockedCommentModel.find).toHaveBeenCalledWith({ gem: 'places/abc' });
  });

  // Mocked behavior: the Gem exists; CommentModel.find returns nothing
  // Input: GET request to /gem/abc/comments
  // Expected status code: 200
  // Expected behavior: no state is changed
  // Expected output: []
  test('Gem without comments', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockFind(Promise.resolve([]));

    const response = await request(createApp()).get('/gem/abc/comments');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  // Mocked behavior: the Gem does not exist
  // Input: GET request to /gem/unknown/comments
  // Expected status code: 404
  // Expected behavior: comments are not read
  // Expected output: { message: "No such Gem." }
  test('No such Gem', async () => {
    mockedGemModel.exists.mockResolvedValue(null);

    const response = await request(createApp()).get('/gem/unknown/comments');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
    expect(mockedCommentModel.find).not.toHaveBeenCalled();
  });

  // Mocked behavior: none
  // Input: GET request whose pk is not a place ID (contains a space, a dot, or an encoded slash)
  // Expected status code: 400
  // Expected behavior: the DB is not queried
  // Expected output: { message: "Invalid Gem ID." }
  test.each(['a%20b', 'a.b', 'places%2Fabc'])('Invalid pk: %s', async (pk) => {
    const response = await request(createApp()).get(`/gem/${pk}/comments`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem ID.' });
    expect(mockedGemModel.exists).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem exists; CommentModel.find rejects (e.g. DB unreachable)
  // Input: GET request to /gem/abc/comments
  // Expected status code: 500
  // Expected behavior: error is logged
  // Expected output: { message: "Get comments failed." }
  test('Database error', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockFind(Promise.reject(new Error('connection refused')));

    const response = await request(createApp()).get('/gem/abc/comments');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Get comments failed.' });
  });
});

// Interface POST /gem/:pk/comments
describe('Mocked: POST /gem/:pk/comments', () => {
  // Mocked behavior: the Gem exists; CommentModel.create succeeds
  // Input: POST request to /gem/abc/comments with { body: "  Great view!  " }
  // Expected status code: 201
  // Expected behavior: one comment is stored under places/abc with a new ID and the trimmed body
  // Expected output: { id, body: "Great view!" }
  test('Valid comment', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedCommentModel.create.mockResolvedValue({});

    const response = await request(createApp()).post('/gem/abc/comments').send({ body: '  Great view!  ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), body: 'Great view!' });
    expect(mockedCommentModel.create).toHaveBeenCalledWith({
      gem: 'places/abc',
      commentId: response.body.id,
      body: 'Great view!',
    });
  });

  // Mocked behavior: none
  // Input: POST request with no body, an empty body, or a comment body that is not a valid string
  // Expected status code: 400
  // Expected behavior: the DB is not touched
  // Expected output: { message: "Invalid comment body." }
  test.each([
    ['no body', undefined],
    ['empty body', {}],
    ['non-string body', { body: 37 }],
    ['blank body', { body: '   ' }],
    ['too long', { body: 'a'.repeat(1001) }],
  ])('Invalid body: %s', async (_label, payload) => {
    const req = request(createApp()).post('/gem/abc/comments');
    const response = payload === undefined ? await req : await req.send(payload);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid comment body.' });
    expect(mockedGemModel.exists).not.toHaveBeenCalled();
    expect(mockedCommentModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: none
  // Input: POST request whose pk is not a place ID
  // Expected status code: 400
  // Expected behavior: the DB is not touched
  // Expected output: { message: "Invalid Gem ID." }
  test('Invalid pk', async () => {
    const response = await request(createApp()).post('/gem/a.b/comments').send({ body: 'hello' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid Gem ID.' });
    expect(mockedCommentModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem does not exist
  // Input: POST request to /gem/unknown/comments with a valid body
  // Expected status code: 404
  // Expected behavior: nothing is stored
  // Expected output: { message: "No such Gem." }
  test('No such Gem', async () => {
    mockedGemModel.exists.mockResolvedValue(null);

    const response = await request(createApp()).post('/gem/unknown/comments').send({ body: 'hello' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'No such Gem.' });
    expect(mockedCommentModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem exists; CommentModel.create rejects (e.g. DB unreachable)
  // Input: POST request to /gem/abc/comments with a valid body
  // Expected status code: 500
  // Expected behavior: error is logged
  // Expected output: { message: "Add comment failed." }
  test('Database error', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedCommentModel.create.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).post('/gem/abc/comments').send({ body: 'hello' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Add comment failed.' });
  });
});
