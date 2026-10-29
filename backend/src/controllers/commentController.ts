import express, { type Request, type Response } from "express";
import CommentService, { NoSuchGemError, isValidCommentBody } from "../services/commentService";
import GemService, { gemNameFromPlaceId } from "../services/gemService";
import { methodNotAllowed } from "../utils/http";
import { alphnumDashOnly } from "../utils/trust";

/** Route parameters inherited from the parent route `/gem/:pk`; `pk` is the Gem's place ID. */
type GemParams = { pk: string };

/**
 * Makes the router for a Gem's comments, to be nested in the Gem router at `/:pk/comments`.
 * Takes the Gem service rather than importing it, so the two controllers don't import each other.
 *
 * @param gemService the app's Gem service, used to check the Gem exists.
 * @returns a router with `mergeParams`, so its handlers see the parent's `:pk`.
 */
export function createCommentRouter(gemService: GemService): express.Router {
  const commentRouter = express.Router({ mergeParams: true });
  const commentService = new CommentService(gemService);

  /**
   * GET /gem/:pk/comments
   *
   * Gets every comment on the Gem whose place ID is `pk`, oldest first.
   * - 200 `[{ id, body }, ...]`: the comments; `[]` if there are none.
   * - 400 `{ message: 'Invalid Gem ID.' }`: `pk` is not a place ID; the DB is not queried.
   * - 404 `{ message: 'No such Gem.' }`: no Gem has that place ID.
   * - 500 `{ message: 'Get comments failed.' }`: database error.
   */
  commentRouter.get('/', async (req: Request<GemParams>, res: Response) => {
    const gem = gemNameFromPlaceId(req.params.pk);
    if (!gem) {
      res.status(400).json({ message: 'Invalid Gem ID.' });
      return;
    }

    try {
      const comments = await commentService.getComments(gem);
      res.json(comments);
    } catch (err) {
      if (err instanceof NoSuchGemError) {
        res.status(404).json({ message: 'No such Gem.' });
        return;
      }

      console.log(`Get comments failed: ${alphnumDashOnly(err)}`);
      res.status(500).json({ message: 'Get comments failed.' });
    }
  });

  /**
   * POST /gem/:pk/comments with JSON body `{ body: '<comment text>' }`
   *
   * Adds a comment to the Gem whose place ID is `pk`.
   * - 201 `{ id, body }`: the new comment (body trimmed).
   * - 400 `{ message: 'Invalid Gem ID.' }`: `pk` is not a place ID.
   * - 400 `{ message: 'Invalid comment body.' }`: `body` is missing, not a string, blank, over 1000 characters, or has control characters.
   * - 404 `{ message: 'No such Gem.' }`: no Gem has that place ID; nothing is stored.
   * - 500 `{ message: 'Add comment failed.' }`: database error.
   */
  commentRouter.post('/', async (req: Request<GemParams>, res: Response) => {
    const gem = gemNameFromPlaceId(req.params.pk);
    if (!gem) {
      res.status(400).json({ message: 'Invalid Gem ID.' });
      return;
    }

    const body: unknown = req.body?.body;
    if (!isValidCommentBody(body)) {
      res.status(400).json({ message: 'Invalid comment body.' });
      return;
    }

    try {
      // TODO reqSession, then record the author (Comment has only id and body for now)
      const comment = await commentService.addComment(gem, body);
      res.status(201).json(comment);
    } catch (err) {
      // The body was validated above, so the service's InvalidCommentError cannot happen here.
      if (err instanceof NoSuchGemError) {
        res.status(404).json({ message: 'No such Gem.' });
        return;
      }

      console.log(`Add comment failed: ${alphnumDashOnly(err)}`);
      res.status(500).json({ message: 'Add comment failed.' });
    }
  });

  commentRouter.all('/', methodNotAllowed(['GET', 'POST']));

  return commentRouter;
}
