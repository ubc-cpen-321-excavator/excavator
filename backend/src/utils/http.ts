import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

/**
 * Makes a handler that answers 405 Method Not Allowed, with the `Allow` header listing the methods the path supports.
 * Register it with `router.all(path, ...)` after the path's real handlers, so it only runs for other methods.
 *
 * @param allowed the methods the path supports, e.g. `['GET', 'POST']`.
 * @returns the handler.
 */
export function methodNotAllowed(allowed: string[]): RequestHandler {
  const allow = allowed.join(', ');

  return (_req, res) => {
    res.set('Allow', allow).status(405).json({ message: 'Method not allowed.' });
  };
}

/**
 * Wraps an `async` route handler so Express gets a plain (void) handler.
 * If the handler's promise rejects, the error goes to `next`, so the app's error handler answers 500.
 *
 * @param handler the `async` handler. It should answer the request itself, including its own errors.
 * @returns the handler to register on the router.
 */
export function asyncHandler<P = ParamsDictionary>(
  handler: (req: Request<P>, res: Response) => Promise<void>,
): RequestHandler<P> {
  return (req: Request<P>, res: Response, next: NextFunction) => {
    handler(req, res).catch((err: unknown) => {
      next(err);
    });
  };
}
