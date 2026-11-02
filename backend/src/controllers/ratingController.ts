import express, { type Request, type Response } from "express";
import { currentUser } from "../services/authService";
import GemService, { NoSuchGemError, gemNameFromPlaceId } from "../services/gemService";
import RatingService, { isValidStars } from "../services/ratingService";
import { methodNotAllowed } from "../utils/http";
import { alphnumDashOnly } from "../utils/trust";
import { authService } from "./authController";
import { feedService } from "./feedController";

/** Route parameters inherited from the parent route `/gem/:pk`; `pk` is the Gem's place ID. */
type GemParams = { pk: string };

/**
 * Makes the router for the signed-in user's rating of a Gem, to be nested in the Gem router at `/:pk/rating`.
 * Every route requires login (`Authorization: Bearer <token>`).
 *
 * @param gemService the app's Gem service, used to check the Gem exists and rescore it.
 * @returns a router with `mergeParams`, so its handlers see the parent's `:pk`.
 */
export function createRatingRouter(gemService: GemService): express.Router {
  const ratingRouter = express.Router({ mergeParams: true });
  const ratingService = new RatingService(gemService);

  ratingRouter.use(authService.reqJwt);

  /**
   * GET /gem/:pk/rating
   *
   * Gets the signed-in user's rating of the Gem whose place ID is `pk`.
   * - 200 `{ stars }`
   * - 400 `{ message: 'Invalid Gem ID.' }`: `pk` is not a place ID.
   * - 401 `{ message }`: not signed in.
   * - 404 `{ message: 'No such Gem.' }` or `{ message: 'No rating.' }`: the Gem doesn't exist, or the user hasn't rated it.
   * - 500 `{ message: 'Get rating failed.' }`: database error.
   */
  ratingRouter.get('/', async (req: Request<GemParams>, res: Response) => {
    const gem = gemNameFromPlaceId(req.params.pk);
    if (!gem) {
      res.status(400).json({ message: 'Invalid Gem ID.' });
      return;
    }

    try {
      const stars = await ratingService.getRating(currentUser(req).id, gem);
      if (stars === undefined) {
        res.status(404).json({ message: 'No rating.' });
        return;
      }
      res.json({ stars });
    } catch (err) {
      if (err instanceof NoSuchGemError) {
        res.status(404).json({ message: 'No such Gem.' });
        return;
      }

      console.log(`Get rating failed: ${alphnumDashOnly(err)}`);
      res.status(500).json({ message: 'Get rating failed.' });
    }
  });

  /**
   * PUT /gem/:pk/rating with JSON body `{ stars }`
   *
   * Sets the signed-in user's 1–5 star rating of the Gem whose place ID is `pk`, replacing any
   * earlier one. The Gem's GemScore is recomputed, and the updated Gem is pushed to live-feed
   * clients near it as `{ type: 'gem.updated', gem }`.
   * - 200 `{ stars, gem }`: `gem` with its new `ratingCount`, `ratingAverage` and `score`.
   * - 400 `{ message: 'Invalid Gem ID.' }` or `{ message: 'Invalid stars.' }`: `stars` is not a whole number from 1 to 5.
   * - 401 `{ message }`: not signed in.
   * - 404 `{ message: 'No such Gem.' }`: nothing is stored.
   * - 500 `{ message: 'Rate Gem failed.' }`: database error.
   */
  ratingRouter.put('/', async (req: Request<GemParams>, res: Response) => {
    const gem = gemNameFromPlaceId(req.params.pk);
    if (!gem) {
      res.status(400).json({ message: 'Invalid Gem ID.' });
      return;
    }

    const stars: unknown = req.body?.stars;
    if (!isValidStars(stars)) {
      res.status(400).json({ message: 'Invalid stars.' });
      return;
    }

    try {
      const updated = await ratingService.rate(currentUser(req).id, gem, stars);

      // The rating is stored either way, so a feed failure must not fail the request.
      try {
        feedService.publishGemUpdated(updated);
      } catch (err) {
        console.log(`Live feed publish failed: ${alphnumDashOnly(err)}`);
      }

      res.json({ stars, gem: updated });
    } catch (err) {
      if (err instanceof NoSuchGemError) {
        res.status(404).json({ message: 'No such Gem.' });
        return;
      }

      console.log(`Rate Gem failed: ${alphnumDashOnly(err)}`);
      res.status(500).json({ message: 'Rate Gem failed.' });
    }
  });

  ratingRouter.all('/', methodNotAllowed(['GET', 'PUT']));

  return ratingRouter;
}
