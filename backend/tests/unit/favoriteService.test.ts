import FavoriteService, { MAX_FAVORITES, TooManyFavoritesError } from '../../src/services/favoriteService';
import { FavoriteModel } from '../../src/models/favoriteModel';
import GemService, { Gem, NoSuchGemError, Place } from '../../src/services/gemService';

jest.mock('../../src/models/favoriteModel', () => ({
  FavoriteModel: {
    find: jest.fn(),
    exists: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

const mockedFavoriteModel = FavoriteModel as unknown as {
  find: jest.Mock;
  exists: jest.Mock;
  countDocuments: jest.Mock;
  create: jest.Mock;
  deleteOne: jest.Mock;
};

/** A FavoriteService whose Gem service is a stub: `hasGem` answers `exists`, `getGems` returns Gems for the names. */
function serviceWithGem(exists: boolean): { service: FavoriteService; gemService: { hasGem: jest.Mock; getGems: jest.Mock } } {
  const gemService = {
    hasGem: jest.fn().mockResolvedValue(exists),
    getGems: jest.fn((names: string[]) => Promise.resolve(names.map(n => new Gem(n, new Place(n, 0, 0))))),
  };
  return { service: new FavoriteService(gemService as unknown as GemService), gemService };
}

/** Makes `FavoriteModel.find(...).sort(...).limit(...).lean()` resolve to `docs`; returns the chain's mocks. */
function mockFind(docs: unknown[]): { sort: jest.Mock; limit: jest.Mock } {
  const chain = { sort: jest.fn(), limit: jest.fn(), lean: () => Promise.resolve(docs) };
  chain.sort.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  mockedFavoriteModel.find.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface FavoriteService.getFavorites
describe('Mocked: FavoriteService.getFavorites', () => {
  // Mocked behavior: FavoriteModel.find returns two favorites, newest first
  // Input: a user's ID
  // Expected behavior: only that user's favorites are read, newest first, capped at MAX_FAVORITES; their Gems loaded in that order
  // Expected output: the two Gems
  test('User with favorites', async () => {
    const { service, gemService } = serviceWithGem(true);
    const { sort, limit } = mockFind([{ user: 'u1', gem: 'places/new' }, { user: 'u1', gem: 'places/old' }]);

    const gems = await service.getFavorites('u1');

    expect(mockedFavoriteModel.find).toHaveBeenCalledWith({ user: 'u1' });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(limit).toHaveBeenCalledWith(MAX_FAVORITES);
    expect(gemService.getGems).toHaveBeenCalledWith(['places/new', 'places/old']);
    expect(gems.map(g => g.name)).toEqual(['places/new', 'places/old']);
  });
});

// Interface FavoriteService.addFavorite
describe('Mocked: FavoriteService.addFavorite', () => {
  // Mocked behavior: the Gem exists; not yet a favorite; the user has 3 favorites; FavoriteModel.create succeeds
  // Input: a user's ID and a Gem name
  // Expected behavior: one favorite is stored for that user and Gem
  // Expected output: true
  test('New favorite', async () => {
    const { service } = serviceWithGem(true);
    mockedFavoriteModel.exists.mockResolvedValue(null);
    mockedFavoriteModel.countDocuments.mockResolvedValue(3);
    mockedFavoriteModel.create.mockResolvedValue({});

    await expect(service.addFavorite('u1', 'places/abc')).resolves.toBe(true);

    expect(mockedFavoriteModel.create).toHaveBeenCalledWith({ user: 'u1', gem: 'places/abc' });
  });

  // Mocked behavior: the Gem exists and is already a favorite
  // Input: the same user and Gem
  // Expected behavior: nothing is stored
  // Expected output: false
  test('Already a favorite', async () => {
    const { service } = serviceWithGem(true);
    mockedFavoriteModel.exists.mockResolvedValue({ _id: 'f' });

    await expect(service.addFavorite('u1', 'places/abc')).resolves.toBe(false);

    expect(mockedFavoriteModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem exists; not yet a favorite; FavoriteModel.create rejects with a duplicate-key error (11000)
  // Input: a favorite added twice at the same moment
  // Expected output: false, not an error
  test('Added twice at once', async () => {
    const { service } = serviceWithGem(true);
    mockedFavoriteModel.exists.mockResolvedValue(null);
    mockedFavoriteModel.countDocuments.mockResolvedValue(0);
    mockedFavoriteModel.create.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }));

    await expect(service.addFavorite('u1', 'places/abc')).resolves.toBe(false);
  });

  // Mocked behavior: the Gem exists; FavoriteModel.create rejects (e.g. DB unreachable)
  // Input: a user's ID and a Gem name
  // Expected output: rejects with the DB error
  test('Database error', async () => {
    const { service } = serviceWithGem(true);
    mockedFavoriteModel.exists.mockResolvedValue(null);
    mockedFavoriteModel.countDocuments.mockResolvedValue(0);
    mockedFavoriteModel.create.mockRejectedValue(new Error('connection refused'));

    await expect(service.addFavorite('u1', 'places/abc')).rejects.toThrow('connection refused');
  });

  // Mocked behavior: the Gem does not exist
  // Input: an unknown Gem
  // Expected behavior: nothing is stored
  // Expected output: rejects with NoSuchGemError
  test('No such Gem', async () => {
    const { service } = serviceWithGem(false);

    await expect(service.addFavorite('u1', 'places/unknown')).rejects.toBeInstanceOf(NoSuchGemError);

    expect(mockedFavoriteModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem exists; not yet a favorite; the user already has MAX_FAVORITES
  // Input: one more favorite
  // Expected behavior: nothing is stored
  // Expected output: rejects with TooManyFavoritesError
  test('Too many favorites', async () => {
    const { service } = serviceWithGem(true);
    mockedFavoriteModel.exists.mockResolvedValue(null);
    mockedFavoriteModel.countDocuments.mockResolvedValue(MAX_FAVORITES);

    await expect(service.addFavorite('u1', 'places/abc')).rejects.toBeInstanceOf(TooManyFavoritesError);

    expect(mockedFavoriteModel.create).not.toHaveBeenCalled();
  });
});

// Interface FavoriteService.removeFavorite
describe('Mocked: FavoriteService.removeFavorite', () => {
  // Mocked behavior: FavoriteModel.deleteOne deletes one, then none
  // Input: the same favorite removed twice
  // Expected behavior: deletes by user and Gem
  // Expected output: true, then false
  test('Remove', async () => {
    const { service } = serviceWithGem(true);
    mockedFavoriteModel.deleteOne.mockResolvedValueOnce({ deletedCount: 1 }).mockResolvedValueOnce({ deletedCount: 0 });

    await expect(service.removeFavorite('u1', 'places/abc')).resolves.toBe(true);
    await expect(service.removeFavorite('u1', 'places/abc')).resolves.toBe(false);

    expect(mockedFavoriteModel.deleteOne).toHaveBeenCalledWith({ user: 'u1', gem: 'places/abc' });
  });
});
