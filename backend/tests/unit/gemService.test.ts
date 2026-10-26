import GemService, { Gem, Place } from '../../src/services/gemService';
import { GemModel } from '../../src/models/gemModel';

jest.mock('../../src/models/gemModel', () => ({
  GemModel: {
    findOne: jest.fn(),
    exists: jest.fn(),
    replaceOne: jest.fn(),
    create: jest.fn(),
  },
}));

const mockedGemModel = GemModel as unknown as { exists: jest.Mock; replaceOne: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface GemService.addGem
describe('Mocked: GemService.addGem', () => {
  // Mocked behavior: GemModel.exists finds no gem; GemModel.replaceOne succeeds
  // Input: a Gem with all fields set
  // Expected behavior: gem is written once, keyed by name, with [lng, lat] and every field
  // Expected output: true
  test('New gem with all fields', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockedGemModel.replaceOne.mockResolvedValue({ acknowledged: true });

    const place = new Place('places/abc', 49.26, -123.25);
    place.setDisplayName('Mitakihara Cafe');
    place.type = 'cafe';
    place.description = 'Quiet cafe behind the library.';
    const gem = new Gem('places/abc', place, 'google-sub-123');
    gem.setNicheness(0.9);
    gem.setQuality(0.8);
    gem.setScore(87, 1761000000000);

    const added = await new GemService().addGem(gem);

    expect(added).toBe(true);
    expect(mockedGemModel.replaceOne).toHaveBeenCalledTimes(1);
    expect(mockedGemModel.replaceOne).toHaveBeenCalledWith(
      { name: 'places/abc' },
      {
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
      },
      { upsert: true },
    );
  });

  // Mocked behavior: GemModel.exists finds no gem; GemModel.replaceOne succeeds
  // Input: a Gem with only name and place
  // Expected behavior: unset optional fields are not written (no undefined values in the doc)
  // Expected output: true
  test('New gem without optional fields', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockedGemModel.replaceOne.mockResolvedValue({ acknowledged: true });

    const gem = new Gem('places/bare', new Place('places/bare', 20, 10));

    const added = await new GemService().addGem(gem);

    expect(added).toBe(true);
    const doc = mockedGemModel.replaceOne.mock.calls[0][1];
    expect(Object.values(doc)).not.toContain(undefined);
    expect(Object.keys(doc).sort()).toEqual(['name', 'place']);
  });

  // Mocked behavior: GemModel.exists finds a gem with the same name
  // Input: a Gem whose name is already stored
  // Expected behavior: nothing is written
  // Expected output: false
  test('Existing gem', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'existing' });

    const gem = new Gem('places/abc', new Place('places/abc', 49.26, -123.25));

    const added = await new GemService().addGem(gem);

    expect(added).toBe(false);
    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });
});
