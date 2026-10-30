import express from "express";
import GemService, {
  GEM_LIST_DEFAULT,
  GEM_LIST_MAX,
  GEM_NEARBY_RADIUS_DEFAULT_M,
  GEM_NEARBY_RADIUS_MAX_M,
  GemExistsError,
  InvalidPlaceError,
  PlacesUnavailableError,
  TooFarError,
  isValidGemName,
} from "../services/gemService";
import { toBounds, toIntInRange, toLatLng } from "../utils/geo";
import { methodNotAllowed } from "../utils/http";
import { alphnumDashOnly } from "../utils/trust";
import { createCommentRouter } from "./commentController";
import { feedService } from "./feedController";

/** Routes mounted at `/gem`. */
export const gemRouter = express.Router();

export const gemService = new GemService();

/** Nested router: a Gem's comments at `/gem/:pk/comments`, where `pk` is the Gem's place ID. */
gemRouter.use('/:pk/comments', createCommentRouter(gemService));

/**
 * GET /gem?name=places/<place ID>
 *
 * Gets a Gem by name.
 * - 200: the Gem.
 * - 400 `{ message: 'Invalid Gem name.' }`: `name` is missing or not `places/<place ID>`; the DB is not queried.
 * - 404 `{ message: 'No such Gem.' }`: no Gem has that name.
 * - 500 `{ message: 'Get Gem failed.' }`: database error.
 */
gemRouter.get('/', (req, res) => {
  const { name } = req.query;
  if (!isValidGemName(name)) {
    res.status(400).json({ message: 'Invalid Gem name.' });
    return;
  }

  gemService.getGem(name)
    .then(gem => {
      if (!gem) {
        res.status(404).json({ message: 'No such Gem.' });
        return;
      }

      res.json(gem);
    })
    .catch(err => {
      console.log(`Get Gem failed: ${alphnumDashOnly(err)}`);
      res.status(500).json({ message: 'Get Gem failed.' });
    });
});

/**
 * POST /gem with JSON body `{ name: 'places/<place ID>', latitude, longitude }`
 *
 * Adds the place as a Gem, after checking it exists on Google Places and is within
 * 200 m of the user. `latitude` / `longitude` are the user's current location. The new Gem is scored
 * and pushed to live-feed clients near it.
 * - 201 the new Gem, with a `Location` header pointing at `GET /gem?name=…`.
 * - 400 `{ message: 'Invalid place name.' }`: `name` is missing or not `places/<place ID>`.
 * - 400 `{ message: 'Invalid location.' }`: `latitude` / `longitude` missing or out of range.
 * - 409 `{ message: 'Gem already exists.' }`: a Gem with that name exists; nothing changed.
 * - 422 `{ message: 'Place does not exist.' }`: Google Places has no such place.
 * - 422 `{ message: 'Too far from place.' }`: the place is more than 200 m from the user.
 * - 500 `{ message: 'Add Gem failed.' }`: database error.
 * - 502 `{ message: 'Google Places unavailable.' }`: Google Places failed; nothing is stored.
 */
gemRouter.post('/', async (req, res) => {
  const name: unknown = req.body?.name;
  if (!isValidGemName(name)) {
    res.status(400).json({ message: 'Invalid place name.' });
    return;
  }

  const userLocation = toLatLng(req.body?.latitude, req.body?.longitude);
  if (!userLocation) {
    res.status(400).json({ message: 'Invalid location.' });
    return;
  }

  try {
    // TODO reqSession, then fill user ID
    const gem = await gemService.addGem(name, '37', userLocation);

    // The Gem is stored either way, so a feed failure must not fail the request.
    try {
      feedService.publishGemAdded(gem);
    } catch (err) {
      console.log(`Live feed publish failed: ${alphnumDashOnly(err)}`);
    }

    res.status(201).location(`/gem?name=${encodeURIComponent(gem.name)}`).json(gem);
  } catch (err) {
    if (err instanceof GemExistsError) {
      res.status(409).json({ message: 'Gem already exists.' });
      return;
    }
    // Well-formed request whose content can't be accepted, so 422 rather than 400 or 404
    if (err instanceof InvalidPlaceError) {
      res.status(422).json({ message: 'Place does not exist.' });
      return;
    }
    if (err instanceof TooFarError) {
      res.status(422).json({ message: 'Too far from place.' });
      return;
    }
    if (err instanceof PlacesUnavailableError) {
      console.log(`Add Gem failed, Google Places: ${alphnumDashOnly(err.cause)}`);
      res.status(502).json({ message: 'Google Places unavailable.' });
      return;
    }

    console.log(`Add Gem failed: ${alphnumDashOnly(err)}`);
    res.status(500).json({ message: 'Add Gem failed.' });
  }
});

/**
 * GET /gem/nearby?lat=…&lng=…[&radius=metres][&limit=n]
 *
 * Gets the Gems around a point, nearest first. For the discovery map and the dashboard.
 * `radius` defaults to 5000 (max 50000); `limit` defaults to 20 (max 50).
 * - 200 `[Gem, ...]`
 * - 400 `{ message: 'Invalid location.' }`: `lat` / `lng` missing or out of range.
 * - 400 `{ message: 'Invalid radius.' }` / `{ message: 'Invalid limit.' }`: not a whole number in range.
 * - 500 `{ message: 'Get Gems failed.' }`: database error.
 */
gemRouter.get('/nearby', async (req, res) => {
  const center = toLatLng(req.query.lat, req.query.lng);
  if (!center) {
    res.status(400).json({ message: 'Invalid location.' });
    return;
  }

  const radius = toIntInRange(req.query.radius, GEM_NEARBY_RADIUS_DEFAULT_M, 1, GEM_NEARBY_RADIUS_MAX_M);
  if (radius === undefined) {
    res.status(400).json({ message: 'Invalid radius.' });
    return;
  }

  const limit = toIntInRange(req.query.limit, GEM_LIST_DEFAULT, 1, GEM_LIST_MAX);
  if (limit === undefined) {
    res.status(400).json({ message: 'Invalid limit.' });
    return;
  }

  try {
    res.json(await gemService.getNearbyGems(center, radius, limit));
  } catch (err) {
    console.log(`Get nearby Gems failed: ${alphnumDashOnly(err)}`);
    res.status(500).json({ message: 'Get Gems failed.' });
  }
});

/**
 * GET /gem/within?south=…&west=…&north=…&east=…[&limit=n]
 *
 * Gets the Gems inside a map viewport, highest GemScore first. For the discovery map.
 * The viewport must not cross the antimeridian (west < east). `limit` defaults to 20 (max 50).
 * - 200 `[Gem, ...]`
 * - 400 `{ message: 'Invalid bounds.' }`: a value missing or out of range, south >= north, or west >= east.
 * - 400 `{ message: 'Invalid limit.' }`: not a whole number in range.
 * - 500 `{ message: 'Get Gems failed.' }`: database error.
 */
gemRouter.get('/within', async (req, res) => {
  const { south, west, north, east } = req.query;
  const bounds = toBounds(south, west, north, east);
  if (!bounds) {
    res.status(400).json({ message: 'Invalid bounds.' });
    return;
  }

  const limit = toIntInRange(req.query.limit, GEM_LIST_DEFAULT, 1, GEM_LIST_MAX);
  if (limit === undefined) {
    res.status(400).json({ message: 'Invalid limit.' });
    return;
  }

  try {
    res.json(await gemService.getGemsWithin(bounds, limit));
  } catch (err) {
    console.log(`Get Gems within bounds failed: ${alphnumDashOnly(err)}`);
    res.status(500).json({ message: 'Get Gems failed.' });
  }
});

/**
 * GET /gem/newest[?limit=n]
 *
 * Gets the most recently added Gems, newest first. For the dashboard.
 * `limit` defaults to 20 (max 50).
 * - 200 `[Gem, ...]`
 * - 400 `{ message: 'Invalid limit.' }`: not a whole number in range.
 * - 500 `{ message: 'Get Gems failed.' }`: database error.
 */
gemRouter.get('/newest', async (req, res) => {
  const limit = toIntInRange(req.query.limit, GEM_LIST_DEFAULT, 1, GEM_LIST_MAX);
  if (limit === undefined) {
    res.status(400).json({ message: 'Invalid limit.' });
    return;
  }

  try {
    res.json(await gemService.getNewestGems(limit));
  } catch (err) {
    console.log(`Get newest Gems failed: ${alphnumDashOnly(err)}`);
    res.status(500).json({ message: 'Get Gems failed.' });
  }
});

// Other methods on these paths
gemRouter.all('/', methodNotAllowed(['GET', 'POST']));
gemRouter.all('/nearby', methodNotAllowed(['GET']));
gemRouter.all('/within', methodNotAllowed(['GET']));
gemRouter.all('/newest', methodNotAllowed(['GET']));
