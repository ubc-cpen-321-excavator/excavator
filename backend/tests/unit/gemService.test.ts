import GemService, { InvalidPlaceError, isValidGemName } from '../../src/services/gemService';
import { GemModel } from '../../src/models/gemModel';

jest.mock('../../src/models/gemModel', () => ({
  GemModel: {
    findOne: jest.fn(),
    exists: jest.fn(),
    replaceOne: jest.fn(),
    create: jest.fn(),
  },
}));

// Called lazily, so it is initialized by the time GemService builds its PlacesClient.
const mockGetPlace = jest.fn();
jest.mock('@googlemaps/places', () => ({
  PlacesClient: jest.fn().mockImplementation(() => ({
    getPlace: (...args: unknown[]) => mockGetPlace(...args),
  })),
}));

const mockedGemModel = GemModel as unknown as {
  findOne: jest.Mock;
  exists: jest.Mock;
  replaceOne: jest.Mock;
};

/** A Google Places error, as thrown by the Places client. */
function placesError(code: number): Error & { code: number } {
  return Object.assign(new Error(`places error ${code}`), { code });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Interface isValidGemName
describe('isValidGemName', () => {
  // Input: Google Places resource names
  // Expected output: true
  test.each(['places/abc', 'places/ChIJN1t_tDeuEmsRUsoyG83frY4', 'places/a-b_c'])('Valid: %s', (name) => {
    expect(isValidGemName(name)).toBe(true);
  });

  // Input: values that are not `places/<place ID>` strings
  // Expected output: false
  test.each([
    undefined, null, 37, {}, ['places/abc'], { $ne: null },
    '', 'abc', 'places/', 'place/abc', 'places/abc/def', 'places/a b', 'places/abc;drop', `places/${'a'.repeat(256)}`,
  ])('Invalid: %p', (name) => {
    expect(isValidGemName(name)).toBe(false);
  });
});

// Interface GemService.addGem
describe('Mocked: GemService.addGem', () => {
  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place with every field; GemModel.replaceOne succeeds
  // Input: a valid place name and user ID
  // Expected behavior: place is looked up with a field mask; gem is written once, keyed by name, with [lng, lat], type, description, quality and addedBy
  // Expected output: true
  test('New gem with all fields', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockedGemModel.replaceOne.mockResolvedValue({ acknowledged: true });
    mockGetPlace.mockResolvedValue([{
      name: 'places/abc',
      displayName: { text: 'Mitakihara Cafe' },
      location: { latitude: 49.26, longitude: -123.25 },
      primaryType: 'cafe',
      editorialSummary: { text: 'Quiet cafe behind the library.' },
      rating: 4.6,
    }]);

    const added = await new GemService().addGem('places/abc', 'google-sub-123');

    expect(added).toBe(true);
    expect(mockGetPlace).toHaveBeenCalledTimes(1);
    expect(mockGetPlace).toHaveBeenCalledWith(
      { name: 'places/abc' },
      { otherArgs: { headers: { 'X-Goog-FieldMask': expect.stringContaining('location') } } },
    );
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
        quality: 4.6,
        addedBy: 'google-sub-123',
      },
      { upsert: true },
    );
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns only name and location (unset fields as '' / 0); GemModel.replaceOne succeeds
  // Input: a valid place name and user ID
  // Expected behavior: unset optional fields are not written (no undefined values in the doc); display name falls back to the place name
  // Expected output: true
  test('New gem without optional fields', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockedGemModel.replaceOne.mockResolvedValue({ acknowledged: true });
    mockGetPlace.mockResolvedValue([{
      name: 'places/bare',
      location: { latitude: 20, longitude: 10 },
      primaryType: '',
      rating: 0,
    }]);

    const added = await new GemService().addGem('places/bare', 'google-sub-123');

    expect(added).toBe(true);
    const doc = mockedGemModel.replaceOne.mock.calls[0][1];
    expect(Object.values(doc)).not.toContain(undefined);
    expect(Object.keys(doc).sort()).toEqual(['addedBy', 'name', 'place']);
    expect(doc.place).toEqual({
      name: 'places/bare',
      displayName: 'places/bare',
      location: { type: 'Point', coordinates: [10, 20] },
    });
  });

  // Mocked behavior: GemModel.exists finds a gem with the same name
  // Input: a place name that is already stored
  // Expected behavior: Google Places is not called; nothing is written
  // Expected output: false
  test('Existing gem', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'existing' });

    const added = await new GemService().addGem('places/abc', 'google-sub-123');

    expect(added).toBe(false);
    expect(mockGetPlace).not.toHaveBeenCalled();
    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: none
  // Input: a name that is not `places/<place ID>`
  // Expected behavior: neither the DB nor Google Places is called
  // Expected output: rejects with InvalidPlaceError
  test('Malformed name', async () => {
    await expect(new GemService().addGem('not a place', 'google-sub-123')).rejects.toBeInstanceOf(InvalidPlaceError);

    expect(mockedGemModel.exists).not.toHaveBeenCalled();
    expect(mockGetPlace).not.toHaveBeenCalled();
    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places rejects with NOT_FOUND (5) or INVALID_ARGUMENT (3)
  // Input: a well-formed name of a place that does not exist
  // Expected behavior: nothing is written
  // Expected output: rejects with InvalidPlaceError
  test.each([5, 3])('Place does not exist (gRPC code %i)', async (code) => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockRejectedValue(placesError(code));

    await expect(new GemService().addGem('places/unknown', 'google-sub-123')).rejects.toBeInstanceOf(InvalidPlaceError);

    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns a place with no location
  // Input: a valid place name
  // Expected behavior: nothing is written
  // Expected output: rejects with InvalidPlaceError
  test('Google Places returns no location', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockResolvedValue([{ name: 'places/abc', location: null }]);

    await expect(new GemService().addGem('places/abc', 'google-sub-123')).rejects.toBeInstanceOf(InvalidPlaceError);

    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places rejects with UNAVAILABLE (14)
  // Input: a valid place name
  // Expected behavior: nothing is written; the error is not mistaken for a missing place
  // Expected output: rejects with the Places error, not InvalidPlaceError
  test('Google Places unavailable', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    const err = placesError(14);
    mockGetPlace.mockRejectedValue(err);

    const result = new GemService().addGem('places/abc', 'google-sub-123');

    await expect(result).rejects.toBe(err);
    await expect(result).rejects.not.toBeInstanceOf(InvalidPlaceError);
    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });
});

// Interface GemService.getGem
describe('Mocked: GemService.getGem', () => {
  // Mocked behavior: none
  // Input: a name that is not `places/<place ID>`
  // Expected behavior: the DB is not queried
  // Expected output: undefined
  test('Malformed name', async () => {
    await expect(new GemService().getGem('not a place')).resolves.toBeUndefined();

    expect(mockedGemModel.findOne).not.toHaveBeenCalled();
  });
});
