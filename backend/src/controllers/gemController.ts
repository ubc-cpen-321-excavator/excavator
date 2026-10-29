import express from "express";
import GemService, { InvalidPlaceError, isValidGemName } from "../services/gemService";
import { alphnumDashOnly } from "../utils/trust";
import { createCommentRouter } from "./commentController";

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
 * POST /gem with JSON body `{ name: 'places/<place ID>' }`
 *
 * Adds the place as a Gem, after checking it exists on Google Places.
 * - 200 `{ added: true }`: the Gem was added.
 * - 200 `{ added: false }`: a Gem with that name already exists; nothing changed.
 * - 400 `{ message: 'Invalid place name.' }`: `name` is missing or not `places/<place ID>`.
 * - 400 `{ message: 'Place does not exist.' }`: Google Places has no such place.
 * - 500 `{ message: 'Add Gem failed.' }`: database or Google Places error.
 */
gemRouter.post('/', async (req, res) => {
  const name: unknown = req.body?.name;
  if (!isValidGemName(name)) {
    res.status(400).json({ message: 'Invalid place name.' });
    return;
  }

  try {
    // TODO reqSession, then fill user ID
    const added = await gemService.addGem(name, '37');

    // NOTE can also use codes like 201, 409
    res.json({ added });
  } catch (err) {
    if (err instanceof InvalidPlaceError) {
      // Client is supposed to supply valid place name, so 400
      res.status(400).json({ message: 'Place does not exist.' });
      return;
    }

    console.log(`Add Gem failed: ${alphnumDashOnly(err)}`);
    res.status(500).json({ message: 'Add Gem failed.' });
  }
});
