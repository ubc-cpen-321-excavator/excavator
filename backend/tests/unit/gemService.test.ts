import GemService, {
  GemExistsError,
  InvalidPlaceError,
  InvalidPlaceTypeError,
  MAX_ADD_DISTANCE_M,
  PlacesUnavailableError,
  TooFarError,
  gemNameFromPlaceId,
  isValidGemName,
} from '../../src/services/gemService';
import { GemModel } from '../../src/models/gemModel';
import { computeGemScore } from '../../src/utils/gemScore';

jest.mock('../../src/models/gemModel', () => ({
  GemModel: {
    findOne: jest.fn(),
    find: jest.fn(),
    exists: jest.fn(),
    replaceOne: jest.fn(),
    create: jest.fn(),
  },
}));

// Called lazily, so it is initialized by the time GemService builds its PlacesClient.
const mockGetPlace = jest.fn();
const mockSearchNearby = jest.fn();
jest.mock('@googlemaps/places', () => ({
  PlacesClient: jest.fn().mockImplementation(() => ({
    getPlace: (...args: unknown[]) => mockGetPlace(...args),
    searchNearby: (...args: unknown[]) => mockSearchNearby(...args),
  })),
}));

const mockedGemModel = GemModel as unknown as {
  findOne: jest.Mock;
  find: jest.Mock;
  exists: jest.Mock;
  replaceOne: jest.Mock;
  create: jest.Mock;
};

/** The user, standing at the place most tests look up. */
const AT_PLACE = { latitude: 49.26, longitude: -123.25 };

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
  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place with every field; GemModel.create succeeds
  // Input: a valid place name and user ID
  // Expected behavior: place is looked up with a field mask; gem is inserted once, keyed by name, with [lng, lat], type, description, rating, review count, GemScore and addedBy
  // Expected output: the new Gem, scored
  test('New gem with all fields', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockedGemModel.create.mockResolvedValue({});
    mockGetPlace.mockResolvedValue([{
      name: 'places/abc',
      displayName: { text: 'Mitakihara Cafe' },
      location: { latitude: 49.26, longitude: -123.25 },
      primaryType: 'cafe',
      editorialSummary: { text: 'Quiet cafe behind the library.' },
      rating: 4.6,
      userRatingCount: 120,
    }]);

    const gem = await new GemService().addGem('places/abc', 'google-sub-123', AT_PLACE);
    const expected = computeGemScore({ rating: 4.6, reviewCount: 120 });

    expect(gem.name).toBe('places/abc');
    expect(gem.getScore()).toBe(expected.score);
    expect(mockGetPlace).toHaveBeenCalledTimes(1);
    expect(mockGetPlace).toHaveBeenCalledWith(
      { name: 'places/abc' },
      { otherArgs: { headers: { 'X-Goog-FieldMask': expect.stringContaining('location') } } },
    );
    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
    expect(mockedGemModel.create).toHaveBeenCalledTimes(1);
    expect(mockedGemModel.create).toHaveBeenCalledWith(
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
        reviewCount: 120,
        nicheness: expected.nicheness,
        score: expected.score,
        scoreTime: expect.any(Number),
        addedBy: 'google-sub-123',
      },
    );
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns only name and location (unset fields as '' / 0); GemModel.create succeeds
  // Input: a valid place name and user ID
  // Expected behavior: unset optional fields are not written (no undefined values in the doc); display name falls back to the place name; still scored from the prior
  // Expected output: true
  test('New gem without optional fields', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockedGemModel.create.mockResolvedValue({});
    mockGetPlace.mockResolvedValue([{
      name: 'places/bare',
      location: { latitude: 20, longitude: 10 },
      primaryType: '',
      rating: 0,
    }]);

    await new GemService().addGem('places/bare', 'google-sub-123', { latitude: 20, longitude: 10 });

    const doc = mockedGemModel.create.mock.calls[0][0];
    expect(Object.values(doc)).not.toContain(undefined);
    expect(Object.keys(doc).sort()).toEqual(['addedBy', 'name', 'nicheness', 'place', 'score', 'scoreTime']);
    expect(doc.score).toBe(computeGemScore({}).score);
    expect(doc.place).toEqual({
      name: 'places/bare',
      displayName: 'places/bare',
      location: { type: 'Point', coordinates: [10, 20] },
    });
  });

  // Mocked behavior: GemModel.exists finds a gem with the same name
  // Input: a place name that is already stored
  // Expected behavior: Google Places is not called; nothing is written
  // Expected output: rejects with GemExistsError
  test('Existing gem', async () => {
    mockedGemModel.exists.mockResolvedValue({ _id: 'existing' });

    await expect(new GemService().addGem('places/abc', 'google-sub-123', AT_PLACE)).rejects.toBeInstanceOf(GemExistsError);

    expect(mockGetPlace).not.toHaveBeenCalled();
    expect(mockedGemModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place; GemModel.create rejects with a duplicate-key error (11000)
  // Input: a place another user adds at the same moment
  // Expected behavior: the existing gem is not overwritten
  // Expected output: rejects with GemExistsError
  test('Gem added concurrently', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockResolvedValue([{ name: 'places/abc', location: AT_PLACE }]);
    mockedGemModel.create.mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));

    await expect(new GemService().addGem('places/abc', 'google-sub-123', AT_PLACE)).rejects.toBeInstanceOf(GemExistsError);

    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place; GemModel.create rejects (e.g. DB unreachable)
  // Input: a valid place name
  // Expected output: rejects with the DB error, not GemExistsError
  test('Database error on insert', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockResolvedValue([{ name: 'places/abc', location: AT_PLACE }]);
    const err = new Error('connection refused');
    mockedGemModel.create.mockRejectedValue(err);

    await expect(new GemService().addGem('places/abc', 'google-sub-123', AT_PLACE)).rejects.toBe(err);
  });

  // Mocked behavior: none
  // Input: a name that is not `places/<place ID>`
  // Expected behavior: neither the DB nor Google Places is called
  // Expected output: rejects with InvalidPlaceError
  test('Malformed name', async () => {
    await expect(new GemService().addGem('not a place', 'google-sub-123', AT_PLACE)).rejects.toBeInstanceOf(InvalidPlaceError);

    expect(mockedGemModel.exists).not.toHaveBeenCalled();
    expect(mockGetPlace).not.toHaveBeenCalled();
    expect(mockedGemModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places rejects with NOT_FOUND (5) or INVALID_ARGUMENT (3)
  // Input: a well-formed name of a place that does not exist
  // Expected behavior: nothing is written
  // Expected output: rejects with InvalidPlaceError
  test.each([5, 3])('Place does not exist (gRPC code %i)', async (code) => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockRejectedValue(placesError(code));

    await expect(new GemService().addGem('places/unknown', 'google-sub-123', AT_PLACE)).rejects.toBeInstanceOf(InvalidPlaceError);

    expect(mockedGemModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns a place with no location
  // Input: a valid place name
  // Expected behavior: nothing is written
  // Expected output: rejects with InvalidPlaceError
  test('Google Places returns no location', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockResolvedValue([{ name: 'places/abc', location: null }]);

    await expect(new GemService().addGem('places/abc', 'google-sub-123', AT_PLACE)).rejects.toBeInstanceOf(InvalidPlaceError);

    expect(mockedGemModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places rejects with UNAVAILABLE (14)
  // Input: a valid place name
  // Expected behavior: nothing is written; the error is not mistaken for a missing place
  // Expected output: rejects with PlacesUnavailableError carrying the Places error, not InvalidPlaceError
  test('Google Places unavailable', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    const err = placesError(14);
    mockGetPlace.mockRejectedValue(err);

    const result = new GemService().addGem('places/abc', 'google-sub-123', AT_PLACE);

    await expect(result).rejects.toBeInstanceOf(PlacesUnavailableError);
    await expect(result).rejects.toMatchObject({ cause: err });
    expect(mockedGemModel.create).not.toHaveBeenCalled();
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

// Interface gemNameFromPlaceId
describe('gemNameFromPlaceId', () => {
  // Input: a place ID
  // Expected output: places/<place ID>
  test('Valid place ID', () => {
    expect(gemNameFromPlaceId('ChIJN1t_tDeuEmsR')).toBe('places/ChIJN1t_tDeuEmsR');
  });

  // Input: values that are not place IDs
  // Expected output: undefined
  test.each([undefined, 37, '', 'a b', 'places/abc', 'a.b'])('Invalid: %p', (pk) => {
    expect(gemNameFromPlaceId(pk)).toBeUndefined();
  });
});

// Interface GemService.addGem: distance check
describe('Mocked: GemService.addGem distance check', () => {
  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place at AT_PLACE
  // Input: a user about 330 m north of the place (0.003° latitude), beyond MAX_ADD_DISTANCE_M
  // Expected behavior: nothing is written
  // Expected output: rejects with TooFarError
  test('User too far from place', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockGetPlace.mockResolvedValue([{ name: 'places/abc', location: AT_PLACE }]);
    const user = { latitude: AT_PLACE.latitude + 0.003, longitude: AT_PLACE.longitude };

    await expect(new GemService().addGem('places/abc', 'google-sub-123', user)).rejects.toBeInstanceOf(TooFarError);

    expect(mockedGemModel.create).not.toHaveBeenCalled();
  });

  // Mocked behavior: GemModel.exists finds no gem; Google Places returns the place at AT_PLACE; GemModel.create succeeds
  // Input: a user about 110 m from the place (0.001° latitude), within MAX_ADD_DISTANCE_M
  // Expected behavior: the gem is inserted
  // Expected output: the new Gem
  test('User near place', async () => {
    mockedGemModel.exists.mockResolvedValue(null);
    mockedGemModel.create.mockResolvedValue({});
    mockGetPlace.mockResolvedValue([{ name: 'places/abc', location: AT_PLACE }]);
    const user = { latitude: AT_PLACE.latitude + 0.001, longitude: AT_PLACE.longitude };

    await expect(new GemService().addGem('places/abc', 'google-sub-123', user)).resolves.toMatchObject({ name: 'places/abc' });
    expect(mockedGemModel.create).toHaveBeenCalledTimes(1);
  });
});

// Interface GemService.findNearbyPlaces
describe('Mocked: GemService.findNearbyPlaces', () => {
  // Mocked behavior: Google returns three places (one without a location); one of the valid two is already a gem
  // Input: the user's location and type "cafe"
  // Expected behavior: Google is asked for up to 20 places within MAX_ADD_DISTANCE_M, nearest first, of that type, with a field mask;
  //                    the place without a location is skipped; stored gems are looked up by name in one query
  // Expected output: two candidates with name, display name, type, address, location, rounded distance and isGem
  test('Places found', async () => {
    mockSearchNearby.mockResolvedValue([{
      places: [
        { name: 'places/near', displayName: { text: 'Near Cafe' }, location: AT_PLACE, primaryType: 'cafe', formattedAddress: '1 Main St' },
        { name: 'places/noloc', displayName: { text: 'Nowhere' } },
        { name: 'places/next', location: { latitude: AT_PLACE.latitude + 0.001, longitude: AT_PLACE.longitude } },
      ],
    }]);
    mockedGemModel.find.mockReturnValue({ lean: () => Promise.resolve([{ name: 'places/next' }]) });

    const places = await new GemService().findNearbyPlaces(AT_PLACE, 'cafe');

    expect(mockSearchNearby).toHaveBeenCalledWith(
      {
        maxResultCount: 20,
        rankPreference: 'DISTANCE',
        locationRestriction: { circle: { center: AT_PLACE, radius: MAX_ADD_DISTANCE_M } },
        includedTypes: ['cafe'],
      },
      { otherArgs: { headers: { 'X-Goog-FieldMask': expect.stringContaining('places.location') } } },
    );
    expect(mockedGemModel.find).toHaveBeenCalledWith({ name: { $in: ['places/near', 'places/next'] } }, { name: 1 });
    expect(places).toEqual([
      { name: 'places/near', displayName: 'Near Cafe', type: 'cafe', address: '1 Main St', ...AT_PLACE, distance: 0, isGem: false },
      {
        name: 'places/next', displayName: 'places/next', type: undefined, address: undefined,
        latitude: AT_PLACE.latitude + 0.001, longitude: AT_PLACE.longitude, distance: 111, isGem: true,
      },
    ]);
  });

  // Mocked behavior: Google returns no places
  // Input: the user's location, no type
  // Expected behavior: no includedTypes is sent; the DB is not queried
  // Expected output: []
  test('No places', async () => {
    mockSearchNearby.mockResolvedValue([{}]);

    await expect(new GemService().findNearbyPlaces(AT_PLACE)).resolves.toEqual([]);

    expect(mockSearchNearby.mock.calls[0][0]).not.toHaveProperty('includedTypes');
    expect(mockedGemModel.find).not.toHaveBeenCalled();
  });

  // Mocked behavior: none
  // Input: a malformed type
  // Expected behavior: Google is not called
  // Expected output: rejects with InvalidPlaceTypeError
  test('Malformed type', async () => {
    await expect(new GemService().findNearbyPlaces(AT_PLACE, 'Cafe!')).rejects.toBeInstanceOf(InvalidPlaceTypeError);

    expect(mockSearchNearby).not.toHaveBeenCalled();
  });

  // Mocked behavior: Google rejects with INVALID_ARGUMENT (3), as for a type it doesn't know
  // Input: a well-formed but unknown type
  // Expected output: rejects with InvalidPlaceTypeError
  test('Unknown type', async () => {
    mockSearchNearby.mockRejectedValue(placesError(3));

    await expect(new GemService().findNearbyPlaces(AT_PLACE, 'not_a_type')).rejects.toBeInstanceOf(InvalidPlaceTypeError);
  });

  // Mocked behavior: Google rejects with UNAVAILABLE (14)
  // Input: the user's location
  // Expected output: rejects with PlacesUnavailableError carrying the Places error, not InvalidPlaceTypeError
  test('Google Places unavailable', async () => {
    const err = placesError(14);
    mockSearchNearby.mockRejectedValue(err);

    await expect(new GemService().findNearbyPlaces(AT_PLACE)).rejects.toMatchObject({ name: 'PlacesUnavailableError', cause: err });
  });
});

// Interface GemService.scoreGem
describe('Mocked: GemService.scoreGem', () => {
  // Mocked behavior: GemModel.findOne returns a stored gem with a rating and review count but an old score; replaceOne succeeds
  // Input: the gem's name
  // Expected behavior: the score is recomputed from the stored inputs and written back
  // Expected output: the new score
  test('Stored gem', async () => {
    mockedGemModel.findOne.mockReturnValue({
      lean: () => Promise.resolve({
        name: 'places/abc',
        place: { name: 'places/abc', location: { type: 'Point', coordinates: [-123.25, 49.26] } },
        quality: 4.8,
        reviewCount: 60,
        score: 1,
      }),
    });
    mockedGemModel.replaceOne.mockResolvedValue({ acknowledged: true });
    const expected = computeGemScore({ rating: 4.8, reviewCount: 60 }).score;

    await expect(new GemService().scoreGem('places/abc')).resolves.toBe(expected);

    expect(mockedGemModel.replaceOne.mock.calls[0][1]).toMatchObject({ score: expected, quality: 4.8, reviewCount: 60 });
  });

  // Mocked behavior: GemModel.findOne finds nothing
  // Input: an unknown gem's name
  // Expected behavior: nothing is written
  // Expected output: undefined
  test('No such gem', async () => {
    mockedGemModel.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

    await expect(new GemService().scoreGem('places/unknown')).resolves.toBeUndefined();

    expect(mockedGemModel.replaceOne).not.toHaveBeenCalled();
  });
});

// Interface GemService list queries
describe('Mocked: GemService list queries', () => {
  const STORED = {
    name: 'places/abc',
    place: { name: 'places/abc', location: { type: 'Point', coordinates: [-123.25, 49.26] } },
  };

  /** Makes GemModel.find return a chain whose calls are recorded; resolves to one stored gem. */
  function mockFindChain(): { sort: jest.Mock; limit: jest.Mock } {
    const chain = { sort: jest.fn(), limit: jest.fn(), lean: () => Promise.resolve([STORED]) };
    chain.sort.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    mockedGemModel.find.mockReturnValue(chain);
    return chain;
  }

  // Mocked behavior: GemModel.find returns one gem
  // Input: a center, radius 1000 m, limit 5
  // Expected behavior: a $nearSphere query on place.location with [lng, lat] and $maxDistance, limited
  // Expected output: the gems, mapped back from documents
  test('Nearby gems', async () => {
    const { limit } = mockFindChain();

    const gems = await new GemService().getNearbyGems(AT_PLACE, 1000, 5);

    expect(mockedGemModel.find).toHaveBeenCalledWith({
      'place.location': {
        $nearSphere: { $geometry: { type: 'Point', coordinates: [-123.25, 49.26] }, $maxDistance: 1000 },
      },
    });
    expect(limit).toHaveBeenCalledWith(5);
    expect(gems.map(g => g.name)).toEqual(['places/abc']);
  });

  // Mocked behavior: GemModel.find returns one gem
  // Input: map bounds and limit 10
  // Expected behavior: a $geoWithin polygon of the bounds' corners (closed ring, [lng, lat]), best score first, limited
  // Expected output: the gems
  test('Gems within bounds', async () => {
    const { sort, limit } = mockFindChain();

    const gems = await new GemService().getGemsWithin({ south: 49, west: -124, north: 50, east: -123 }, 10);

    expect(mockedGemModel.find).toHaveBeenCalledWith({
      'place.location': {
        $geoWithin: {
          $geometry: { type: 'Polygon', coordinates: [[[-124, 49], [-123, 49], [-123, 50], [-124, 50], [-124, 49]]] },
        },
      },
    });
    expect(sort).toHaveBeenCalledWith({ score: -1, _id: 1 });
    expect(limit).toHaveBeenCalledWith(10);
    expect(gems).toHaveLength(1);
  });

  // Mocked behavior: GemModel.find returns one gem
  // Input: limit 3
  // Expected behavior: all gems, newest first, limited
  // Expected output: the gems
  test('Newest gems', async () => {
    const { sort, limit } = mockFindChain();

    await new GemService().getNewestGems(3);

    expect(mockedGemModel.find).toHaveBeenCalledWith({});
    expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(limit).toHaveBeenCalledWith(3);
  });
});
