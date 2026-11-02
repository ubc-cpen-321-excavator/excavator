import express, { type Request, type Response } from "express";
import { currentUser } from "../services/authService";
import FavoriteService, { TooManyFavoritesError } from "../services/favoriteService";
import { NoSuchGemError, gemNameFromPlaceId, isValidGemName } from "../services/gemService";
import { methodNotAllowed } from "../utils/http";
import { alphnumDashOnly } from "../utils/trust";
import { authService } from "./authController";
import { gemService } from "./gemController";

/**
 * Routes mounted at `/user/favorites`: the signed-in user's favorite Gems.
 * Every route requires login (`Authorization: Bearer <token>`) and acts on that user's own list,
 * so no user ID appears in the URL and nobody can read or change someone else's favorites.
 */
export const favoriteRouter = express.Router();

const favoriteService = new FavoriteService(gemService);

favoriteRouter.use(authService.reqJwt);

/**
 * GET /user/favorites
 *
 * Gets the signed-in user's favorite Gems, most recently added first.
 * - 200 `[Gem, ...]`: `[]` if there are none.
 * - 401 `{ message }`: not signed in (see `AuthService.reqJwt`).
 * - 500 `{ message: 'Get favorites failed.' }`: database error.
 */
favoriteRouter.get('/', async (req, res) => {
  try {
    res.json(await favoriteService.getFavorites(currentUser(req).id));
  } catch (err) {
    console.log(`Get favorites failed: ${alphnumDashOnly(err)}`);
    res.status(500).json({ message: 'Get favorites failed.' });
  }
});

/**
 * POST /user/favorites with JSON body `{ gem: 'places/<place ID>' }`
 *
 * Adds a Gem to the signed-in user's favorites.
 * - 201 `{ gem }`: added.
 * - 200 `{ gem }`: it already was a favorite; nothing changed.
 * - 400 `{ message: 'Invalid Gem name.' }`: `gem` is missing or not `places/<place ID>`.
 * - 401 `{ message }`: not signed in.
 * - 404 `{ message: 'No such Gem.' }`: no Gem has that name.
 * - 409 `{ message: 'Too many favorites.' }`: the user already has 500 favorites.
 * - 500 `{ message: 'Add favorite failed.' }`: database error.
 */
favoriteRouter.post('/', async (req, res) => {
  const gem: unknown = req.body?.gem;
  if (!isValidGemName(gem)) {
    res.status(400).json({ message: 'Invalid Gem name.' });
    return;
  }

  try {
    const added = await favoriteService.addFavorite(currentUser(req).id, gem);
    res.status(added ? 201 : 200).json({ gem });
  } catch (err) {
    if (err instanceof NoSuchGemError) {
      res.status(404).json({ message: 'No such Gem.' });
      return;
    }
    if (err instanceof TooManyFavoritesError) {
      res.status(409).json({ message: 'Too many favorites.' });
      return;
    }

    console.log(`Add favorite failed: ${alphnumDashOnly(err)}`);
    res.status(500).json({ message: 'Add favorite failed.' });
  }
});

/**
 * DELETE /user/favorites/:placeId
 *
 * Removes a Gem from the signed-in user's favorites. `placeId` is the Gem's place ID (its name
 * without `places/`), since the name's slash can't go in a URL segment.
 * - 204: removed.
 * - 400 `{ message: 'Invalid Gem ID.' }`: `placeId` is not a place ID.
 * - 401 `{ message }`: not signed in.
 * - 404 `{ message: 'Not a favorite.' }`: the Gem isn't in the user's favorites.
 * - 500 `{ message: 'Remove favorite failed.' }`: database error.
 */
favoriteRouter.delete('/:placeId', async (req: Request<{ placeId: string }>, res: Response) => {
  const gem = gemNameFromPlaceId(req.params.placeId);
  if (!gem) {
    res.status(400).json({ message: 'Invalid Gem ID.' });
    return;
  }

  try {
    if (await favoriteService.removeFavorite(currentUser(req).id, gem)) {
      res.status(204).end();
    } else {
      res.status(404).json({ message: 'Not a favorite.' });
    }
  } catch (err) {
    console.log(`Remove favorite failed: ${alphnumDashOnly(err)}`);
    res.status(500).json({ message: 'Remove favorite failed.' });
  }
});

favoriteRouter.all('/', methodNotAllowed(['GET', 'POST']));
favoriteRouter.all('/:placeId', methodNotAllowed(['DELETE']));
