import RatingService, { InvalidStarsError, isValidStars } from '../../src/services/ratingService';
import { RatingModel } from '../../src/models/ratingModel';
import GemService, { Gem, NoSuchGemError, Place } from '../../src/services/gemService';

jest.mock('../../src/models/ratingModel', () => ({
  ...jest.requireActual<Record<string, unknown>>('../../src/models/ratingModel'),
  RatingModel: {
    updateOne: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
  },
}));

const mockedRatingModel = RatingModel as unknown as { updateOne: jest.Mock; findOne: jest.Mock; aggregate: jest.Mock };

/** A RatingService whose Gem service is a stub: `hasGem` answers `exists`; `applyAppRatings` returns a Gem with the totals. */
function serviceWithGem(exists: boolean): { service: RatingService; gemService: { hasGem: jest.Mock; applyAppRatings: jest.Mock } } {
  const gemService = {
    hasGem: jest.fn().mockResolvedValue(exists),
    applyAppRatings: jest.fn((name: string, count: number, average: number | undefined) => {
      const gem = new Gem(name, new Place(name, 0, 0));
      gem.setAppRatings(count, average);
      return Promise.resolve(gem);
    }),
  };
  return { service: new RatingService(gemService as unknown as GemService), gemService };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface isValidStars
describe('isValidStars', () => {
  // Input: whole numbers from 1 to 5
  // Expected output: true
  test.each([1, 2, 3, 4, 5])('Valid: %p', (stars) => {
    expect(isValidStars(stars)).toBe(true);
  });

  // Input: out of range, fractional, non-numbers
  // Expected output: false
  test.each([0, 6, 3.5, -1, NaN, '4', null, undefined, [4]])('Invalid: %p', (stars) => {
    expect(isValidStars(stars)).toBe(false);
  });
});

// Interface RatingService.rate
describe('Mocked: RatingService.rate', () => {
  // Mocked behavior: the Gem exists; the rating is stored; the aggregate finds 3 ratings averaging 4
  // Input: user u1 gives places/abc 5 stars
  // Expected behavior: the rating is upserted by (gem, user); the totals are recounted from all the Gem's
  //                    ratings and handed to the Gem service to rescore
  // Expected output: the Gem with ratingCount 3, ratingAverage 4
  test('New rating', async () => {
    const { service, gemService } = serviceWithGem(true);
    mockedRatingModel.updateOne.mockResolvedValue({ acknowledged: true });
    mockedRatingModel.aggregate.mockResolvedValue([{ _id: null, count: 3, average: 4 }]);

    const gem = await service.rate('u1', 'places/abc', 5);

    expect(mockedRatingModel.updateOne).toHaveBeenCalledWith(
      { gem: 'places/abc', user: 'u1' }, { $set: { stars: 5 } }, { upsert: true },
    );
    expect(mockedRatingModel.aggregate.mock.calls[0][0][0]).toEqual({ $match: { gem: 'places/abc' } });
    expect(gemService.applyAppRatings).toHaveBeenCalledWith('places/abc', 3, 4);
    expect(gem.getRatingCount()).toBe(3);
    expect(gem.getRatingAverage()).toBe(4);
  });

  // Mocked behavior: the Gem exists; the aggregate finds nothing (e.g. the rating was deleted meanwhile)
  // Input: a valid rating
  // Expected output: the Gem service gets totals of 0 and no average
  test('No ratings found', async () => {
    const { service, gemService } = serviceWithGem(true);
    mockedRatingModel.updateOne.mockResolvedValue({ acknowledged: true });
    mockedRatingModel.aggregate.mockResolvedValue([]);

    await service.rate('u1', 'places/abc', 4);

    expect(gemService.applyAppRatings).toHaveBeenCalledWith('places/abc', 0, undefined);
  });

  // Mocked behavior: none
  // Input: 6 stars
  // Expected behavior: the Gem is not looked up; nothing is stored
  // Expected output: rejects with InvalidStarsError
  test('Invalid stars', async () => {
    const { service, gemService } = serviceWithGem(true);

    await expect(service.rate('u1', 'places/abc', 6)).rejects.toBeInstanceOf(InvalidStarsError);

    expect(gemService.hasGem).not.toHaveBeenCalled();
    expect(mockedRatingModel.updateOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: the Gem does not exist
  // Input: a valid rating of an unknown Gem
  // Expected behavior: nothing is stored
  // Expected output: rejects with NoSuchGemError
  test('No such Gem', async () => {
    const { service } = serviceWithGem(false);

    await expect(service.rate('u1', 'places/unknown', 3)).rejects.toBeInstanceOf(NoSuchGemError);

    expect(mockedRatingModel.updateOne).not.toHaveBeenCalled();
  });
});

// Interface RatingService.getRating
describe('Mocked: RatingService.getRating', () => {
  // Mocked behavior: the Gem exists; RatingModel.findOne returns 4 stars, then nothing
  // Input: user u1 and places/abc, twice
  // Expected output: 4, then undefined
  test('Rated and not rated', async () => {
    const { service } = serviceWithGem(true);
    mockedRatingModel.findOne
      .mockReturnValueOnce({ lean: () => Promise.resolve({ stars: 4 }) })
      .mockReturnValueOnce({ lean: () => Promise.resolve(null) });

    await expect(service.getRating('u1', 'places/abc')).resolves.toBe(4);
    await expect(service.getRating('u1', 'places/abc')).resolves.toBeUndefined();

    expect(mockedRatingModel.findOne).toHaveBeenCalledWith({ gem: 'places/abc', user: 'u1' });
  });

  // Mocked behavior: the Gem does not exist
  // Input: an unknown Gem
  // Expected output: rejects with NoSuchGemError
  test('No such Gem', async () => {
    const { service } = serviceWithGem(false);

    await expect(service.getRating('u1', 'places/unknown')).rejects.toBeInstanceOf(NoSuchGemError);
  });
});
