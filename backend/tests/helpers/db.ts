import os from 'node:os';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

import { CommentModel } from '../../src/models/commentModel';
import { GemModel } from '../../src/models/gemModel';
import { UserModel } from '../../src/models/userModel';

/**
 * A real MongoDB for no-mock tests, running in memory for one test file.
 * The first run downloads MongoDB (cached afterwards), so `startDb` gets a long timeout.
 */

/** Timeout for `beforeAll(startDb, …)`: long enough for the first MongoDB download. */
export const DB_START_TIMEOUT_MS = 120_000;

let mongo: MongoMemoryServer | undefined;

/** Starts MongoDB, connects Mongoose to it, and builds every index (the geo queries need the 2dsphere one). */
export async function startDb(): Promise<void> {
  mongo = await MongoMemoryServer.create();
  // The MongoDB driver loads `os` with a dynamic import(), which Jest's sandbox doesn't support; without
  // it the driver's handshake is incomplete and MongoDB rejects the connection. Passing `os` avoids that.
  await mongoose.connect(mongo.getUri(), { runtimeAdapters: { os } });
  await Promise.all([GemModel.init(), CommentModel.init(), UserModel.init()]);
}

/** Empties every collection, keeping the indexes. */
export async function clearDb(): Promise<void> {
  await Promise.all([GemModel.deleteMany({}), CommentModel.deleteMany({}), UserModel.deleteMany({})]);
}

/** Disconnects Mongoose and stops MongoDB. */
export async function stopDb(): Promise<void> {
  await mongoose.disconnect();
  await mongo?.stop();
}

/** A point, in degrees. */
export interface Point { latitude: number; longitude: number }

/** UBC, and points at known distances from it. */
export const UBC: Point = { latitude: 49.2606, longitude: -123.246 };
/** ~1.1 km north of UBC. */
export const NEAR_UBC: Point = { latitude: 49.2706, longitude: -123.246 };
/** Downtown Vancouver, ~9.3 km from UBC. */
export const DOWNTOWN: Point = { latitude: 49.2827, longitude: -123.1207 };

/** Fixed score time for seeded Gems, so responses are predictable. */
export const SEED_SCORE_TIME = 1_761_868_800_000;

/**
 * Stores a Gem directly in the database, bypassing Google Places.
 *
 * @param placeId the place ID; the Gem is named `places/<placeId>`.
 * @param at where the Gem is.
 * @param score its GemScore; omitted if undefined.
 * @returns the Gem's name.
 */
export async function seedGem(placeId: string, at: Point, score?: number): Promise<string> {
  const name = `places/${placeId}`;
  await GemModel.create({
    name,
    place: { name, displayName: placeId, location: { type: 'Point', coordinates: [at.longitude, at.latitude] } },
    ...(score === undefined ? {} : { score, scoreTime: SEED_SCORE_TIME }),
  });
  return name;
}
