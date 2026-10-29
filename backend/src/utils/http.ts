import type { RequestHandler } from "express";

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
