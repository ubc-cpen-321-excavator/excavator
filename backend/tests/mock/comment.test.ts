import request from 'supertest';

import { createApp } from '../../src/app';
import { CommentModel } from '../../src/models/commentModel';
import { GemModel } from '../../src/models/gemModel';
import { UserModel } from '../../src/models/userModel';
import { TEST_USER_DOC, bearer } from '../helpers/auth';

// The login check (AuthService.reqJwt) looks the signed-in user up.
jest.mock('../../src/models/userModel', () => ({
  UserModel: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() },
}));

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
  (UserModel as unknown as { findOne: jest.Mock }).findOne.mockReturnValue({ lean: () => Promise.resolve(TEST_USER_DOC) });
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

// Interface GET /gem/:pk/comments
describe('Mocked: GET /gem/:pk/comments', () => {
  // Mocked behavior: the Gem exists; CommentModel.find returns two comments
  // Input: GET request to /gem/abc/comments
  // Expected status code: 200
  // Expected behavior: the Gem is looked up as places/abc; only its comments are read
  // Expected output: [{ id, body, author?, authorName? }, ...], oldest first, without the Gem name; no login needed
  test('Gem with comments', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockFind(Promise.resolve([
      { gem: 'places/abc', commentId: 'c1', body: 'first' },
      { gem: 'places/abc', commentId: 'c2', body: 'second', author: 'google-sub-9', authorName: 'kyoko' },
    ]));

    const response = await request(createApp()).get('/gem/abc/comments');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 'c1', body: 'first' },
      { id: 'c2', body: 'second', author: 'google-sub-9', authorName: 'kyoko' },
    ]);
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

  // Mocked behavior: GemModel.exists rejects (e.g. DB unreachable) while checking the Gem
  // Input: GET request to /gem/abc/comments
  // Expected status code: 500, not 404
  // Expected behavior: error is logged; comments are not read
  // Expected output: { message: "Get comments failed." }
  test('Database error while checking the Gem', async () => {
    mockedGemModel.exists.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).get('/gem/abc/comments');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Get comments failed.' });
    expect(mockedCommentModel.find).not.toHaveBeenCalled();
  });
});

// Interface POST /gem/:pk/comments
describe('Mocked: POST /gem/:pk/comments', () => {
  // Mocked behavior: the Gem exists; CommentModel.create succeeds
  // Input: POST request to /gem/abc/comments with { body: "  Great view!  " }
  // Expected status code: 201
  // Expected behavior: one comment is stored under places/abc with a new ID, the trimmed body, and the signed-in
  //                    user as author (with their display name)
  // Expected output: { id, body: "Great view!", author, authorName }
  test('Valid comment', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'gem' });
    mockedCommentModel.create.mockResolvedValue({});

    const response = await request(createApp()).post('/gem/abc/comments').set('Authorization', bearer()).send({ body: '  Great view!  ' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: expect.any(String), body: 'Great view!', author: TEST_USER_DOC.googleId, authorName: 'mermaid' });
    expect(mockedCommentModel.create).toHaveBeenCalledWith({
      gem: 'places/abc',
      commentId: response.body.id,
      body: 'Great view!',
      author: TEST_USER_DOC.googleId,
      authorName: 'mermaid',
    });
  });

  // Mocked behavior: none
  // Input: POST request to /gem/abc/comments with a valid body but no Authorization header
  // Expected status code: 401
  // Expected behavior: nothing is read or stored
  // Expected output: { message: "Unauthorized request." }
  test('Not signed in', async () => {
    const response = await request(createApp()).post('/gem/abc/comments').send({ body: 'hello' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Unauthorized request.' });
    expect(mockedGemModel.exists).not.toHaveBeenCalled();
    expect(mockedCommentModel.create).not.toHaveBeenCalled();
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
    ['control character', { body: 'bell\u0007' }],
  ])('Invalid body: %s', async (_label, payload) => {
    const req = request(createApp()).post('/gem/abc/comments').set('Authorization', bearer());
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
    const response = await request(createApp()).post('/gem/a.b/comments').set('Authorization', bearer()).send({ body: 'hello' });

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

    const response = await request(createApp()).post('/gem/unknown/comments').set('Authorization', bearer()).send({ body: 'hello' });

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

    const response = await request(createApp()).post('/gem/abc/comments').set('Authorization', bearer()).send({ body: 'hello' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Add comment failed.' });
  });

  // Mocked behavior: GemModel.exists rejects (e.g. DB unreachable) while checking the Gem
  // Input: POST request to /gem/abc/comments with a valid body
  // Expected status code: 500, not 404
  // Expected behavior: error is logged; nothing is stored
  // Expected output: { message: "Add comment failed." }
  test('Database error while checking the Gem', async () => {
    mockedGemModel.exists.mockRejectedValue(new Error('connection refused'));

    const response = await request(createApp()).post('/gem/abc/comments').set('Authorization', bearer()).send({ body: 'hello' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Add comment failed.' });
    expect(mockedCommentModel.create).not.toHaveBeenCalled();
  });
});
