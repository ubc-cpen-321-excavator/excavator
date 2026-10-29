import CommentService, { InvalidCommentError, NoSuchGemError, isValidCommentBody } from '../../src/services/commentService';
import type GemService from '../../src/services/gemService';
import { CommentModel } from '../../src/models/commentModel';

jest.mock('../../src/models/commentModel', () => ({
  ...jest.requireActual('../../src/models/commentModel'),
  CommentModel: {
    create: jest.fn(),
    find: jest.fn(),
  },
}));

const mockedCommentModel = CommentModel as unknown as {
  create: jest.Mock;
  find: jest.Mock;
};

/** Makes `CommentModel.find(...).sort(...).lean()` resolve to `docs`; returns the `sort` mock. */
function mockFind(docs: Promise<unknown>): jest.Mock {
  const sort = jest.fn().mockReturnValue({ lean: () => docs });
  mockedCommentModel.find.mockReturnValue({ sort });
  return sort;
}

/** A CommentService whose Gem service says the Gem does (or does not) exist. */
function serviceWithGem(exists: boolean): { service: CommentService; hasGem: jest.Mock } {
  const hasGem = jest.fn().mockResolvedValue(exists);
  return { service: new CommentService({ hasGem } as unknown as GemService), hasGem };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface isValidCommentBody
describe('isValidCommentBody', () => {
  // Input: bodies of 1–1000 characters after trimming, incl. newlines, tabs, non-ASCII and emoji
  // Expected output: true
  test.each(['Great view!', '  padded  ', 'x', 'a'.repeat(1000), 'line one\nline two', 'tab\there', '景色がいい 💎'])('Valid: %p', (body) => {
    expect(isValidCommentBody(body)).toBe(true);
  });

  // Input: non-strings, empty or whitespace-only, too long, or with other control characters
  // Expected output: false
  test.each([undefined, null, 37, {}, ['hi'], '', '  \n\t ', 'a'.repeat(1001), 'bell\u0007', 'nul\u0000'])('Invalid: %p', (body) => {
    expect(isValidCommentBody(body)).toBe(false);
  });
});

// Interface CommentService.addComment
describe('Mocked: CommentService.addComment', () => {
  // Mocked behavior: the Gem exists; CommentModel.create succeeds
  // Input: a stored Gem's name and a body with surrounding spaces
  // Expected behavior: one comment is stored under the Gem, with a new comment ID and the trimmed body
  // Expected output: the Comment, serialized as { id, body }
  test('Valid comment', async () => {
    const { service, hasGem } = serviceWithGem(true);
    mockedCommentModel.create.mockResolvedValue({});

    const comment = await service.addComment('places/abc', '  Great view!  ');

    expect(hasGem).toHaveBeenCalledWith('places/abc');
    expect(comment.gem).toBe('places/abc');
    expect(comment.body).toBe('Great view!');
    expect(comment.id).toEqual(expect.any(String));
    expect(mockedCommentModel.create).toHaveBeenCalledTimes(1);
    expect(mockedCommentModel.create).toHaveBeenCalledWith({ gem: 'places/abc', commentId: comment.id, body: 'Great view!' });
    expect(JSON.parse(JSON.stringify(comment))).toEqual({ id: comment.id, body: 'Great view!' });
  });

  // Mocked behavior: the Gem exists; CommentModel.create succeeds
  // Input: two comments on the same Gem
  // Expected behavior: each gets its own comment ID
  // Expected output: two different IDs
  test('Comment IDs are unique', async () => {
    const { service } = serviceWithGem(true);
    mockedCommentModel.create.mockResolvedValue({});

    const first = await service.addComment('places/abc', 'one');
    const second = await service.addComment('places/abc', 'two');

    expect(first.id).not.toBe(second.id);
  });

  // Mocked behavior: none
  // Input: a blank body
  // Expected behavior: the Gem is not looked up; nothing is stored
  // Expected output: rejects with InvalidCommentError
  test('Invalid body', async () => {
    const { service, hasGem } = serviceWithGem(true);

    await expect(service.addComment('places/abc', '   ')).rejects.toBeInstanceOf(InvalidCommentError);

    expect(hasGem).not.toHaveBeenCalled();
    expect(mockedCommentModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem does not exist
  // Input: an unknown Gem's name and a valid body
  // Expected behavior: nothing is stored
  // Expected output: rejects with NoSuchGemError
  test('No such Gem', async () => {
    const { service } = serviceWithGem(false);

    await expect(service.addComment('places/unknown', 'hello')).rejects.toBeInstanceOf(NoSuchGemError);

    expect(mockedCommentModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem exists; CommentModel.create rejects (e.g. DB unreachable)
  // Input: a stored Gem's name and a valid body
  // Expected behavior: the error is passed on
  // Expected output: rejects with the DB error
  test('Database error', async () => {
    const { service } = serviceWithGem(true);
    mockedCommentModel.create.mockRejectedValue(new Error('connection refused'));

    await expect(service.addComment('places/abc', 'hello')).rejects.toThrow('connection refused');
  });
});

// Interface CommentService.getComments
describe('Mocked: CommentService.getComments', () => {
  // Mocked behavior: the Gem exists; CommentModel.find returns two stored comments
  // Input: a stored Gem's name
  // Expected behavior: only that Gem's comments are queried, oldest first
  // Expected output: the Comments, in the order stored
  test('Gem with comments', async () => {
    const { service } = serviceWithGem(true);
    const sort = mockFind(Promise.resolve([
      { gem: 'places/abc', commentId: 'c1', body: 'first' },
      { gem: 'places/abc', commentId: 'c2', body: 'second' },
    ]));

    const comments = await service.getComments('places/abc');

    expect(mockedCommentModel.find).toHaveBeenCalledWith({ gem: 'places/abc' });
    expect(sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
    expect(comments.map(c => [c.gem, c.id, c.body])).toEqual([
      ['places/abc', 'c1', 'first'],
      ['places/abc', 'c2', 'second'],
    ]);
  });

  // Mocked behavior: the Gem exists; CommentModel.find returns nothing
  // Input: a stored Gem's name
  // Expected behavior: no error
  // Expected output: []
  test('Gem without comments', async () => {
    const { service } = serviceWithGem(true);
    mockFind(Promise.resolve([]));

    await expect(service.getComments('places/abc')).resolves.toEqual([]);
  });

  // Mocked behavior: the Gem does not exist
  // Input: an unknown Gem's name
  // Expected behavior: comments are not queried
  // Expected output: rejects with NoSuchGemError
  test('No such Gem', async () => {
    const { service } = serviceWithGem(false);

    await expect(service.getComments('places/unknown')).rejects.toBeInstanceOf(NoSuchGemError);

    expect(mockedCommentModel.find).not.toHaveBeenCalled();
  });
});
