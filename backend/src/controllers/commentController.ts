import express, { type Request, type Response } from "express";
import CommentService, { NoSuchGemError, isValidCommentBody } from "../services/commentService";
import { currentUser } from "../services/authService";
import GemService, { gemNameFromPlaceId } from "../services/gemService";
import type { ParamsDictionary } from "express-serve-static-core";
import { asyncHandler, methodNotAllowed } from "../utils/http";
import { logError } from "../utils/log";
import { authService } from "./authController";

/** Route parameters inherited from the parent route `/gem/:pk`; `pk` is the Gem's place ID. */
interface GemParams extends ParamsDictionary {
  pk: string;
}

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
   * - 200 `[{ id, body, author, authorName }, ...]`: the comments; `[]` if there are none.
   *   `author` / `authorName` are absent on comments written before authors were recorded.
   * - 400 `{ message: 'Invalid Gem ID.' }`: `pk` is not a place ID; the DB is not queried.
   * - 404 `{ message: 'No such Gem.' }`: no Gem has that place ID.
   * - 500 `{ message: 'Get comments failed.' }`: database error.
   */
  commentRouter.get('/', asyncHandler(async (req: Request<GemParams>, res: Response) => {
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

      logError('Get comments failed', err);
      res.status(500).json({ message: 'Get comments failed.' });
    }
  }));

  /**
   * POST /gem/:pk/comments with JSON body `{ body: '<comment text>' }`
   * Requires login: `Authorization: Bearer <token>`. The comment's author is the signed-in user.
   *
   * Adds a comment to the Gem whose place ID is `pk`.
   * - 201 `{ id, body, author, authorName }`: the new comment (body trimmed).
   * - 400 `{ message: 'Invalid Gem ID.' }`: `pk` is not a place ID.
   * - 400 `{ message: 'Invalid comment body.' }`: `body` is missing, not a string, blank, over 1000 characters, or has control characters.
   * - 401 `{ message }`: not signed in (see `AuthService.reqJwt`).
   * - 404 `{ message: 'No such Gem.' }`: no Gem has that place ID; nothing is stored.
   * - 500 `{ message: 'Add comment failed.' }`: database error.
   */
  commentRouter.post('/', authService.reqJwt, asyncHandler(async (req: Request<GemParams>, res: Response) => {
    const gem = gemNameFromPlaceId(req.params.pk);
    if (!gem) {
      res.status(400).json({ message: 'Invalid Gem ID.' });
      return;
    }

    const { body } = (req.body ?? {}) as { body?: unknown };
    if (!isValidCommentBody(body)) {
      res.status(400).json({ message: 'Invalid comment body.' });
      return;
    }

    try {
      const user = currentUser(req);
      const comment = await commentService.addComment(gem, body, { id: user.id, name: user.getDisplayName() });
      res.status(201).json(comment);
    } catch (err) {
      // The body was validated above, so the service's InvalidCommentError cannot happen here.
      if (err instanceof NoSuchGemError) {
        res.status(404).json({ message: 'No such Gem.' });
        return;
      }

      logError('Add comment failed', err);
      res.status(500).json({ message: 'Add comment failed.' });
    }
  }));

  commentRouter.all('/', methodNotAllowed(['GET', 'POST']));

  return commentRouter;
}
