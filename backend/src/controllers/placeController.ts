import express from "express";
import { InvalidPlaceTypeError, PlacesUnavailableError, isValidPlaceType } from "../services/gemService";
import { toLatLng } from "../utils/geo";
import { methodNotAllowed } from "../utils/http";
import { alphnumDashOnly } from "../utils/trust";
import { gemService } from "./gemController";

/** Routes mounted at `/place`: Google Places lookups that are not Gems yet. */
export const placeRouter = express.Router();

/**
 * GET /place/nearby?lat=…&lng=…[&type=cafe]
 *
 * Lists the places within 200 m of the user that they could add as a Gem, nearest first, for
 * places that aren't labelled on the map. The user picks one and the app sends `POST /gem`
 * with its `name`. `lat` / `lng` are the user's current location; `type` is an optional
 * Google Places type (e.g. `cafe`, `park`) to narrow a retry.
 * - 200 `[{ name, displayName, type?, address?, latitude, longitude, distance, isGem }, ...]`
 *   (up to 20; `distance` in metres; `[]` if there are none).
 * - 400 `{ message: 'Invalid location.' }`: `lat` / `lng` missing or out of range.
 * - 400 `{ message: 'Invalid place type.' }`: `type` malformed or unknown to Google.
 * - 500 `{ message: 'Nearby search failed.' }`: database error.
 * - 502 `{ message: 'Google Places unavailable.' }`: Google Places failed.
 */
placeRouter.get('/nearby', async (req, res) => {
  const location = toLatLng(req.query.lat, req.query.lng);
  if (!location) {
    res.status(400).json({ message: 'Invalid location.' });
    return;
  }

  const { type } = req.query;
  if (type !== undefined && !isValidPlaceType(type)) {
    res.status(400).json({ message: 'Invalid place type.' });
    return;
  }

  try {
    res.json(await gemService.findNearbyPlaces(location, type));
  } catch (err) {
    if (err instanceof InvalidPlaceTypeError) {
      res.status(400).json({ message: 'Invalid place type.' });
      return;
    }
    if (err instanceof PlacesUnavailableError) {
      console.log(`Nearby search failed, Google Places: ${alphnumDashOnly(err.cause)}`);
      res.status(502).json({ message: 'Google Places unavailable.' });
      return;
    }

    console.log(`Nearby search failed: ${alphnumDashOnly(err)}`);
    res.status(500).json({ message: 'Nearby search failed.' });
  }
});

placeRouter.all('/nearby', methodNotAllowed(['GET']));
