import express from "express";
import { InvalidPlaceTypeError, PlacesUnavailableError, parsePlaceTypes } from "../services/gemService";
import { toLatLng } from "../utils/geo";
import { asyncHandler, methodNotAllowed } from "../utils/http";
import { logError } from "../utils/log";
import { gemService } from "./gemController";

/** Routes mounted at `/place`: Google Places lookups that are not Gems yet. */
export const placeRouter = express.Router();

/**
 * GET /place/nearby?lat=…&lng=…[&type=cafe,park]
 *
 * Lists the places within 200 m of the user that they could add as a Gem, nearest first, for
 * places that aren't labelled on the map. The user picks one and the app sends `POST /gem`
 * with its `name`. `lat` / `lng` are the user's current location. `type` optionally limits the
 * search to one or more Google Places types (e.g. `cafe`, `park`), comma-separated
 * (`type=cafe,park`) or repeated (`type=cafe&type=park`); a place matching any of them is listed.
 * - 200 `[{ name, displayName, type?, address?, latitude, longitude, distance, isGem }, ...]`
 *   (up to 20; `distance` in metres; `[]` if there are none).
 * - 400 `{ message: 'Invalid location.' }`: `lat` / `lng` missing or out of range.
 * - 400 `{ message: 'Invalid place type.' }`: a type is empty, malformed or unknown to Google, or there are more than 50.
 * - 500 `{ message: 'Nearby search failed.' }`: database error.
 * - 502 `{ message: 'Google Places unavailable.' }`: Google Places failed.
 */
placeRouter.get('/nearby', asyncHandler(async (req, res) => {
  const location = toLatLng(req.query.lat, req.query.lng);
  if (!location) {
    res.status(400).json({ message: 'Invalid location.' });
    return;
  }

  const types = parsePlaceTypes(req.query.type);
  if (!types) {
    res.status(400).json({ message: 'Invalid place type.' });
    return;
  }

  try {
    res.json(await gemService.findNearbyPlaces(location, types));
  } catch (err) {
    if (err instanceof InvalidPlaceTypeError) {
      res.status(400).json({ message: 'Invalid place type.' });
      return;
    }
    if (err instanceof PlacesUnavailableError) {
      logError('Nearby search failed, Google Places', err.cause);
      res.status(502).json({ message: 'Google Places unavailable.' });
      return;
    }

    logError('Nearby search failed', err);
    res.status(500).json({ message: 'Nearby search failed.' });
  }
}));

placeRouter.all('/nearby', methodNotAllowed(['GET']));
