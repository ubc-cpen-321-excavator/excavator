import { distanceMeters, toBounds, toIntInRange, toLatLng, toNumber } from '../../src/utils/geo';

// Interface toNumber
describe('toNumber', () => {
  // Input: finite numbers and plain decimal strings
  // Expected output: the number
  test.each([[1, 1], [-2.5, -2.5], ['49.26', 49.26], ['-123', -123], ['0', 0]])('Valid: %p', (value, expected) => {
    expect(toNumber(value)).toBe(expected);
  });

  // Input: non-finite numbers, non-decimal strings, arrays (repeated query params), other types
  // Expected output: undefined
  test.each([NaN, Infinity, '', ' 1', '1e5', '0x10', '1.', 'abc', ['1'], null, undefined, {}])('Invalid: %p', (value) => {
    expect(toNumber(value)).toBeUndefined();
  });
});

// Interface toIntInRange
describe('toIntInRange', () => {
  // Input: absent value, whole numbers in range
  // Expected output: the default, or the number
  test('Default and valid values', () => {
    expect(toIntInRange(undefined, 20, 1, 50)).toBe(20);
    expect(toIntInRange('1', 20, 1, 50)).toBe(1);
    expect(toIntInRange('50', 20, 1, 50)).toBe(50);
  });

  // Input: out of range, fractional or non-numeric values
  // Expected output: undefined
  test.each(['0', '51', '2.5', 'ten', ''])('Invalid: %p', (value) => {
    expect(toIntInRange(value, 20, 1, 50)).toBeUndefined();
  });
});

// Interface toLatLng
describe('toLatLng', () => {
  // Input: coordinates in range, as numbers or strings, incl. the extremes
  // Expected output: the point
  test('Valid', () => {
    expect(toLatLng('49.26', '-123.25')).toEqual({ latitude: 49.26, longitude: -123.25 });
    expect(toLatLng(-90, 180)).toEqual({ latitude: -90, longitude: 180 });
  });

  // Input: missing or out-of-range coordinates
  // Expected output: undefined
  test.each([[undefined, 1], [1, undefined], [91, 0], [0, -181], ['a', 'b']])('Invalid: %p, %p', (lat, lng) => {
    expect(toLatLng(lat, lng)).toBeUndefined();
  });
});

// Interface toBounds
describe('toBounds', () => {
  // Input: south < north and west < east
  // Expected output: the bounds
  test('Valid', () => {
    expect(toBounds('49', '-124', '50', '-123')).toEqual({ south: 49, west: -124, north: 50, east: -123 });
  });

  // Input: inverted or empty boxes (incl. one crossing the antimeridian), missing values
  // Expected output: undefined
  test.each([
    ['50', '-124', '49', '-123'],
    ['49', '-123', '50', '-124'],
    ['49', '-123', '49', '-122'],
    ['-10', '170', '10', '-170'],
    [undefined, '-124', '50', '-123'],
  ])('Invalid: %p %p %p %p', (s, w, n, e) => {
    expect(toBounds(s, w, n, e)).toBeUndefined();
  });
});

// Interface distanceMeters
describe('distanceMeters', () => {
  // Input: the same point twice
  // Expected output: 0
  test('Same point', () => {
    expect(distanceMeters({ latitude: 49.26, longitude: -123.25 }, { latitude: 49.26, longitude: -123.25 })).toBe(0);
  });

  // Input: points 1° of latitude apart, and the UBC–downtown Vancouver distance
  // Expected output: ~111.2 km, and ~8.6 km (both symmetric)
  test('Known distances', () => {
    expect(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111_195, -1);

    const ubc = { latitude: 49.2606, longitude: -123.2460 };
    const downtown = { latitude: 49.2827, longitude: -123.1207 };
    expect(distanceMeters(ubc, downtown)).toBeGreaterThan(9_000);
    expect(distanceMeters(ubc, downtown)).toBeLessThan(9_600);
    expect(distanceMeters(downtown, ubc)).toBeCloseTo(distanceMeters(ubc, downtown), 6);
  });
});
