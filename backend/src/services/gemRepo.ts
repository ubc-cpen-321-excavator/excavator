import { GemModel, type GemDoc, type GemInput } from "../models/gemModel";
import { definedOnly, nonEmpty, orUndefined } from "../utils/defined";
import { type Bounds, type LatLng } from "../utils/geo";
import { Gem, Place } from "./gem";
import { GemExistsError, NoSuchGemError } from "./gemErrors";

/** Earth's radius in metres, as MongoDB uses to turn a `$centerSphere` radius into radians. */
const EARTH_RADIUS_M = 6_378_100;

/** MongoDB's error code for a unique index violation. */
const MONGO_DUPLICATE_KEY = 11000;

/**
 * Maps a Gem to the document stored in Mongo.
 *
 * @param gem the Gem to store.
 * @param photoName Google Places resource name of the place's first photo, if it has one.
 * @returns the document, with the location as GeoJSON `[longitude, latitude]` and no `undefined` fields.
 */
function toDoc(gem: Gem, photoName?: string): GemInput {
  const place = gem.place;
  const doc: GemInput = {
    name: gem.name,
    place: {
      name: place.name,
      displayName: place.getDisplayName(),
      location: { type: 'Point', coordinates: [place.longitude, place.latitude] },
      ...definedOnly({ photoName }),
    },
    ...definedOnly({
      description: place.description,
      type: place.type,
      score: gem.getScore(),
      scoreTime: gem.getScoreTime(),
      nicheness: gem.getNicheness(),
      quality: gem.getQuality(),
      reviewCount: gem.getReviewCount(),
      ratingCount: gem.getRatingCount(),
      ratingAverage: gem.getRatingAverage(),
      addedBy: gem.addedBy,
    }),
  };

  return doc;
}

/**
 * Maps the place part of a stored Gem document back to a Place.
 *
 * @param doc the stored document.
 * @returns the Place; `null` fields become `undefined`.
 * @throws if the document has no valid `[longitude, latitude]`.
 */
function placeFromDoc(doc: GemDoc): Place {
  const [longitude, latitude] = doc.place.location.coordinates;
  if (longitude === undefined || latitude === undefined) {
    throw new Error(`Invalid location for Gem.`);
  }

  const place = new Place(doc.place.name, latitude, longitude);
  if (doc.place.displayName) {
    place.setDisplayName(doc.place.displayName);
  }
  place.type = doc.type ?? undefined;
  place.description = doc.description ?? undefined;

  return place;
}

/**
 * Maps a stored Mongo document back to a Gem.
 *
 * @param doc the stored document.
 * @returns the Gem; `null` fields become `undefined`.
 * @throws if the document has no valid `[longitude, latitude]`.
 */
function fromDoc(doc: GemDoc): Gem {
  const gem = new Gem(doc.name, placeFromDoc(doc), orUndefined(doc.addedBy));
  gem.setNicheness(orUndefined(doc.nicheness));
  gem.setQuality(orUndefined(doc.quality));
  gem.setReviewCount(orUndefined(doc.reviewCount));
  gem.setAppRatings(orUndefined(doc.ratingCount), orUndefined(doc.ratingAverage));
  if (doc.score !== undefined && doc.score !== null) {
    gem.setScore(doc.score, doc.scoreTime ?? Date.now());
  }

  return gem;
}

/**
 * Stores Gems in the `gems` collection. Does no validation; `GemService` does that.
 */
export class GemRepo {

  /**
   * Stores a new Gem, never overwriting one.
   *
   * @param gem the Gem to store.
   * @param photoName Google Places resource name of the place's first photo, if it has one.
   * @throws `GemExistsError` if a Gem with the same name is already stored (unique index).
   * @throws the database error for anything else.
   */
  async insert(gem: Gem, photoName?: string): Promise<void> {
    try {
      await GemModel.create(toDoc(gem, photoName));
    } catch (err) {
      if ((err as { code?: unknown } | null)?.code === MONGO_DUPLICATE_KEY) {
        throw new GemExistsError('Gem already exists.');
      }
      throw err;
    }
  }

  /**
   * Deletes a Gem matching the name.
   *
   * @param name
   * @throws the database error
   */
  async delete(name: string): Promise<void> {
    await GemModel.deleteOne({ name: { $eq: name } });
  }

  /**
   * @param name Gem name.
   * @returns the stored Gem, or `undefined` if there is none.
   */
  async get(name: string): Promise<Gem | undefined> {
    const doc = await GemModel.findOne({ name }).lean<GemDoc>();
    return doc ? fromDoc(doc) : undefined;
  }

  /**
   * @param name Gem name.
   * @returns `true` if a Gem with that name is stored.
   */
  async has(name: string): Promise<boolean> {
    return (await GemModel.exists({ name })) !== null;
  }

  /**
   * @param names Gem names to look for.
   * @returns the subset of `names` that are stored Gems.
   */
  async namesIn(names: string[]): Promise<Set<string>> {
    if (names.length === 0) {
      return new Set();
    }

    const docs = await GemModel.find({ name: { $in: names } }, { name: 1 }).lean<{ name: string }[]>();
    return new Set(docs.map(d => d.name));
  }

  /**
   * @param center point to search around.
   * @param radius in metres.
   * @param limit most Gems to return.
   * @returns Gems within `radius` of `center`, nearest first (uses the 2dsphere index).
   */
  async nearby(center: LatLng, radius: number, limit: number): Promise<Gem[]> {
    const docs = await GemModel.find({
      'place.location': {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [center.longitude, center.latitude] },
          $maxDistance: radius,
        },
      },
    }).limit(limit).lean<GemDoc[]>();

    return docs.map(fromDoc);
  }

  /**
   * @param bounds the map viewport (must not cross the antimeridian).
   * @param limit most Gems to return.
   * @returns Gems inside `bounds`, highest GemScore first.
   */
  async within(bounds: Bounds, limit: number): Promise<Gem[]> {
    const { south, west, north, east } = bounds;
    const docs = await GemModel.find({
      'place.location': {
        $geoWithin: {
          $geometry: {
            type: 'Polygon',
            coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
          },
        },
      },
    }).sort({ score: -1, _id: 1 }).limit(limit).lean<GemDoc[]>();

    return docs.map(fromDoc);
  }

  /**
   * @param limit most Gems to return.
   * @param near if given, only Gems within `near.radius` metres of `near.center`.
   * @returns the most recently added Gems, newest first.
   */
  async newest(limit: number, near?: { center: LatLng; radius: number }): Promise<Gem[]> {
    // $centerSphere rather than $nearSphere, which would sort by distance instead of age.
    const filter = near
      ? {
        'place.location': {
          $geoWithin: {
            $centerSphere: [[near.center.longitude, near.center.latitude], near.radius / EARTH_RADIUS_M],
          },
        },
      }
      : {};
    const docs = await GemModel.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).lean<GemDoc[]>();
    return docs.map(fromDoc);
  }

  /**
   * @param name Gem name.
   * @returns the stored Google Places photo name of the Gem, or `undefined` if none is stored (or there is no such Gem).
   */
  async getPhotoName(name: string): Promise<string | undefined> {
    const doc = await GemModel.findOne({ name }, { 'place.photoName': 1 })
      .lean<{ place?: { photoName?: string | null } }>();
    return nonEmpty(doc?.place?.photoName);
  }

  /**
   * Stores the Google Places photo name of a Gem, leaving everything else as stored.
   *
   * @param name Gem name.
   * @param photoName Google Places photo resource name.
   */
  async setPhotoName(name: string, photoName: string): Promise<void> {
    await GemModel.updateOne({ name }, { $set: { 'place.photoName': photoName } });
  }

  /**
   * @param names Gem names.
   * @returns the stored Gems among them, in no particular order.
   */
  async getMany(names: string[]): Promise<Gem[]> {
    if (names.length === 0) {
      return [];
    }

    const docs = await GemModel.find({ name: { $in: names } }).lean<GemDoc[]>();
    return docs.map(fromDoc);
  }

  /**
   * Takes the next rating sequence number of a Gem, atomically, so concurrent ratings get different ones.
   *
   * @param name Gem name.
   * @returns the new sequence number (1 for the first rating), or `undefined` if there is no such Gem.
   */
  async nextRatingSeq(name: string): Promise<number | undefined> {
    const doc = await GemModel.findOneAndUpdate(
      { name },
      { $inc: { ratingSeq: 1 } },
      { returnDocument: 'after', projection: { ratingSeq: 1 } },
    ).lean<{ ratingSeq?: number | null }>();

    return doc?.ratingSeq ?? undefined;
  }

  /**
   * Stores a Gem's GemScore and the values it was computed from, leaving everything else as stored.
   * `$set` rather than a replace, so `createdAt` (used by the newest-Gems list) is kept.
   * A value that is now `undefined` (e.g. the last rating was removed) is unset.
   *
   * @param gem the rescored Gem.
   * @param ratingSeq with rating totals from `nextRatingSeq`: only store them if no rating with a later
   *   sequence number has stored its totals yet (its recount already includes this rating).
   * @returns `false` if nothing was stored because a later rating's totals already are (or the Gem is gone).
   */
  async saveScore(gem: Gem, ratingSeq?: number): Promise<boolean> {
    const fields = {
      score: gem.getScore(),
      scoreTime: gem.getScoreTime(),
      nicheness: gem.getNicheness(),
      ratingCount: gem.getRatingCount(),
      ratingAverage: gem.getRatingAverage(),
    };
    const unset = Object.fromEntries(Object.entries(fields).filter(entry => entry[1] === undefined).map(entry => [entry[0], 1]));

    const filter = ratingSeq === undefined
      ? { name: gem.name }
      : { name: gem.name, $or: [{ ratingSeqApplied: { $lt: ratingSeq } }, { ratingSeqApplied: { $exists: false } }] };
    const set = ratingSeq === undefined ? definedOnly(fields) : { ...definedOnly(fields), ratingSeqApplied: ratingSeq };

    const res = await GemModel.updateOne(
      filter,
      { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
    );

    return res.matchedCount > 0;
  }

}
